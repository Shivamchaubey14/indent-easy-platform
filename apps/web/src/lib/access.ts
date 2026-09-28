/**
 * Which parts of the app a user's permissions open. Only for showing and hiding: the API checks
 * every operation itself (SRS §31.2, point 5).
 */
export const ADMIN_PERMISSIONS = [
  'admin:user_manage',
  'admin:role_manage',
  'admin:master_manage',
] as const;

export const canAdminister = (permissions: readonly string[]) =>
  ADMIN_PERMISSIONS.some((p) => permissions.includes(p));

/** Masters sections and the permissions that open each (any one of them). */
export const MASTER_SECTIONS = [
  { to: '/masters/products', label: 'masters.products', permissions: ['product:read'] },
  { to: '/masters/vendors', label: 'masters.vendors', permissions: ['vendor:read'] },
  { to: '/masters/mpps', label: 'masters.mpps', permissions: ['mpp:read'] },
  {
    to: '/masters/units',
    label: 'masters.units',
    permissions: ['product:read', 'admin:master_manage'],
  },
  {
    to: '/masters/categories',
    label: 'masters.categories',
    permissions: ['product:read', 'admin:master_manage'],
  },
  {
    to: '/masters/code-systems',
    label: 'masters.codeSystems',
    permissions: ['admin:master_manage'],
  },
  {
    to: '/masters/imports',
    label: 'masters.imports',
    permissions: ['product:map_external', 'vendor:map_products', 'mpp:import'],
  },
] as const;

export const canUseMasters = (permissions: readonly string[]) =>
  MASTER_SECTIONS.some((s) => s.permissions.some((p) => permissions.includes(p)));
