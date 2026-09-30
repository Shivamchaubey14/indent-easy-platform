/*
 * Migrates master data from the legacy app (SRS §52, M1).
 *
 *   pnpm legacy:migrate --organization <id> [--dump legacy.sql] [--report m1.md] [--commit]
 *   docker compose run --rm migrate dist/cli/legacy-migrate.js ...   (on a VM, as the schema owner)
 *
 * --dump    stages a mysqldump of the legacy database first (re-loading replaces earlier rows)
 * --commit  keeps the result; without it the run is a dry run that only writes the report
 * Connects as the schema owner (MIGRATION_DATABASE_URL): only the owner may read legacy.*.
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { pino } from 'pino';
import { reportMarkdown, runMasters, stageDump } from '../legacy/run.js';

const logger = pino({
  base: { service: 'legacy-migrate' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
const { values } = parseArgs({
  options: {
    organization: { type: 'string' },
    dump: { type: 'string' },
    report: { type: 'string' },
    commit: { type: 'boolean', default: false },
  },
});

const url = process.env['MIGRATION_DATABASE_URL'];
if (!url || !values.organization) {
  logger.fatal('MIGRATION_DATABASE_URL and --organization <id> are required');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url, max: 2 });
try {
  if (values.dump) {
    const staged = await stageDump(pool, values.dump);
    logger.info(
      { tables: Object.fromEntries(staged.tables), skipped: staged.skipped },
      'dump staged',
    );
  }
  const report = await runMasters(pool, values.organization, { commit: values.commit });
  const path = values.report ?? `legacy-m1-${new Date().toISOString().slice(0, 10)}.md`;
  writeFileSync(
    path,
    reportMarkdown(report, { organizationId: values.organization, committed: values.commit }),
  );
  logger.info(
    { counts: report.counts, issues: report.issues.length, report: path, committed: values.commit },
    values.commit ? 'M1 committed' : 'M1 dry run finished (nothing changed; use --commit to keep)',
  );
} catch (err) {
  logger.fatal({ err }, 'legacy migration failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
