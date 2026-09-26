/*
 * Migrator entrypoint: applies pending database migrations, then exits. Runs from the API image
 * (`node dist/migrate.js`) as a one-off job before a new version of the API starts. It connects
 * as the schema owner (MIGRATION_DATABASE_URL), never as the application role.
 */
import { migrationStatus, runMigrations } from '@ie/db';
import pg from 'pg';
import { pino } from 'pino';

const logger = pino({ base: { service: 'migrator' }, timestamp: pino.stdTimeFunctions.isoTime });

const url = process.env['MIGRATION_DATABASE_URL'];
if (!url) {
  logger.fatal('MIGRATION_DATABASE_URL (the schema owner connection) is required');
  process.exit(1);
}

try {
  await runMigrations(url);
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const status = await migrationStatus(pool);
  await pool.end();
  logger.info({ applied: status.applied, latest: status.expected }, 'migrations up to date');
} catch (err) {
  logger.fatal({ err }, 'migration failed');
  process.exit(1);
}
