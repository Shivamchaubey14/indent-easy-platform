import { createServer } from 'node:http';
import { ConfigError, loadConfig, type AppConfig } from '@ie/config';
import { loadTypeDefs } from '@ie/graphql/schema';
import { createApp } from './app.js';
import { createGraphQLServer } from './graphql/server.js';
import { postgresFeatureFlags } from './modules/configuration/index.js';
import { migrationStatus } from '@ie/db';
import { createPool, type Pool } from './shared/database.js';
import { Health } from './shared/health.js';
import { createLogger } from './shared/logging.js';
import { createMetrics, startMetricsServer } from './shared/metrics.js';
import { createRedis } from './shared/redis.js';
import { buildInfo } from './shared/version.js';

const SHUTDOWN_GRACE_MS = 25_000;

function readConfig(): AppConfig {
  try {
    return loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

/**
 * Until authentication lands, requests run as the deployment's single organisation.
 * Looked up lazily so the API can start while the database is still coming up.
 */
function singleOrganization(pool: Pool): () => Promise<string | undefined> {
  let cached: string | undefined;
  return async () => {
    if (cached) return cached;
    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM org.organization ORDER BY created_at LIMIT 2',
    );
    if (rows.length === 1) cached = rows[0]?.id;
    return cached;
  };
}

const config = readConfig();
const typeDefs = loadTypeDefs();
const info = buildInfo(typeDefs);
const logger = createLogger({
  level: process.env['LOG_LEVEL'] ?? (config.nodeEnv === 'production' ? 'info' : 'debug'),
  service: 'api',
  env: config.appEnv,
  version: info.version,
  pretty: config.nodeEnv === 'development',
});

const pool = createPool(config.database, logger);
const redis = createRedis(config.redis.url, logger);
redis.connect().catch(() => undefined); // failures are reported by the error handler and readiness

const metrics = createMetrics();
const health = new Health(
  {
    database: () => pool.query('SELECT 1'),
    redis: () => redis.ping(),
    // Never serve traffic against a schema older than this build expects.
    migrations: async () => {
      const status = await migrationStatus(pool);
      if (!status.upToDate) throw new Error(`pending migrations: ${status.pending.join(', ')}`);
    },
  },
  logger,
);

const graphql = createGraphQLServer({
  config,
  logger,
  typeDefs,
  services: { featureFlags: postgresFeatureFlags(pool) },
  organizationId: singleOrganization(pool),
});

const app = createApp({ config, logger, metrics, health, graphql, buildInfo: info });
const server = createServer(app);
const metricsServer = startMetricsServer(metrics, config.http.metricsPort, logger);

for (const [name, listener, port] of [
  ['api', server, config.http.port],
  ['metrics', metricsServer, config.http.metricsPort],
] as const) {
  listener.on('error', (err: NodeJS.ErrnoException) => {
    // EACCES on Windows usually means Hyper-V/WinNAT has reserved the port
    // (`netsh interface ipv4 show excludedportrange protocol=tcp`).
    logger.fatal({ err, port }, `${name} server cannot listen on port ${port} (${err.code})`);
    process.exit(1);
  });
}

server.listen(config.http.port, () => {
  health.markStarted();
  logger.info({ port: config.http.port, metricsPort: config.http.metricsPort }, 'api listening');
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  health.startDraining();

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out');
    process.exit(1);
  }, SHUTDOWN_GRACE_MS + 5_000);
  forceExit.unref();

  // Stop accepting connections and let in-flight requests finish, then cut idle keep-alives.
  const closed = new Promise<void>((resolve) => server.close(() => resolve()));
  server.closeIdleConnections();
  setTimeout(() => server.closeAllConnections(), SHUTDOWN_GRACE_MS).unref();
  await closed;

  metricsServer.close();
  await Promise.allSettled([pool.end(), redis.quit()]);
  logger.info('shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) =>
  logger.error({ err: reason }, 'unhandled promise rejection'),
);
