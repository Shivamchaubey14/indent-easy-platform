/*
 * Authorization over GraphQL against real PostgreSQL and Redis: the role seed, scoped
 * assignments, `me`, stale tokens after a role change, @auth refusals and session management.
 */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { createApp } from '../../app.js';
import { withOrgContext } from '../../shared/database.js';
import { integrationApp, ORG } from '../../test/integration-app.js';
import { passwords, PostgresIdentity } from './index.js';

const run = randomUUID().slice(0, 8);
const PASSWORD = 'first milk of the monsoon';
const LOCATION = `T${run}`;
const users: string[] = [];
let locationId: string;

let pool: pg.Pool;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;

interface Session {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

async function user(options: { temporary?: boolean } = {}) {
  const email = `authz-${run}-${users.length}@test.local`;
  const id = await new PostgresIdentity(pool).createAccount({
    organizationId: ORG,
    email,
    displayName: `Authz ${users.length}`,
    passwordHash: await passwords.hash(PASSWORD),
    mustChangePassword: options.temporary ?? false,
  });
  users.push(id);
  return { id, email };
}

const grant = (userId: string, roleCode: string, locationCodes: string[] = []) =>
  new PostgresIdentity(pool).assignRole({ organizationId: ORG, userId, roleCode, locationCodes });

async function signIn(email: string): Promise<Session> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Client-Name', 'mobile')
    .set('X-Forwarded-For', `10.9.${users.length}.${Math.floor(Math.random() * 250)}`)
    .send({ identifier: email, password: PASSWORD })
    .expect(200);
  return res.body as Session;
}

async function refresh(session: Session): Promise<request.Response> {
  return request(app)
    .post('/api/v1/auth/refresh')
    .set('X-Client-Name', 'mobile')
    .send({ refreshToken: session.refreshToken });
}

interface GraphQLBody {
  data?: Record<string, unknown> | null;
  errors?: { message: string; extensions: Record<string, unknown> }[];
}

async function gql(query: string, token?: string): Promise<GraphQLBody> {
  const req = request(app).post('/graphql').set('Content-Type', 'application/json');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return (await req.send({ query })).body as GraphQLBody;
}

beforeAll(async () => {
  ({ app, pool, close } = await integrationApp());
  const { rows } = await withOrgContext(pool, ORG, (client) =>
    client.query<{ id: string }>(
      `INSERT INTO org.location (organization_id, code, name, type)
       VALUES ($1, $2, 'Test BMC', 'BMC') RETURNING id`,
      [ORG, LOCATION],
    ),
  );
  locationId = rows[0]!.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM identity.session WHERE user_id = ANY($1)', [users]);
  await withOrgContext(pool, ORG, async (client) => {
    await client.query('DELETE FROM identity.app_user WHERE id = ANY($1)', [users]);
    await client.query('DELETE FROM org.location WHERE id = $1', [locationId]);
  });
  await close();
});

describe('the role seed', () => {
  it('gives every organisation the twelve system role templates', async () => {
    const { rows } = await withOrgContext(pool, ORG, (client) =>
      client.query<{ code: string }>(
        'SELECT code FROM identity.role WHERE is_system ORDER BY home_priority',
      ),
    );
    expect(rows.map((r) => r.code)).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'HOD',
      'PURCHASE_HEAD',
      'PURCHASE_USER',
      'FINANCE_ADMIN',
      'FINANCE_USER',
      'LOGISTICS_USER',
      'MANAGEMENT',
      'AUDITOR',
      'CLUSTER_MIS',
      'STORE_USER',
    ]);
  });
});

describe('me', () => {
  it('needs a signed-in user', async () => {
    const body = await gql('{ me { id } }');
    expect(body.errors?.[0]?.extensions['code']).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('returns roles with their scope, the permissions and the home workspace', async () => {
    const u = await user();
    await grant(u.id, 'STORE_USER', [LOCATION]);
    const session = await signIn(u.email);
    const body = await gql(
      `{ me { email homeWorkspace permissions
             roles { role { code isSystem } scopeLocations { code warehouses { id } } } } }`,
      session.accessToken,
    );
    expect(body.errors).toBeUndefined();
    const me = body.data?.['me'] as {
      email: string;
      homeWorkspace: string;
      permissions: string[];
      roles: unknown[];
    };
    expect(me.email).toBe(u.email);
    expect(me.homeWorkspace).toBe('STORE');
    expect(me.permissions).toContain('indent:create');
    expect(me.permissions).not.toContain('admin:user_manage');
    expect(me.roles).toEqual([
      {
        role: { code: 'STORE_USER', isSystem: true },
        scopeLocations: [{ code: LOCATION, warehouses: [] }],
      },
    ]);
  });

  it('picks the start page of the highest-precedence role', async () => {
    const u = await user();
    await grant(u.id, 'STORE_USER');
    await grant(u.id, 'HOD');
    const session = await signIn(u.email);
    const body = await gql('{ me { homeWorkspace } }', session.accessToken);
    expect(body.data?.['me']).toEqual({ homeWorkspace: 'HOD' });
  });
});

describe('role changes', () => {
  it('refuse tokens issued before the change, and a refresh brings the new permissions', async () => {
    const u = await user();
    await grant(u.id, 'STORE_USER');
    const session = await signIn(u.email);
    expect(
      (await gql('{ roles { id } }', session.accessToken)).errors?.[0]?.extensions,
    ).toMatchObject({ code: 'FORBIDDEN' });

    await grant(u.id, 'ADMIN');
    const stale = await gql('{ me { id } }', session.accessToken);
    expect(stale.errors?.[0]?.extensions).toMatchObject({
      code: 'AUTH_TOKEN_EXPIRED',
      details: { reason: 'ROLES_CHANGED' },
    });

    const renewed = (await refresh(session)).body as Session;
    const body = await gql('{ me { permissions } }', renewed.accessToken);
    expect((body.data?.['me'] as { permissions: string[] }).permissions).toContain(
      'admin:role_manage',
    );
  });
});

describe('@auth', () => {
  it('refuses operations the roles do not allow and records a security event', async () => {
    const u = await user();
    await grant(u.id, 'STORE_USER');
    const session = await signIn(u.email);
    const body = await gql('{ users { totalCount } }', session.accessToken);
    expect(body.errors?.[0]?.extensions).toMatchObject({
      code: 'FORBIDDEN',
      details: { permission: 'admin:user_manage' },
    });
    await expect
      .poll(async () => {
        const { rows } = await pool.query<{ details: { operation: string } }>(
          "SELECT details FROM audit.security_event WHERE user_id = $1 AND type = 'ACCESS_DENIED'",
          [u.id],
        );
        return rows.map((r) => r.details.operation);
      })
      .toEqual(['Query.users']);
  });

  it('lets a user with a temporary password read only `me`', async () => {
    const u = await user({ temporary: true });
    await grant(u.id, 'STORE_USER');
    const session = await signIn(u.email);
    expect((await gql('{ me { id } }', session.accessToken)).errors).toBeUndefined();
    const flags = await gql('{ featureFlags { key } }', session.accessToken);
    expect(flags.errors?.[0]?.extensions).toMatchObject({
      code: 'FORBIDDEN',
      details: { reason: 'PASSWORD_CHANGE_REQUIRED' },
    });
  });
});

describe('sessions', () => {
  it('lists the user’s devices and signs out another one', async () => {
    const u = await user();
    const phone = await signIn(u.email);
    const laptop = await signIn(u.email);
    const body = await gql('{ mySessions { id current platform } }', laptop.accessToken);
    expect(body.data?.['mySessions']).toEqual([
      { id: laptop.sessionId, current: true, platform: 'mobile' },
      { id: phone.sessionId, current: false, platform: 'mobile' },
    ]);

    const revoked = await gql(
      `mutation { revokeSession(id: "${phone.sessionId}") }`,
      laptop.accessToken,
    );
    expect(revoked.data).toEqual({ revokeSession: true });
    expect((await refresh(phone)).status).toBe(401);
    // The revoked session's access token is refused before GraphQL even runs.
    const stale = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${phone.accessToken}`)
      .send({ query: '{ me { id } }' })
      .expect(401);
    expect((stale.body as { code: string }).code).toBe('AUTH_TOKEN_EXPIRED');
  });
});

describe('organisation reference data', () => {
  it('lists active locations for any signed-in user', async () => {
    const u = await user();
    const session = await signIn(u.email);
    const body = await gql('{ locations { code type active } }', session.accessToken);
    expect(body.data?.['locations']).toContainEqual({ code: LOCATION, type: 'BMC', active: true });
  });
});
