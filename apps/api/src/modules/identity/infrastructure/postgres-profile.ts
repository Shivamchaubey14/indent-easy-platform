import type { UserRef } from '@ie/graphql';
import { type Pool, withOrgContext } from '../../../shared/database.js';

export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface RoleAssignmentRecord {
  role: RoleRecord;
  homeWorkspace: string | null;
  scopeLocationIds: string[];
  scopeDepartmentIds: string[];
  scopeCategoryIds: string[];
  validFrom: string | null;
  validTo: string | null;
  /** In force today (inside its validity window, role active). */
  effective: boolean;
}

/** A user as the GraphQL `User` resolvers see it: ids for things resolved from the directory. */
export interface UserRecord {
  id: string;
  email: string;
  mobile: string | null;
  displayName: string;
  employeeCode: string | null;
  designationId: string | null;
  departmentId: string | null;
  primaryLocationId: string | null;
  locationIds: string[];
  deliveryPointCode: string | null;
  preferredLocale: 'EN' | 'HI';
  status: string;
  reportsTo: UserRef | null;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: UserRef | null;
  updatedAt: string | null;
  updatedBy: UserRef | null;
  version: number;
  roles: RoleAssignmentRecord[];
}

export interface SessionRecord {
  id: string;
  deviceName: string | null;
  platform: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
}

const iso = (value: Date | null) => (value ? value.toISOString() : null);
const ref = (id: string | null, displayName: string | null, employeeCode: string | null) =>
  id && displayName ? { id, displayName, employeeCode } : null;

interface UserRow {
  id: string;
  email: string;
  mobile: string | null;
  display_name: string;
  employee_code: string | null;
  designation_id: string | null;
  department_id: string | null;
  primary_location_id: string | null;
  location_ids: string[];
  delivery_point_code: string | null;
  preferred_locale: 'EN' | 'HI';
  status: string;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
  version: number;
  mfa_enabled: boolean;
  manager_id: string | null;
  manager_name: string | null;
  manager_code: string | null;
  creator_id: string | null;
  creator_name: string | null;
  creator_code: string | null;
  updater_id: string | null;
  updater_name: string | null;
  updater_code: string | null;
}

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  home_workspace: string | null;
  permissions: string[];
  user_count: number;
  scope_location_ids: string[];
  scope_department_ids: string[];
  scope_category_ids: string[];
  valid_from: string | null;
  valid_to: string | null;
  effective: boolean;
}

/** Read models for the identity part of the GraphQL contract. */
export class PostgresProfiles {
  constructor(
    private readonly pool: Pool,
    private readonly timezone: string,
  ) {}

  user(organizationId: string, userId: string): Promise<UserRecord | null> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const users = await client.query<UserRow>(
        `SELECT u.id, u.email, u.mobile_e164 AS mobile, u.display_name, u.employee_code,
                u.designation_id, u.department_id, u.primary_location_id,
                ARRAY(SELECT l.location_id::text FROM identity.user_location l
                      WHERE l.user_id = u.id) AS location_ids,
                u.delivery_point_code, u.preferred_locale, u.status, u.last_login_at,
                u.created_at, u.updated_at, u.version,
                EXISTS (SELECT 1 FROM identity.mfa_factor f
                        WHERE f.user_id = u.id AND f.type = 'TOTP' AND f.confirmed_at IS NOT NULL)
                  AS mfa_enabled,
                m.id AS manager_id, m.display_name AS manager_name, m.employee_code AS manager_code,
                c.id AS creator_id, c.display_name AS creator_name, c.employee_code AS creator_code,
                p.id AS updater_id, p.display_name AS updater_name, p.employee_code AS updater_code
         FROM identity.app_user u
         LEFT JOIN identity.app_user m ON m.id = u.reports_to_id
         LEFT JOIN identity.app_user c ON c.id = u.created_by
         LEFT JOIN identity.app_user p ON p.id = u.updated_by
         WHERE u.id = $1`,
        [userId],
      );
      const row = users.rows[0];
      if (!row) return null;
      const roles = await client.query<RoleRow>(
        `SELECT r.id, r.code, r.name, r.description, r.is_system, r.home_workspace,
                ARRAY(SELECT rp.permission_code FROM identity.role_permission rp
                      WHERE rp.role_id = r.id ORDER BY 1) AS permissions,
                (SELECT count(*)::int FROM identity.user_role x WHERE x.role_id = r.id) AS user_count,
                ur.scope_location_ids::text[] AS scope_location_ids,
                ur.scope_department_ids::text[] AS scope_department_ids,
                ur.scope_category_ids::text[] AS scope_category_ids,
                ur.valid_from::text AS valid_from, ur.valid_to::text AS valid_to,
                r.status = 'ACTIVE'
                  AND (ur.valid_from IS NULL OR ur.valid_from <= (now() AT TIME ZONE $2)::date)
                  AND (ur.valid_to IS NULL OR ur.valid_to >= (now() AT TIME ZONE $2)::date)
                  AS effective
         FROM identity.user_role ur JOIN identity.role r ON r.id = ur.role_id
         WHERE ur.user_id = $1
         ORDER BY r.home_priority, r.code`,
        [userId, this.timezone],
      );
      return {
        id: row.id,
        email: row.email,
        mobile: row.mobile,
        displayName: row.display_name,
        employeeCode: row.employee_code,
        designationId: row.designation_id,
        departmentId: row.department_id,
        primaryLocationId: row.primary_location_id,
        locationIds: row.location_ids,
        deliveryPointCode: row.delivery_point_code,
        preferredLocale: row.preferred_locale,
        status: row.status,
        reportsTo: ref(row.manager_id, row.manager_name, row.manager_code),
        mfaEnabled: row.mfa_enabled,
        lastLoginAt: iso(row.last_login_at),
        createdAt: row.created_at.toISOString(),
        createdBy: ref(row.creator_id, row.creator_name, row.creator_code),
        updatedAt: iso(row.updated_at),
        updatedBy: ref(row.updater_id, row.updater_name, row.updater_code),
        version: row.version,
        roles: roles.rows.map((r) => ({
          role: {
            id: r.id,
            code: r.code,
            name: r.name,
            description: r.description,
            isSystem: r.is_system,
            permissions: r.permissions,
            userCount: r.user_count,
          },
          homeWorkspace: r.home_workspace,
          scopeLocationIds: r.scope_location_ids,
          scopeDepartmentIds: r.scope_department_ids,
          scopeCategoryIds: r.scope_category_ids,
          validFrom: r.valid_from,
          validTo: r.valid_to,
          effective: r.effective,
        })),
      };
    });
  }

  /** The user's sessions that can still be refreshed, most recently used first. */
  async sessions(userId: string): Promise<SessionRecord[]> {
    const { rows } = await this.pool.query<{
      id: string;
      device_name: string | null;
      platform: string | null;
      ip: string | null;
      created_at: Date;
      last_seen_at: Date;
    }>(
      `SELECT id, device_name, platform, host(ip) AS ip, created_at, last_seen_at
       FROM identity.session
       WHERE user_id = $1 AND revoked_at IS NULL
         AND idle_expires_at > now() AND absolute_expires_at > now()
       ORDER BY last_seen_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      deviceName: r.device_name,
      platform: r.platform,
      ip: r.ip,
      createdAt: r.created_at.toISOString(),
      lastSeenAt: r.last_seen_at.toISOString(),
    }));
  }
}
