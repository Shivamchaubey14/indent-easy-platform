import { configurationResolvers } from '../modules/configuration/index.js';

export type Resolvers = Record<string, Record<string, unknown>>;

/** Merges module resolver maps; each module owns distinct fields. */
function mergeResolvers(...maps: Resolvers[]): Resolvers {
  const merged: Resolvers = {};
  for (const map of maps) {
    for (const [type, fields] of Object.entries(map)) merged[type] = { ...merged[type], ...fields };
  }
  return merged;
}

/** Every module's resolvers. Add a module here when it implements part of the contract. */
export const moduleResolvers: Resolvers = mergeResolvers(configurationResolvers);

export interface ImplementedOperations {
  query: string[];
  mutation: string[];
  subscription: string[];
}

/** Root operations that have a real implementation (the rest answer NOT_IMPLEMENTED). */
export function implementedOperations(): ImplementedOperations {
  const names = (type: string) => Object.keys(moduleResolvers[type] ?? {}).sort();
  return {
    query: names('Query'),
    mutation: names('Mutation'),
    subscription: names('Subscription'),
  };
}
