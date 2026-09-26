import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Field, TextInput } from '@ie/ui';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthError, resetPassword } from '../../lib/auth';
import {
  applyFieldErrors,
  AuthLayout,
  authErrorMessage,
  newPasswordFields,
  passwordsMatch,
} from './shared';

const schema = z
  .object(newPasswordFields)
  .refine(passwordsMatch, { path: ['confirmPassword'], message: 'validation.passwordMismatch' });
type Form = z.input<typeof schema>;

/**
 * Reads the token from the URL fragment (`#token=...`) once, then removes it from the address bar
 * and history. Fragments are never sent to servers, so the token stays out of logs.
 */
function takeTokenFromUrl(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (token) window.history.replaceState(null, '', window.location.pathname);
  return token;
}

type Outcome = 'done' | 'invalid' | null;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [token] = useState(takeTokenFromUrl);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), mode: 'onBlur' });

  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const submit = handleSubmit(async ({ newPassword }) => {
    setFailure(null);
    try {
      await resetPassword(token ?? '', newPassword);
      setOutcome('done');
    } catch (err) {
      if (err instanceof AuthError && err.code === 'AUTH_TOKEN_EXPIRED') setOutcome('invalid');
      else if (!applyFieldErrors(err, setError)) setFailure(authErrorMessage(t, err));
    }
  });

  const newLink = (
    <Link to="/forgot-password" className="text-link underline-offset-2 hover:underline">
      {t('auth.requestNewLink')}
    </Link>
  );

  return (
    <AuthLayout title={t('auth.resetTitle')}>
      {outcome === 'done' ? (
        <Alert tone="success" className="mt-4">
          {t('auth.resetDone')}
        </Alert>
      ) : !token || outcome === 'invalid' ? (
        <Alert tone="warning" className="mt-4" action={newLink}>
          {token ? t('auth.resetLinkInvalid') : t('auth.resetLinkMissing')}
        </Alert>
      ) : (
        <form noValidate className="mt-4 space-y-4" onSubmit={(e) => void submit(e)}>
          {failure && <Alert tone="danger">{failure}</Alert>}
          <Field
            label={t('auth.newPassword')}
            hint={t('auth.passwordHint')}
            error={fieldError(errors.newPassword?.message)}
            required
          >
            {(control) => (
              <TextInput
                {...control}
                type="password"
                autoComplete="new-password"
                {...register('newPassword')}
              />
            )}
          </Field>
          <Field
            label={t('auth.confirmPassword')}
            error={fieldError(errors.confirmPassword?.message)}
            required
          >
            {(control) => (
              <TextInput
                {...control}
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
            )}
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t('auth.savePassword')}
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-body-sm">
        <Link to="/login" className="text-link underline-offset-2 hover:underline">
          {t('auth.backToSignIn')}
        </Link>
      </p>
    </AuthLayout>
  );
}
