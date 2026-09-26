import { loginInputSchema } from '@ie/validation';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { Banner, Button, Card, Segmented, TextField } from '../../components/ui';
import type { Locale } from '../../i18n';
import { signIn } from '../../lib/auth';
import { useUiStore } from '../../stores/ui';
import { enter, space, TOUCH_TARGET } from '../../theme';
import { authErrorMessage, type FieldErrors, validate } from './form';

/** Each language is named in its own script, whatever the current UI language. */
const LANGUAGES: readonly { value: Locale; label: string; lang: string }[] = [
  { value: 'en', label: 'English', lang: 'en' },
  { value: 'hi', label: 'हिन्दी', lang: 'hi' },
];

/**
 * Sign-in (AUTH-001, §18). On success the root layout's guards take over: the tabs open, or the
 * change-password screen first when the password was temporary.
 */
export function SignInScreen() {
  const { t } = useTranslation();
  const { locale, setLocale } = useUiStore();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFailure(null);
    const { data, errors: invalid } = validate(loginInputSchema, { identifier, password }, t);
    setErrors(invalid ?? {});
    if (!data) return;
    setBusy(true);
    try {
      await signIn(data);
    } catch (err) {
      setFailure(authErrorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Animated.View entering={enter(0)} style={{ gap: space['4'] }}>
        <Segmented
          label={t('more.language')}
          value={locale}
          options={LANGUAGES}
          onChange={setLocale}
        />
        <Card>
          <Text variant="h1" weight="semibold" accessibilityRole="header">
            {t('auth.signInTitle')}
          </Text>
          <Text color="text-secondary">{t('auth.signInIntro')}</Text>
          {failure && <Banner tone="danger">{failure}</Banner>}
          <TextField
            label={t('auth.identifier')}
            requiredLabel={t('auth.required')}
            value={identifier}
            onChangeText={setIdentifier}
            error={errors['identifier']}
            autoCapitalize="none"
            autoComplete="username"
            textContentType="username"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <TextField
            label={t('auth.password')}
            requiredLabel={t('auth.required')}
            value={password}
            onChangeText={setPassword}
            error={errors['password']}
            secure
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
          <Button label={t('auth.signIn')} onPress={() => void submit()} busy={busy} block />
          <View style={{ alignItems: 'center' }}>
            <Link
              href="/forgot-password"
              style={{ minHeight: TOUCH_TARGET, paddingVertical: space['3'] }}
            >
              <Text color="link">{t('auth.forgot')}</Text>
            </Link>
          </View>
        </Card>
      </Animated.View>
    </Screen>
  );
}
