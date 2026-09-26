import { zodResolver } from '@hookform/resolvers/zod';
import { loginInputSchema, type LoginInput } from '@ie/validation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Field, TextInput, useEnter } from '@ie/ui';
import { LanguageToggle } from '../../components/Preferences';

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
            <Field
              label={t('login.identifier')}
              error={fieldError(errors.identifier?.message)}
              required
            >
              {(control) => (
                <TextInput {...control} autoComplete="username" {...register('identifier')} />
              )}
            </Field>
            <Field
              label={t('login.password')}
              error={fieldError(errors.password?.message)}
              required
            >
              {(control) => (
                <TextInput
                  {...control}
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                />
              )}
            </Field>
            <Button type="submit" className="w-full">
              {t('login.submit')}
            </Button>
            {notice && <Alert tone="info">{t('login.notAvailable')}</Alert>}
          </form>
        </Card>
      </div>
    </div>
  );
}
