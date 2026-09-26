import type { GraphQLContext } from '../../graphql/context.js';
import type { LocationRecord, WarehouseRecord } from './directory.js';

export { type Directory, loadDirectory, type LocationRecord } from './directory.js';

/**
 * Organisation reference data every signed-in user may read (pick lists, labels). Changing it is
 * the admin console's job (Phase 1.5).
 */
export const organizationResolvers = {
  Query: {
    locations: async (
      _parent: unknown,
      args: { includeInactive?: boolean | null },
      ctx: GraphQLContext,
    ) => {
      const { locations } = await ctx.directory();
      return args.includeInactive ? locations : locations.filter((l) => l.active);
    },
    departments: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) =>
      (await ctx.directory()).departments,
    designations: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) =>
      (await ctx.directory()).designations,
  },
  Location: {
    warehouses: async (location: LocationRecord, _args: unknown, ctx: GraphQLContext) =>
      (await ctx.directory()).warehousesOf(location.id),
  },
  Warehouse: {
    location: async (warehouse: WarehouseRecord, _args: unknown, ctx: GraphQLContext) =>
      (await ctx.directory()).location(warehouse.locationId),
  },
};
