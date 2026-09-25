import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { LeaderLock } from '../scheduler/leader.js';
import type { PoolClient } from '../shared/database.js';
import { subscribers, type Consumer } from './consumers.js';
import { InvalidEventError, appendEvent } from './outbox.js';
import { decideOrdering } from './ordering.js';
import { MAX_ATTEMPTS, RETRY_DELAYS_MS, retryDelay } from './queues.js';

const logger = pino({ level: 'silent' });

describe('retry schedule', () => {
  it('follows 5 s, 30 s, 2 min, 10 min, 30 min with ±20% jitter', () => {
    RETRY_DELAYS_MS.forEach((base, i) => {
      expect(retryDelay(i + 1, () => 0)).toBe(base * 0.8);
      expect(retryDelay(i + 1, () => 1)).toBe(base * 1.2);
    });
    expect(MAX_ATTEMPTS).toBe(6);
  });

  it('keeps the last delay if asked beyond the schedule', () => {
    expect(retryDelay(99, () => 0.5)).toBe(RETRY_DELAYS_MS[4]);
  });
});

describe('ordering', () => {
  it.each([
    [1, undefined, 'process'],
    [2, undefined, 'defer'],
    [3, 2, 'process'],
    [2, 2, 'skip'],
    [1, 2, 'skip'],
    [5, 2, 'defer'],
  ] as const)('version %i after %s → %s', (version, last, decision) => {
    expect(decideOrdering(version, last)).toBe(decision);
  });
});

describe('subscriptions', () => {
  const make = (name: string, events: Consumer['events']): Consumer => ({
    name,
    events,
    ordered: false,
    concurrency: 1,
    handle: async () => undefined,
  });
  it('delivers to consumers of that type and to catch-all consumers', () => {
    const consumers = [
      make('all', '*'),
      make('grn', ['GrnPosted']),
      make('indent', ['IndentCreated']),
    ];
    expect(subscribers('IndentCreated', consumers).map((c) => c.name)).toEqual(['all', 'indent']);
    expect(subscribers('PodUploaded', consumers).map((c) => c.name)).toEqual(['all']);
  });
});

describe('appendEvent', () => {
  function fakeClient() {
    const calls: { sql: string; values: unknown[] }[] = [];
    const client = {
      query: async (sql: string, values: unknown[]) => {
        calls.push({ sql, values });
        return { rows: [], rowCount: 1 };
      },
    } as unknown as PoolClient;
    return { client, calls };
  }

  const base = {
    eventType: 'IndentCreated' as const,
    organizationId: '0192a000-0000-7000-8000-000000000001',
    aggregateType: 'Indent',
    aggregateId: '0192a000-0000-7000-8000-00000000abcd',
    aggregateVersion: 1,
    actor: { type: 'USER' as const, id: '0192a000-0000-7000-8000-00000000beef' },
  };

  it('writes a contract-valid event to the outbox with a UUIDv7 id', async () => {
    const { client, calls } = fakeClient();
    const event = await appendEvent(client, {
      ...base,
      payload: { locationId: '0192a000-0000-7000-8000-0000000000b1', lineCount: 3 },
    });
    expect(event.eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain('INSERT INTO events.outbox');
    const metadata = calls[0]?.values[8] as Record<string, unknown>;
    expect(metadata).toMatchObject({ actor: base.actor, channel: 'API' });
    expect(metadata).not.toHaveProperty('payload');
  });

  it('refuses an event that breaks its contract, writing nothing', async () => {
    const { client, calls } = fakeClient();
    await expect(
      appendEvent(client, { ...base, payload: { locationId: 'not-a-uuid' } as never }),
    ).rejects.toBeInstanceOf(InvalidEventError);
    expect(calls).toHaveLength(0);
  });
});

describe('leader lock', () => {
  // Minimal in-memory Redis with the two commands the lock uses.
  function fakeRedis() {
    const store = new Map<string, string>();
    return {
      store,
      async set(key: string, value: string, _px: string, _ttl: number, _nx: string) {
        if (store.has(key)) return null;
        store.set(key, value);
        return 'OK';
      },
      async eval(script: string, _n: number, key: string, id: string) {
        if (store.get(key) !== id) return 0;
        if (script.includes('del')) store.delete(key);
        return 1;
      },
    };
  }

  it('lets exactly one instance lead, and hands over when the leader stops', async () => {
    const redis = fakeRedis();
    const a = new LeaderLock(redis as never, logger);
    const b = new LeaderLock(redis as never, logger);
    await a.tick();
    await b.tick();
    expect([a.isLeader, b.isLeader]).toEqual([true, false]);
    await a.tick(); // renewal keeps leadership
    expect(a.isLeader).toBe(true);
    await a.stop();
    await b.tick();
    expect([a.isLeader, b.isLeader]).toEqual([false, true]);
  });

  it('steps down if its key was taken over (e.g. after expiry)', async () => {
    const redis = fakeRedis();
    const a = new LeaderLock(redis as never, logger);
    await a.tick();
    redis.store.set('ie:scheduler:leader', 'someone-else');
    await a.tick();
    expect(a.isLeader).toBe(false);
  });
});
