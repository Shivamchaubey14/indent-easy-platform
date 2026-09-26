import { ApiError } from '../errors.js';

/*
 * Authorization model (SRS §31.1):
 *
 *   allowed = hasPermission(roles, permission)          RBAC
 *         AND inScope(role scopes, resource scope keys)  location / department / category
 *         AND policy(permission, resource, context)      the module's own predicate
 *
 * This file covers the first two; modules add their policy predicates next to their commands.
 */

/** One role assignment of the user, with the permissions its role grants. */
export interface Assignment {
  roleCode: string;
  permissions: ReadonlySet<string>;
  /** Empty means the whole organisation for that dimension. */
  locationIds: readonly string[];
  departmentIds: readonly string[];
  categoryIds: readonly string[];
}

/** Where a resource sits, for scope checks. Omit a dimension the resource doesn't have. */
export interface ScopeKeys {
  locationId?: string | null;
  departmentId?: string | null;
  categoryId?: string | null;
}

/** Location scope of a permission, for building list queries: everything, or these locations. */
export type LocationScope = { kind: 'all' } | { kind: 'some'; locationIds: readonly string[] };

const covers = (scope: readonly string[], key: string | null | undefined) =>
  scope.length === 0 || key === null || key === undefined || scope.includes(key);

/** What a signed-in user may do, loaded once per request. */
export class Grants {
  readonly permissions: readonly string[];

  constructor(
    readonly userId: string,
    readonly organizationId: string,
    readonly assignments: readonly Assignment[],
  ) {
    this.permissions = [...new Set(assignments.flatMap((a) => [...a.permissions]))].sort();
  }

  can(permission: string): boolean {
    return this.assignments.some((a) => a.permissions.has(permission));
  }

  /** Whether some assignment grants the permission for a resource in these scopes. */
  canAccess(permission: string, keys: ScopeKeys): boolean {
    return this.assignments.some(
      (a) =>
        a.permissions.has(permission) &&
        covers(a.locationIds, keys.locationId) &&
        covers(a.departmentIds, keys.departmentId) &&
        covers(a.categoryIds, keys.categoryId),
    );
  }

  /**
   * The locations a list query may return for a permission (§31.2: filter in SQL, never after
   * fetching). An assignment without location scope opens the whole organisation.
   */
  locationScope(permission: string): LocationScope {
    const granting = this.assignments.filter((a) => a.permissions.has(permission));
    if (granting.some((a) => a.locationIds.length === 0)) return { kind: 'all' };
    return { kind: 'some', locationIds: [...new Set(granting.flatMap((a) => a.locationIds))] };
  }
}

/**
 * The single authorization check for commands and queries (§31.2). Missing permission is
 * FORBIDDEN; a resource outside the user's scope is NOT_FOUND, so its existence doesn't leak.
 */
export function authorize(grants: Grants, permission: string, resource?: ScopeKeys): void {
  if (!grants.can(permission)) {
    throw new ApiError('FORBIDDEN', 'You do not have permission to do this.', { permission });
  }
  if (resource && !grants.canAccess(permission, resource)) {
    throw new ApiError('NOT_FOUND', 'Not found.');
  }
}
