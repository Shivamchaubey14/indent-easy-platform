import { createHash } from 'node:crypto';
import { uuidv7 } from '@ie/domain-types';
import { loadUserGrants } from '../../../shared/authorization/index.js';
import { type Pool, type PoolClient, withOrgContext } from '../../../shared/database.js';
import type { Logger } from '../../../shared/logging.js';
import {
  bucketFor,
  type ObjectStorage,
  type PostgresDocuments,
  storageKey,
  XLSX_MIME,
} from '../../documents/index.js';
import type { ImportContext, ImportKindHandler, PlannedRow } from '../domain/kinds.js';
import { SheetError, type SheetRow, toRows } from '../domain/sheet.js';
import type {
  BatchRecord,
  ImportSummary,
  PostgresImports,
} from '../infrastructure/postgres-imports.js';
import { readRawRows, writeReport } from '../infrastructure/workbooks.js';

/** Rows applied per transaction (SRS OP-12). */
export const CHUNK_SIZE = 1_000;

const OUTCOME: Record<PlannedRow['action'], string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  SKIP: 'Unchanged',
  REJECT: 'Rejected',
  DEACTIVATE: 'Deactivated',
};

export function summarise(plan: readonly PlannedRow[]): ImportSummary {
  const count = (action: PlannedRow['action']) => plan.filter((r) => r.action === action).length;
  return {
    created: count('CREATE'),
    updated: count('UPDATE'),
    unchanged: count('SKIP'),
    deactivated: count('DEACTIVATE'),
    rejected: count('REJECT'),
    warnings: plan.filter((r) => r.action !== 'REJECT' && r.issues.length > 0).length,
  };
}

/**
 * Works import batches in the worker (SRS OP-12): validates the file into a preview, and after
 * commitImport applies it in chunks of 1,000 rows, each chunk one transaction and each row inside
 * a savepoint (a failing row is recorded, the others go on). Batches are claimed with a lease, so
 * if a worker dies another one takes the batch over.
 *
 * On a resumed commit the file is planned again against the current data: rows the dead worker
 * already applied now plan as unchanged, so nothing is applied twice.
 */
export class ImportRunner {
  private readonly handlers: Map<string, ImportKindHandler>;

  constructor(
    private readonly pool: Pool,
    private readonly store: PostgresImports,
    private readonly documents: PostgresDocuments,
    private readonly storage: ObjectStorage,
    handlers: readonly ImportKindHandler[],
    private readonly logger: Logger,
    private readonly timezone: string,
  ) {
    this.handlers = new Map(handlers.map((h) => [h.kind, h]));
  }

  /** Claims and works one batch; false when nothing was waiting. */
  async runOnce(): Promise<boolean> {
    const claimed = await this.store.claim();
    if (!claimed) return false;
    const { batchId, organizationId } = claimed;
    const log = this.logger.child({ batchId });
    try {
      await this.work(organizationId, batchId, log);
    } catch (err) {
      log.error({ err }, 'import failed');
      await withOrgContext(this.pool, organizationId, (client) =>
        this.store.failed(client, batchId, 'INTERNAL_ERROR'),
      );
    }
    return true;
  }

  private async work(organizationId: string, batchId: string, log: Logger): Promise<void> {
    const batch = await this.store.find(organizationId, batchId);
    if (!batch) return;
    const handler = this.handlers.get(batch.kind);
    const fail = (reason: string) =>
      withOrgContext(this.pool, organizationId, (client) =>
        this.store.failed(client, batchId, reason),
      );
    if (!handler) return fail('UNKNOWN_KIND');
    const grants = batch.uploadedBy
      ? await loadUserGrants(this.pool, organizationId, batch.uploadedBy.id, this.timezone)
      : null;
    if (!grants?.can(handler.permission)) return fail('UPLOADER_NOT_ALLOWED');
    const context: ImportContext = {
      organizationId,
      userId: batch.uploadedBy!.id,
      grants,
      options: batch.options,
    };

    let rows: SheetRow[];
    try {
      rows = await this.readFile(organizationId, batch, handler);
    } catch (err) {
      if (!(err instanceof SheetError)) throw err;
      await withOrgContext(this.pool, organizationId, async (client) => {
        await this.store.replaceErrors(client, organizationId, batch.id, [
          { rowIndex: 0, issue: { rule: err.rule, message: err.message, critical: true } },
        ]);
        await this.store.validated(client, batch.id, {
          status: 'VALIDATION_FAILED',
          totalRows: 0,
          summary: null,
          resultDocumentId: null,
          failure: err.rule,
        });
      });
      log.info({ rule: err.rule, err: err.cause }, 'import file refused');
      return;
    }

    const plan = await withOrgContext(this.pool, organizationId, (client) =>
      handler.plan(client, rows, context),
    );

    if (batch.status === 'VALIDATING') {
      await withOrgContext(this.pool, organizationId, async (client) => {
        await this.store.replaceErrors(client, organizationId, batch.id, issuesOf(plan));
        const report = await this.report(client, batch, handler, rows, plan);
        await this.store.validated(client, batch.id, {
          status: batch.previewOnly ? 'PREVIEW_READY' : 'PROCESSING',
          totalRows: plan.length,
          summary: summarise(plan),
          resultDocumentId: report,
        });
      });
      log.info({ summary: summarise(plan) }, 'import validated');
      if (batch.previewOnly) return;
    }
    await this.apply(batch, handler, context, rows, plan, log);
  }

  private async readFile(
    organizationId: string,
    batch: BatchRecord,
    handler: ImportKindHandler,
  ): Promise<SheetRow[]> {
    const document = batch.fileDocumentId
      ? await this.documents.find(organizationId, batch.fileDocumentId)
      : null;
    if (!document || document.status !== 'AVAILABLE') {
      throw new SheetError('FILE_NOT_AVAILABLE', 'The uploaded file is not available.');
    }
    const stream = await this.storage.get(bucketFor(document.typeCode), document.storageKey);
    const raw = await readRawRows(stream, document.mimeType);
    const rows = toRows(raw, handler.columns);
    if (rows.length === 0) throw new SheetError('EMPTY_FILE', 'The file has no data rows.');
    return rows;
  }

  private async apply(
    batch: BatchRecord,
    handler: ImportKindHandler,
    context: ImportContext,
    rows: SheetRow[],
    plan: PlannedRow[],
    log: Logger,
  ): Promise<void> {
    const org = batch.organizationId;
    const counts = { processed: 0, succeeded: 0, failed: 0 };
    const applyFailures: { rowIndex: number; message: string }[] = [];
    // Errors from validation stay; a resumed run records its own planning again.
    await withOrgContext(this.pool, org, (client) =>
      this.store.replaceErrors(client, org, batch.id, issuesOf(plan)),
    );

    for (let start = 0; start < plan.length; start += CHUNK_SIZE) {
      const chunk = plan.slice(start, start + CHUNK_SIZE);
      await withOrgContext(this.pool, org, async (client) => {
        for (const row of chunk) {
          counts.processed++;
          if (row.action === 'REJECT') {
            counts.failed++;
            await this.store.recordRow(client, org, batch.id, row, row.entityId);
            continue;
          }
          if (row.action === 'SKIP') {
            counts.succeeded++;
            continue;
          }
          await client.query('SAVEPOINT import_row');
          try {
            const entityId = await handler.apply(client, row, context);
            await this.store.recordRow(client, org, batch.id, row, entityId);
            await client.query('RELEASE SAVEPOINT import_row');
            counts.succeeded++;
          } catch (err) {
            await client.query('ROLLBACK TO SAVEPOINT import_row');
            counts.failed++;
            const message = err instanceof Error ? err.message : String(err);
            applyFailures.push({ rowIndex: row.rowIndex, message });
            await this.store.addErrors(client, org, batch.id, [
              {
                rowIndex: row.rowIndex,
                issue: {
                  rule: 'APPLY_FAILED',
                  message: 'The row could not be saved.',
                  critical: true,
                },
              },
            ]);
            log.warn({ err, rowIndex: row.rowIndex }, 'import row failed');
          }
        }
        await this.store.progress(client, batch.id, counts);
      });
    }

    const failedRows = new Set(applyFailures.map((f) => f.rowIndex));
    const final = plan.map((row) =>
      failedRows.has(row.rowIndex) && row.rowIndex > 0
        ? {
            ...row,
            action: 'REJECT' as const,
            issues: [
              ...row.issues,
              { rule: 'APPLY_FAILED', message: 'The row could not be saved.', critical: true },
            ],
          }
        : row,
    );
    const summary = summarise(final);
    await withOrgContext(this.pool, org, async (client) => {
      const report = await this.report(client, batch, handler, rows, final);
      await this.store.completed(client, batch, {
        status: counts.failed > 0 ? 'PROCESSED_WITH_EXCEPTIONS' : 'PROCESSED',
        summary,
        succeeded: counts.succeeded,
        failed: counts.failed,
        resultDocumentId: report,
      });
    });
    log.info({ summary }, 'import applied');
  }

  /** The downloadable report: every row of the file with its outcome and problems. */
  private async report(
    client: PoolClient,
    batch: BatchRecord,
    handler: ImportKindHandler,
    rows: SheetRow[],
    plan: PlannedRow[],
  ): Promise<string> {
    const byRow = new Map(plan.map((p) => [p.rowIndex, p]));
    const describe = (p: PlannedRow | undefined) =>
      (p?.issues ?? [])
        .map(
          (i) =>
            `${i.critical ? '✖' : '⚠'} ${i.field ? `${i.field}: ` : ''}${i.message}${i.suggestion ? ` (${i.suggestion})` : ''}`,
        )
        .join('\n');
    const reportRows = [
      ...rows.map((r) => {
        const planned = byRow.get(r.rowIndex);
        return {
          rowIndex: r.rowIndex,
          values: r.values,
          outcome: planned ? OUTCOME[planned.action] : '',
          problems: describe(planned),
        };
      }),
      // Records not in the file that the import deactivates.
      ...plan
        .filter((p) => p.rowIndex === 0)
        .map((p) => ({
          rowIndex: 0,
          values: (p.change?.['values'] as Record<string, string | null>) ?? {},
          outcome: OUTCOME[p.action],
          problems: describe(p),
        })),
    ];
    const body = await writeReport(handler.title, handler.columns, reportRows, {
      row: 'Row',
      outcome: 'Outcome',
      problems: 'Problems',
    });
    const id = uuidv7();
    const fileName = `${batch.fileName.replace(/\.[^.]+$/, '')} - result.xlsx`;
    const key = storageKey({
      organizationId: batch.organizationId,
      typeCode: 'EXPORT_FILE',
      documentId: id,
      versionNo: 1,
      fileName,
      at: new Date(),
    });
    await this.storage.put(bucketFor('EXPORT_FILE'), key, body, XLSX_MIME);
    await this.documents.createGenerated(client, {
      id,
      organizationId: batch.organizationId,
      typeCode: 'EXPORT_FILE',
      title: fileName,
      ownerId: batch.uploadedBy?.id ?? null,
      storageKey: key,
      fileName,
      mimeType: XLSX_MIME,
      sizeBytes: body.length,
      sha256: createHash('sha256').update(body).digest('hex'),
    });
    return id;
  }
}

function issuesOf(plan: readonly PlannedRow[]) {
  return plan.flatMap((row) => row.issues.map((issue) => ({ rowIndex: row.rowIndex, issue })));
}
