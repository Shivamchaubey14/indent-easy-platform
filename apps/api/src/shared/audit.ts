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

/**
 * JSON with sorted keys, so the same record always hashes the same way. Values are taken as they
 * are stored (toJSON first): a Date is hashed as its ISO string, exactly what the jsonb column
 * holds, so the hash covers it and a verifier reading the row can recompute it.
 */
export function canonical(input: unknown): string {
  const value =
    input &&
    typeof input === 'object' &&
    typeof (input as { toJSON?: unknown }).toJSON === 'function'
      ? (input as { toJSON: () => unknown }).toJSON()
      : input;
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

export interface ChainCheck {
  day: string;
  records: number;
  intact: boolean;
  /** The first record whose link or hash does not match, when the chain is broken. */
  brokenAt: string | null;
}

/**
 * Recomputes one organisation-day of the audit chain (AUD-004): every record must point at the
 * previous record's hash, and its own hash must match its content. Run in the organisation's
 * transaction.
 */
export async function verifyAuditChain(
  client: PoolClient,
  organizationId: string,
  day: string,
): Promise<ChainCheck> {
  const { rows } = await client.query<{
    id: string;
    occurred_at: Date;
    actor_id: string | null;
    actor_type: string;
    action: string;
    entity_type: string;
    entity_id: string;
    entity_number: string | null;
    before: unknown;
    after: unknown;
    prev_hash: Buffer | null;
    hash: Buffer | null;
  }>(
    `SELECT id, occurred_at, actor_id, actor_type, action, entity_type, entity_id, entity_number,
            before, after, prev_hash, hash
     FROM audit.audit_log
     WHERE organization_id = $1 AND occurred_at >= $2::date AND occurred_at < $2::date + 1
     ORDER BY occurred_at, id`,
    [organizationId, day],
  );
  let previous: Buffer | null = null;
  for (const row of rows) {
    const record = {
      id: row.id,
      occurredAt: row.occurred_at.toISOString(),
      organizationId,
      actorId: row.actor_id,
      actorType: row.actor_type,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityNumber: row.entity_number,
      before: row.before,
      after: row.after,
    };
    const expected = createHash('sha256')
      .update(previous ?? Buffer.alloc(0))
      .update(canonical(record))
      .digest();
    const linked = previous === null ? row.prev_hash === null : row.prev_hash?.equals(previous);
    if (!linked || !row.hash?.equals(expected)) {
      return { day, records: rows.length, intact: false, brokenAt: row.id };
    }
    previous = row.hash;
  }
  return { day, records: rows.length, intact: true, brokenAt: null };
}
