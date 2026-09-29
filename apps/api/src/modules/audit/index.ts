import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../graphql/context.js';
import {
  type AuditFilter,
  type AuditRecord,
  encodeCursor,
  PostgresAudit,
} from './infrastructure/postgres-audit.js';

export { PostgresAudit } from './infrastructure/postgres-audit.js';

/** The audit viewer (SRS AUD-003, AUD-004). Writing is shared/audit.ts, in each transaction. */
export const auditResolvers = {
  Query: {
    auditLog: async (
      _p: unknown,
      args: {
        filter?: AuditFilter | null;
        pagination?: { first?: number | null; after?: string | null } | null;
      },
      ctx: GraphQLContext,
    ) => {
      const first = Math.min(Math.max(args.pagination?.first ?? 25, 1), 100);
      const page = await ctx.services.audit.list(ctx.viewer().organizationId, args.filter ?? {}, {
        first,
        after: args.pagination?.after ?? null,
      });
      return {
        edges: page.rows.map((node: AuditRecord) => ({ cursor: encodeCursor(node), node })),
        pageInfo: {
          hasNextPage: page.hasNextPage,
          hasPreviousPage: Boolean(args.pagination?.after),
          startCursor: page.rows[0] ? encodeCursor(page.rows[0]) : null,
          endCursor: page.rows.at(-1) ? encodeCursor(page.rows.at(-1)!) : null,
        },
        totalCount: page.totalCount,
      };
    },
    auditChainCheck: async (_p: unknown, args: { day: string }, ctx: GraphQLContext) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.day)) {
        throw new GraphQLError('Give a day as YYYY-MM-DD.', {
          extensions: { code: 'VALIDATION_FAILED' },
        });
      }
      return ctx.services.audit.checkChain(ctx.viewer().organizationId, args.day);
    },
  },
  AuditEntry: {
    occurredAt: (entry: AuditRecord) => new Date(entry.occurredAt).toISOString(),
  },
};

export function createAudit(pool: ConstructorParameters<typeof PostgresAudit>[0]) {
  return new PostgresAudit(pool);
}
