import type { Pool } from '../../shared/database.js';
import type { Logger } from '../../shared/logging.js';
import type { Documents } from '../documents/index.js';
import { ImportRunner } from './application/import-runner.js';
import { ImportService } from './application/import-service.js';
import type { ImportKindHandler } from './domain/kinds.js';
import { PostgresImports } from './infrastructure/postgres-imports.js';
import type { ImportQueries } from './interface/graphql.js';

export { importResolvers, type ImportQueries } from './interface/graphql.js';
export { importsHandlers, type ImportsOperationId } from './interface/rest.js';
export type {
  ImportContext,
  ImportIssue,
  ImportKindHandler,
  PlannedRow,
  RowAction,
} from './domain/kinds.js';
export { type ImportColumn, normaliseText, type SheetRow } from './domain/sheet.js';
export { ImportRunner } from './application/import-runner.js';

/** Import batches (SRS OP-12) for the API: the kinds come from the modules that own the data. */
export function createImports(
  pool: Pool,
  documents: Documents,
  handlers: readonly ImportKindHandler[],
): ImportQueries {
  const store = new PostgresImports(pool);
  return {
    service: new ImportService(pool, store, documents.service, handlers),
    documents: documents.service,
  };
}

/** The worker's side: claims batches and works them. */
export function createImportRunner(
  pool: Pool,
  documents: Documents,
  handlers: readonly ImportKindHandler[],
  logger: Logger,
  timezone: string,
): ImportRunner {
  return new ImportRunner(
    pool,
    new PostgresImports(pool),
    documents.store,
    documents.storage,
    handlers,
    logger.child({ module: 'imports' }),
    timezone,
  );
}
