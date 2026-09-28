import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { uuidv7 } from '@ie/domain-types';
import { uploadIntentSchema } from '@ie/validation';
import type { Grants } from '../../../shared/authorization/index.js';
import type { PoolClient } from '../../../shared/database.js';
import { ApiError } from '../../../shared/errors.js';
import type { Logger } from '../../../shared/logging.js';
import { bucketFor, contentMatchesType, hexToBase64, storageKey } from '../domain/files.js';
import type { MalwareScanner } from '../infrastructure/clamav.js';
import type { ObjectStorage } from '../infrastructure/object-storage.js';
import type { DocumentRecord, PostgresDocuments } from '../infrastructure/postgres-documents.js';

const PUT_TTL_SECONDS = 10 * 60; // SRS §35.1: PUT 10 min, GET 5 min
const GET_TTL_SECONDS = 5 * 60;

/** Import and export files are private to whoever uploaded or requested them. */
const OWNER_ONLY_TYPES = new Set(['IMPORT_FILE', 'EXPORT_FILE']);

/**
 * Import files may be uploaded by anyone allowed to run some import; each import checks its own
 * permission when it starts (OP-12). Other documents need `document:upload`.
 */
const IMPORT_PERMISSIONS = [
  'product:map_external',
  'vendor:map_products',
  'mpp:import',
  'sap_po:import',
  'reconciliation:import_sap_sales',
  'reconciliation:import_post_sheet',
  'admin:master_manage',
];

export interface Requester {
  organizationId: string;
  userId: string;
  grants: Grants;
}

export interface DocumentMeta {
  documentId: string;
  typeCode: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: string;
  versionNo: number;
  uploadedAt: string;
}

export const toMeta = (d: DocumentRecord): DocumentMeta => ({
  documentId: d.id,
  typeCode: d.typeCode,
  fileName: d.fileName,
  mimeType: d.mimeType,
  sizeBytes: d.sizeBytes,
  sha256: d.sha256,
  status: d.status,
  versionNo: d.versionNo,
  uploadedAt: new Date(d.uploadedAt).toISOString(),
});

function validationFailed(fieldErrors: Record<string, string[]>): ApiError {
  return new ApiError('VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors });
}

/** Reads up to `limit` bytes from the start of a stream (for the file-signature check). */
async function readHead(stream: Readable, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
    size += (chunk as Buffer).length;
    if (size >= limit) break;
  }
  stream.destroy();
  return Buffer.concat(chunks).subarray(0, limit);
}

/** SHA-256 (hex) and length of a whole stream. */
async function digest(stream: Readable): Promise<{ sha256: string; size: number }> {
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
    size += (chunk as Buffer).length;
  }
  return { sha256: hash.digest('hex'), size };
}

/**
 * Documents (SRS §35): uploads go straight to object storage through pre-signed URLs, never
 * through the API. A file becomes AVAILABLE only after its size, checksum, signature and (when a
 * scanner is configured) malware scan are checked; otherwise it is quarantined.
 */
export class DocumentService {
  constructor(
    private readonly store: PostgresDocuments,
    private readonly storage: ObjectStorage,
    private readonly scanner: MalwareScanner | null,
    private readonly logger: Logger,
  ) {}

  async createUploadIntent(requester: Requester, body: unknown) {
    const parsed = uploadIntentSchema.safeParse(body ?? {});
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        (fieldErrors[issue.path.join('.') || '_'] ??= []).push(issue.message);
      }
      throw validationFailed(fieldErrors);
    }
    const input = parsed.data;
    const mayUpload =
      input.documentType === 'IMPORT_FILE'
        ? IMPORT_PERMISSIONS.some((p) => requester.grants.can(p))
        : requester.grants.can('document:upload');
    if (!mayUpload) throw new ApiError('FORBIDDEN', 'You cannot upload this kind of document.');
    if (input.multipart || input.existingDocumentId) {
      // Single PUT covers the 25 MB spreadsheet limit; resumable and versioned uploads come later.
      throw validationFailed({ multipart: ['validation.notSupported'] });
    }
    const type = await this.store.documentType(requester.organizationId, input.documentType);
    if (!type) throw validationFailed({ documentType: ['validation.notFound'] });
    if (!type.allowedMime.includes(input.mimeType)) {
      throw new ApiError('DOCUMENT_TYPE_NOT_ALLOWED', 'This kind of file is not accepted here.', {
        allowed: type.allowedMime,
      });
    }
    if (input.sizeBytes > type.maxBytes) {
      throw new ApiError('DOCUMENT_TOO_LARGE', 'The file is larger than allowed.', {
        maxBytes: type.maxBytes,
      });
    }

    const documentId = uuidv7();
    const key = storageKey({
      organizationId: requester.organizationId,
      typeCode: type.code,
      documentId,
      versionNo: 1,
      fileName: input.fileName,
      at: new Date(),
    });
    await this.store.create(requester.organizationId, {
      id: documentId,
      type,
      title: input.fileName,
      ownerId: requester.userId,
      storageKey: key,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
    });
    const upload = await this.storage.presignPut({
      bucket: bucketFor(type.code),
      key,
      mimeType: input.mimeType,
      sha256Base64: hexToBase64(input.sha256),
      expiresInSeconds: PUT_TTL_SECONDS,
    });
    return {
      documentId,
      versionNo: 1,
      upload: {
        method: 'PUT' as const,
        url: upload.url,
        headers: upload.headers,
        expiresAt: new Date(Date.now() + PUT_TTL_SECONDS * 1000).toISOString(),
      },
    };
  }

  /** The document if this user may see it; NOT_FOUND otherwise (existence is not revealed). */
  async visible(requester: Requester, documentId: string): Promise<DocumentRecord> {
    const document = await this.store.find(requester.organizationId, documentId);
    const own = document?.ownerId === requester.userId;
    const allowed =
      document &&
      (own || (!OWNER_ONLY_TYPES.has(document.typeCode) && requester.grants.can('document:read')));
    if (!allowed) throw new ApiError('NOT_FOUND', 'No such document.');
    return document;
  }

  async complete(requester: Requester, documentId: string): Promise<DocumentMeta> {
    const document = await this.visible(requester, documentId);
    if (document.ownerId !== requester.userId) {
      throw new ApiError('NOT_FOUND', 'No such document.');
    }
    if (document.status === 'PENDING_UPLOAD') {
      const stored = await this.storage.head(bucketFor(document.typeCode), document.storageKey);
      if (!stored || stored.sizeBytes !== document.sizeBytes) {
        throw new ApiError('VALIDATION_FAILED', 'The file has not been uploaded completely.', {
          reason: stored ? 'SIZE_MISMATCH' : 'MISSING',
        });
      }
    }
    const updated = await this.store.markUploaded(requester.organizationId, documentId);
    return toMeta(updated ?? document);
  }

  async downloadUrl(
    requester: Requester,
    documentId: string,
    disposition: 'inline' | 'attachment',
  ): Promise<string> {
    const document = await this.visible(requester, documentId);
    if (document.status !== 'AVAILABLE') {
      throw new ApiError('DOCUMENT_NOT_AVAILABLE', 'The file is not available yet.', {
        status: document.status,
      });
    }
    await this.store.recordDownload(requester.organizationId, document);
    return this.storage.presignGet({
      bucket: bucketFor(document.typeCode),
      key: document.storageKey,
      fileName: document.fileName,
      disposition,
      expiresInSeconds: GET_TTL_SECONDS,
    });
  }

  /**
   * The worker's check of a new upload (DocumentUploaded): the stored file must have the declared
   * checksum and a signature matching its type, and pass the malware scan when a scanner is set.
   * Runs in the event consumer's transaction; a failure of the scanner itself throws, so the event
   * is retried rather than the document being judged.
   */
  async checkUpload(client: PoolClient, documentId: string): Promise<void> {
    const document = await this.store.findWith(client, documentId);
    if (!document || document.status !== 'PENDING_SCAN') return; // already settled
    const bucket = bucketFor(document.typeCode);
    const quarantine = async (scan: 'INFECTED' | 'ERROR', reason: string) => {
      await this.storage.move(bucket, 'quarantine', document.storageKey);
      await this.store.recordScan(client, document, { status: 'QUARANTINED', scan, reason });
      this.logger.warn({ documentId, reason }, 'document quarantined');
    };

    const { sha256, size } = await digest(await this.storage.get(bucket, document.storageKey));
    if (sha256 !== document.sha256 || size !== document.sizeBytes) {
      return quarantine('ERROR', 'CHECKSUM_MISMATCH');
    }
    const head = await readHead(await this.storage.get(bucket, document.storageKey), 4096);
    if (!contentMatchesType(document.mimeType, head)) {
      return quarantine('ERROR', 'CONTENT_TYPE_MISMATCH');
    }
    if (!document.requiresScan) {
      return this.store.recordScan(client, document, { status: 'AVAILABLE', scan: 'SKIPPED' });
    }
    if (!this.scanner) {
      this.logger.warn({ documentId }, 'no malware scanner configured; document not scanned');
      return this.store.recordScan(client, document, { status: 'AVAILABLE', scan: 'SKIPPED' });
    }
    const verdict = await this.scanner.scan(await this.storage.get(bucket, document.storageKey));
    if (verdict.verdict === 'INFECTED') return quarantine('INFECTED', verdict.signature);
    return this.store.recordScan(client, document, { status: 'AVAILABLE', scan: 'CLEAN' });
  }
}
