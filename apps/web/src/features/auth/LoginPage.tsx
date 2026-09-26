import { zodResolver } from '@hookform/resolvers/zod';
import { loginInputSchema, type LoginInput } from '@ie/validation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '../../components/ui';
import { LanguageToggle } from '../../components/Preferences';
import { useEnter } from '../../motion/useEnter';

/**
 * Sign-in screen. Validation uses the same Zod schema the API will enforce. Authentication itself
 * arrives in Phase 1, so a valid submission only explains that; no credentials are sent.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const page = useRef<HTMLDivElement>(null);
  useEnter(page);
  const [notice, setNotice] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInputSchema), mode: 'onBlur' });

  const fieldError = (message?: string) => (message ? t(message) : undefined);

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <div ref={page} className="w-full max-w-sm space-y-4">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <Card>
          <h1 className="text-h1 font-semibold">{t('login.title')}</h1>
          <p className="mt-1 text-text-secondary">{t('login.subtitle')}</p>
          <form
            noValidate
            className="mt-6 space-y-4"
            onSubmit={handleSubmit(() => setNotice(true))}
          >
            <div>
              <label htmlFor="email" className="block font-medium">
                {t('login.email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="mt-1 h-10 w-full rounded-md border border-border-control bg-surface-input px-3"
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-body-sm text-danger-text">
                  {fieldError(errors.email.message)}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block font-medium">
                {t('login.password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className="mt-1 h-10 w-full rounded-md border border-border-control bg-surface-input px-3"
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" className="mt-1 text-body-sm text-danger-text">
                  {fieldError(errors.password.message)}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full">
              {t('login.submit')}
            </Button>
            {notice && (
              <p
                role="status"
                className="rounded-md bg-info-surface p-3 text-body-sm text-info-text"
              >
                {t('login.notAvailable')}
              </p>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
