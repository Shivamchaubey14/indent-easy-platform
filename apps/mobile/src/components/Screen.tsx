import { useNetInfo } from '@react-native-community/netinfo';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space, useColors } from '../theme';
import { Text } from './Text';

/** Scrolling screen body with the offline banner (SRS §40.6) and optional pull-to-refresh. */
export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  const { isConnected } = useNetInfo();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {isConnected === false && (
        <View
          accessibilityRole="alert"
          style={{ backgroundColor: colors['warning-surface'], padding: space['3'] }}
        >
          <Text variant="bodySm" style={{ color: colors['warning-text'] }}>
            {t('state.offline')}
          </Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={{ padding: space['4'], gap: space['4'] }}
        refreshControl={
          onRefresh && (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
              tintColor={colors['text-secondary']}
              colors={[colors.primary]}
            />
          )
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
