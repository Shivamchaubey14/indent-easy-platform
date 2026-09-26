import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, ErrorState, Loading, StatusBadge } from '../../components/ui';
import { ApiRequestError } from '../../lib/api';
import { useEnter } from '../../motion/useEnter';
import { buildInfoQuery, featureFlagsQuery, readinessQuery } from './api';

const requestIdOf = (error: unknown) =>
  error instanceof ApiRequestError ? error.requestId : undefined;

export function DashboardPage() {
  const { t } = useTranslation();
  const page = useRef<HTMLDivElement>(null);
  useEnter(page);

  const build = useQuery(buildInfoQuery);
  const ready = useQuery(readinessQuery);
  const flags = useQuery(featureFlagsQuery);

  return (
    <div ref={page} className="space-y-6">
      <header>
        <h1 className="text-h1 font-semibold">{t('dashboard.welcome')}</h1>
        <p className="mt-2 max-w-prose text-text-secondary">{t('dashboard.intro')}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card aria-labelledby="system-title">
          <h2 id="system-title" className="text-h2 font-semibold">
            {t('dashboard.systemTitle')}
          </h2>
          {build.isPending || ready.isPending ? (
            <div className="mt-4">
              <Loading />
            </div>
          ) : build.isError ? (
            <div className="mt-4">
              <ErrorState
                requestId={requestIdOf(build.error)}
                onRetry={() => void build.refetch()}
              />
            </div>
          ) : (
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
              <dt className="text-text-secondary">{t('dashboard.api')}</dt>
              <dd>
                <StatusBadge tone={ready.data?.status === 'ok' ? 'success' : 'danger'}>
                  {ready.data?.status === 'ok' ? t('dashboard.ready') : t('dashboard.notReady')}
                </StatusBadge>
              </dd>
              <dt className="text-text-secondary">{t('dashboard.database')}</dt>
              <dd className="flex flex-wrap gap-2">
                {Object.entries(ready.data?.checks ?? {}).map(([name, check]) => (
                  <StatusBadge key={name} tone={check.status === 'ok' ? 'success' : 'danger'}>
                    {name}
                  </StatusBadge>
                ))}
              </dd>
              <dt className="text-text-secondary">{t('dashboard.version')}</dt>
              <dd className="tabular">{build.data.version}</dd>
              <dt className="text-text-secondary">{t('dashboard.commit')}</dt>
              <dd className="tabular">
                <code>{build.data.commit.slice(0, 12)}</code>
              </dd>
            </dl>
          )}
        </Card>

        <Card aria-labelledby="flags-title">
          <h2 id="flags-title" className="text-h2 font-semibold">
            {t('dashboard.flagsTitle')}
          </h2>
          <div className="mt-4">
            {flags.isPending ? (
              <Loading />
            ) : flags.isError ? (
              <ErrorState
                requestId={requestIdOf(flags.error)}
                onRetry={() => void flags.refetch()}
              />
            ) : flags.data.featureFlags.length === 0 ? (
              <p className="text-text-secondary">{t('dashboard.flagsEmpty')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {flags.data.featureFlags.map((flag) => (
                  <li key={flag.key} className="flex items-center justify-between gap-4 py-2">
                    <span>
                      <code className="text-body-sm">{flag.key}</code>
                      {flag.description && (
                        <span className="block text-caption text-text-secondary">
                          {flag.description}
                        </span>
                      )}
                    </span>
                    <StatusBadge tone={flag.enabled ? 'success' : 'neutral'}>
                      {flag.enabled ? t('dashboard.on') : t('dashboard.off')}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
