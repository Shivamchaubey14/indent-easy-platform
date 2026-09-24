import { database, featureFlagInConfig } from '@ie/db';
import type { FeatureFlag } from '@ie/graphql';
import { asc, eq } from 'drizzle-orm';
import { withOrgContext, type Pool } from '../../shared/database.js';

/** Port used by resolvers; the PostgreSQL implementation is below, fakes are used in tests. */
export interface FeatureFlagReader {
  list(organizationId: string): Promise<FeatureFlag[]>;
}

/**
 * Row-level security limits rows to the caller's organisation (set by withOrgContext). The explicit
 * filter is a second guard in case the app is ever misconfigured to connect as the table owner,
 * for whom PostgreSQL does not apply RLS.
 */
export function postgresFeatureFlags(pool: Pool): FeatureFlagReader {
  return {
    list: (organizationId) =>
      withOrgContext(pool, organizationId, (client) =>
        database(client)
          .select({
            key: featureFlagInConfig.key,
            enabled: featureFlagInConfig.enabled,
            rules: featureFlagInConfig.rules,
            description: featureFlagInConfig.description,
          })
          .from(featureFlagInConfig)
          .where(eq(featureFlagInConfig.organizationId, organizationId))
          .orderBy(asc(featureFlagInConfig.key)),
      ),
  };
}
