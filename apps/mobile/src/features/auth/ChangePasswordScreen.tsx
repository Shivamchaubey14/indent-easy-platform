import { newPasswordSchema } from '@ie/validation';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';
import { z } from 'zod';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { Banner, Button, Card, TextField } from '../../components/ui';
import { changePassword } from '../../lib/auth';
import { useSessionStore } from '../../stores/session';
import { space, TOUCH_TARGET } from '../../theme';
import { authErrorMessage, type FieldErrors, serverFieldErrors, validate } from './form';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'validation.required'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'validation.required'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'validation.passwordMismatch',
  });

/** Change password (AUTH-013); the only screen available while a temporary password is in use. */
export function ChangePasswordScreen() {
  const { t } = useTranslation();
  const required = useSessionStore((s) => s.mustChangePassword);
  const [values, setValues] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (field: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [field]: value }));

  const submit = async () => {
    setFailure(null);
    const { data, errors: invalid } = validate(schema, values, t);
    setErrors(invalid ?? {});
    if (!data) return;
    setBusy(true);
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: signOutOthers,
      });
      setDone(true);
      // After a forced change the guards open the app on their own; otherwise go back.
      if (!required && router.canGoBack()) router.back();
    } catch (err) {
      const fields = serverFieldErrors(err, t);
      if (fields) setErrors(fields);
      else setFailure(authErrorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text variant="h1" weight="semibold" accessibilityRole="header">
          {t('auth.changeTitle')}
        </Text>
        {required && <Text color="text-secondary">{t('auth.changeRequired')}</Text>}
        {done && <Text accessibilityLiveRegion="polite">{t('auth.passwordChanged')}</Text>}
        {failure && <Banner tone="danger">{failure}</Banner>}
        <TextField
          label={t('auth.currentPassword')}
          requiredLabel={t('auth.required')}
          value={values.currentPassword}
          onChangeText={set('currentPassword')}
          error={errors['currentPassword']}
          secure
          autoComplete="current-password"
          textContentType="password"
        />
        <TextField
          label={t('auth.newPassword')}
          requiredLabel={t('auth.required')}
          hint={t('auth.passwordHint')}
          value={values.newPassword}
          onChangeText={set('newPassword')}
          error={errors['newPassword']}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TextField
          label={t('auth.confirmPassword')}
          requiredLabel={t('auth.required')}
          value={values.confirmPassword}
          onChangeText={set('confirmPassword')}
          error={errors['confirmPassword']}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space['3'],
            minHeight: TOUCH_TARGET,
          }}
        >
          <Text style={{ flexShrink: 1 }}>{t('auth.signOutOthers')}</Text>
          <Switch
            accessibilityLabel={t('auth.signOutOthers')}
            value={signOutOthers}
            onValueChange={setSignOutOthers}
          />
        </View>
        <Button label={t('auth.savePassword')} onPress={() => void submit()} busy={busy} block />
        {!required && (
          <Button label={t('auth.cancel')} variant="ghost" onPress={() => router.back()} block />
        )}
      </Card>
    </Screen>
  );
}
