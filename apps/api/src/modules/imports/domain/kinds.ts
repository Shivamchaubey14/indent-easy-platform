import type { Grants } from '../../../shared/authorization/index.js';
import type { PoolClient } from '../../../shared/database.js';
import type { ImportColumn, SheetRow } from './sheet.js';

/** A problem with one row (io.import_error). Critical problems reject the row. */
export interface ImportIssue {
  field?: string | null;
  value?: string | null;
  /** Stable rule id, e.g. CONFLICTING_MAPPINGS (legacy ValidationRule names where they exist). */
  rule: string;
  message: string;
  suggestion?: string | null;
  critical: boolean;
}

export type RowAction = 'CREATE' | 'UPDATE' | 'SKIP' | 'REJECT' | 'DEACTIVATE';

/**
 * What the import will do with one row, decided against the current data. `change` is what
 * `apply` needs (kind-specific) and what the row audit records.
 */
export interface PlannedRow {
  /** Spreadsheet row; 0 for records not in the file (deactivations). */
  rowIndex: number;
  action: RowAction;
  entityType: string;
  entityId: string | null;
  issues: ImportIssue[];
  change: Record<string, unknown> | null;
}

export interface ImportContext {
  organizationId: string;
  /** The uploader, whose current permissions and scope the import runs with. */
  userId: string;
  grants: Grants;
  options: Record<string, unknown>;
}

/** One kind of import (SRS OP-12): its columns, its checks and how it applies a row. */
export interface ImportKindHandler {
  kind: string;
  /** Needed to start, commit and see the batch; the handler may also check scope per row. */
  permission: string;
  /** Title of the template's sheet and download file. */
  title: string;
  columns: readonly ImportColumn[];
  /** Checks every row against the data as it is now, in one transaction (with org set). */
  plan(client: PoolClient, rows: SheetRow[], context: ImportContext): Promise<PlannedRow[]>;
  /** Applies planned rows (never REJECT/SKIP ones) in the caller's transaction. */
  apply(client: PoolClient, row: PlannedRow, context: ImportContext): Promise<string | null>;
  /** Current data in the template's columns, for the template/export download. */
  exportRows(client: PoolClient, context: ImportContext): Promise<Record<string, unknown>[]>;
}
