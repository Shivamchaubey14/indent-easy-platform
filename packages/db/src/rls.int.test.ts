/*
 * Integration tests against a migrated, seeded database, connecting as the application role.
 * Run with `pnpm test:integration` (local: `pnpm infra:up && pnpm db:reset` first).
 */
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { database, featureFlagInConfig, migrationStatus } from './index.js';

try {
  process.loadEnvFile('../../.env');
} catch {
  // CI provides the variables directly.
}

const url = process.env['DATABASE_URL'];
if (!url)
  throw new Error('DATABASE_URL (the app role connection) is required for integration tests');

const SEEDED_ORG = '0192a000-0000-7000-8000-000000000001';
const OTHER_ORG = '0192a000-0000-7000-8000-0000000000ff';

let pool: pg.Pool;

/** Runs `work` in a transaction that is always rolled back, with app.org_id set if given. */
async function inTransaction<T>(orgId: string | null, work: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (orgId) await client.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
    return await work(client);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
}

const countFlags = (client: pg.PoolClient) =>
  client
    .query<{ n: string }>('SELECT count(*) AS n FROM config.feature_flag')
    .then((r) => Number(r.rows[0]?.n));

beforeAll(() => {
  pool = new pg.Pool({ connectionString: url, max: 2 });
});

afterAll(async () => {
  await pool.end();
});

describe('application role', () => {
  it('is not the owner and cannot bypass row-level security', async () => {
    const { rows } = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean; user: string }>(
      'SELECT rolsuper, rolbypassrls, current_user AS user FROM pg_roles WHERE rolname = current_user',
    );
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, user: 'ie_app' });
  });

  it('sees migrations as up to date', async () => {
    const status = await migrationStatus(pool);
    expect(status).toMatchObject({ upToDate: true, pending: [] });
    expect(status.applied).toBeGreaterThanOrEqual(2);
  });
});

describe('row-level security', () => {
  it('hides every row when no organisation is set', async () => {
    expect(await inTransaction(null, countFlags)).toBe(0);
  });

  it("shows only the current organisation's rows", async () => {
    expect(await inTransaction(SEEDED_ORG, countFlags)).toBe(12);
    expect(await inTransaction(OTHER_ORG, countFlags)).toBe(0);
  });

  it('refuses to write rows into another organisation', async () => {
    await expect(
      inTransaction(OTHER_ORG, (client) =>
        client.query(
          'INSERT INTO config.feature_flag (organization_id, key, enabled) VALUES ($1, $2, true)',
          [SEEDED_ORG, 'smuggled_flag'],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('works through typed Drizzle queries on the transaction client', async () => {
    const flags = await inTransaction(SEEDED_ORG, (client) =>
      database(client)
        .select({ key: featureFlagInConfig.key, enabled: featureFlagInConfig.enabled })
        .from(featureFlagInConfig)
        .where(eq(featureFlagInConfig.key, 'hindi_ui')),
    );
    expect(flags).toEqual([{ key: 'hindi_ui', enabled: true }]);
  });
});

describe('history tables', () => {
  it.each(['audit.audit_log', 'inventory.stock_transaction', 'workflow.approval_action'])(
    'the app cannot update or delete %s',
    async (table) => {
      await expect(
        inTransaction(SEEDED_ORG, (client) => client.query(`DELETE FROM ${table}`)),
      ).rejects.toThrow(/permission denied/);
      await expect(
        inTransaction(SEEDED_ORG, (client) => client.query(`UPDATE ${table} SET id = id`)),
      ).rejects.toThrow(/permission denied/);
    },
  );
});
