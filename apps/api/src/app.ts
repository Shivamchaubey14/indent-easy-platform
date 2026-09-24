import type { AppConfig } from '@ie/config';
import compression from 'compression';
import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import type { GraphQLServer } from './graphql/server.js';
import { Health, healthRouter } from './shared/health.js';
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

  app.use(healthRouter(health));
  // Yoga parses its own bodies, so it is mounted before the JSON parser.
  app.use(graphql.graphqlEndpoint, (req, res, next) => {
    Promise.resolve(graphql(req, res, { req, res })).catch(next);
  });

  const v1 = Router();
  v1.get('/version', (_req, res) => {
    res.json(buildInfo);
  });
  app.use('/api/v1', express.json({ limit: '1mb' }), v1);

  app.use(notFound());
  app.use(errorHandler(logger));
  return app;
}
