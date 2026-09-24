/*
 * Migrator entrypoint: applies pending database migrations, then exits. Runs from the API image
 * (`node dist/migrate.js`) as a one-off job before a new version of the API starts. It connects
 * as the schema owner (MIGRATION_DATABASE_URL), never as the application role.
 */
import { migrationStatus, runMigrations } from '@ie/db';
import pg from 'pg';

const url = process.env['MIGRATION_DATABASE_URL'];
if (!url) {
  console.error('MIGRATION_DATABASE_URL (the schema owner connection) is required');
  process.exit(1);
}

try {
  await runMigrations(url);
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const status = await migrationStatus(pool);
  await pool.end();
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'migrations up to date',
      applied: status.applied,
      latest: status.expected,
    }),
  );
} catch (err) {
  console.error(
    JSON.stringify({
      level: 'fatal',
      msg: 'migration failed',
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
}
