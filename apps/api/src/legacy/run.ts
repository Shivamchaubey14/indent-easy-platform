import type { Pool } from '../shared/database.js';
import { recordAudit } from '../shared/audit.js';
import { readDump, type LegacyRow } from './dump.js';
import { migrateMasters, type Report } from './m1.js';

/** Copies a legacy dump into legacy.source_row (re-loading a newer dump replaces the rows). */
export async function stageDump(pool: Pool, path: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await readDump(path, async (table, rows: LegacyRow[]) => {
      for (let start = 0; start < rows.length; start += 500) {
        const slice = rows.slice(start, start + 500);
        await client.query(
          `INSERT INTO legacy.source_row (table_name, legacy_id, data)
           SELECT * FROM unnest($1::text[], $2::text[], $3::jsonb[])
           ON CONFLICT (table_name, legacy_id) DO UPDATE SET data = EXCLUDED.data, loaded_at = now()`,
          [
            slice.map(() => table),
            slice.map((row, i) => String(row['id'] ?? `#${start + i + 1}`)),
            slice.map((row) => JSON.stringify(row)),
          ],
        );
      }
    });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Runs M1 for an organisation in one transaction and records the run with its report. A dry run
 * rolls everything back, so the report can be reviewed before anything changes.
 */
export async function runMasters(
  pool: Pool,
  organizationId: string,
  options: { commit: boolean },
): Promise<Report> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: string }>(
      "INSERT INTO legacy.run (organization_id, phase) VALUES ($1, 'M1') RETURNING id",
      [organizationId],
    );
    const report = await migrateMasters(client, organizationId);
    await client.query('UPDATE legacy.run SET finished_at = now(), report = $2 WHERE id = $1', [
      rows[0]!.id,
      { counts: report.counts, issues: report.issues, committed: options.commit },
    ]);
    await recordAudit(client, {
      organizationId,
      action: 'LEGACY_MIGRATION_RUN',
      entityType: 'Organization',
      entityId: organizationId,
      entityNumber: 'M1',
      after: { counts: report.counts, issues: report.issues.length },
    });
    await client.query(options.commit ? 'COMMIT' : 'ROLLBACK');
    return report;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** The reconciliation report for business sign-off (SRS §52.2 M1 exit criteria), as Markdown. */
export function reportMarkdown(
  report: Report,
  meta: { organizationId: string; committed: boolean },
): string {
  const lines = [
    `# Legacy migration M1 — master data`,
    '',
    `Organisation \`${meta.organizationId}\` · ${new Date().toISOString()} · ${meta.committed ? '**committed**' : '**dry run** (nothing was changed)'}`,
    '',
    '| Entity | Legacy | Created | Already there | Merged | Not migrated |',
    '|---|---:|---:|---:|---:|---:|',
    ...Object.entries(report.counts).map(
      ([entity, c]) =>
        `| ${entity} | ${c.legacy} | ${c.created} | ${c.matched} | ${c.merged} | ${c.skipped} |`,
    ),
    '',
    `## Needs a decision (${report.issues.length})`,
    '',
  ];
  const byEntity = new Map<string, typeof report.issues>();
  for (const issue of report.issues)
    byEntity.set(issue.entity, [...(byEntity.get(issue.entity) ?? []), issue]);
  for (const [entity, issues] of byEntity) {
    lines.push(`### ${entity}`, '', '| Record | Problem | Detail |', '|---|---|---|');
    for (const i of issues) {
      lines.push(
        `| ${i.legacyKey.replace(/\|/g, '/')} | ${i.problem} | ${(i.detail ?? '').replace(/\|/g, '/')} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}
