import type { FeatureFlag } from '@ie/graphql';
import { withOrgContext, type Pool } from '../../shared/database.js';

/** Port used by resolvers; the PostgreSQL implementation is below, fakes are used in tests. */
export interface FeatureFlagReader {
  list(organizationId: string): Promise<FeatureFlag[]>;
}

interface FeatureFlagRow {
  key: string;
  enabled: boolean;
  rules: unknown;
  description: string | null;
}

export function postgresFeatureFlags(pool: Pool): FeatureFlagReader {
  return {
    list: (organizationId) =>
      withOrgContext(pool, organizationId, async (client) => {
        const { rows } = await client.query<FeatureFlagRow>(
          `SELECT key, enabled, rules, description
             FROM config.feature_flag
            WHERE organization_id = $1
            ORDER BY key`,
          [organizationId],
        );
        return rows.map((row) => ({
          key: row.key,
          enabled: row.enabled,
          rules: row.rules,
          description: row.description,
        }));
      }),
  };
}
