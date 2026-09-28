import { appendEvent } from '../../../events/outbox.js';
import { recordAudit } from '../../../shared/audit.js';
import { currentContext } from '../../../shared/context.js';
import { type Pool, type PoolClient, withOrgContext } from '../../../shared/database.js';

export interface DocumentType {
  id: string;
  code: string;
  allowedMime: string[];
  maxBytes: number;
  requiresScan: boolean;
}

/** A document with its current version: what the API and the scanner need. */
export interface DocumentRecord {
  id: string;
  organizationId: string;
  typeCode: string;
  status: string;
  ownerId: string | null;
  versionNo: number;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  scanStatus: string;
  requiresScan: boolean;
  uploadedAt: string;
}

const DOCUMENT_SELECT = `
  SELECT d.id, d.organization_id AS "organizationId", t.code AS "typeCode", d.status,
         d.owner_id AS "ownerId", v.version_no AS "versionNo", v.storage_key AS "storageKey",
         v.file_name AS "fileName", v.mime_type AS "mimeType", v.size_bytes::float8 AS "sizeBytes",
         v.sha256, v.scan_status AS "scanStatus", t.requires_scan AS "requiresScan",
         v.uploaded_at AS "uploadedAt"
  FROM docs.document d
  JOIN docs.document_type t ON t.id = d.type_id
  JOIN docs.document_version v ON v.document_id = d.id AND v.version_no = d.current_version_no`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Events of one document version: uploaded is 2n-1, available is 2n (ordered per document). */
const uploadedVersion = (versionNo: number) => versionNo * 2 - 1;
const availableVersion = (versionNo: number) => versionNo * 2;

function actor() {
  const principal = currentContext()?.principal;
  return principal ? { type: 'USER' as const, id: principal.userId } : { type: 'SYSTEM' as const };
}

export class PostgresDocuments {
  constructor(private readonly pool: Pool) {}

  documentType(organizationId: string, code: string): Promise<DocumentType | null> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<DocumentType>(
        `SELECT id, code, allowed_mime AS "allowedMime", max_bytes::float8 AS "maxBytes",
                requires_scan AS "requiresScan"
         FROM docs.document_type WHERE code = $1`,
        [code],
      );
      return rows[0] ?? null;
    });
  }

  find(organizationId: string, id: string): Promise<DocumentRecord | null> {
    if (!UUID.test(id)) return Promise.resolve(null);
    return withOrgContext(this.pool, organizationId, (client) => this.findWith(client, id));
  }

  async findWith(client: PoolClient, id: string): Promise<DocumentRecord | null> {
    const { rows } = await client.query<DocumentRecord>(
      `${DOCUMENT_SELECT} WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  /** Creates the document and its first version, waiting for the upload. */
  create(
    organizationId: string,
    input: {
      id: string;
      type: DocumentType;
      title: string;
      ownerId: string;
      storageKey: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
    },
  ): Promise<void> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      await client.query(
        `INSERT INTO docs.document (id, organization_id, type_id, title, owner_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [input.id, organizationId, input.type.id, input.title, input.ownerId],
      );
      await client.query(
        `INSERT INTO docs.document_version (organization_id, document_id, version_no, storage_key,
           file_name, mime_type, size_bytes, sha256, uploaded_by)
         VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8)`,
        [
          organizationId,
          input.id,
          input.storageKey,
          input.fileName,
          input.mimeType,
          input.sizeBytes,
          input.sha256,
          input.ownerId,
        ],
      );
      await recordAudit(client, {
        organizationId,
        action: 'DOCUMENT_UPLOAD_STARTED',
        entityType: 'Document',
        entityId: input.id,
        after: {
          type: input.type.code,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          sha256: input.sha256,
        },
      });
    });
  }

  /**
   * PENDING_UPLOAD → PENDING_SCAN, with DocumentUploaded for the scanner. Returns the document as
   * it is afterwards; a second call finds it already past PENDING_UPLOAD and changes nothing.
   */
  markUploaded(organizationId: string, id: string): Promise<DocumentRecord | null> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE docs.document SET status = 'PENDING_SCAN'
         WHERE id = $1 AND status = 'PENDING_UPLOAD'`,
        [id],
      );
      const document = await this.findWith(client, id);
      if (rowCount && document) {
        await recordAudit(client, {
          organizationId,
          action: 'DOCUMENT_UPLOADED',
          entityType: 'Document',
          entityId: id,
          after: { status: 'PENDING_SCAN', versionNo: document.versionNo },
        });
        await appendEvent(client, {
          eventType: 'DocumentUploaded',
          organizationId,
          aggregateType: 'Document',
          aggregateId: id,
          aggregateVersion: uploadedVersion(document.versionNo),
          payload: {
            documentId: id,
            versionNo: document.versionNo,
            typeCode: document.typeCode,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
          },
          actor: actor(),
        });
      }
      return document;
    });
  }

  /**
   * Records the scanner's verdict in the consumer's transaction. Clean (or not scanned, when no
   * scanner is configured) → AVAILABLE + DocumentAvailable; otherwise QUARANTINED + a security event.
   */
  async recordScan(
    client: PoolClient,
    document: DocumentRecord,
    outcome:
      | { status: 'AVAILABLE'; scan: 'CLEAN' | 'SKIPPED' }
      | { status: 'QUARANTINED'; scan: 'INFECTED' | 'ERROR'; reason: string },
  ): Promise<void> {
    await client.query(
      `UPDATE docs.document_version SET scan_status = $3, scanned_at = now()
       WHERE document_id = $1 AND version_no = $2`,
      [document.id, document.versionNo, outcome.scan],
    );
    await client.query(`UPDATE docs.document SET status = $2 WHERE id = $1`, [
      document.id,
      outcome.status,
    ]);
    await recordAudit(client, {
      organizationId: document.organizationId,
      action: outcome.status === 'AVAILABLE' ? 'DOCUMENT_AVAILABLE' : 'DOCUMENT_QUARANTINED',
      entityType: 'Document',
      entityId: document.id,
      before: { status: document.status },
      after: {
        status: outcome.status,
        scan: outcome.scan,
        ...(outcome.status === 'QUARANTINED' && { reason: outcome.reason }),
      },
    });
    if (outcome.status === 'AVAILABLE') {
      await appendEvent(client, {
        eventType: 'DocumentAvailable',
        organizationId: document.organizationId,
        aggregateType: 'Document',
        aggregateId: document.id,
        aggregateVersion: availableVersion(document.versionNo),
        payload: { documentId: document.id, versionNo: document.versionNo },
        actor: { type: 'SYSTEM' },
        channel: 'SYSTEM',
      });
    } else {
      await client.query(
        `INSERT INTO audit.security_event (organization_id, type, user_id, outcome, details)
         VALUES ($1, 'DOCUMENT_QUARANTINED', $2, 'BLOCKED', $3)`,
        [
          document.organizationId,
          document.ownerId,
          { documentId: document.id, fileName: document.fileName, reason: outcome.reason },
        ],
      );
    }
  }

  /** Records a download of a document (the audit trail of who saw what). */
  recordDownload(organizationId: string, document: DocumentRecord): Promise<void> {
    return withOrgContext(this.pool, organizationId, (client) =>
      recordAudit(client, {
        organizationId,
        action: 'DOCUMENT_DOWNLOADED',
        entityType: 'Document',
        entityId: document.id,
        after: { versionNo: document.versionNo },
      }),
    );
  }

  /** Stores a file the system produced (an error report, an export) as an AVAILABLE document. */
  async createGenerated(
    client: PoolClient,
    input: {
      id: string;
      organizationId: string;
      typeCode: string;
      title: string;
      ownerId: string | null;
      storageKey: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO docs.document (id, organization_id, type_id, title, owner_id, status)
       SELECT $1, $2, t.id, $4, $5, 'AVAILABLE' FROM docs.document_type t WHERE t.code = $3`,
      [input.id, input.organizationId, input.typeCode, input.title, input.ownerId],
    );
    await client.query(
      `INSERT INTO docs.document_version (organization_id, document_id, version_no, storage_key,
         file_name, mime_type, size_bytes, sha256, scan_status, scanned_at, uploaded_by)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7, 'SKIPPED', now(), $8)`,
      [
        input.organizationId,
        input.id,
        input.storageKey,
        input.fileName,
        input.mimeType,
        input.sizeBytes,
        input.sha256,
        input.ownerId,
      ],
    );
  }
}
