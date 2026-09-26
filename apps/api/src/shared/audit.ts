import { createHash } from 'node:crypto';
import { uuidv7 } from '@ie/domain-types';
import { currentContext } from './context.js';
import type { PoolClient } from './database.js';

export interface AuditEntry {
  organizationId: string;
  /** From the catalogue, e.g. USER_CREATED (SRS §33.2). */
  action: string;
  entityType: string;
  entityId: string;
  entityNumber?: string | null;
  /** State before and after. Pass only safe fields: never password hashes or tokens. */
  before?: object | null;
  after?: object | null;
}

type Diff = Record<string, { before: unknown; after: unknown }>;

/** Fields whose value changed between two snapshots. */
export function diffOf(
  beforeState: object | null | undefined,
  afterState: object | null | undefined,
): Diff {
  const before = beforeState as Record<string, unknown> | null | undefined;
  const after = afterState as Record<string, unknown> | null | undefined;
  const diff: Diff = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of keys) {
    const a = before?.[key] ?? null;
    const b = after?.[key] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) diff[key] = { before: a, after: b };
  }
  return diff;
}

/** JSON with sorted keys, so the same record always hashes the same way. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Appends an audit record in the caller's transaction, so the change and its record commit or
 * roll back together (SRS §33.3). Records are chained per organisation and day: each hash covers
 * the previous record's hash, so an edited or removed row breaks the chain.
 */
export async function recordAudit(client: PoolClient, entry: AuditEntry): Promise<void> {
  const context = currentContext();
  const principal = context?.principal;
  const occurredAt = new Date();
  const day = occurredAt.toISOString().slice(0, 10);

  // One writer per organisation-day at a time, so the chain has a single order.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `audit:${entry.organizationId}:${day}`,
  ]);
  const previous = await client.query<{ hash: Buffer | null }>(
    `SELECT hash FROM audit.audit_log
     WHERE organization_id = $1 AND occurred_at >= $2::date AND occurred_at < $2::date + 1
     ORDER BY occurred_at DESC, id DESC LIMIT 1`,
    [entry.organizationId, day],
  );
  const prevHash = previous.rows[0]?.hash ?? null;

  const id = uuidv7();
  const record = {
    id,
    occurredAt: occurredAt.toISOString(),
    organizationId: entry.organizationId,
    actorId: principal?.userId ?? null,
    actorType: principal ? 'USER' : 'SYSTEM',
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityNumber: entry.entityNumber ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  };
  const hash = createHash('sha256')
    .update(prevHash ?? Buffer.alloc(0))
    .update(canonical(record))
    .digest();

  await client.query(
    `INSERT INTO audit.audit_log
       (id, occurred_at, organization_id, actor_id, actor_type, action, entity_type, entity_id,
        entity_number, before, after, diff, request_id, correlation_id, ip, user_agent, channel,
        prev_hash, hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
    [
      id,
      occurredAt,
      entry.organizationId,
      record.actorId,
      record.actorType,
      entry.action,
      entry.entityType,
      entry.entityId,
      record.entityNumber,
      record.before,
      record.after,
      diffOf(entry.before, entry.after),
      context?.requestId ?? null,
      context?.correlationId ?? null,
      context?.ip ?? null,
      context?.userAgent ?? null,
      context?.clientName?.startsWith('mobile') ? 'MOBILE' : principal ? 'WEB' : 'SYSTEM',
      prevHash,
      hash,
    ],
  );
}
