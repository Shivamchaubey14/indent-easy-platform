import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Field, TextInput } from '@ie/ui';
import { loginInputSchema, type LoginInput } from '@ie/validation';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { signIn } from '../../lib/auth';
import { AuthLayout, authErrorMessage } from './shared';

/**
 * Sign-in (AUTH-001). Validation uses the same Zod schema as the API. After a successful sign-in
 * the user goes back to the page they asked for, or first to "change password" when the
 * administrator gave them a temporary one.
 */
export function LoginPage({ redirectTo }: { redirectTo?: string | undefined }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInputSchema), mode: 'onBlur' });

  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const submit = handleSubmit(async (input) => {
    setFailure(null);
    try {
      const { mustChangePassword } = await signIn(input);
      if (mustChangePassword) await navigate({ to: '/change-password' });
      else await navigate({ to: redirectTo ?? '/' });
    } catch (err) {
      setFailure(authErrorMessage(t, err));
    }
  });

  return (
    <AuthLayout title={t('login.title')}>
      <p className="mt-1 text-text-secondary">{t('login.subtitle')}</p>
      <form noValidate className="mt-6 space-y-4" onSubmit={(e) => void submit(e)}>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <Field
          label={t('login.identifier')}
          error={fieldError(errors.identifier?.message)}
          required
        >
          {(control) => (
            <TextInput
              {...control}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              {...register('identifier')}
            />
          )}
        </Field>
        <Field label={t('login.password')} error={fieldError(errors.password?.message)} required>
          {(control) => (
            <TextInput
              {...control}
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          {isSubmitting ? t('login.signingIn') : t('login.submit')}
        </Button>
        <p className="text-center text-body-sm">
          <Link to="/forgot-password" className="text-link underline-offset-2 hover:underline">
            {t('login.forgot')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
