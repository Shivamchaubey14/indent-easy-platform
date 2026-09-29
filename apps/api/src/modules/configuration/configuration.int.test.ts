/*
 * Settings, number series, feature flags and the audit viewer over GraphQL against real
 * PostgreSQL: validation, forward-only numbering, audit of every change, filters and paging of the
 * audit log, and the hash-chain check catching a forged record.
 */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { createApp } from '../../app.js';
import { recordAudit } from '../../shared/audit.js';
import { withOrgContext } from '../../shared/database.js';
import { integrationApp, ORG } from '../../test/integration-app.js';
import { passwords, PostgresIdentity } from '../identity/index.js';

const run = randomUUID().slice(0, 6);
const PASSWORD = 'first milk of the monsoon';
let context: Awaited<ReturnType<typeof integrationApp>>;
let app: ReturnType<typeof createApp>;
let pool: pg.Pool;
let admin: string;
let auditor: string;
let store: string;
const users: string[] = [];

interface Body<T> {
  data?: T | null;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
}

async function gql<T>(token: string, query: string, variables: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/graphql')
    .set('Authorization', `Bearer ${token}`)
    .send({ query, variables });
  return res.body as Body<T>;
}

async function account(roleCode: string) {
  const identity = new PostgresIdentity(pool);
  const email = `config-${run}-${users.length}@test.local`;
  const id = await identity.createAccount({
    organizationId: ORG,
    email,
    displayName: `Config test ${users.length}`,
    passwordHash: await passwords.hash(PASSWORD),
    mustChangePassword: false,
  });
  users.push(id);
  await identity.assignRole({ organizationId: ORG, userId: id, roleCode, locationCodes: [] });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Client-Name', 'mobile')
    .set('X-Forwarded-For', `10.83.${users.length}.${Math.floor(Math.random() * 250)}`)
    .send({ identifier: email, password: PASSWORD });
  return (res.body as { accessToken: string }).accessToken;
}

const SETTING = 'receiving.overReceiptTolerancePct';
const SETTINGS_QUERY = `{ settings { key value isDefault defaultValue source input { kind min max unit } } }`;
const UPDATE_SETTING = `mutation($value: JSON!) { updateSetting(input: { key: "${SETTING}", value: $value }) {
  setting { value isDefault } userErrors { code message field } } }`;

beforeAll(async () => {
  context = await integrationApp();
  ({ app, pool } = context);
  admin = await account('SUPER_ADMIN');
  auditor = await account('AUDITOR');
  store = await account('STORE_USER');
});

afterAll(async () => {
  // Leave the shared settings as the defaults.
  await gql(admin, UPDATE_SETTING, { value: 10 });
  await context.close();
});

describe('settings', () => {
  it('lists typed settings with their defaults and sources', async () => {
    const { data } = await gql<{ settings: Record<string, unknown>[] }>(admin, SETTINGS_QUERY);
    expect(data!.settings.find((s) => s['key'] === SETTING)).toMatchObject({
      defaultValue: 10,
      source: 'GRN-005 (legacy 10%)',
      input: { kind: 'number', min: 0, max: 100, unit: '%' },
    });
  });

  it('validates, stores, audits, and goes back to the default', async () => {
    const bad = await gql<{ updateSetting: { userErrors: { message: string }[] } }>(
      admin,
      UPDATE_SETTING,
      { value: 150 },
    );
    expect(bad.data!.updateSetting.userErrors[0]).toMatchObject({
      message: 'validation.outOfRange',
    });
    const wrongType = await gql<{ updateSetting: { userErrors: unknown[] } }>(
      admin,
      UPDATE_SETTING,
      {
        value: 'ten',
      },
    );
    expect(wrongType.data!.updateSetting.userErrors).toHaveLength(1);

    const set = await gql<{ updateSetting: { setting: { value: number; isDefault: boolean } } }>(
      admin,
      UPDATE_SETTING,
      { value: 12.5 },
    );
    expect(set.data!.updateSetting.setting).toEqual({ value: 12.5, isDefault: false });

    const log = await gql<{ auditLog: { edges: { node: Record<string, unknown> }[] } }>(
      auditor,
      `query($f: AuditFilter) { auditLog(filter: $f, pagination: { first: 1 }) {
         edges { node { action entityNumber before after actor { displayName } } } } }`,
      { f: { action: 'SETTING_CHANGED' } },
    );
    expect(log.data!.auditLog.edges[0]!.node).toMatchObject({
      action: 'SETTING_CHANGED',
      entityNumber: SETTING,
      after: { key: SETTING, value: 12.5 },
    });

    const back = await gql<{ updateSetting: { setting: { isDefault: boolean } } }>(
      admin,
      UPDATE_SETTING,
      { value: 10 },
    );
    expect(back.data!.updateSetting.setting.isDefault).toBe(true);
  });

  it('is only for administrators', async () => {
    const res = await gql(store, SETTINGS_QUERY);
    expect(res.errors?.[0]?.extensions?.['code']).toBe('FORBIDDEN');
  });
});

describe('number series', () => {
  it('shows the legacy formats and only lets the next number move forward', async () => {
    const { data } = await gql<{
      numberSeries: {
        id: string;
        docType: string;
        prefix: string;
        padding: number;
        nextValue: number;
        preview: string;
      }[];
    }>(admin, `{ numberSeries { id docType prefix padding nextValue preview } }`);
    const indent = data!.numberSeries.find((s) => s.docType === 'INDENT')!;
    expect(indent).toMatchObject({ prefix: 'REQ', padding: 4 });
    expect(indent.preview).toBe(`REQ${String(indent.nextValue).padStart(4, '0')}`);
    expect(data!.numberSeries.find((s) => s.docType === 'STN')).toMatchObject({
      prefix: 'STN-',
      padding: 6,
    });

    const UPDATE = `mutation($input: UpdateNumberSeriesInput!) { updateNumberSeries(input: $input) {
      series { nextValue preview } userErrors { message field } } }`;
    const backwards = await gql<{ updateNumberSeries: { userErrors: { message: string }[] } }>(
      admin,
      UPDATE,
      {
        input: { id: indent.id, nextValue: indent.nextValue - 1 || 0 },
      },
    );
    expect(backwards.data!.updateNumberSeries.userErrors[0]!.message).toMatch(
      /validation\.(seriesBackwards|outOfRange)/,
    );
    const badPrefix = await gql<{ updateNumberSeries: { userErrors: { message: string }[] } }>(
      admin,
      UPDATE,
      {
        input: { id: indent.id, prefix: 'RE Q!' },
      },
    );
    expect(badPrefix.data!.updateNumberSeries.userErrors[0]!.message).toBe(
      'validation.seriesPrefix',
    );

    const forward = await gql<{
      updateNumberSeries: { series: { nextValue: number; preview: string } };
    }>(admin, UPDATE, { input: { id: indent.id, nextValue: indent.nextValue + 5 } });
    expect(forward.data!.updateNumberSeries.series.nextValue).toBe(indent.nextValue + 5);

    // The allocator issues exactly the previewed number next.
    const issued = await withOrgContext(pool, ORG, async (client) => {
      const { rows } = await client.query<{ n: string }>(
        "SELECT config.next_document_number($1, 'INDENT') AS n",
        [ORG],
      );
      return rows[0]!.n;
    });
    expect(issued).toBe(forward.data!.updateNumberSeries.series.preview);
  });
});

describe('feature flags', () => {
  it('switches a flag with targeting rules, audits it, and refuses unknown flags and rules', async () => {
    const SET = `mutation($input: SetFeatureFlagInput!) { setFeatureFlag(input: $input) { key enabled rules } }`;
    const on = await gql<{ setFeatureFlag: Record<string, unknown> }>(admin, SET, {
      input: { key: 'rfq', enabled: true, rules: { environments: ['dev', 'qa'], percentage: 50 } },
    });
    expect(on.data!.setFeatureFlag).toEqual({
      key: 'rfq',
      enabled: true,
      rules: { environments: ['dev', 'qa'], percentage: 50 },
    });
    const unknown = await gql(admin, SET, { input: { key: 'no_such_flag', enabled: true } });
    expect(unknown.errors?.[0]?.extensions?.['code']).toBe('NOT_FOUND');
    const badRules = await gql(admin, SET, {
      input: { key: 'rfq', enabled: true, rules: { everyone: true } },
    });
    expect(badRules.errors?.[0]?.extensions?.['code']).toBe('VALIDATION_FAILED');
    await gql(admin, SET, { input: { key: 'rfq', enabled: false } });

    const log = await gql<{ auditLog: { edges: { node: Record<string, unknown> }[] } }>(
      auditor,
      `{ auditLog(filter: { action: "FEATURE_FLAG_CHANGED" }, pagination: { first: 2 }) {
          edges { node { entityNumber after } } } }`,
    );
    expect(log.data!.auditLog.edges.map((e) => e.node)).toEqual([
      { entityNumber: 'rfq', after: { enabled: false, rules: null } },
      {
        entityNumber: 'rfq',
        after: { enabled: true, rules: { environments: ['dev', 'qa'], percentage: 50 } },
      },
    ]);
  });
});

describe('audit log', () => {
  it('filters by entity and pages newest first', async () => {
    const entityId = randomUUID();
    await withOrgContext(pool, ORG, async (client) => {
      for (let i = 1; i <= 3; i++) {
        await recordAudit(client, {
          organizationId: ORG,
          action: 'TEST_EVENT',
          entityType: 'Test',
          entityId,
          after: { step: i },
        });
      }
    });
    const QUERY = `query($f: AuditFilter, $after: String) { auditLog(filter: $f, pagination: { first: 2, after: $after }) {
      totalCount pageInfo { hasNextPage endCursor } edges { node { after } } } }`;
    type Page = {
      auditLog: {
        totalCount: number;
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: { node: { after: { step: number } } }[];
      };
    };
    const first = await gql<Page>(auditor, QUERY, { f: { entityId } });
    expect(first.data!.auditLog.totalCount).toBe(3);
    expect(first.data!.auditLog.edges.map((e) => e.node.after.step)).toEqual([3, 2]);
    const second = await gql<Page>(auditor, QUERY, {
      f: { entityId },
      after: first.data!.auditLog.pageInfo.endCursor,
    });
    expect(second.data!.auditLog.edges.map((e) => e.node.after.step)).toEqual([1]);
    expect(second.data!.auditLog.pageInfo.hasNextPage).toBe(false);
  });

  it('finds a forged record in the hash chain', async () => {
    // A day of its own (far in the past), so no other test writes into this chain.
    const day = `199${Math.floor(Math.random() * 10)}-0${1 + Math.floor(Math.random() * 9)}-1${Math.floor(Math.random() * 9)}`;
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      await withOrgContext(pool, ORG, async (client) => {
        for (let i = 0; i < 3; i++) {
          vi.setSystemTime(new Date(`${day}T0${4 + i}:00:00.000Z`));
          await recordAudit(client, {
            organizationId: ORG,
            action: 'TEST_CHAIN',
            entityType: 'Test',
            entityId: randomUUID(),
            // A Date in the record: it must be covered by the hash like any other value.
            before: { lockedUntil: new Date(`${day}T23:00:00.000Z`) },
            after: { i, run },
          });
        }
      });
    } finally {
      vi.useRealTimers();
    }
    const CHECK = `query($day: Date!) { auditChainCheck(day: $day) { records intact brokenAt } }`;
    const intact = await gql<{ auditChainCheck: Record<string, unknown> }>(auditor, CHECK, { day });
    expect(intact.data!.auditChainCheck).toMatchObject({ intact: true, brokenAt: null });

    const forged = randomUUID();
    await withOrgContext(pool, ORG, (client) =>
      client.query(
        `INSERT INTO audit.audit_log (id, occurred_at, organization_id, actor_type, action,
           entity_type, entity_id, after, prev_hash, hash)
         VALUES ($1, $2, $3, 'SYSTEM', 'TEST_CHAIN', 'Test', $4, '{"forged":true}', NULL, $5)`,
        [forged, `${day}T05:30:00.000Z`, ORG, randomUUID(), Buffer.alloc(32, 7)],
      ),
    );
    const broken = await gql<{ auditChainCheck: Record<string, unknown> }>(auditor, CHECK, { day });
    expect(broken.data!.auditChainCheck).toMatchObject({ intact: false, brokenAt: forged });
  });

  it('is only for users with audit:read', async () => {
    const res = await gql(store, `{ auditLog { totalCount } }`);
    expect(res.errors?.[0]?.extensions?.['code']).toBe('FORBIDDEN');
  });
});
