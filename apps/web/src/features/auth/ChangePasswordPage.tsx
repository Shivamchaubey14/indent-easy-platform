import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Field, TextInput, useToast } from '@ie/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { changePassword } from '../../lib/auth';
import { useSessionStore } from '../../stores/session';
import {
  applyFieldErrors,
  AuthLayout,
  authErrorMessage,
  newPasswordFields,
  passwordsMatch,
} from './shared';

const schema = z
  .object({ currentPassword: z.string().min(1, 'validation.required'), ...newPasswordFields })
  .refine(passwordsMatch, { path: ['confirmPassword'], message: 'validation.passwordMismatch' });
type Form = z.input<typeof schema>;

/**
 * Change password (AUTH-013). Also the forced first step after signing in with a temporary
 * password; then there is no way back into the app until it's done.
 */
export function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const required = useSessionStore((s) => s.mustChangePassword);
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), mode: 'onBlur' });

  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFailure(null);
    try {
      await changePassword({ currentPassword, newPassword, revokeOtherSessions: signOutOthers });
      toast({ title: t('auth.passwordChanged') });
      await navigate({ to: '/' });
    } catch (err) {
      if (!applyFieldErrors(err, setError)) setFailure(authErrorMessage(t, err));
    }
  });

  return (
    <AuthLayout title={t('auth.changeTitle')}>
      <form noValidate className="mt-4 space-y-4" onSubmit={(e) => void submit(e)}>
        {required && <Alert tone="info">{t('auth.changeRequired')}</Alert>}
        {failure && <Alert tone="danger">{failure}</Alert>}
        <Field
          label={t('auth.currentPassword')}
          error={fieldError(errors.currentPassword?.message)}
          required
        >
          {(control) => (
            <TextInput
              {...control}
              type="password"
              autoComplete="current-password"
              {...register('currentPassword')}
            />
          )}
        </Field>
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
        <label className="flex items-center gap-2 text-body-sm">
          <input
            type="checkbox"
            checked={signOutOthers}
            onChange={(e) => setSignOutOthers(e.target.checked)}
            className="size-4 accent-primary"
          />
          {t('auth.signOutOthers')}
        </label>
        <div className="flex gap-3">
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {t('auth.savePassword')}
          </Button>
          {!required && (
            <Link
              to="/"
              className="inline-flex h-10 items-center rounded-md px-4 text-body text-text-secondary hover:bg-surface-muted"
            >
              {t('auth.cancel')}
            </Link>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
