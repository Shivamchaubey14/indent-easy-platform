/*
 * Sign-in flows over HTTP against real PostgreSQL (as the application role) and Redis.
 * Run with `pnpm test:integration` (local: `pnpm infra:up && pnpm db:reset` first).
 */
import { randomUUID } from 'node:crypto';
import { createLocalJWKSet, type JSONWebKeySet, jwtVerify } from 'jose';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { createApp } from '../../app.js';
import { withOrgContext } from '../../shared/database.js';
import { integrationApp, ORG } from '../../test/integration-app.js';
import { type MailMessage, passwords, PostgresIdentity } from './index.js';

const run = randomUUID().slice(0, 8);
const PASSWORD = 'first milk of the monsoon';
const createdUsers: string[] = [];

let pool: pg.Pool;
let outbox: MailMessage[];
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;

/** Each test signs in from its own address, so per-IP limits never interfere between tests. */
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.7`;

async function user(options: { temporary?: boolean; status?: string } = {}) {
  const email = `auth-${run}-${createdUsers.length}@test.local`;
  const employeeCode = `T${run}${createdUsers.length}`;
  const id = await new PostgresIdentity(pool).createAccount({
    organizationId: ORG,
    email,
    displayName: 'Test User',
    employeeCode,
    passwordHash: await passwords.hash(PASSWORD),
    mustChangePassword: options.temporary ?? false,
  });
  createdUsers.push(id);
  if (options.status) {
    await withOrgContext(pool, ORG, (client) =>
      client.query('UPDATE identity.app_user SET status = $2 WHERE id = $1', [id, options.status]),
    );
  }
  return { id, email, employeeCode };
}

function login(identifier: string, password = PASSWORD, from = ip(), client = 'web') {
  return request(app)
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', from)
    .set('X-Client-Name', client)
    .send({ identifier, password });
}

function cookieValue(res: request.Response, name: string): string | undefined {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const found = cookies.find((c) => c.startsWith(`${name}=`));
  return found?.split(';')[0]?.slice(name.length + 1) || undefined;
}

async function csrf(): Promise<{ token: string; cookie: string }> {
  const res = await request(app).get('/api/v1/auth/csrf').expect(200);
  const token = (res.body as { csrfToken: string }).csrfToken;
  return { token, cookie: `ie_csrf=${token}` };
}

async function webRefresh(refreshCookie: string, status: number) {
  const { token, cookie } = await csrf();
  return request(app)
    .post('/api/v1/auth/refresh')
    .set('X-CSRF-Token', token)
    .set('Cookie', [cookie, `ie_rt=${refreshCookie}`])
    .expect(status);
}

beforeAll(async () => {
  ({ app, pool, outbox, close } = await integrationApp());
});

afterAll(async () => {
  if (createdUsers.length) {
    // Refresh tokens go with their sessions (ON DELETE CASCADE).
    await pool.query('DELETE FROM identity.password_reset_token WHERE user_id = ANY($1)', [
      createdUsers,
    ]);
    await pool.query('DELETE FROM identity.session WHERE user_id = ANY($1)', [createdUsers]);
    await withOrgContext(pool, ORG, (client) =>
      client.query('DELETE FROM identity.app_user WHERE id = ANY($1)', [createdUsers]),
    );
  }
  await close();
});

describe('sign-in', () => {
  it('signs a web user in with an HttpOnly refresh cookie and a verifiable access token', async () => {
    const u = await user();
    const res = await login(u.email.toUpperCase()).expect(200);
    const body = res.body as Record<string, unknown>;
    expect(body).toMatchObject({ tokenType: 'Bearer', expiresIn: 600, mustChangePassword: false });
    expect(body).not.toHaveProperty('refreshToken');
    expect(res.headers['cache-control']).toBe('no-store');

    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(cookie).toMatch(/ie_rt=[\w-]{43}/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    const jwks = (await request(app).get('/.well-known/jwks.json').expect(200))
      .body as JSONWebKeySet;
    const { payload, protectedHeader } = await jwtVerify(
      body['accessToken'] as string,
      createLocalJWKSet(jwks),
    );
    expect(protectedHeader.alg).toBe('ES256');
    expect(payload).toMatchObject({ sub: u.id, org: ORG, sid: body['sessionId'], rv: 1 });
  });

  it('accepts the employee code, and gives mobile clients the refresh token in the body', async () => {
    const u = await user();
    const res = await login(u.employeeCode, PASSWORD, ip(), 'mobile').expect(200);
    expect((res.body as { refreshToken?: string }).refreshToken).toMatch(/^[\w-]{43}$/);
    expect(cookieValue(res, 'ie_rt')).toBeUndefined();
  });

  it('answers a wrong password and an unknown account identically', async () => {
    const u = await user();
    const wrong = await login(u.email, 'not the password').expect(401);
    const unknown = await login(`nobody-${run}@test.local`).expect(401);
    expect((wrong.body as { code: string }).code).toBe('AUTH_INVALID_CREDENTIALS');
    expect((unknown.body as { detail: string }).detail).toBe(
      (wrong.body as { detail: string }).detail,
    );
  });

  it('locks the account after five failures, even against the right password', async () => {
    const u = await user();
    const from = ip();
    for (let i = 0; i < 5; i++) await login(u.email, 'wrong password', from).expect(401);
    const locked = await login(u.email, PASSWORD, from).expect(423);
    expect((locked.body as { code: string }).code).toBe('AUTH_ACCOUNT_LOCKED');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(800);
  });

  it('refuses a disabled account once the password is right', async () => {
    const u = await user({ status: 'DISABLED' });
    expect((await login(u.email).expect(401)).body).toMatchObject({
      code: 'AUTH_ACCOUNT_DISABLED',
    });
  });

  it('limits sign-in attempts per address', async () => {
    const from = ip();
    for (let i = 0; i < 30; i++) await login(`nobody-${run}@test.local`, 'x', from).expect(401);
    const limited = await login(`nobody-${run}@test.local`, 'x', from).expect(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });
});

describe('refresh tokens', () => {
  it('needs a CSRF token on the web', async () => {
    const u = await user();
    const refresh = cookieValue(await login(u.email).expect(200), 'ie_rt')!;
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `ie_rt=${refresh}`)
      .expect(403);
    expect((res.body as { details: unknown }).details).toEqual({ reason: 'CSRF' });
  });

  it('rotates on every use and revokes the session when an old token comes back', async () => {
    const u = await user();
    const first = cookieValue(await login(u.email).expect(200), 'ie_rt')!;
    const second = cookieValue(await webRefresh(first, 200), 'ie_rt')!;
    expect(second).not.toBe(first);

    // Someone replays the first token: the whole session ends, including the current token.
    await webRefresh(first, 401);
    await webRefresh(second, 401);
  });

  it('rotates mobile tokens sent in the body', async () => {
    const u = await user();
    const { refreshToken } = (await login(u.email, PASSWORD, ip(), 'mobile').expect(200)).body as {
      refreshToken: string;
    };
    const next = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Name', 'mobile')
      .send({ refreshToken })
      .expect(200);
    expect((next.body as { refreshToken: string }).refreshToken).not.toBe(refreshToken);
  });
});

describe('sign-out', () => {
  it('rejects the access token at once after signing out', async () => {
    const u = await user();
    const { accessToken } = (await login(u.email).expect(200)).body as { accessToken: string };
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('signs out every device', async () => {
    const u = await user();
    const a = (await login(u.email).expect(200)).body as { accessToken: string };
    const b = cookieValue(await login(u.email).expect(200), 'ie_rt')!;
    const res = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(res.body).toEqual({ revokedSessions: 2 });
    await webRefresh(b, 401);
  });
});

describe('passwords', () => {
  const resetToken = (to: string) => {
    const mail = outbox.findLast((m) => m.to === to);
    return mail?.text.match(/#token=([\w-]+)/)?.[1];
  };

  it('resets by e-mail link, once, and signs out everywhere', async () => {
    const u = await user();
    const before = cookieValue(await login(u.email).expect(200), 'ie_rt')!;
    await request(app)
      .post('/api/v1/auth/password/forgot')
      .set('X-Forwarded-For', ip())
      .send({ email: u.email })
      .expect(202);
    await expect.poll(() => resetToken(u.email)).toBeDefined();
    const token = resetToken(u.email)!;

    const weak = await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: 'too short' })
      .expect(400);
    expect((weak.body as { details: unknown }).details).toEqual({
      fieldErrors: { newPassword: ['validation.passwordTooShort'] },
    });

    const next = 'evening collection at the bmc';
    await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: next })
      .expect(204);
    await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: next })
      .expect(410);
    await login(u.email).expect(401);
    await login(u.email, next).expect(200);
    await webRefresh(before, 401);
  });

  it('answers a reset request for an unknown address the same way, and sends nothing', async () => {
    const email = `ghost-${run}@test.local`;
    await request(app)
      .post('/api/v1/auth/password/forgot')
      .set('X-Forwarded-For', ip())
      .send({ email })
      .expect(202);
    expect(outbox.some((m) => m.to === email)).toBe(false);
  });

  it('changes the password, keeping this session and ending the others', async () => {
    const u = await user();
    const current = (await login(u.email).expect(200)).body as { accessToken: string };
    const other = cookieValue(await login(u.email).expect(200), 'ie_rt')!;
    const change = (body: object) =>
      request(app)
        .post('/api/v1/auth/password/change')
        .set('Authorization', `Bearer ${current.accessToken}`)
        .send(body);

    const wrong = await change({ currentPassword: 'nope', newPassword: 'a brand new passphrase' });
    expect(wrong.status).toBe(400);
    expect((wrong.body as { details: unknown }).details).toEqual({
      fieldErrors: { currentPassword: ['validation.passwordIncorrect'] },
    });
    const personal = await change({
      currentPassword: PASSWORD,
      newPassword: `${u.employeeCode} rocks!`,
    });
    expect((personal.body as { details: unknown }).details).toEqual({
      fieldErrors: { newPassword: ['validation.passwordPersonal'] },
    });

    await change({ currentPassword: PASSWORD, newPassword: 'a brand new passphrase' }).expect(204);
    await webRefresh(other, 401);
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(204);
  });

  it('tells the client when a temporary password must be replaced', async () => {
    const u = await user({ temporary: true });
    const res = await login(u.email).expect(200);
    expect((res.body as { mustChangePassword: boolean }).mustChangePassword).toBe(true);
  });
});
