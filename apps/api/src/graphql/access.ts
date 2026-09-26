import { Kind, parse } from 'graphql';
import { ApiError } from '../shared/errors.js';
import type { GraphQLContext } from './context.js';
import type { Resolvers } from './resolvers.js';

type Resolver = (parent: unknown, args: unknown, ctx: GraphQLContext, info: unknown) => unknown;

/** Root fields a user with a pending password change may still call. */
const ALLOWED_BEFORE_PASSWORD_CHANGE = new Set(['Query.me']);

/** Every `@auth(requires: "...")` in the contract, keyed `Type.field`. */
export function requiredPermissions(typeDefs: string): Map<string, string> {
  const required = new Map<string, string>();
  for (const definition of parse(typeDefs).definitions) {
    if (
      definition.kind !== Kind.OBJECT_TYPE_DEFINITION &&
      definition.kind !== Kind.OBJECT_TYPE_EXTENSION
    )
      continue;
    for (const field of definition.fields ?? []) {
      const auth = field.directives?.find((d) => d.name.value === 'auth');
      const requires = auth?.arguments?.find((a) => a.name.value === 'requires');
      if (requires?.value.kind === Kind.STRING) {
        required.set(`${definition.name.value}.${field.name.value}`, requires.value.value);
      }
    }
  }
  return required;
}

async function checkPermission(
  ctx: GraphQLContext,
  permission: string | undefined,
  operation: string,
): Promise<void> {
  if (!permission) return;
  const { grants } = await ctx.access();
  if (grants.can(permission)) return;
  ctx.services.denied(ctx.viewer(), permission, operation);
  throw new ApiError('FORBIDDEN', 'You do not have permission to do this.', { permission });
}

/**
 * Wraps resolvers so the contract's access rules hold before any module code runs (§31.2, the
 * "@auth wrapper"):
 *
 * - every Query and Mutation field needs a signed-in user whose roles haven't changed since the
 *   token was issued (the grants loader refuses stale tokens);
 * - a user with a temporary password may only read `me` until they change it (AUTH-013);
 * - fields marked `@auth(requires: ...)` also need that permission.
 *
 * Scope and policy checks (which location, whose indent) stay in the modules via `authorize()`.
 */
export function enforceAccess(typeDefs: string, resolvers: Resolvers): Resolvers {
  const required = requiredPermissions(typeDefs);
  const result: Resolvers = {};
  for (const [typeName, fields] of Object.entries(resolvers)) {
    const root = typeName === 'Query' || typeName === 'Mutation';
    result[typeName] = { ...fields };
    for (const [fieldName, resolve] of Object.entries(fields)) {
      const operation = `${typeName}.${fieldName}`;
      const permission = required.get(operation);
      if (typeof resolve !== 'function' || (!root && !permission)) continue;
      const inner = resolve as Resolver;
      result[typeName][fieldName] = async (
        parent: unknown,
        args: unknown,
        ctx: GraphQLContext,
        info: unknown,
      ) => {
        if (root) {
          const viewer = ctx.viewer();
          if (viewer.mustChangePassword && !ALLOWED_BEFORE_PASSWORD_CHANGE.has(operation)) {
            throw new ApiError('FORBIDDEN', 'Change your password to continue.', {
              reason: 'PASSWORD_CHANGE_REQUIRED',
            });
          }
          await ctx.access();
        }
        await checkPermission(ctx, permission, operation);
        return inner(parent, args, ctx, info);
      };
    }
  }
  // Non-root fields that declare a permission but have no resolver of their own.
  for (const [operation, permission] of required) {
    const [typeName = '', fieldName = ''] = operation.split('.');
    if (typeName === 'Query' || typeName === 'Mutation' || result[typeName]?.[fieldName]) continue;
    result[typeName] = {
      ...result[typeName],
      [fieldName]: async (parent: Record<string, unknown>, _args: unknown, ctx: GraphQLContext) => {
        await checkPermission(ctx, permission, operation);
        return parent[fieldName];
      },
    };
  }
  return result;
}
