/*
 * The real API app for integration tests: PostgreSQL as the application role, Redis, the
 * identity module and GraphQL with its real services. Only e-mail is captured instead of sent.
 */
import { loadConfig } from '@ie/config';
import { loadTypeDefs } from '@ie/graphql/schema';
import { Redis } from 'ioredis';
import pg from 'pg';
import { pino } from 'pino';
import { createApp } from '../app.js';
import { createGraphQLServer } from '../graphql/server.js';
import { postgresFeatureFlags } from '../modules/configuration/index.js';
import { createIdentity, type MailMessage } from '../modules/identity/index.js';
import { loadDirectory, organizationAdmin } from '../modules/organization/index.js';
import { loadGrants } from '../shared/authorization/index.js';
import { Health } from '../shared/health.js';
import { createMetrics } from '../shared/metrics.js';
import { buildInfo } from '../shared/version.js';

try {
  process.loadEnvFile('../../.env');
} catch {
  // CI provides the variables directly.
}

/** The seeded development organisation (database/seeds). */
export const ORG = '0192a000-0000-7000-8000-000000000001';

export async function integrationApp() {
  // CI passes only the database and Redis URLs; everything else gets a neutral test value.
  const config = loadConfig({
    PUBLIC_BASE_URL: 'http://localhost:5173',
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
    S3_BUCKET_DOCUMENTS: 'test-documents',
    S3_BUCKET_EXPORTS: 'test-exports',
    S3_BUCKET_IMPORTS: 'test-imports',
    S3_BUCKET_QUARANTINE: 'test-quarantine',
    SMTP_HOST: 'localhost',
    MAIL_FROM: 'test@indent-easy.local',
    ...process.env,
    PASSWORD_BREACH_CHECK: 'off',
  });
  const logger = pino({ level: process.env['TEST_LOG'] ?? 'silent' });
  const pool = new pg.Pool({ connectionString: config.database.url, max: 4 });
  const redis = new Redis(config.redis.url);
  const outbox: MailMessage[] = [];
  const identity = await createIdentity({
    config,
    pool,
    redis,
    logger,
    directory: (organizationId) => loadDirectory(pool, organizationId),
    mailer: { send: (message) => (outbox.push(message), Promise.resolve()) },
  });
  const typeDefs = loadTypeDefs();
  const app = createApp({
    config,
    logger,
    metrics: createMetrics(),
    health: new Health({}, logger),
    graphql: createGraphQLServer({
      config,
      logger,
      typeDefs,
      services: {
        featureFlags: postgresFeatureFlags(pool),
        identity: identity.queries,
        admin: identity.admin,
        organizationAdmin: organizationAdmin(pool),
        directory: (organizationId) => loadDirectory(pool, organizationId),
        access: (principal) => loadGrants(pool, principal, config.timezone),
        denied: identity.recordDenied,
      },
    }),
    buildInfo: buildInfo(typeDefs),
    identity,
  });
  return {
    app,
    pool,
    redis,
    outbox,
    close: async () => {
      await pool.end();
      redis.disconnect();
    },
  };
}
