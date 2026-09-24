// Applies pending migrations: `pnpm db:migrate`. Also the entrypoint of the migrator job that
// runs before a new API version starts. Uses the owner connection, never the app role.
import { migrationStatus, runMigrations } from '../dist/index.js';
import pg from 'pg';

const url = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL'];
if (!url) {
  console.error('Set MIGRATION_DATABASE_URL to the schema owner connection string.');
  process.exit(1);
}

try {
  await runMigrations(url);
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const status = await migrationStatus(pool);
  await pool.end();
  console.log(`migrations up to date: ${status.applied} applied, latest ${status.expected}`);
} catch (err) {
  console.error('migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
