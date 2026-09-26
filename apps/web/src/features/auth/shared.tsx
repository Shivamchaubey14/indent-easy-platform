import { Card, useEnter } from '@ie/ui';
import { newPasswordSchema } from '@ie/validation';
import type { TFunction } from 'i18next';
import { type ReactNode, useRef } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { z } from 'zod';
import { LanguageToggle } from '../../components/Preferences';
import { AuthError } from '../../lib/auth';

/** The centred card every signed-out screen uses. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const page = useRef<HTMLDivElement>(null);
  useEnter(page);
  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <div ref={page} className="w-full max-w-sm space-y-4">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <Card aria-labelledby="auth-title">
          <h1 id="auth-title" className="text-h1 font-semibold">
            {title}
          </h1>
          {children}
        </Card>
      </div>
    </main>
  );
}

const minutes = (seconds: number | undefined) => Math.max(1, Math.ceil((seconds ?? 900) / 60));

/** A sentence for a failed auth request, in the user's language. */
export function authErrorMessage(t: TFunction, error: unknown): string {
  if (!(error instanceof AuthError)) return t('state.error');
  switch (error.code) {
    case 'AUTH_INVALID_CREDENTIALS':
      return t('auth.invalidCredentials');
    case 'AUTH_ACCOUNT_LOCKED':
      return t('auth.locked', { minutes: minutes(error.problem.retryAfter) });
    case 'AUTH_ACCOUNT_DISABLED':
      return t('auth.disabled');
    case 'RATE_LIMITED':
      return t('auth.rateLimited', { minutes: minutes(error.problem.retryAfter) });
    case 'NETWORK_ERROR':
      return t('auth.network');
    case 'AUTH_TOKEN_EXPIRED':
      return t('auth.sessionEnded');
    default:
      return t('state.error');
  }
}

/**
 * Puts the server's field errors (i18n keys) on the form. Returns false when there were none, so
 * the caller shows a general message instead.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  const fields = error instanceof AuthError ? error.problem.fieldErrors : undefined;
  if (!fields) return false;
  for (const [field, messages] of Object.entries(fields)) {
    setError(field as Path<T>, { type: 'server', message: messages[0] ?? 'validation.required' });
  }
  return true;
}

/** New password + repeat, with the same length rules as the API. */
export const newPasswordFields = {
  newPassword: newPasswordSchema,
  confirmPassword: z.string().min(1, 'validation.required'),
};

export const passwordsMatch = (value: { newPassword: string; confirmPassword: string }) =>
  value.newPassword === value.confirmPassword;
