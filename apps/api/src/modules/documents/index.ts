import type { AppConfig } from '@ie/config';
import type { Pool } from '../../shared/database.js';
import type { Logger } from '../../shared/logging.js';
import { DocumentService } from './application/document-service.js';
import { clamdScanner } from './infrastructure/clamav.js';
import { type ObjectStorage, s3Storage } from './infrastructure/object-storage.js';
import { PostgresDocuments } from './infrastructure/postgres-documents.js';

export { DocumentService, type Requester } from './application/document-service.js';
export { filesHandlers, type FilesOperationId } from './interface/rest.js';
export type { ObjectStorage } from './infrastructure/object-storage.js';
export type { MalwareScanner } from './infrastructure/clamav.js';
export { PostgresDocuments } from './infrastructure/postgres-documents.js';
export { XLSX_MIME, bucketFor, storageKey } from './domain/files.js';

export interface Documents {
  service: DocumentService;
  store: PostgresDocuments;
  storage: ObjectStorage;
}

/** Documents and file storage (SRS §35), for the API and the worker. */
export function createDocuments(
  config: AppConfig,
  pool: Pool,
  logger: Logger,
  storage: ObjectStorage = s3Storage(config.storage),
): Documents {
  const store = new PostgresDocuments(pool);
  const scanner = config.scanner ? clamdScanner(config.scanner) : null;
  const service = new DocumentService(
    store,
    storage,
    scanner,
    logger.child({ module: 'documents' }),
  );
  return { service, store, storage };
}
