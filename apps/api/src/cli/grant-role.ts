/*
 * Gives a user one of the organisation's roles, optionally limited to some locations.
 *
 *   pnpm user:grant --email admin@shwetdhara.in --role SUPER_ADMIN
 *   pnpm user:grant --email store@shwetdhara.in --role STORE_USER --locations BMC-01,BMC-02
 *   docker compose run --rm api dist/cli/grant-role.js --email ... --role ...   (on a VM)
 *
 * Without --locations the role applies to the whole organisation. The user's current access
 * tokens stop working at once and are refreshed with the new permissions.
 */
import { parseArgs } from 'node:util';
import pg from 'pg';
import { pino } from 'pino';
import { PostgresIdentity } from '../modules/identity/index.js';

try {
  process.loadEnvFile('../../.env');
} catch {
  // not a local checkout
}

const logger = pino({ base: { service: 'grant-role' }, timestamp: pino.stdTimeFunctions.isoTime });

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    role: { type: 'string' },
    locations: { type: 'string' },
  },
});

const url = process.env['DATABASE_URL'];
if (!url || !values.email || !values.role) {
  logger.fatal('usage: grant-role --email <e-mail> --role <ROLE_CODE> [--locations CODE,CODE]');
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  const store = new PostgresIdentity(pool);
  const account = await store.findLoginAccount(values.email);
  if (!account) throw new Error(`no user with e-mail ${values.email}`);
  const locationCodes = (values.locations ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
  await store.assignRole({
    organizationId: account.organizationId,
    userId: account.userId,
    roleCode: values.role.toUpperCase(),
    locationCodes,
  });
  logger.info(
    { email: values.email, role: values.role.toUpperCase(), locations: locationCodes },
    'role granted',
  );
} catch (err) {
  logger.fatal({ err }, 'could not grant the role');
  process.exitCode = 1;
} finally {
  await pool.end();
}
