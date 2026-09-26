import type { TFunction } from 'i18next';
import type { z } from 'zod';
import { ApiRequestError } from '../../lib/api';

export type FieldErrors = Record<string, string | undefined>;

/** Validates with a shared schema; returns the data or field → translated first message. */
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
  t: TFunction,
): { data: z.output<S>; errors: null } | { data: null; errors: FieldErrors } {
  const result = schema.safeParse(input);
  if (result.success) return { data: result.data, errors: null };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? '_');
    errors[field] ??= t(issue.message);
  }
  return { data: null, errors };
}

/** The server's field errors (i18n keys), translated; null if the error has none. */
export function serverFieldErrors(error: unknown, t: TFunction): FieldErrors | null {
  const fields = error instanceof ApiRequestError ? error.details?.fieldErrors : undefined;
  if (!fields) return null;
  return Object.fromEntries(
    Object.entries(fields).map(([field, keys]) => [field, t(keys[0] ?? 'validation.required')]),
  );
}

const minutes = (seconds: number | undefined) => Math.max(1, Math.ceil((seconds ?? 900) / 60));

/** A sentence for a refused auth request, in the user's language. */
export function authErrorMessage(t: TFunction, error: unknown): string {
  if (!(error instanceof ApiRequestError)) return t('state.error');
  switch (error.code) {
    case 'AUTH_INVALID_CREDENTIALS':
      return t('auth.invalidCredentials');
    case 'AUTH_ACCOUNT_LOCKED':
      return t('auth.locked', { minutes: minutes(error.details?.retryAfter) });
    case 'AUTH_ACCOUNT_DISABLED':
      return t('auth.disabled');
    case 'RATE_LIMITED':
      return t('auth.rateLimited', { minutes: minutes(error.details?.retryAfter) });
    case 'NETWORK_ERROR':
      return t('auth.network');
    default:
      return t('state.error');
  }
}
