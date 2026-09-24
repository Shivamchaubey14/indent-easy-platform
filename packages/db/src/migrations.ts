import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export const MIGRATIONS_SCHEMA = 'drizzle';
export const MIGRATIONS_TABLE = '__drizzle_migrations';

/**
 * Location of database/migrations. Images copy it next to the app and set MIGRATIONS_DIR; in the
 * repository it is found relative to this package.
 */
export function migrationsDir(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env['MIGRATIONS_DIR'] ??
    fileURLToPath(new URL('../../../database/migrations/', import.meta.url))
  );
}

interface Journal {
  entries: { idx: number; tag: string; when: number }[];
}

function readJournal(dir: string): Journal {
  return JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf8')) as Journal;
}

/** Applies pending migrations as the schema owner. Each migration runs in its own transaction. */
export async function runMigrations(
  connectionString: string,
  dir = migrationsDir(),
): Promise<void> {
  const client = new pg.Client({ connectionString, application_name: 'indent-easy-migrator' });
  await client.connect();
  try {
    await migrate(drizzle({ client }), {
      migrationsFolder: dir,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    });
  } finally {
    await client.end();
  }
}

export interface MigrationStatus {
  expected: string;
  applied: number;
  pending: string[];
  upToDate: boolean;
}

interface Queryable {
  query<R extends pg.QueryResultRow>(text: string): Promise<pg.QueryResult<R>>;
}

/**
 * Compares the database with the migrations shipped with this build. Readiness fails while
 * migrations are pending, so a new version never serves traffic against an old schema.
 */
export async function migrationStatus(
  db: Queryable,
  dir = migrationsDir(),
): Promise<MigrationStatus> {
  const entries = readJournal(dir).entries;
  const { rows } = await db.query<{ created_at: string }>(
    `SELECT created_at FROM ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`,
  );
  const appliedAt = new Set(rows.map((r) => Number(r.created_at)));
  const pending = entries.filter((e) => !appliedAt.has(e.when)).map((e) => e.tag);
  return {
    expected: entries.at(-1)?.tag ?? '(none)',
    applied: rows.length,
    pending,
    upToDate: pending.length === 0,
  };
}
