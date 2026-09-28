import type { UserError } from '@ie/graphql';
import { z } from 'zod';
import type { Grants } from '../../../shared/authorization/index.js';
import { withOrgContext, type Pool } from '../../../shared/database.js';
import type { DocumentService, Requester } from '../../documents/index.js';
import type { ImportKindHandler } from '../domain/kinds.js';
import {
  type BatchRecord,
  DuplicateFile,
  type PostgresImports,
} from '../infrastructure/postgres-imports.js';
import { writeTemplate } from '../infrastructure/workbooks.js';

export type ImportResult =
  { ok: true; batch: BatchRecord } | { ok: false; userErrors: UserError[] };

const startSchema = z.object({
  kind: z.string(),
  documentId: z.string().min(1),
  previewOnly: z.boolean().nullish(),
  options: z.record(z.string(), z.unknown()).nullish(),
  force: z.boolean().nullish(),
});

const problem = (
  code: UserError['code'],
  message: string,
  field: string[] = ['input'],
): ImportResult => ({ ok: false, userErrors: [{ code, message, field, details: null }] });

/**
 * Starting, committing and following imports (SRS OP-12). The work itself happens in the worker
 * (ImportRunner); this side checks permissions, creates the batch and moves it between states.
 */
export class ImportService {
  private readonly handlers: Map<string, ImportKindHandler>;

  constructor(
    private readonly pool: Pool,
    private readonly store: PostgresImports,
    private readonly documents: DocumentService,
    handlers: readonly ImportKindHandler[],
  ) {
    this.handlers = new Map(handlers.map((h) => [h.kind, h]));
  }

  handler(kind: string): ImportKindHandler | undefined {
    return this.handlers.get(kind);
  }

  /** Kinds this user may import. */
  kindsFor(grants: Grants): string[] {
    return [...this.handlers.values()].filter((h) => grants.can(h.permission)).map((h) => h.kind);
  }

  async start(requester: Requester, raw: unknown): Promise<ImportResult> {
    const parsed = startSchema.safeParse(raw);
    if (!parsed.success) return problem('VALIDATION_FAILED', 'validation.required');
    const input = parsed.data;
    const handler = this.handlers.get(input.kind);
    if (!handler) return problem('VALIDATION_FAILED', 'validation.importKind', ['input', 'kind']);
    if (!requester.grants.can(handler.permission)) {
      return problem('FORBIDDEN', 'validation.beyondYourAccess', ['input', 'kind']);
    }
    let document;
    try {
      document = await this.documents.visible(requester, input.documentId);
    } catch {
      return problem('NOT_FOUND', 'validation.notFound', ['input', 'documentId']);
    }
    if (document.typeCode !== 'IMPORT_FILE' || document.ownerId !== requester.userId) {
      return problem('NOT_FOUND', 'validation.notFound', ['input', 'documentId']);
    }
    if (document.status !== 'AVAILABLE') {
      return problem('DOCUMENT_NOT_AVAILABLE', 'validation.fileNotReady', ['input', 'documentId']);
    }
    try {
      const id = await this.store.create(requester.organizationId, {
        kind: handler.kind,
        documentId: document.id,
        fileName: document.fileName,
        sha256: document.sha256,
        previewOnly: input.previewOnly ?? true,
        force: input.force ?? false,
        options: input.options ?? {},
        uploadedBy: requester.userId,
      });
      return { ok: true, batch: (await this.store.find(requester.organizationId, id))! };
    } catch (err) {
      if (err instanceof DuplicateFile) {
        return problem('RECONCILIATION_DUPLICATE_FILE', 'validation.importDuplicateFile', [
          'input',
          'documentId',
        ]);
      }
      throw err;
    }
  }

  /** The batch if this user may see it: their own, of a kind they may import. */
  async visible(requester: Requester, id: string): Promise<BatchRecord | null> {
    const batch = await this.store.find(requester.organizationId, id);
    const handler = batch && this.handlers.get(batch.kind);
    if (!batch || !handler || !requester.grants.can(handler.permission)) return null;
    return batch.uploadedBy?.id === requester.userId ? batch : null;
  }

  async commit(requester: Requester, batchId: string): Promise<ImportResult> {
    const batch = await this.visible(requester, batchId);
    if (!batch) return problem('NOT_FOUND', 'validation.notFound', ['input', 'batchId']);
    if (!(await this.store.requestCommit(requester.organizationId, batch.id))) {
      return problem('CONFLICT', 'validation.importNotReady', ['input', 'batchId']);
    }
    return { ok: true, batch: (await this.store.find(requester.organizationId, batch.id))! };
  }

  async discard(requester: Requester, batchId: string): Promise<ImportResult> {
    const batch = await this.visible(requester, batchId);
    if (!batch) return problem('NOT_FOUND', 'validation.notFound', ['batchId']);
    if (!(await this.store.discard(requester.organizationId, batch.id))) {
      return problem('CONFLICT', 'validation.importNotReady', ['batchId']);
    }
    return { ok: true, batch: (await this.store.find(requester.organizationId, batch.id))! };
  }

  recent(requester: Requester, kinds: string[], first: number) {
    const allowed = kinds.filter((k) => {
      const handler = this.handlers.get(k);
      return handler && requester.grants.can(handler.permission);
    });
    if (allowed.length === 0) return Promise.resolve([]);
    return this.store.recent(requester.organizationId, requester.userId, allowed, first);
  }

  errors(organizationId: string, batchId: string, first: number, after: number | null) {
    return this.store.errors(organizationId, batchId, first, after);
  }

  /** The kind's template holding the current data (MST-004/007: import and export in one). */
  async template(requester: Requester, kind: string): Promise<{ fileName: string; body: Buffer }> {
    const handler = this.handlers.get(kind);
    if (!handler || !requester.grants.can(handler.permission)) {
      throw new Error('not allowed'); // the REST handler checks first; this is a backstop
    }
    const data = await withOrgContext(this.pool, requester.organizationId, (client) =>
      handler.exportRows(client, {
        organizationId: requester.organizationId,
        userId: requester.userId,
        grants: requester.grants,
        options: {},
      }),
    );
    const date = new Date().toISOString().slice(0, 10);
    return {
      fileName: `${handler.title} ${date}.xlsx`,
      body: await writeTemplate(handler.title, handler.columns, data),
    };
  }
}
