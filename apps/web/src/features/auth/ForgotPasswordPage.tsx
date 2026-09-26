import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Field, TextInput } from '@ie/ui';
import { forgotPasswordInputSchema, type ForgotPasswordInput } from '@ie/validation';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { requestPasswordReset } from '../../lib/auth';
import { AuthLayout, authErrorMessage } from './shared';

/**
 * Asks for a reset link (AUTH-012). The answer is the same whether or not the address has an
 * account, so this screen can't be used to find out who works here.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordInputSchema),
    mode: 'onBlur',
  });

  const submit = handleSubmit(async ({ email }) => {
    setFailure(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setFailure(authErrorMessage(t, err));
    }
  });

  return (
    <AuthLayout title={t('auth.forgotTitle')}>
      {sent ? (
        <Alert tone="success" className="mt-4">
          {t('auth.linkSent')}
        </Alert>
      ) : (
        <form noValidate className="mt-4 space-y-4" onSubmit={(e) => void submit(e)}>
          <p className="text-text-secondary">{t('auth.forgotIntro')}</p>
          {failure && <Alert tone="danger">{failure}</Alert>}
          <Field
            label={t('auth.email')}
            error={errors.email?.message ? t(errors.email.message) : undefined}
            required
          >
            {(control) => (
              <TextInput {...control} type="email" autoComplete="email" {...register('email')} />
            )}
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t('auth.sendLink')}
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
