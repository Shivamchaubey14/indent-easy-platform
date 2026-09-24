import { queryOptions } from '@tanstack/react-query';
import { graphql } from '../../generated/graphql';
import { gql, rest } from '../../lib/api';

const FeatureFlagsQuery = graphql(`
  query DashboardFeatureFlags {
    featureFlags {
      key
      enabled
      description
    }
  }
`);

export interface BuildInfo {
  version: string;
  commit: string;
  builtAt: string;
}

export interface Readiness {
  status: 'ok' | 'fail';
  checks: Record<string, { status: 'ok' | 'fail' }>;
}

export const featureFlagsQuery = queryOptions({
  queryKey: ['featureFlags'],
  queryFn: () => gql(FeatureFlagsQuery),
});

export const buildInfoQuery = queryOptions({
  queryKey: ['buildInfo'],
  queryFn: () => rest<BuildInfo>('/api/v1/version'),
  staleTime: 5 * 60_000,
});

export const readinessQuery = queryOptions({
  queryKey: ['readiness'],
  queryFn: () => rest<Readiness>('/health/ready'),
  refetchInterval: 30_000,
});
