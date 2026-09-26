/*
 * Authentication rules (SRS §11.1, §30). Values are the SRS defaults; per-organisation overrides
 * come with the settings module.
 */

export type Platform = 'web' | 'mobile';

export const AUTH_POLICY = {
  /** AUTH-004: N failures within the window lock the account for lockSeconds. */
  lockout: { maxFailures: 5, windowSeconds: 15 * 60, lockSeconds: 15 * 60 },
  /** AUTH-006, §30.1: refresh-token idle and absolute lifetimes. */
  session: {
    web: { idleSeconds: 60 * 60, absoluteSeconds: 7 * 24 * 60 * 60 },
    mobile: { idleSeconds: 14 * 24 * 60 * 60, absoluteSeconds: 30 * 24 * 60 * 60 },
  },
  /** AUTH-012: reset links are single use and short lived. */
  resetTokenSeconds: 30 * 60,
  /** Per-IP and per-account request limits (AUTH-004, §32). */
  rateLimits: {
    loginPerIp: { limit: 30, windowSeconds: 5 * 60 },
    forgotPerIp: { limit: 5, windowSeconds: 15 * 60 },
    forgotPerAccount: { limit: 3, windowSeconds: 60 * 60 },
    changePerUser: { limit: 10, windowSeconds: 15 * 60 },
  },
} as const;

/** Mobile clients identify themselves with `X-Client-Name: mobile` (or `mobile-<variant>`). */
export function platformOf(clientName: string | undefined): Platform {
  return clientName === 'mobile' || clientName?.startsWith('mobile-') ? 'mobile' : 'web';
}

export type AccountStatus = 'INVITED' | 'ACTIVE' | 'LOCKED' | 'DISABLED';

/** The earlier of now + idle and the session's hard end: a refresh never outlives its session. */
export function refreshExpiry(now: Date, idleSeconds: number, absoluteExpiresAt: Date): Date {
  return new Date(Math.min(now.getTime() + idleSeconds * 1000, absoluteExpiresAt.getTime()));
}

/**
 * Why a new password is refused. Messages are i18n keys shared with the clients. There are no
 * composition rules (AUTH-003): length, known breaches and the user's own identifiers only.
 */
export type PasswordProblem =
  | 'validation.passwordTooShort'
  | 'validation.passwordTooLong'
  | 'validation.passwordPersonal'
  | 'validation.passwordBreached'
  | 'validation.passwordUnchanged';

const MIN = 12;
const MAX = 128;

/**
 * Checks that need no network: length in characters and whether the password is built from the
 * user's own e-mail or employee code (NIST SP 800-63B "context-specific words").
 */
export function localPasswordProblems(
  password: string,
  personal: readonly (string | null | undefined)[],
): PasswordProblem[] {
  const length = [...password].length;
  if (length < MIN) return ['validation.passwordTooShort'];
  if (length > MAX) return ['validation.passwordTooLong'];
  const lower = password.toLowerCase();
  const words = personal
    .flatMap((value) => (value ? [value, value.split('@')[0] ?? ''] : []))
    .map((value) => value.toLowerCase())
    .filter((value) => value.length >= 4);
  return words.some((word) => lower.includes(word)) ? ['validation.passwordPersonal'] : [];
}
