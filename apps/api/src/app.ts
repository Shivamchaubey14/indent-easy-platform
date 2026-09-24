import type { AppConfig } from '@ie/config';
import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { GraphQLServer } from './graphql/server.js';
import { REST_ROUTES, toExpressPath, type RestHandlers } from './rest/routes.js';
import { Health, healthHandlers } from './shared/health.js';
import { errorHandler, notFound } from './shared/http/problem.js';
import { requestContext } from './shared/http/request-context.js';
import type { Logger } from './shared/logging.js';
import { accessLog, type Metrics } from './shared/metrics.js';
import type { BuildInfo } from './shared/version.js';

export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  metrics: Metrics;
  health: Health;
  graphql: GraphQLServer;
  buildInfo: BuildInfo;
}

/** Builds the HTTP application. Kept free of listening/sockets so tests can drive it directly. */
export function createApp({
  config,
  logger,
  metrics,
  health,
  graphql,
  buildInfo,
}: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestContext());
  app.use(accessLog(logger, metrics));
  // GraphiQL loads inline scripts, so the CSP is only relaxed where introspection is allowed (dev).
  app.use(helmet({ contentSecurityPolicy: config.graphql.introspection ? false : undefined }));
  app.use(
    cors({
      origin: config.http.corsAllowedOrigins,
      credentials: true,
      exposedHeaders: ['X-Request-ID'],
    }),
  );
  app.use(compression({ threshold: 1024 }));

  // Yoga parses its own bodies, so it is mounted before the JSON parser.
  app.use(graphql.graphqlEndpoint, (req, res, next) => {
    Promise.resolve(graphql(req, res, { req, res })).catch(next);
  });
  app.use('/api', express.json({ limit: '1mb' }));

  const handlers: RestHandlers = {
    ...healthHandlers(health),
    version: (_req, res) => {
      res.json(buildInfo);
    },
  };
  for (const route of REST_ROUTES) {
    if ('listener' in route) continue;
    app[route.method](toExpressPath(route.path), handlers[route.operationId]);
  }

  app.use(notFound());
  app.use(errorHandler(logger));
  return app;
}
