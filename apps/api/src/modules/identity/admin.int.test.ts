/*
 * User, role and master administration over GraphQL against real PostgreSQL and Redis.
 */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { createApp } from '../../app.js';
import { withOrgContext } from '../../shared/database.js';
import { integrationApp, ORG } from '../../test/integration-app.js';
import { type MailMessage, passwords, PostgresIdentity } from './index.js';

const run = randomUUID().slice(0, 8);
const PASSWORD = 'first milk of the monsoon';
const users: string[] = [];
const locations: string[] = [];

let pool: pg.Pool;
let outbox: MailMessage[];
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let superAdmin: string;
let bmc: { id: string; code: string };
const roleIds = new Map<string, string>();

interface GraphQLBody<T = Record<string, unknown>> {
  data?: T | null;
  errors?: { message: string; extensions: Record<string, unknown> }[];
}
interface UserErrorShape {
  code: string;
  message: string;
  field: string[];
}

async function account(roleCode?: string) {
  const email = `admin-${run}-${users.length}@test.local`;
  const id = await new PostgresIdentity(pool).createAccount({
    organizationId: ORG,
    email,
    displayName: `Admin test ${users.length}`,
    passwordHash: await passwords.hash(PASSWORD),
    mustChangePassword: false,
  });
  users.push(id);
  if (roleCode) {
    await new PostgresIdentity(pool).assignRole({
      organizationId: ORG,
      userId: id,
      roleCode,
      locationCodes: [],
    });
  }
  return { id, email };
}

async function signIn(email: string, password = PASSWORD): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Client-Name', 'mobile')
    .set('X-Forwarded-For', `10.77.${users.length}.${Math.floor(Math.random() * 250)}`)
    .send({ identifier: email, password });
  return (res.body as { accessToken: string }).accessToken;
}

async function gql<T = Record<string, unknown>>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphQLBody<T>> {
  const res = await request(app)
    .post('/graphql')
    .set('Authorization', `Bearer ${token}`)
    .send({ query, variables });
  return res.body as GraphQLBody<T>;
}

const CREATE = `mutation($input: CreateUserInput!) {
  createUser(input: $input) {
    user { id status version email roles { role { code } scopeLocations { code } } }
    userErrors { code message field }
  }
}`;

beforeAll(async () => {
  ({ app, pool, outbox, close } = await integrationApp());
  const { rows } = await withOrgContext(pool, ORG, (client) =>
    client.query<{ id: string; code: string }>(
      `INSERT INTO org.location (organization_id, code, name, type)
       VALUES ($1, $2, 'Admin test BMC', 'BMC') RETURNING id, code`,
      [ORG, `A${run}`.toUpperCase()],
    ),
  );
  bmc = rows[0]!;
  locations.push(bmc.id);
  const roles = await withOrgContext(pool, ORG, (client) =>
    client.query<{ id: string; code: string }>('SELECT id, code FROM identity.role'),
  );
  for (const r of roles.rows) roleIds.set(r.code, r.id);
  superAdmin = await signIn((await account('SUPER_ADMIN')).email);
});

afterAll(async () => {
  const created = await withOrgContext(pool, ORG, (client) =>
    client.query<{ id: string }>(`SELECT id FROM identity.app_user WHERE email LIKE $1`, [
      `%${run}%`,
    ]),
  );
  const ids = [...new Set([...users, ...created.rows.map((r) => r.id)])];
  await pool.query('DELETE FROM identity.password_reset_token WHERE user_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM identity.session WHERE user_id = ANY($1)', [ids]);
  await withOrgContext(pool, ORG, async (client) => {
    await client.query('DELETE FROM identity.app_user WHERE id = ANY($1)', [ids]);
    await client.query(`DELETE FROM identity.role WHERE code LIKE $1`, [`T${run}%`.toUpperCase()]);
    await client.query('DELETE FROM org.location WHERE id = ANY($1)', [locations]);
    await client.query(`DELETE FROM org.department WHERE code LIKE $1`, [`D${run}%`.toUpperCase()]);
  });
  await close();
});

describe('creating users', () => {
  it('invites a store user whose role defaults to their own locations, and audits it', async () => {
    const email = `new-${run}@test.local`;
    const body = await gql<{
      createUser: { user: Record<string, unknown>; userErrors: unknown[] };
    }>(superAdmin, CREATE, {
      input: {
        email: email.toUpperCase(),
        displayName: 'Ramesh Kumar',
        employeeCode: `E${run}`,
        primaryLocationId: bmc.id,
        roles: [{ roleId: roleIds.get('STORE_USER') }],
      },
    });
    expect(body.errors).toBeUndefined();
    const { user, userErrors } = body.data!.createUser;
    expect(userErrors).toEqual([]);
    expect(user).toMatchObject({
      email,
      status: 'INVITED',
      roles: [{ role: { code: 'STORE_USER' }, scopeLocations: [{ code: bmc.code }] }],
    });

    // The invitation link lets them choose a password and sign in.
    await expect.poll(() => outbox.find((m) => m.to === email)).toBeDefined();
    const token = outbox.find((m) => m.to === email)!.text.match(/#token=([\w-]+)/)![1];
    await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: 'fresh start at the bmc' })
      .expect(204);
    expect(await signIn(email, 'fresh start at the bmc')).toMatch(/^ey/);

    const audit = await pool.query<{ action: string; hash: Buffer }>(
      "SELECT action, hash FROM audit.audit_log WHERE entity_id = $1 AND action = 'USER_CREATED'",
      [user['id']],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]!.hash).toHaveLength(32);
  });

  it('reports a taken e-mail address on the field', async () => {
    const existing = await account();
    const body = await gql<{ createUser: { userErrors: UserErrorShape[] } }>(superAdmin, CREATE, {
      input: {
        email: existing.email,
        displayName: 'Duplicate',
        primaryLocationId: bmc.id,
        roles: [],
      },
    });
    expect(body.data!.createUser.userErrors).toEqual([
      { code: 'CONFLICT', message: 'validation.emailTaken', field: ['input', 'email'] },
    ]);
  });
});

describe('no privilege escalation', () => {
  it('stops an administrator from granting a role more powerful than their own', async () => {
    const admin = await signIn((await account('ADMIN')).email);
    const body = await gql<{ createUser: { userErrors: UserErrorShape[] } }>(admin, CREATE, {
      input: {
        email: `escalate-${run}@test.local`,
        displayName: 'Escalation',
        primaryLocationId: bmc.id,
        roles: [{ roleId: roleIds.get('SUPER_ADMIN') }],
      },
    });
    expect(body.data!.createUser.userErrors[0]).toMatchObject({
      code: 'FORBIDDEN',
      message: 'validation.beyondYourAccess',
      field: ['input', 'roles', '0', 'roleId'],
    });
  });

  it('stops them building a role with permissions they lack', async () => {
    const admin = await signIn((await account('ADMIN')).email);
    const body = await gql<{ saveRole: { userErrors: UserErrorShape[] } }>(
      admin,
      `mutation($input: SaveRoleInput!) { saveRole(input: $input) { role { id } userErrors { code message field } } }`,
      { input: { code: `T${run}X`, name: 'Sneaky', permissions: ['admin:feature_flag_manage'] } },
    );
    expect(body.data!.saveRole.userErrors[0]).toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('changing roles', () => {
  it('ends the user’s current token, emits UserRoleChanged and audits the change', async () => {
    const target = await account('STORE_USER');
    const token = await signIn(target.email);
    const version = await withOrgContext(pool, ORG, async (client) => {
      const { rows } = await client.query<{ version: number }>(
        'SELECT version FROM identity.app_user WHERE id = $1',
        [target.id],
      );
      return rows[0]!.version;
    });
    const body = await gql<{ setUserRoles: { userErrors: unknown[] } }>(
      superAdmin,
      `mutation($input: SetUserRolesInput!) { setUserRoles(input: $input) { user { id } userErrors { code } } }`,
      {
        input: {
          userId: target.id,
          expectedVersion: version,
          roles: [{ roleId: roleIds.get('HOD') }],
        },
      },
    );
    expect(body.data!.setUserRoles.userErrors).toEqual([]);
    expect((await gql(token, '{ me { id } }')).errors?.[0]?.extensions['code']).toBe(
      'AUTH_TOKEN_EXPIRED',
    );
    const events = await pool.query(
      "SELECT 1 FROM events.outbox WHERE event_type = 'UserRoleChanged' AND aggregate_id = $1",
      [target.id],
    );
    expect(events.rowCount).toBeGreaterThan(0);

    const stale = await gql<{ setUserRoles: { userErrors: UserErrorShape[] } }>(
      superAdmin,
      `mutation($input: SetUserRolesInput!) { setUserRoles(input: $input) { userErrors { code } } }`,
      { input: { userId: target.id, expectedVersion: version, roles: [] } },
    );
    expect(stale.data!.setUserRoles.userErrors[0]).toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});

describe('deactivating and unlocking', () => {
  const UPDATE = `mutation($input: UpdateUserInput!) {
    updateUser(input: $input) { user { status version } userErrors { code message field } }
  }`;

  it('signs a deactivated user out at once and refuses their sign-in', async () => {
    const target = await account('STORE_USER');
    const token = await signIn(target.email);
    const current = await gql<{ user: { version: number } }>(
      superAdmin,
      `{ user(id: "${target.id}") { version } }`,
    );
    const body = await gql<{ updateUser: { user: { status: string } } }>(superAdmin, UPDATE, {
      input: { id: target.id, expectedVersion: current.data!.user.version, status: 'DISABLED' },
    });
    expect(body.data!.updateUser.user.status).toBe('DISABLED');
    await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: '{ me { id } }' })
      .expect(401);
    const refused = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '10.78.0.1')
      .send({ identifier: target.email, password: PASSWORD });
    expect((refused.body as { code: string }).code).toBe('AUTH_ACCOUNT_DISABLED');
  });

  it('does not let an administrator disable themselves', async () => {
    const me = await gql<{ me: { id: string; version: number } }>(
      superAdmin,
      '{ me { id version } }',
    );
    const body = await gql<{ updateUser: { userErrors: UserErrorShape[] } }>(superAdmin, UPDATE, {
      input: { id: me.data!.me.id, expectedVersion: me.data!.me.version, status: 'DISABLED' },
    });
    expect(body.data!.updateUser.userErrors[0]).toMatchObject({
      message: 'validation.cannotBlockSelf',
    });
  });

  it('unlocks an account locked by failed sign-ins', async () => {
    const target = await account('STORE_USER');
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.79.0.1')
        .send({ identifier: target.email, password: 'wrong password' });
    }
    await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '10.79.0.2')
      .send({ identifier: target.email, password: PASSWORD })
      .expect(423);
    await gql(superAdmin, `mutation { unlockUser(id: "${target.id}") { userErrors { code } } }`);
    expect(await signIn(target.email)).toMatch(/^ey/);
  });
});

describe('listing users', () => {
  it('searches by name and pages with cursors', async () => {
    const LIST = `query($filter: UserFilter, $after: String) {
      users(filter: $filter, pagination: { first: 1, after: $after }) {
        totalCount edges { cursor node { email } } pageInfo { hasNextPage endCursor }
      }
    }`;
    type Page = {
      users: {
        totalCount: number;
        edges: { node: { email: string } }[];
        pageInfo: { hasNextPage: boolean; endCursor: string };
      };
    };
    const first = await gql<Page>(superAdmin, LIST, { filter: { search: `admin-${run}` } });
    expect(first.data!.users.totalCount).toBeGreaterThan(2);
    expect(first.data!.users.edges).toHaveLength(1);
    expect(first.data!.users.pageInfo.hasNextPage).toBe(true);
    const second = await gql<Page>(superAdmin, LIST, {
      filter: { search: `admin-${run}` },
      after: first.data!.users.pageInfo.endCursor,
    });
    expect(second.data!.users.edges[0]!.node.email).not.toBe(
      first.data!.users.edges[0]!.node.email,
    );
  });
});

describe('organisation masters', () => {
  it('creates locations and departments with unique codes', async () => {
    const SAVE = `mutation($input: SaveLocationInput!) {
      saveLocation(input: $input) { location { id code active } userErrors { code field } }
    }`;
    const code = `l${run}`;
    const created = await gql<{ saveLocation: { location: { id: string; code: string } } }>(
      superAdmin,
      SAVE,
      { input: { code, name: 'New MCC', type: 'MCC' } },
    );
    const location = created.data!.saveLocation.location;
    locations.push(location.id);
    expect(location.code).toBe(code.toUpperCase());
    const duplicate = await gql<{ saveLocation: { userErrors: UserErrorShape[] } }>(
      superAdmin,
      SAVE,
      { input: { code, name: 'Again', type: 'MCC' } },
    );
    expect(duplicate.data!.saveLocation.userErrors[0]).toMatchObject({
      code: 'CONFLICT',
      field: ['input', 'code'],
    });

    const department = await gql<{ saveDepartment: { department: { code: string } } }>(
      superAdmin,
      `mutation { saveDepartment(input: { code: "D${run}", name: "Dairy" }) { department { code } userErrors { code } } }`,
    );
    expect(department.data!.saveDepartment.department.code).toBe(`D${run}`.toUpperCase());
  });

  it('chains audit records: each one carries the previous hash', async () => {
    const { rows } = await pool.query<{ prev_hash: Buffer | null; hash: Buffer }>(
      `SELECT prev_hash, hash FROM audit.audit_log
       WHERE organization_id = $1 AND occurred_at >= now()::date
       ORDER BY occurred_at, id`,
      [ORG],
    );
    expect(rows.length).toBeGreaterThan(3);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.prev_hash?.equals(rows[i - 1]!.hash)).toBe(true);
    }
  });
});
