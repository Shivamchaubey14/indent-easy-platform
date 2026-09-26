import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, View } from 'react-native';
import { Text } from '../../components/Text';
import { Button } from '../../components/ui';
import { signOut } from '../../lib/auth';
import { useSessionStore } from '../../stores/session';
import { space, useColors } from '../../theme';

/** How long the app may sit in the background before it asks to be unlocked (§30.3). */
export const LOCK_AFTER_MS = 5 * 60_000;

/**
 * Locks the app when it returns after LOCK_AFTER_MS in the background, if the phone has a
 * fingerprint, face or screen lock set up. The session itself stays; unlocking is local. Phones
 * without any screen lock can't be locked this way, so they aren't.
 */
export function useAppLock(): void {
  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active' || backgroundedAt.current === null) return;
      const away = Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;
      if (away < LOCK_AFTER_MS || useSessionStore.getState().status !== 'signedIn') return;
      void LocalAuthentication.getEnrolledLevelAsync().then((level) => {
        if (level !== LocalAuthentication.SecurityLevel.NONE) {
          useSessionStore.getState().setLocked(true);
        }
      });
    });
    return () => subscription.remove();
  }, []);
}

/** Covers the whole app until the user unlocks with the phone's own authentication. */
export function LockScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const unlock = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('auth.unlockPrompt'),
      cancelLabel: t('auth.cancel'),
    });
    if (result.success) useSessionStore.getState().setLocked(false);
  };

  useEffect(() => {
    void unlock();
    // Ask once when the lock appears; after that the user taps Unlock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        inset: 0,
        justifyContent: 'center',
        padding: space['6'],
        gap: space['4'],
        backgroundColor: colors.background,
      }}
    >
      <Text variant="h1" weight="semibold" accessibilityRole="header">
        {t('auth.lockedTitle')}
      </Text>
      <Text color="text-secondary">{t('auth.lockedIntro')}</Text>
      <Button label={t('auth.unlock')} onPress={() => void unlock()} block />
      <Button label={t('auth.signOut')} variant="ghost" onPress={() => void signOut()} block />
    </View>
  );
}
