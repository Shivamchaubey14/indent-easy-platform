import { type ChainCheck, verifyAuditChain } from '../../../shared/audit.js';
import { type Pool, withOrgContext } from '../../../shared/database.js';

export interface AuditFilter {
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  action?: string | null;
  requestId?: string | null;
  occurredAt?: { from?: string | null; to?: string | null } | null;
}

interface UserRef {
  id: string;
  displayName: string;
  employeeCode: string | null;
}

export interface AuditRecord {
  id: string;
  occurredAt: string;
  actor: UserRef | null;
  onBehalfOf: UserRef | null;
  action: string;
  entityType: string;
  entityId: string;
  entityNumber: string | null;
  before: unknown;
  after: unknown;
  requestId: string | null;
  channel: string | null;
  ip: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const userRef = (alias: string) => `CASE WHEN ${alias}.id IS NULL THEN NULL ELSE json_build_object(
  'id', ${alias}.id, 'displayName', ${alias}.display_name, 'employeeCode', ${alias}.employee_code) END`;

/** Cursor = occurred_at and id of the last row (newest first), base64url encoded. */
export const encodeCursor = (row: { occurredAt: string; id: string }) =>
  Buffer.from(`${new Date(row.occurredAt).toISOString()}|${row.id}`).toString('base64url');

function decodeCursor(cursor: string | null | undefined): { at: string; id: string } | null {
  if (!cursor) return null;
  const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  return at && id && UUID.test(id) && !Number.isNaN(Date.parse(at)) ? { at, id } : null;
}

/** Reading the audit log of one organisation (AUD-003); row-level security isolates it too. */
export class PostgresAudit {
  constructor(private readonly pool: Pool) {}

  list(
    organizationId: string,
    filter: AuditFilter,
    page: { first: number; after?: string | null },
  ): Promise<{ rows: AuditRecord[]; hasNextPage: boolean; totalCount: number }> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const where: string[] = ['a.organization_id = $1'];
      const params: unknown[] = [organizationId];
      const add = (sql: string, value: unknown) => {
        params.push(value);
        where.push(sql.replace('$?', `$${params.length}`));
      };
      if (filter.entityType) add('a.entity_type = $?', filter.entityType);
      if (filter.entityId) {
        if (!UUID.test(filter.entityId)) return { rows: [], hasNextPage: false, totalCount: 0 };
        add('a.entity_id = $?', filter.entityId);
      }
      if (filter.actorId) {
        if (!UUID.test(filter.actorId)) return { rows: [], hasNextPage: false, totalCount: 0 };
        add('a.actor_id = $?', filter.actorId);
      }
      if (filter.action) add('a.action = $?', filter.action.toUpperCase());
      if (filter.requestId) add('a.request_id = $?', filter.requestId);
      if (filter.occurredAt?.from) add('a.occurred_at >= $?::timestamptz', filter.occurredAt.from);
      if (filter.occurredAt?.to) add('a.occurred_at <= $?::timestamptz', filter.occurredAt.to);

      const { rows: count } = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit.audit_log a WHERE ${where.join(' AND ')}`,
        params,
      );
      const cursor = decodeCursor(page.after);
      if (cursor) {
        params.push(cursor.at, cursor.id);
        where.push(
          `(a.occurred_at, a.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
        );
      }
      params.push(page.first + 1);
      const { rows } = await client.query<AuditRecord>(
        `SELECT a.id, a.occurred_at AS "occurredAt", ${userRef('actor')} AS actor,
                ${userRef('behalf')} AS "onBehalfOf", a.action, a.entity_type AS "entityType",
                a.entity_id AS "entityId", a.entity_number AS "entityNumber", a.before, a.after,
                a.request_id AS "requestId", a.channel, host(a.ip) AS ip
         FROM audit.audit_log a
         LEFT JOIN identity.app_user actor ON actor.id = a.actor_id
         LEFT JOIN identity.app_user behalf ON behalf.id = a.on_behalf_of_id
         WHERE ${where.join(' AND ')}
         ORDER BY a.occurred_at DESC, a.id DESC
         LIMIT $${params.length}`,
        params,
      );
      return {
        rows: rows.slice(0, page.first),
        hasNextPage: rows.length > page.first,
        totalCount: count[0]!.n,
      };
    });
  }

  checkChain(organizationId: string, day: string): Promise<ChainCheck> {
    return withOrgContext(this.pool, organizationId, (client) =>
      verifyAuditChain(client, organizationId, day),
    );
  }
}
