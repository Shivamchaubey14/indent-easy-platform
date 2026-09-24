import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import * as partitioned from './partitioned.js';
import * as relations from './relations.js';
import * as tables from './schema.js';

export * from './schema.js';
export * from './partitioned.js';
export {
  migrationStatus,
  migrationsDir,
  runMigrations,
  type MigrationStatus,
} from './migrations.js';

export const schema = { ...tables, ...partitioned, ...relations };

export type Database = NodePgDatabase<typeof schema>;

/**
 * A typed Drizzle handle over an existing pool or a checked-out client. Pass the transaction's
 * client (e.g. from withOrgContext) so queries run inside it with row-level security applied.
 */
export function database(client: pg.Pool | pg.PoolClient): Database {
  return drizzle({ client, schema });
}
