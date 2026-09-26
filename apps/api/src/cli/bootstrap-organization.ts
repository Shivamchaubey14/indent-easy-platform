/*
 * Sets up the operating organisation of a fresh environment: the organisation row and its system
 * role templates (migration 0003). Safe to run again: an existing organisation is left as it is and
 * only missing role templates are added.
 *
 *   pnpm org:bootstrap --name "Shwetdhara MPCL" --legal-name "Shwetdhara Milk Producer Company Limited"
 *   docker compose run --rm api dist/cli/bootstrap-organization.js --name ... --legal-name ...   (VM)
 *
 * Then create the first administrator with create-user and grant-role (docs/runbooks/auth.md).
 */
import { parseArgs } from 'node:util';
import pg from 'pg';
import { pino } from 'pino';
import { withOrgContext } from '../shared/database.js';

try {
  process.loadEnvFile('../../.env');
} catch {
  // not a local checkout
}

const logger = pino({
  base: { service: 'bootstrap-organization' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    'legal-name': { type: 'string' },
    timezone: { type: 'string', default: 'Asia/Kolkata' },
  },
});

const url = process.env['DATABASE_URL'];
if (!url || !values.name) {
  logger.fatal('usage: bootstrap-organization --name <name> [--legal-name <legal name>]');
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  const existing = await pool.query<{ id: string; name: string }>(
    'SELECT id, name FROM org.organization ORDER BY created_at',
  );
  let organizationId = existing.rows.find((o) => o.name === values.name)?.id;
  if (!organizationId && existing.rows.length > 0) {
    throw new Error(
      `this deployment already has an organisation (${existing.rows.map((o) => o.name).join(', ')})`,
    );
  }
  if (!organizationId) {
    const created = await pool.query<{ id: string }>(
      `INSERT INTO org.organization (name, legal_name, base_currency, time_zone)
       VALUES ($1, $2, 'INR', $3) RETURNING id`,
      [values.name, values['legal-name'] ?? values.name, values.timezone],
    );
    organizationId = created.rows[0]!.id;
    logger.info({ organizationId, name: values.name }, 'organisation created');
  }
  const roles = await withOrgContext(pool, organizationId, async (client) => {
    await client.query('SELECT identity.seed_role_templates($1)', [organizationId]);
    const { rows } = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM identity.role WHERE is_system',
    );
    return rows[0]?.count ?? 0;
  });
  logger.info({ organizationId, systemRoles: roles }, 'organisation ready');
} catch (err) {
  logger.fatal({ err }, 'could not bootstrap the organisation');
  process.exitCode = 1;
} finally {
  await pool.end();
}
