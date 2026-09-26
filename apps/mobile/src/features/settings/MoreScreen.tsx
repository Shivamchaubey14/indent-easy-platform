import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { Button, Card, Row, Segmented, StatusBadge } from '../../components/ui';
import { signOut } from '../../lib/auth';
import type { Locale } from '../../i18n';
import { type ThemePreference, useUiStore } from '../../stores/ui';
import { enter } from '../../theme';
import { meQuery } from './api';

/** Each language is named in its own script, whatever the current UI language. */
const LANGUAGES: readonly { value: Locale; label: string; lang: string }[] = [
  { value: 'en', label: 'English', lang: 'en' },
  { value: 'hi', label: 'हिन्दी', lang: 'hi' },
];

export function MoreScreen() {
  const { t } = useTranslation();
  const { locale, theme, setLocale, setTheme } = useUiStore();
  const me = useQuery(meQuery);

  return (
    <Screen>
      <Text variant="h1" weight="semibold" accessibilityRole="header">
        {t('more.title')}
      </Text>
      <Animated.View entering={enter(0)}>
        <Card>
          <Text variant="h3" weight="semibold" accessibilityRole="header">
            {t('auth.account')}
          </Text>
          {me.data && (
            <>
              <Text weight="medium">{me.data.displayName}</Text>
              <Text variant="bodySm" color="text-secondary">
                {[me.data.email, me.data.primaryLocation?.name].filter(Boolean).join(' · ')}
              </Text>
            </>
          )}
          <Button
            label={t('auth.changePassword')}
            variant="secondary"
            onPress={() => router.push('/change-password')}
            block
          />
          <Button label={t('auth.signOut')} variant="ghost" onPress={() => void signOut()} block />
        </Card>
      </Animated.View>
      <Animated.View entering={enter(1)}>
        <Card>
          <Segmented
            label={t('more.language')}
            value={locale}
            options={LANGUAGES}
            onChange={setLocale}
          />
          <Segmented<ThemePreference>
            label={t('more.theme')}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'system', label: t('more.themeSystem') },
              { value: 'light', label: t('more.themeLight') },
              { value: 'dark', label: t('more.themeDark') },
            ]}
          />
        </Card>
      </Animated.View>
      <Animated.View entering={enter(2)}>
        <Card>
          <Text variant="h3" weight="semibold" accessibilityRole="header">
            {t('more.about')}
          </Text>
          <Row label={t('more.appVersion')}>
            <Text tabular>{Constants.expoConfig?.version}</Text>
          </Row>
          <Row label={t('more.localDatabase')}>
            <StatusBadge tone="success">{t('more.localDatabaseReady')}</StatusBadge>
          </Row>
        </Card>
      </Animated.View>
    </Screen>
  );
}
