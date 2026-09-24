import type { FeatureFlag } from '@ie/graphql';
import type { GraphQLContext } from '../../graphql/context.js';

export { postgresFeatureFlags, type FeatureFlagReader } from './feature-flags.js';

export const configurationResolvers = {
  Query: {
    featureFlags: async (
      _parent: unknown,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<FeatureFlag[]> => {
      const organizationId = await ctx.organizationId();
      return organizationId ? ctx.services.featureFlags.list(organizationId) : [];
    },
  },
};
