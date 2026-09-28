import type { GraphQLContext } from '../../../graphql/context.js';
import type { DocumentService, Requester } from '../../documents/index.js';
import type { ImportResult, ImportService } from '../application/import-service.js';
import type { BatchRecord } from '../infrastructure/postgres-imports.js';

export interface ImportQueries {
  service: ImportService;
  documents: DocumentService;
}

const imports = (ctx: GraphQLContext) => ctx.services.imports;

async function requester(ctx: GraphQLContext): Promise<Requester> {
  const viewer = ctx.viewer();
  return {
    organizationId: viewer.organizationId,
    userId: viewer.userId,
    grants: (await ctx.access()).grants,
  };
}

const payload = (result: ImportResult) =>
  result.ok
    ? { batch: result.batch, userErrors: [] }
    : { batch: null, userErrors: result.userErrors };

/** Import batches (SRS OP-12): start, commit, discard and follow. */
export const importResolvers = {
  Query: {
    importBatch: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) =>
      imports(ctx).service.visible(await requester(ctx), args.id),
    importBatches: async (
      _p: unknown,
      args: { kinds: string[]; first?: number | null },
      ctx: GraphQLContext,
    ) =>
      imports(ctx).service.recent(
        await requester(ctx),
        args.kinds,
        Math.min(Math.max(args.first ?? 20, 1), 100),
      ),
  },
  Mutation: {
    startImport: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      payload(await imports(ctx).service.start(await requester(ctx), args.input)),
    commitImport: async (_p: unknown, args: { input: { batchId: string } }, ctx: GraphQLContext) =>
      payload(await imports(ctx).service.commit(await requester(ctx), args.input.batchId)),
    discardImport: async (_p: unknown, args: { batchId: string }, ctx: GraphQLContext) =>
      payload(await imports(ctx).service.discard(await requester(ctx), args.batchId)),
  },
  ImportBatch: {
    progressPct: (batch: BatchRecord) =>
      batch.totalRows > 0 ? Math.round((batch.processedRows / batch.totalRows) * 1000) / 10 : 0,
    errors: async (
      batch: BatchRecord,
      args: { first?: number | null; after?: string | null },
      ctx: GraphQLContext,
    ) => {
      const first = Math.min(Math.max(args.first ?? 50, 1), 500);
      const after = args.after && /^\d+$/.test(args.after) ? Number(args.after) : null;
      const page = await imports(ctx).service.errors(batch.organizationId, batch.id, first, after);
      return {
        edges: page.rows.map((node) => ({ cursor: String(node.id), node })),
        pageInfo: {
          hasNextPage: page.hasNextPage,
          hasPreviousPage: after !== null,
          startCursor: page.rows[0] ? String(page.rows[0].id) : null,
          endCursor: page.rows.at(-1) ? String(page.rows.at(-1)!.id) : null,
        },
        totalCount: page.total,
      };
    },
    resultDocument: async (batch: BatchRecord, _a: unknown, ctx: GraphQLContext) => {
      if (!batch.resultDocumentId) return null;
      const who = await requester(ctx);
      const service = imports(ctx).documents;
      const document = await service.visible(who, batch.resultDocumentId).catch(() => null);
      if (!document) return null;
      return {
        id: document.id,
        typeCode: document.typeCode,
        title: document.fileName,
        fileName: document.fileName,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        sha256: document.sha256,
        status: document.status,
        versionNo: document.versionNo,
        versions: [],
        uploadedBy: batch.uploadedBy,
        uploadedAt: new Date(document.uploadedAt).toISOString(),
        downloadUrl:
          document.status === 'AVAILABLE'
            ? await service.signedUrl(who, document.id).catch(() => null)
            : null,
        previewUrl: null,
      };
    },
  },
};
