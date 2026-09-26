import { EnvelopArmorPlugin } from '@escape.tech/graphql-armor';
import type { AppConfig } from '@ie/config';
import { useDisableIntrospection } from '@graphql-yoga/plugin-disable-introspection';
import type { Request, Response } from 'express';
import { Kind, parse } from 'graphql';
import { createSchema, createYoga, type Plugin, type YogaServerInstance } from 'graphql-yoga';
import { currentContext, type Principal } from '../shared/context.js';
import { ApiError } from '../shared/errors.js';
import type { Logger } from '../shared/logging.js';
import { enforceAccess } from './access.js';
import type { Directory } from '../modules/organization/index.js';
import type { GraphQLContext, Services } from './context.js';
import { createErrorMask, notImplemented } from './errors.js';
import { moduleResolvers, type Resolvers } from './resolvers.js';

/**
 * Root Query/Mutation fields in the contract that no module implements yet answer with a clear
 * NOT_IMPLEMENTED error instead of a null-for-non-null crash.
 */
function stubUnimplementedRootFields(typeDefs: string, resolvers: Resolvers): Resolvers {
  const result = { ...resolvers };
  for (const definition of parse(typeDefs).definitions) {
    if (
      definition.kind !== Kind.OBJECT_TYPE_DEFINITION &&
      definition.kind !== Kind.OBJECT_TYPE_EXTENSION
    )
      continue;
    const typeName = definition.name.value;
    if (typeName !== 'Query' && typeName !== 'Mutation') continue;
    const fields = { ...result[typeName] };
    for (const field of definition.fields ?? []) {
      const name = field.name.value;
      fields[name] ??= () => {
        throw notImplemented(`${typeName}.${name}`);
      };
    }
    result[typeName] = fields;
  }
  return result;
}

export interface GraphQLServerOptions {
  config: AppConfig;
  logger: Logger;
  typeDefs: string;
  services: Services;
}

type ServerContext = { req: Request; res: Response };

export type GraphQLServer = YogaServerInstance<ServerContext, GraphQLContext>;

export function createGraphQLServer({
  config,
  logger,
  typeDefs,
  services,
}: GraphQLServerOptions): GraphQLServer {
  const resolvers = enforceAccess(typeDefs, stubUnimplementedRootFields(typeDefs, moduleResolvers));
  const plugins: Plugin[] = [
    EnvelopArmorPlugin({
      maxDepth: { n: config.graphql.maxDepth },
      costLimit: { maxCost: config.graphql.maxCost },
      maxAliases: { n: 15 },
      maxDirectives: { n: 50 },
      maxTokens: { n: 5_000 },
      blockFieldSuggestion: { enabled: !config.graphql.introspection },
    }),
  ];
  if (!config.graphql.introspection) plugins.push(useDisableIntrospection());

  return createYoga<ServerContext, GraphQLContext>({
    schema: createSchema<ServerContext & GraphQLContext>({ typeDefs, resolvers }),
    graphqlEndpoint: '/graphql',
    graphiql: config.graphql.introspection,
    landingPage: false,
    logging: logger,
    maskedErrors: { maskError: createErrorMask(logger) },
    plugins,
    context: () => {
      const request = currentContext();
      if (!request) throw new Error('GraphQL request is outside a request context');
      return createContext(request, services);
    },
  });
}

/** Memoises a lazy value for the lifetime of one request. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let value: Promise<T> | undefined;
  return () => (value ??= load());
}

function createContext(
  request: NonNullable<ReturnType<typeof currentContext>>,
  services: Services,
): GraphQLContext {
  const viewer = (): Principal => {
    if (!request.principal) throw new ApiError('AUTH_TOKEN_EXPIRED', 'Sign in to continue.');
    return request.principal;
  };
  let directory: Promise<Directory> | undefined;
  return {
    request,
    services,
    viewer,
    access: once(() => services.access(viewer())),
    directory: () => (directory ??= services.directory(viewer().organizationId)),
    invalidateDirectory: () => {
      directory = undefined;
    },
    organizationId: () => Promise.resolve(request.principal?.organizationId),
  };
}
