import { forgotPasswordInputSchema } from '@ie/validation';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { Banner, Button, Card, TextField } from '../../components/ui';
import { requestPasswordReset } from '../../lib/auth';
import { authErrorMessage, type FieldErrors, validate } from './form';

/**
 * Asks for a reset link (AUTH-012). The link opens the web app's reset page, on this phone or any
 * computer; the answer is the same whether or not the address has an account.
 */
export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFailure(null);
    const { data, errors: invalid } = validate(forgotPasswordInputSchema, { email }, t);
    setErrors(invalid ?? {});
    if (!data) return;
    setBusy(true);
    try {
      await requestPasswordReset(data.email);
      setSent(true);
    } catch (err) {
      setFailure(authErrorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text variant="h1" weight="semibold" accessibilityRole="header">
          {t('auth.forgotTitle')}
        </Text>
        {sent ? (
          <Text accessibilityLiveRegion="polite">{t('auth.linkSent')}</Text>
        ) : (
          <>
            <Text color="text-secondary">{t('auth.forgotIntro')}</Text>
            {failure && <Banner tone="danger">{failure}</Banner>}
            <TextField
              label={t('auth.email')}
              requiredLabel={t('auth.required')}
              value={email}
              onChangeText={setEmail}
              error={errors['email']}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Button label={t('auth.sendLink')} onPress={() => void submit()} busy={busy} block />
          </>
        )}
        <Button label={t('auth.back')} variant="ghost" onPress={() => router.back()} block />
      </Card>
    </Screen>
  );
}
