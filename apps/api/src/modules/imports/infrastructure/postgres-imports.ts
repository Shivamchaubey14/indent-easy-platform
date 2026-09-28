import { appendEvent } from '../../../events/outbox.js';
import { recordAudit } from '../../../shared/audit.js';
import { type Pool, type PoolClient, withOrgContext } from '../../../shared/database.js';
import type { ImportIssue, PlannedRow } from '../domain/kinds.js';

export interface ImportSummary {
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  rejected: number;
  warnings: number;
}

export interface BatchRecord {
  id: string;
  organizationId: string;
  kind: string;
  fileDocumentId: string | null;
  fileName: string;
  status: string;
  previewOnly: boolean;
  totalRows: number;
  processedRows: number;
  succeededRows: number;
  failedRows: number;
  summary: ImportSummary | null;
  options: Record<string, unknown>;
  resultDocumentId: string | null;
  uploadedBy: { id: string; displayName: string; employeeCode: string | null } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ImportErrorRecord {
  id: number;
  rowIndex: number;
  field: string | null;
  value: string | null;
  rule: string;
  message: string;
  suggestion: string | null;
  critical: boolean;
}

/** A file already imported for this kind (same SHA-256), unless `force` is used. */
export class DuplicateFile extends Error {
  constructor() {
    super('duplicate import file');
    this.name = 'DuplicateFile';
  }
}

const BATCH_SELECT = `
  SELECT b.id, b.organization_id AS "organizationId", b.kind, b.file_document_id AS "fileDocumentId",
         b.file_name AS "fileName", b.status, b.preview_only AS "previewOnly",
         b.total_rows AS "totalRows", b.processed_rows AS "processedRows",
         b.succeeded_rows AS "succeededRows", b.failed_rows AS "failedRows",
         b.metrics -> 'summary' AS summary, coalesce(b.options, '{}'::jsonb) AS options,
         b.result_document_id AS "resultDocumentId",
         CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object(
           'id', u.id, 'displayName', u.display_name, 'employeeCode', u.employee_code) END
           AS "uploadedBy",
         b.created_at AS "createdAt", b.started_at AS "startedAt", b.completed_at AS "completedAt"
  FROM io.import_batch b
  LEFT JOIN identity.app_user u ON u.id = b.uploaded_by`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LEASE = '5 minutes';

export class PostgresImports {
  constructor(private readonly pool: Pool) {}

  create(
    organizationId: string,
    input: {
      kind: string;
      documentId: string;
      fileName: string;
      sha256: string;
      previewOnly: boolean;
      force: boolean;
      options: Record<string, unknown>;
      uploadedBy: string;
    },
  ): Promise<string> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      try {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO io.import_batch (organization_id, kind, file_document_id, file_name,
             file_sha256, preview_only, force_reprocess, options, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            organizationId,
            input.kind,
            input.documentId,
            input.fileName,
            input.sha256,
            input.previewOnly,
            input.force,
            input.options,
            input.uploadedBy,
          ],
        );
        const id = rows[0]!.id;
        await recordAudit(client, {
          organizationId,
          action: 'IMPORT_STARTED',
          entityType: 'ImportBatch',
          entityId: id,
          after: { kind: input.kind, fileName: input.fileName, options: input.options },
        });
        return id;
      } catch (err) {
        const pgError = err as { code?: string; constraint?: string };
        if (pgError.code === '23505' && pgError.constraint === 'uq_import_file') {
          throw new DuplicateFile();
        }
        throw err;
      }
    });
  }

  find(organizationId: string, id: string): Promise<BatchRecord | null> {
    if (!UUID.test(id)) return Promise.resolve(null);
    return withOrgContext(this.pool, organizationId, (client) => this.findWith(client, id));
  }

  async findWith(client: PoolClient, id: string): Promise<BatchRecord | null> {
    const { rows } = await client.query<BatchRecord>(`${BATCH_SELECT} WHERE b.id = $1`, [id]);
    return rows[0] ?? null;
  }

  recent(organizationId: string, userId: string, kinds: string[], first: number) {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<BatchRecord>(
        `${BATCH_SELECT} WHERE b.uploaded_by = $1 AND b.kind = ANY($2) ORDER BY b.created_at DESC LIMIT $3`,
        [userId, kinds, first],
      );
      return rows;
    });
  }

  errors(organizationId: string, batchId: string, first: number, after: number | null) {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<ImportErrorRecord>(
        `SELECT id, row_index AS "rowIndex", field, value, rule, message, suggestion,
                is_critical AS critical
         FROM io.import_error WHERE batch_id = $1 AND ($2::bigint IS NULL OR id > $2)
         ORDER BY id LIMIT $3`,
        [batchId, after, first + 1],
      );
      const { rows: count } = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM io.import_error WHERE batch_id = $1',
        [batchId],
      );
      return { rows: rows.slice(0, first), hasNextPage: rows.length > first, total: count[0]!.n };
    });
  }

  /** PREVIEW_READY → PROCESSING (queued for a worker). False when not in that state. */
  requestCommit(organizationId: string, id: string): Promise<boolean> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE io.import_batch
            SET status = 'PROCESSING', preview_only = false, lease_until = NULL,
                processed_rows = 0, succeeded_rows = 0, failed_rows = 0
          WHERE id = $1 AND status = 'PREVIEW_READY'`,
        [id],
      );
      if (rowCount) {
        await recordAudit(client, {
          organizationId,
          action: 'IMPORT_COMMIT_REQUESTED',
          entityType: 'ImportBatch',
          entityId: id,
          after: { status: 'PROCESSING' },
        });
      }
      return rowCount === 1;
    });
  }

  discard(organizationId: string, id: string): Promise<boolean> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE io.import_batch SET status = 'DISCARDED', completed_at = now(), lease_until = NULL
          WHERE id = $1 AND status IN ('PREVIEW_READY', 'VALIDATION_FAILED')`,
        [id],
      );
      if (rowCount) {
        await recordAudit(client, {
          organizationId,
          action: 'IMPORT_DISCARDED',
          entityType: 'ImportBatch',
          entityId: id,
          after: { status: 'DISCARDED' },
        });
      }
      return rowCount === 1;
    });
  }

  // ---- Worker side ------------------------------------------------------------------------------

  /** Claims the next waiting batch (any organisation) with a lease; null when there is none. */
  async claim(): Promise<{ batchId: string; organizationId: string } | null> {
    const { rows } = await this.pool.query<{ batch_id: string; organization_id: string }>(
      'SELECT batch_id, organization_id FROM io.claim_import_batch($1::interval)',
      [LEASE],
    );
    const row = rows[0];
    return row ? { batchId: row.batch_id, organizationId: row.organization_id } : null;
  }

  /** Extends the lease while work goes on. */
  async renewLease(client: PoolClient, id: string): Promise<void> {
    await client.query(
      `UPDATE io.import_batch SET lease_until = now() + $2::interval WHERE id = $1`,
      [id, LEASE],
    );
  }

  /** Replaces the batch's recorded problems (a new validation run supersedes the last). */
  async replaceErrors(
    client: PoolClient,
    organizationId: string,
    batchId: string,
    rows: readonly { rowIndex: number; issue: ImportIssue }[],
  ): Promise<void> {
    await client.query('DELETE FROM io.import_error WHERE batch_id = $1', [batchId]);
    await this.addErrors(client, organizationId, batchId, rows);
  }

  async addErrors(
    client: PoolClient,
    organizationId: string,
    batchId: string,
    rows: readonly { rowIndex: number; issue: ImportIssue }[],
  ): Promise<void> {
    // Inserted in slices, so a file full of problems doesn't make one enormous statement.
    for (let start = 0; start < rows.length; start += 500) {
      const slice = rows.slice(start, start + 500);
      await client.query(
        `INSERT INTO io.import_error (organization_id, batch_id, row_index, field, value, rule,
           message, suggestion, is_critical)
         SELECT $1, $2, * FROM unnest($3::int[], $4::text[], $5::text[], $6::text[], $7::text[],
           $8::text[], $9::bool[])`,
        [
          organizationId,
          batchId,
          slice.map((r) => r.rowIndex),
          slice.map((r) => r.issue.field ?? null),
          slice.map((r) => r.issue.value ?? null),
          slice.map((r) => r.issue.rule),
          slice.map((r) => r.issue.message),
          slice.map((r) => r.issue.suggestion ?? null),
          slice.map((r) => r.issue.critical),
        ],
      );
    }
  }

  async recordRow(
    client: PoolClient,
    organizationId: string,
    batchId: string,
    row: PlannedRow,
    entityId: string | null,
  ): Promise<void> {
    await client.query(
      `INSERT INTO io.import_row_audit (organization_id, batch_id, row_index, action, entity_type,
         entity_id, changes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [organizationId, batchId, row.rowIndex, row.action, row.entityType, entityId, row.change],
    );
  }

  /** Validation finished: counts, summary, report and the next status. */
  async validated(
    client: PoolClient,
    id: string,
    input: {
      status: 'PREVIEW_READY' | 'VALIDATION_FAILED' | 'PROCESSING';
      totalRows: number;
      summary: ImportSummary | null;
      resultDocumentId: string | null;
      failure?: string;
    },
  ): Promise<void> {
    await client.query(
      `UPDATE io.import_batch
          SET status = $2, total_rows = $3, processed_rows = $4, succeeded_rows = 0,
              failed_rows = 0, metrics = $5, result_document_id = coalesce($6, result_document_id),
              lease_until = CASE WHEN $2 = 'PROCESSING' THEN lease_until ELSE NULL END,
              completed_at = CASE WHEN $2 = 'VALIDATION_FAILED' THEN now() ELSE NULL END
        WHERE id = $1`,
      [
        id,
        input.status,
        input.totalRows,
        input.status === 'PROCESSING' ? 0 : input.totalRows,
        { summary: input.summary, ...(input.failure && { failure: input.failure }) },
        input.resultDocumentId,
      ],
    );
  }

  async progress(
    client: PoolClient,
    id: string,
    counts: { processed: number; succeeded: number; failed: number },
  ): Promise<void> {
    await client.query(
      `UPDATE io.import_batch
          SET processed_rows = $2, succeeded_rows = $3, failed_rows = $4,
              lease_until = now() + $5::interval
        WHERE id = $1`,
      [id, counts.processed, counts.succeeded, counts.failed, LEASE],
    );
  }

  /** The commit finished: final status, audit and ImportCompleted, in one transaction. */
  async completed(
    client: PoolClient,
    batch: BatchRecord,
    input: {
      status: 'PROCESSED' | 'PROCESSED_WITH_EXCEPTIONS';
      summary: ImportSummary;
      succeeded: number;
      failed: number;
      resultDocumentId: string | null;
    },
  ): Promise<void> {
    await client.query(
      `UPDATE io.import_batch
          SET status = $2, metrics = $3, completed_at = now(), lease_until = NULL,
              result_document_id = coalesce($4, result_document_id)
        WHERE id = $1`,
      [batch.id, input.status, { summary: input.summary }, input.resultDocumentId],
    );
    await recordAudit(client, {
      organizationId: batch.organizationId,
      action: 'IMPORT_COMMITTED',
      entityType: 'ImportBatch',
      entityId: batch.id,
      after: { kind: batch.kind, status: input.status, summary: input.summary },
    });
    await appendEvent(client, {
      eventType: 'ImportCompleted',
      organizationId: batch.organizationId,
      aggregateType: 'ImportBatch',
      aggregateId: batch.id,
      aggregateVersion: 1,
      payload: {
        batchId: batch.id,
        kind: batch.kind,
        status: input.status,
        succeededRows: input.succeeded,
        failedRows: input.failed,
      },
      actor: batch.uploadedBy ? { type: 'USER', id: batch.uploadedBy.id } : { type: 'SYSTEM' },
      channel: 'IMPORT',
    });
  }

  /** Something went wrong outside any row (unreadable file, user deactivated, bug). */
  async failed(client: PoolClient, id: string, reason: string): Promise<void> {
    await client.query(
      `UPDATE io.import_batch
          SET status = 'FAILED', completed_at = now(), lease_until = NULL,
              metrics = coalesce(metrics, '{}'::jsonb) || jsonb_build_object('failure', $2::text)
        WHERE id = $1`,
      [id, reason],
    );
  }
}
