import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '../components/Text';
import { useLocalDatabase } from '../db/client';
import { LockScreen, useAppLock } from '../features/auth/app-lock';
import i18n from '../i18n';
import { ApiRequestError } from '../lib/api';
import { onSignedOut, restoreSession } from '../lib/auth';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';
import { FONTS, space, useColors, useIsDark } from '../theme';

void SplashScreen.preventAutoHideAsync();
// Launch: check secure storage for a session while fonts and the database get ready.
void restoreSession();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't hammer the API on errors that won't fix themselves.
      retry: (count, error) =>
        count < 2 &&
        !(error instanceof ApiRequestError && error.status !== undefined && error.status < 500),
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const database = useLocalDatabase();
  const locale = useUiStore((s) => s.locale);
  const colors = useColors();
  const dark = useIsDark();
  const session = useSessionStore((s) => s.status);
  const mustChangePassword = useSessionStore((s) => s.mustChangePassword);
  const locked = useSessionStore((s) => s.locked);
  useAppLock();

  // Another user may sign in next: nothing cached for this one may be shown to them.
  useEffect(() => onSignedOut(() => queryClient.clear()), []);

  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  // Fonts that fail to load fall back to the system font rather than blocking the app.
  const ready =
    (fontsLoaded || fontError !== null) &&
    (database.success || !!database.error) &&
    session !== 'unknown';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        {database.error ? (
          <DatabaseFailed />
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            {/* Expo Router opens the first screen whose guard passes. */}
            <Stack.Protected guard={session === 'signedIn' && !mustChangePassword}>
              <Stack.Screen name="(tabs)" />
            </Stack.Protected>
            <Stack.Protected guard={session === 'signedIn'}>
              <Stack.Screen name="change-password" />
            </Stack.Protected>
            <Stack.Protected guard={session !== 'signedIn'}>
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="forgot-password" />
            </Stack.Protected>
          </Stack>
        )}
        {locked && <LockScreen />}
      </QueryClientProvider>
    </I18nextProvider>
  );
}

/** Without local storage nothing can be queued safely, so the app stops here and says so. */
function DatabaseFailed() {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: space['6'],
        backgroundColor: colors.background,
      }}
    >
      <Text accessibilityRole="alert">{t('state.databaseFailed')}</Text>
    </View>
  );
}
