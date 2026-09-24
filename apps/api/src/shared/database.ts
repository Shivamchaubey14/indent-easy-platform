import type { AppConfig } from '@ie/config';
import pg from 'pg';
import type { Logger } from './logging.js';

export type Pool = pg.Pool;
export type PoolClient = pg.PoolClient;

export function createPool(config: AppConfig['database'], logger: Logger): Pool {
  const pool = new pg.Pool({
    connectionString: config.url,
    max: config.poolMax,
    application_name: 'indent-easy-api',
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  // An idle client losing its connection must not crash the process.
  pool.on('error', (err) => logger.error({ err }, 'idle database client error'));
  return pool;
}

/**
 * Runs `work` in a transaction with `app.org_id` set, which the row-level security policies
 * use to isolate organisations. Every business query goes through here.
 */
export async function withOrgContext<T>(
  pool: Pool,
  organizationId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.org_id', $1, true)", [organizationId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
