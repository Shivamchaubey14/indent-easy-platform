import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { Banner, Button, Card, Row, StatusBadge } from '../../components/ui';
import { ApiRequestError, apiBaseUrl } from '../../lib/api';
import { enter, space } from '../../theme';
import { buildInfoQuery, readinessQuery } from './api';

export function HomeScreen() {
  const { t } = useTranslation();
  const build = useQuery(buildInfoQuery);
  const ready = useQuery(readinessQuery);
  const error = build.error ?? ready.error;
  const refresh = () => void Promise.all([build.refetch(), ready.refetch()]);

  return (
    <Screen refreshing={build.isRefetching || ready.isRefetching} onRefresh={refresh}>
      <Animated.View entering={enter(0)} style={{ gap: space['2'] }}>
        <Text variant="h1" weight="semibold" accessibilityRole="header">
          {t('home.welcome')}
        </Text>
        <Text color="text-secondary">{t('home.intro')}</Text>
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <Card>
          <Text variant="h2" weight="semibold" accessibilityRole="header">
            {t('home.systemTitle')}
          </Text>
          {build.isPending || ready.isPending ? (
            <Text color="text-secondary" accessibilityLiveRegion="polite">
              {t('state.loading')}
            </Text>
          ) : error ? (
            <Banner
              tone="danger"
              action={<Button variant="secondary" label={t('state.retry')} onPress={refresh} />}
            >
              {error instanceof ApiRequestError && error.code === 'NETWORK_ERROR'
                ? t('state.unreachable')
                : t('state.error')}
              {error instanceof ApiRequestError &&
                `\n${t('state.requestId', { id: error.requestId })}`}
            </Banner>
          ) : (
            <View style={{ gap: space['3'] }}>
              <Row label={t('home.api')}>
                <StatusBadge tone={ready.data?.status === 'ok' ? 'success' : 'danger'}>
                  {ready.data?.status === 'ok' ? t('home.ready') : t('home.notReady')}
                </StatusBadge>
              </Row>
              <Row label={t('home.checks')}>
                <View style={{ gap: space['1'], alignItems: 'flex-end' }}>
                  {Object.entries(ready.data?.checks ?? {}).map(([name, check]) => (
                    <StatusBadge key={name} tone={check.status === 'ok' ? 'success' : 'danger'}>
                      {name}
                    </StatusBadge>
                  ))}
                </View>
              </Row>
              <Row label={t('home.version')}>
                <Text tabular>{build.data?.version}</Text>
              </Row>
              <Row label={t('home.commit')}>
                <Text tabular>{build.data?.commit.slice(0, 12)}</Text>
              </Row>
            </View>
          )}
          <Row label={t('home.server')}>
            <Text variant="bodySm" color="text-secondary" tabular>
              {apiBaseUrl()}
            </Text>
          </Row>
        </Card>
      </Animated.View>
    </Screen>
  );
}
