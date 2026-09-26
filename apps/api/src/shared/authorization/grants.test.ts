import { describe, expect, it } from 'vitest';
import type { ApiError } from '../errors.js';
import { type Assignment, authorize, Grants } from './grants.js';

const assignment = (
  roleCode: string,
  permissions: string[],
  scope: Partial<Pick<Assignment, 'locationIds' | 'departmentIds' | 'categoryIds'>> = {},
): Assignment => ({
  roleCode,
  permissions: new Set(permissions),
  locationIds: scope.locationIds ?? [],
  departmentIds: scope.departmentIds ?? [],
  categoryIds: scope.categoryIds ?? [],
});

const store = assignment('STORE_USER', ['indent:create', 'indent:read'], {
  locationIds: ['bmc-1', 'bmc-2'],
});
const hod = assignment('HOD', ['indent:read', 'approval:act'], { departmentIds: ['dairy'] });

describe('grants', () => {
  const grants = new Grants('u1', 'org', [store, hod]);

  it('unions the permissions of every role', () => {
    expect(grants.permissions).toEqual(['approval:act', 'indent:create', 'indent:read']);
    expect(grants.can('approval:act')).toBe(true);
    expect(grants.can('purchase_order:approve')).toBe(false);
  });

  it('checks the resource against the scope of the roles that grant the permission', () => {
    expect(grants.canAccess('indent:create', { locationId: 'bmc-1' })).toBe(true);
    expect(grants.canAccess('indent:create', { locationId: 'bmc-9' })).toBe(false);
    // indent:read comes from both roles: the HOD's department scope opens bmc-9 for dairy only.
    expect(grants.canAccess('indent:read', { locationId: 'bmc-9', departmentId: 'dairy' })).toBe(
      true,
    );
    expect(grants.canAccess('indent:read', { locationId: 'bmc-9', departmentId: 'feed' })).toBe(
      false,
    );
  });

  it('turns scopes into a location filter for list queries', () => {
    expect(grants.locationScope('indent:create')).toEqual({
      kind: 'some',
      locationIds: ['bmc-1', 'bmc-2'],
    });
    // The HOD assignment has no location scope, so indents can be read at every location
    // (the department scope still applies through canAccess and the module's filter).
    expect(grants.locationScope('indent:read')).toEqual({ kind: 'all' });
    expect(grants.locationScope('grn:create')).toEqual({ kind: 'some', locationIds: [] });
  });
});

describe('authorize', () => {
  const grants = new Grants('u1', 'org', [store]);

  it('refuses a missing permission as FORBIDDEN', () => {
    expect(() => authorize(grants, 'approval:act')).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }) as ApiError,
    );
  });

  it('hides out-of-scope resources as NOT_FOUND', () => {
    expect(() => authorize(grants, 'indent:read', { locationId: 'bmc-9' })).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }) as ApiError,
    );
    expect(() => authorize(grants, 'indent:read', { locationId: 'bmc-2' })).not.toThrow();
  });
});
