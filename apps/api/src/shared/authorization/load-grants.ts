import type { Principal } from '../context.js';
import { type Pool, withOrgContext } from '../database.js';
import { ApiError } from '../errors.js';
import { type Assignment, Grants } from './grants.js';

export interface LoadedGrants {
  grants: Grants;
  /** Start page of the highest-precedence role (§10.1); STORE when the user has no role. */
  homeWorkspace: string;
}

interface Row {
  roles_version: number;
  status: string;
  role_code: string | null;
  home_workspace: string | null;
  permissions: string[] | null;
  scope_location_ids: string[] | null;
  scope_department_ids: string[] | null;
  scope_category_ids: string[] | null;
}

/**
 * Loads the caller's current role assignments. Role changes bump `roles_version`; a token issued
 * before the change is refused here, so the client refreshes and gets the new permissions at once
 * instead of after the token expires (§30.3). Deactivated users are refused the same way.
 */
export async function loadGrants(
  pool: Pool,
  principal: Principal,
  timezone: string,
): Promise<LoadedGrants> {
  const rows = await assignmentRows(pool, principal.organizationId, principal.userId, timezone);

  const first = rows[0];
  if (!first || first.status !== 'ACTIVE' || first.roles_version !== principal.rolesVersion) {
    throw new ApiError('AUTH_TOKEN_EXPIRED', 'Your access has changed. Refreshing your session.', {
      reason: 'ROLES_CHANGED',
    });
  }
  return {
    grants: new Grants(principal.userId, principal.organizationId, toAssignments(rows)),
    homeWorkspace: rows.find((row) => row.home_workspace)?.home_workspace ?? 'STORE',
  };
}

/**
 * A user's current grants outside a request, e.g. for work the worker does on their behalf.
 * Null when the user is no longer active, so their queued work stops.
 */
export async function loadUserGrants(
  pool: Pool,
  organizationId: string,
  userId: string,
  timezone: string,
): Promise<Grants | null> {
  const rows = await assignmentRows(pool, organizationId, userId, timezone);
  if (rows[0]?.status !== 'ACTIVE') return null;
  return new Grants(userId, organizationId, toAssignments(rows));
}

function assignmentRows(pool: Pool, organizationId: string, userId: string, timezone: string) {
  return withOrgContext(pool, organizationId, async (client) => {
    const result = await client.query<Row>(
      `SELECT u.roles_version, u.status, r.code AS role_code, r.home_workspace,
              ur.scope_location_ids::text[] AS scope_location_ids,
              ur.scope_department_ids::text[] AS scope_department_ids,
              ur.scope_category_ids::text[] AS scope_category_ids,
              (SELECT array_agg(rp.permission_code) FROM identity.role_permission rp
               WHERE rp.role_id = r.id) AS permissions
       FROM identity.app_user u
       LEFT JOIN identity.user_role ur
         ON ur.user_id = u.id
        AND (ur.valid_from IS NULL OR ur.valid_from <= (now() AT TIME ZONE $2)::date)
        AND (ur.valid_to IS NULL OR ur.valid_to >= (now() AT TIME ZONE $2)::date)
       LEFT JOIN identity.role r ON r.id = ur.role_id AND r.status = 'ACTIVE'
       WHERE u.id = $1
       ORDER BY r.home_priority NULLS LAST`,
      [userId, timezone],
    );
    return result.rows;
  });
}

function toAssignments(rows: Row[]): Assignment[] {
  return rows
    .filter((row) => row.role_code)
    .map((row) => ({
      roleCode: row.role_code!,
      permissions: new Set(row.permissions ?? []),
      locationIds: row.scope_location_ids ?? [],
      departmentIds: row.scope_department_ids ?? [],
      categoryIds: row.scope_category_ids ?? [],
    }));
}
