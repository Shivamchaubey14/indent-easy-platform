import type { UserError } from '@ie/graphql';
import type { GraphQLContext } from '../../../graphql/context.js';
import type { Actor, AdminResult, AdminService } from '../application/admin-service.js';
import type { RoleSummary, UserListFilter } from '../infrastructure/postgres-admin.js';
import type { UserRecord } from '../infrastructure/postgres-profile.js';

/** What the admin resolvers need (wired in the module's index). */
export interface AdminQueries {
  service: AdminService;
  listUsers(
    organizationId: string,
    filter: UserListFilter,
    page: { first: number; after?: string | null },
  ): Promise<{
    ids: string[];
    cursors: string[];
    totalCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }>;
  users(organizationId: string, ids: readonly string[]): Promise<UserRecord[]>;
  roles(organizationId: string): Promise<RoleSummary[]>;
  permissionCatalogue(): Promise<string[]>;
}

async function actorOf(ctx: GraphQLContext): Promise<Actor> {
  return { principal: ctx.viewer(), grants: (await ctx.access()).grants };
}

/** A mutation payload: the saved user, or the problems. */
async function userPayload(
  ctx: GraphQLContext,
  result: AdminResult,
): Promise<{ user: UserRecord | null; userErrors: UserError[] }> {
  if (!result.ok) return { user: null, userErrors: result.userErrors };
  const [user] = await ctx.services.admin.users(ctx.viewer().organizationId, [result.id]);
  return { user: user ?? null, userErrors: [] };
}

export const adminResolvers = {
  Query: {
    users: async (
      _parent: unknown,
      args: {
        filter?: UserListFilter | null;
        pagination?: { first?: number | null; after?: string | null } | null;
      },
      ctx: GraphQLContext,
    ) => {
      const org = ctx.viewer().organizationId;
      const first = Math.min(Math.max(args.pagination?.first ?? 20, 1), 100);
      const page = await ctx.services.admin.listUsers(org, args.filter ?? {}, {
        first,
        after: args.pagination?.after ?? null,
      });
      const users = await ctx.services.admin.users(org, page.ids);
      return {
        edges: users.map((node, i) => ({ node, cursor: page.cursors[i] })),
        totalCount: page.totalCount,
        pageInfo: {
          hasNextPage: page.hasNextPage,
          hasPreviousPage: page.hasPreviousPage,
          startCursor: page.cursors[0] ?? null,
          endCursor: page.cursors.at(-1) ?? null,
        },
      };
    },
    user: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!/^[0-9a-f-]{36}$/i.test(args.id)) return null;
      const [user] = await ctx.services.admin.users(ctx.viewer().organizationId, [args.id]);
      return user ?? null;
    },
    roles: (_parent: unknown, _args: unknown, ctx: GraphQLContext) =>
      ctx.services.admin.roles(ctx.viewer().organizationId),
    permissionCatalogue: (_parent: unknown, _args: unknown, ctx: GraphQLContext) =>
      ctx.services.admin.permissionCatalogue(),
  },
  Mutation: {
    createUser: async (_parent: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      userPayload(ctx, await ctx.services.admin.service.createUser(await actorOf(ctx), args.input)),
    updateUser: async (_parent: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      userPayload(ctx, await ctx.services.admin.service.updateUser(await actorOf(ctx), args.input)),
    setUserRoles: async (_parent: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      userPayload(
        ctx,
        await ctx.services.admin.service.setUserRoles(await actorOf(ctx), args.input),
      ),
    unlockUser: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) =>
      userPayload(ctx, await ctx.services.admin.service.unlockUser(await actorOf(ctx), args.id)),
    forcePasswordReset: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) =>
      userPayload(
        ctx,
        await ctx.services.admin.service.forcePasswordReset(await actorOf(ctx), args.id),
      ),
    saveRole: async (_parent: unknown, args: { input: unknown }, ctx: GraphQLContext) => {
      const result = await ctx.services.admin.service.saveRole(await actorOf(ctx), args.input);
      if (!result.ok) return { role: null, userErrors: result.userErrors };
      const roles = await ctx.services.admin.roles(ctx.viewer().organizationId);
      return { role: roles.find((r) => r.id === result.id) ?? null, userErrors: [] };
    },
  },
};
