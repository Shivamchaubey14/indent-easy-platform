import type { FeatureFlagReader } from '../modules/configuration/index.js';
import type { IdentityQueries } from '../modules/identity/index.js';
import type { Directory } from '../modules/organization/index.js';
import type { LoadedGrants } from '../shared/authorization/index.js';
import type { Principal, RequestContext } from '../shared/context.js';

export interface Services {
  featureFlags: FeatureFlagReader;
  identity: IdentityQueries;
  directory: (organizationId: string) => Promise<Directory>;
  /** Loads the caller's current grants; refuses tokens older than their last role change. */
  access: (principal: Principal) => Promise<LoadedGrants>;
  /** Records a refused operation as a security event (§31.3). */
  denied: (principal: Principal, permission: string, operation: string) => void;
}

export interface GraphQLContext {
  request: RequestContext;
  services: Services;
  /**
   * The signed-in caller. Every root field is checked before its resolver runs (graphql/access.ts),
   * so resolvers can rely on this.
   */
  viewer: () => Principal;
  /** The caller's grants, loaded once per request. */
  access: () => Promise<LoadedGrants>;
  /** The caller's organisation structure, loaded once per request. */
  directory: () => Promise<Directory>;
  /** The caller's organisation. */
  organizationId: () => Promise<string | undefined>;
}
