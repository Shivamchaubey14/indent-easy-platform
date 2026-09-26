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
