import type { GraphQLContext } from '../../../graphql/context.js';
import type { Principal } from '../../../shared/context.js';
import { ApiError } from '../../../shared/errors.js';
import type {
  RoleAssignmentRecord,
  SessionRecord,
  UserRecord,
} from '../infrastructure/postgres-profile.js';

/** What the identity resolvers need from the module (wired in the module's index). */
export interface IdentityQueries {
  user(organizationId: string, userId: string): Promise<UserRecord | null>;
  sessions(userId: string): Promise<SessionRecord[]>;
  revokeOwnSession(principal: Principal, sessionId: string): Promise<boolean>;
  revokeOtherSessions(principal: Principal): Promise<number>;
}

const present = <T>(value: T | null): value is T => value !== null;

export const identityResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, ctx: GraphQLContext): Promise<UserRecord> => {
      const viewer = ctx.viewer();
      const user = await ctx.services.identity.user(viewer.organizationId, viewer.userId);
      if (!user) throw new ApiError('AUTH_TOKEN_EXPIRED', 'Sign in to continue.');
      return user;
    },
    mySessions: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      const viewer = ctx.viewer();
      const sessions = await ctx.services.identity.sessions(viewer.userId);
      return sessions.map((s) => ({ ...s, current: s.id === viewer.sessionId }));
    },
  },
  Mutation: {
    revokeSession: (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const viewer = ctx.viewer();
      // Signing out the current device is the REST sign-out, which also clears its cookie.
      if (args.id === viewer.sessionId) return Promise.resolve(false);
      return ctx.services.identity.revokeOwnSession(viewer, args.id);
    },
    revokeAllMySessions: (_parent: unknown, _args: unknown, ctx: GraphQLContext) =>
      ctx.services.identity.revokeOtherSessions(ctx.viewer()),
  },
  User: {
    designation: async (user: UserRecord, _args: unknown, ctx: GraphQLContext) =>
      (await ctx.directory()).designation(user.designationId),
    department: async (user: UserRecord, _args: unknown, ctx: GraphQLContext) =>
      (await ctx.directory()).department(user.departmentId),
    primaryLocation: async (user: UserRecord, _args: unknown, ctx: GraphQLContext) =>
      (await ctx.directory()).location(user.primaryLocationId),
    locations: async (user: UserRecord, _args: unknown, ctx: GraphQLContext) => {
      const directory = await ctx.directory();
      const ids = [...new Set([user.primaryLocationId, ...user.locationIds])];
      return ids.map((id) => directory.location(id)).filter(present);
    },
    roles: (user: UserRecord) => user.roles.filter((r) => r.effective),
    permissions: (user: UserRecord) =>
      [...new Set(user.roles.filter((r) => r.effective).flatMap((r) => r.role.permissions))].sort(),
    homeWorkspace: (user: UserRecord) =>
      user.roles.find((r) => r.effective && r.homeWorkspace)?.homeWorkspace ?? 'STORE',
  },
  UserRoleAssignment: {
    scopeLocations: async (a: RoleAssignmentRecord, _args: unknown, ctx: GraphQLContext) => {
      const directory = await ctx.directory();
      return a.scopeLocationIds.map((id) => directory.location(id)).filter(present);
    },
    scopeDepartments: async (a: RoleAssignmentRecord, _args: unknown, ctx: GraphQLContext) => {
      const directory = await ctx.directory();
      return a.scopeDepartmentIds.map((id) => directory.department(id)).filter(present);
    },
    // Product categories arrive with the catalogue (Phase 1.6); until then none can be resolved.
    scopeCategories: () => [],
  },
};
