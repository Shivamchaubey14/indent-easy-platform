/*
 * Creates a user who can sign in, e.g. the first administrator of a new environment.
 *
 *   pnpm user:create --email admin@shwetdhara.in --name "Admin" [--employee-code E1] [--temporary]
 *   docker compose run --rm api dist/cli/create-user.js --email ... --name ...   (on a VM)
 *
 * The password is read from IE_NEW_PASSWORD, or from standard input, never from the command line
 * (which would leave it in shell history and process lists). With --temporary the user must choose
 * a new password at first sign-in.
 */
import { parseArgs } from 'node:util';
import { newPasswordSchema } from '@ie/validation';
import pg from 'pg';
import { pino } from 'pino';
import { localPasswordProblems, passwords, PostgresIdentity } from '../modules/identity/index.js';

// Local runs use the repository's .env; containers get real environment variables.
try {
  process.loadEnvFile('../../.env');
} catch {
  // not a local checkout
}

const logger = pino({ base: { service: 'create-user' }, timestamp: pino.stdTimeFunctions.isoTime });

async function readStdin(): Promise<string> {
  let data = '';
  for await (const chunk of process.stdin) data += String(chunk);
  return data.replace(/\r?\n$/, '');
}

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    'employee-code': { type: 'string' },
    organization: { type: 'string' },
    temporary: { type: 'boolean', default: false },
  },
});

const url = process.env['DATABASE_URL'];
if (!url || !values.email || !values.name) {
  logger.fatal('usage: create-user --email <e-mail> --name <display name> (DATABASE_URL required)');
  process.exit(2);
}

const password = process.env['IE_NEW_PASSWORD'] ?? (await readStdin());
const problems = [
  ...new Set([
    ...(newPasswordSchema.safeParse(password).error?.issues.map((i) => i.message) ?? []),
    ...localPasswordProblems(password, [values.email, values['employee-code']]),
  ]),
];
if (problems.length) {
  logger.fatal({ problems }, 'the password does not meet the policy');
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  let organizationId = values.organization;
  if (!organizationId) {
    const { rows } = await pool.query<{ id: string }>('SELECT id FROM org.organization LIMIT 2');
    if (rows.length !== 1) throw new Error('several organisations exist; pass --organization');
    organizationId = rows[0]!.id;
  }
  const id = await new PostgresIdentity(pool).createAccount({
    organizationId,
    email: values.email,
    displayName: values.name,
    employeeCode: values['employee-code'],
    passwordHash: await passwords.hash(password),
    mustChangePassword: values.temporary,
  });
  logger.info({ id, email: values.email.toLowerCase() }, 'user created');
} catch (err) {
  logger.fatal({ err }, 'could not create the user');
  process.exitCode = 1;
} finally {
  await pool.end();
}
