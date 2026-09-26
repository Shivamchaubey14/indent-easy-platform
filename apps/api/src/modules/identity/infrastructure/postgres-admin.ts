import { appendEvent } from '../../../events/outbox.js';
import { recordAudit } from '../../../shared/audit.js';
import { currentContext } from '../../../shared/context.js';
import { type Pool, type PoolClient, withOrgContext } from '../../../shared/database.js';
import { tokenHash } from './secrets.js';

/** A unique value already in use: which input field it belongs to. */
export class DuplicateValue extends Error {
  constructor(readonly field: 'email' | 'employeeCode' | 'deliveryPointCode' | 'code') {
    super(`duplicate ${field}`);
    this.name = 'DuplicateValue';
  }
}

/** The record changed since the client read it (optimistic locking, SRS §26). */
export class VersionConflict extends Error {
  constructor() {
    super('version conflict');
    this.name = 'VersionConflict';
  }
}

export class RecordNotFound extends Error {
  constructor() {
    super('not found');
    this.name = 'RecordNotFound';
  }
}

const UNIQUE_FIELDS: Record<string, DuplicateValue['field']> = {
  uq_user_email: 'email',
  uq_user_employee_code: 'employeeCode',
  uq_user_delivery_point: 'deliveryPointCode',
  uq_role_code: 'code',
};

/** Turns unique-constraint violations into DuplicateValue; rethrows anything else. */
function rethrowDuplicate(err: unknown): never {
  const pgError = err as { code?: string; constraint?: string };
  const field = pgError.code === '23505' && pgError.constraint && UNIQUE_FIELDS[pgError.constraint];
  if (field) throw new DuplicateValue(field);
  throw err;
}

export interface Assignment {
  roleId: string;
  scopeLocationIds: string[];
  scopeDepartmentIds: string[];
  scopeCategoryIds: string[];
  validFrom: string | null;
  validTo: string | null;
}

export interface UserFields {
  displayName: string;
  mobile: string | null;
  employeeCode: string | null;
  designationId: string | null;
  departmentId: string | null;
  primaryLocationId: string | null;
  locationIds: string[];
  deliveryPointCode: string | null;
  preferredLocale: 'EN' | 'HI';
  reportsToId: string | null;
  status: string;
}

export type UserSnapshot = UserFields & { email: string; version: number; rolesVersion: number };

export interface RoleSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface UserListFilter {
  search?: string | null;
  status?: string[] | null;
  roleCodes?: string[] | null;
  locationIds?: string[] | null;
  departmentIds?: string[] | null;
}

interface Cursor {
  n: string;
  i: string;
}
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(value: string | null | undefined): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as Partial<Cursor>;
    return typeof parsed.n === 'string' && typeof parsed.i === 'string'
      ? { n: parsed.n, i: parsed.i }
      : null;
  } catch {
    return null;
  }
}

async function snapshot(client: PoolClient, userId: string): Promise<UserSnapshot | null> {
  const { rows } = await client.query<UserSnapshot>(
    `SELECT u.email, u.display_name AS "displayName", u.mobile_e164 AS mobile,
            u.employee_code AS "employeeCode", u.designation_id AS "designationId",
            u.department_id AS "departmentId", u.primary_location_id AS "primaryLocationId",
            ARRAY(SELECT l.location_id::text FROM identity.user_location l
                  WHERE l.user_id = u.id ORDER BY 1) AS "locationIds",
            u.delivery_point_code AS "deliveryPointCode", u.preferred_locale AS "preferredLocale",
            u.reports_to_id AS "reportsToId", u.status, u.version,
            u.roles_version AS "rolesVersion"
     FROM identity.app_user u WHERE u.id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

async function assignmentsOf(client: PoolClient, userId: string) {
  const { rows } = await client.query<Assignment & { roleCode: string }>(
    `SELECT ur.role_id AS "roleId", r.code AS "roleCode",
            ur.scope_location_ids::text[] AS "scopeLocationIds",
            ur.scope_department_ids::text[] AS "scopeDepartmentIds",
            ur.scope_category_ids::text[] AS "scopeCategoryIds",
            ur.valid_from::text AS "validFrom", ur.valid_to::text AS "validTo"
     FROM identity.user_role ur JOIN identity.role r ON r.id = ur.role_id
     WHERE ur.user_id = $1 ORDER BY r.code`,
    [userId],
  );
  return rows;
}

async function setLocations(client: PoolClient, userId: string, locationIds: string[]) {
  await client.query('DELETE FROM identity.user_location WHERE user_id = $1', [userId]);
  if (locationIds.length) {
    await client.query(
      `INSERT INTO identity.user_location (user_id, location_id)
       SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
      [userId, locationIds],
    );
  }
}

async function replaceAssignments(client: PoolClient, userId: string, assignments: Assignment[]) {
  const actor = currentContext()?.principal?.userId ?? null;
  await client.query('DELETE FROM identity.user_role WHERE user_id = $1', [userId]);
  for (const a of assignments) {
    await client.query(
      `INSERT INTO identity.user_role
         (user_id, role_id, scope_location_ids, scope_department_ids, scope_category_ids,
          valid_from, valid_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        a.roleId,
        a.scopeLocationIds,
        a.scopeDepartmentIds,
        a.scopeCategoryIds,
        a.validFrom,
        a.validTo,
        actor,
      ],
    );
  }
}

/** Bumps roles_version so the user's current tokens are refused and refreshed (§30.3). */
async function rolesChanged(client: PoolClient, organizationId: string, userIds: string[]) {
  for (const userId of userIds) {
    const { rows } = await client.query<{ roles_version: number; version: number }>(
      `UPDATE identity.app_user SET roles_version = roles_version + 1
       WHERE id = $1 RETURNING roles_version, version`,
      [userId],
    );
    const row = rows[0];
    if (!row) continue;
    const principal = currentContext()?.principal;
    await appendEvent(client, {
      eventType: 'UserRoleChanged',
      organizationId,
      aggregateType: 'User',
      aggregateId: userId,
      aggregateVersion: row.roles_version,
      payload: { userId, rolesVersion: row.roles_version },
      actor: principal ? { type: 'USER', id: principal.userId } : { type: 'SYSTEM' },
    });
  }
}

/** User and role administration (SRS §11.2). Every change is audited in its transaction. */
export class PostgresAdmin {
  constructor(private readonly pool: Pool) {}

  /** A page of user ids by name, with the total, for the admin list. */
  listUsers(
    organizationId: string,
    filter: UserListFilter,
    page: { first: number; after?: string | null },
  ) {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const where: string[] = [];
      const params: unknown[] = [];
      const add = (sql: string, value: unknown) => {
        params.push(value);
        where.push(sql.replaceAll('$?', `$${params.length}`));
      };
      if (filter.search?.trim()) {
        add(
          `(u.display_name ILIKE $? OR u.email::text ILIKE $? OR u.employee_code ILIKE $?)`,
          `%${filter.search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
        );
      }
      if (filter.status?.length) add('u.status = ANY($?)', filter.status);
      if (filter.roleCodes?.length) {
        add(
          `EXISTS (SELECT 1 FROM identity.user_role x JOIN identity.role r ON r.id = x.role_id
                   WHERE x.user_id = u.id AND r.code = ANY($?))`,
          filter.roleCodes,
        );
      }
      if (filter.locationIds?.length) {
        add(
          `(u.primary_location_id = ANY($?::uuid[]) OR EXISTS (
             SELECT 1 FROM identity.user_location l
             WHERE l.user_id = u.id AND l.location_id = ANY($?::uuid[])))`,
          filter.locationIds,
        );
      }
      if (filter.departmentIds?.length)
        add('u.department_id = ANY($?::uuid[])', filter.departmentIds);

      const filtered = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM identity.app_user u ${filtered}`,
        params,
      );
      const cursor = decodeCursor(page.after);
      const pageWhere = [...where];
      const pageParams = [...params];
      if (cursor) {
        pageParams.push(cursor.n, cursor.i);
        pageWhere.push(
          `(lower(u.display_name), u.id::text) > ($${pageParams.length - 1}, $${pageParams.length})`,
        );
      }
      pageParams.push(page.first + 1);
      const { rows } = await client.query<{ id: string; sort: string }>(
        `SELECT u.id, lower(u.display_name) AS sort FROM identity.app_user u
         ${pageWhere.length ? `WHERE ${pageWhere.join(' AND ')}` : ''}
         ORDER BY lower(u.display_name), u.id::text
         LIMIT $${pageParams.length}`,
        pageParams,
      );
      const pageRows = rows.slice(0, page.first);
      return {
        ids: pageRows.map((r) => r.id),
        cursors: pageRows.map((r) => encodeCursor({ n: r.sort, i: r.id })),
        totalCount: total.rows[0]?.count ?? 0,
        hasNextPage: rows.length > page.first,
        hasPreviousPage: cursor !== null,
      };
    });
  }

  roles(organizationId: string): Promise<RoleSummary[]> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<RoleSummary>(
        `SELECT r.id, r.code, r.name, r.description, r.is_system AS "isSystem",
                ARRAY(SELECT rp.permission_code FROM identity.role_permission rp
                      WHERE rp.role_id = r.id ORDER BY 1) AS permissions,
                (SELECT count(*)::int FROM identity.user_role x WHERE x.role_id = r.id) AS "userCount"
         FROM identity.role r WHERE r.status = 'ACTIVE'
         ORDER BY r.home_priority, r.name`,
      );
      return rows;
    });
  }

  async permissionCatalogue(): Promise<string[]> {
    const { rows } = await this.pool.query<{ code: string }>(
      'SELECT code FROM identity.permission ORDER BY code',
    );
    return rows.map((r) => r.code);
  }

  /** Active users other than `exceptUserId` who hold SUPER_ADMIN today. */
  activeSuperAdmins(organizationId: string, exceptUserId: string): Promise<number> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<{ count: number }>(
        `SELECT count(DISTINCT u.id)::int AS count
         FROM identity.app_user u
         JOIN identity.user_role ur ON ur.user_id = u.id
         JOIN identity.role r ON r.id = ur.role_id
         WHERE r.code = 'SUPER_ADMIN' AND u.status = 'ACTIVE' AND u.id <> $1
           AND (ur.valid_to IS NULL OR ur.valid_to >= current_date)`,
        [exceptUserId],
      );
      return rows[0]?.count ?? 0;
    });
  }

  /**
   * Creates an invited user (no password) with locations and roles. With `inviteToken`, a
   * single-use link lets them choose a password; it expires at `inviteExpiresAt`.
   */
  createUser(input: {
    organizationId: string;
    email: string;
    fields: UserFields;
    assignments: Assignment[];
    invite: { token: string; expiresAt: Date } | null;
  }): Promise<string> {
    const { organizationId, fields } = input;
    return withOrgContext(this.pool, organizationId, async (client) => {
      const actor = currentContext()?.principal?.userId ?? null;
      const inserted = await client
        .query<{ id: string }>(
          `INSERT INTO identity.app_user
             (organization_id, email, display_name, mobile_e164, employee_code, designation_id,
              department_id, primary_location_id, delivery_point_code, preferred_locale,
              reports_to_id, status, created_by)
           VALUES ($1, lower($2), $3, $4, $5, $6, $7, $8, $9, $10, $11, 'INVITED', $12)
           RETURNING id`,
          [
            organizationId,
            input.email,
            fields.displayName,
            fields.mobile,
            fields.employeeCode,
            fields.designationId,
            fields.departmentId,
            fields.primaryLocationId,
            fields.deliveryPointCode,
            fields.preferredLocale,
            fields.reportsToId,
            actor,
          ],
        )
        .catch(rethrowDuplicate);
      const userId = inserted.rows[0]!.id;
      await setLocations(client, userId, fields.locationIds);
      await replaceAssignments(client, userId, input.assignments);
      if (input.invite) {
        await client.query(
          `INSERT INTO identity.password_reset_token (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [userId, tokenHash(input.invite.token), input.invite.expiresAt],
        );
      }
      await recordAudit(client, {
        organizationId,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: userId,
        entityNumber: fields.employeeCode,
        after: {
          ...(await snapshot(client, userId)),
          roles: await assignmentsOf(client, userId),
        },
      });
      return userId;
    });
  }

  /** Updates profile fields and status; the action says what kind of change it was. */
  updateUser(input: {
    organizationId: string;
    userId: string;
    expectedVersion: number;
    fields: UserFields;
    action: string;
  }): Promise<{ before: UserSnapshot; after: UserSnapshot }> {
    const { organizationId, userId, fields } = input;
    return withOrgContext(this.pool, organizationId, async (client) => {
      const before = await snapshot(client, userId);
      if (!before) throw new RecordNotFound();
      if (before.version !== input.expectedVersion) throw new VersionConflict();
      await client
        .query(
          `UPDATE identity.app_user
           SET display_name = $2, mobile_e164 = $3, employee_code = $4, designation_id = $5,
               department_id = $6, primary_location_id = $7, delivery_point_code = $8,
               preferred_locale = $9, reports_to_id = $10, status = $11,
               updated_at = now(), updated_by = $12, version = version + 1
           WHERE id = $1`,
          [
            userId,
            fields.displayName,
            fields.mobile,
            fields.employeeCode,
            fields.designationId,
            fields.departmentId,
            fields.primaryLocationId,
            fields.deliveryPointCode,
            fields.preferredLocale,
            fields.reportsToId,
            fields.status,
            currentContext()?.principal?.userId ?? null,
          ],
        )
        .catch(rethrowDuplicate);
      await setLocations(client, userId, fields.locationIds);
      const after = (await snapshot(client, userId))!;
      await recordAudit(client, {
        organizationId,
        action: input.action,
        entityType: 'User',
        entityId: userId,
        entityNumber: after.employeeCode,
        before,
        after,
      });
      return { before, after };
    });
  }

  /** Replaces a user's role assignments. */
  setUserRoles(input: {
    organizationId: string;
    userId: string;
    expectedVersion: number;
    assignments: Assignment[];
  }): Promise<void> {
    const { organizationId, userId } = input;
    return withOrgContext(this.pool, organizationId, async (client) => {
      const user = await snapshot(client, userId);
      if (!user) throw new RecordNotFound();
      if (user.version !== input.expectedVersion) throw new VersionConflict();
      const before = await assignmentsOf(client, userId);
      await replaceAssignments(client, userId, input.assignments);
      await client.query(
        'UPDATE identity.app_user SET version = version + 1, updated_at = now() WHERE id = $1',
        [userId],
      );
      await rolesChanged(client, organizationId, [userId]);
      await recordAudit(client, {
        organizationId,
        action: 'USER_ROLE_CHANGED',
        entityType: 'User',
        entityId: userId,
        entityNumber: user.employeeCode,
        before: { roles: before },
        after: { roles: await assignmentsOf(client, userId) },
      });
    });
  }

  /** Clears a lockout (failed attempts, temporary lock, administrative LOCKED status). */
  unlockUser(organizationId: string, userId: string): Promise<void> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const before = await snapshot(client, userId);
      if (!before) throw new RecordNotFound();
      const lock = await client.query<{ locked_until: Date | null; failed_attempts: number }>(
        'SELECT locked_until, failed_attempts FROM identity.app_user WHERE id = $1',
        [userId],
      );
      await client.query(
        `UPDATE identity.app_user
         SET locked_until = NULL, failed_attempts = 0,
             status = CASE WHEN status = 'LOCKED' THEN 'ACTIVE' ELSE status END,
             updated_at = now(), version = version + 1
         WHERE id = $1`,
        [userId],
      );
      await recordAudit(client, {
        organizationId,
        action: 'USER_UNLOCKED',
        entityType: 'User',
        entityId: userId,
        entityNumber: before.employeeCode,
        before: { ...before, lockedUntil: lock.rows[0]?.locked_until ?? null },
        after: await snapshot(client, userId),
      });
    });
  }

  /**
   * Admin-initiated reset (AUTH-013): a new single-use link, earlier links void, and the current
   * password must be replaced at the next sign-in.
   */
  forcePasswordReset(input: {
    organizationId: string;
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const { organizationId, userId } = input;
    return withOrgContext(this.pool, organizationId, async (client) => {
      const before = await snapshot(client, userId);
      if (!before) throw new RecordNotFound();
      await client.query(
        `UPDATE identity.password_reset_token SET used_at = now()
         WHERE user_id = $1 AND used_at IS NULL`,
        [userId],
      );
      await client.query(
        `INSERT INTO identity.password_reset_token (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash(input.token), input.expiresAt],
      );
      await client.query(
        `UPDATE identity.app_user SET must_change_password = true, updated_at = now(),
                version = version + 1
         WHERE id = $1`,
        [userId],
      );
      await recordAudit(client, {
        organizationId,
        action: 'PASSWORD_RESET_FORCED',
        entityType: 'User',
        entityId: userId,
        entityNumber: before.employeeCode,
        before: { mustChangePassword: false },
        after: { mustChangePassword: true },
      });
    });
  }

  /** Creates or updates a role; holders' roles_version is bumped when permissions change. */
  saveRole(input: {
    organizationId: string;
    id: string | null;
    code: string;
    name: string;
    description: string | null;
    permissions: string[];
  }): Promise<string> {
    const { organizationId } = input;
    return withOrgContext(this.pool, organizationId, async (client) => {
      let roleId = input.id;
      let before: Record<string, unknown> | null = null;
      if (roleId) {
        const existing = await client.query<{
          code: string;
          name: string;
          description: string | null;
          is_system: boolean;
          permissions: string[];
        }>(
          `SELECT code, name, description, is_system,
                  ARRAY(SELECT permission_code FROM identity.role_permission
                        WHERE role_id = r.id ORDER BY 1) AS permissions
           FROM identity.role r WHERE id = $1 FOR UPDATE`,
          [roleId],
        );
        const row = existing.rows[0];
        if (!row) throw new RecordNotFound();
        before = {
          code: row.code,
          name: row.name,
          description: row.description,
          permissions: row.permissions,
        };
        await client
          .query(
            `UPDATE identity.role SET code = $2, name = $3, description = $4, updated_at = now(),
                    version = version + 1
             WHERE id = $1`,
            [roleId, row.is_system ? row.code : input.code, input.name, input.description],
          )
          .catch(rethrowDuplicate);
      } else {
        const created = await client
          .query<{ id: string }>(
            `INSERT INTO identity.role (organization_id, code, name, description, is_system)
             VALUES ($1, $2, $3, $4, false) RETURNING id`,
            [organizationId, input.code, input.name, input.description],
          )
          .catch(rethrowDuplicate);
        roleId = created.rows[0]!.id;
      }
      await client.query('DELETE FROM identity.role_permission WHERE role_id = $1', [roleId]);
      await client.query(
        `INSERT INTO identity.role_permission (role_id, permission_code)
         SELECT $1, code FROM identity.permission WHERE code = ANY($2)`,
        [roleId, input.permissions],
      );
      const after = await client.query<{
        code: string;
        name: string;
        description: string | null;
        permissions: string[];
      }>(
        `SELECT code, name, description,
                ARRAY(SELECT permission_code FROM identity.role_permission
                      WHERE role_id = r.id ORDER BY 1) AS permissions
         FROM identity.role r WHERE id = $1`,
        [roleId],
      );
      const permissionsChanged =
        !before ||
        JSON.stringify(before['permissions']) !== JSON.stringify(after.rows[0]?.permissions);
      if (before && permissionsChanged) {
        const holders = await client.query<{ user_id: string }>(
          'SELECT DISTINCT user_id FROM identity.user_role WHERE role_id = $1',
          [roleId],
        );
        await rolesChanged(
          client,
          organizationId,
          holders.rows.map((r) => r.user_id),
        );
      }
      await recordAudit(client, {
        organizationId,
        action: before ? 'ROLE_UPDATED' : 'ROLE_CREATED',
        entityType: 'Role',
        entityId: roleId,
        entityNumber: after.rows[0]?.code ?? null,
        before,
        after: after.rows[0] ?? null,
      });
      return roleId;
    });
  }

  /** Current snapshot for a user (for the service's checks). */
  userSnapshot(organizationId: string, userId: string): Promise<UserSnapshot | null> {
    return withOrgContext(this.pool, organizationId, (client) => snapshot(client, userId));
  }

  /** Permission codes of roles by id (to check that an admin isn't granting more than they hold). */
  rolePermissions(
    organizationId: string,
    roleIds: string[],
  ): Promise<Map<string, { code: string; permissions: string[] }>> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<{ id: string; code: string; permissions: string[] }>(
        `SELECT r.id, r.code,
                ARRAY(SELECT permission_code FROM identity.role_permission
                      WHERE role_id = r.id) AS permissions
         FROM identity.role r WHERE r.id = ANY($1::uuid[]) AND r.status = 'ACTIVE'`,
        [roleIds],
      );
      return new Map(rows.map((r) => [r.id, { code: r.code, permissions: r.permissions }]));
    });
  }
}
