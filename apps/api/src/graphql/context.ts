import type { FeatureFlagReader } from '../modules/configuration/index.js';
import type { RequestContext } from '../shared/context.js';

export interface Services {
  featureFlags: FeatureFlagReader;
}

export interface GraphQLContext {
  request: RequestContext;
  /**
   * The caller's organisation. Until authentication exists this is the deployment's single
   * organisation; afterwards it comes from the verified access token.
   */
  organizationId: () => Promise<string | undefined>;
  services: Services;
}
