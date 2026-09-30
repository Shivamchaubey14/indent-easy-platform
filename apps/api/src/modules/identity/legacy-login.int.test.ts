/*
 * Signing in with a password migrated from the legacy Django app (OQ-025: verify and re-hash),
 * against real PostgreSQL and Redis.
 */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { createApp } from '../../app.js';
import { withOrgContext } from '../../shared/database.js';
import { integrationApp, ORG } from '../../test/integration-app.js';
import { PostgresIdentity } from './index.js';

// Django PBKDF2 hash of 'bmc store 2025' (made with Python's hashlib, as Django does), with few
// iterations so the test stays fast; the unit test uses a realistic count.
const DJANGO = 'pbkdf2_sha256$1000$Xq3vLr9TzP1kWm2A$FXLv4vVQzzhkF1rWAQLh+5BAQ+WUhQ9z32uxP67tOZ4=';

let context: Awaited<ReturnType<typeof integrationApp>>;
let app: ReturnType<typeof createApp>;
let pool: pg.Pool;
let email: string;
let userId: string;

const setFlag = (enabled: boolean) =>
  withOrgContext(pool, ORG, (client) =>
    client.query("UPDATE config.feature_flag SET enabled = $1 WHERE key = 'legacy_hash_login'", [
      enabled,
    ]),
  );

const signIn = (password: string) =>
  request(app)
    .post('/api/v1/auth/login')
    .set('X-Client-Name', 'mobile')
    .set(
      'X-Forwarded-For',
      `10.84.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    )
    .send({ identifier: email, password });

const storedHash = () =>
  withOrgContext(pool, ORG, async (client) => {
    const { rows } = await client.query<{ password_hash: string }>(
      'SELECT password_hash FROM identity.app_user WHERE id = $1',
      [userId],
    );
    return rows[0]!.password_hash;
  });

beforeAll(async () => {
  context = await integrationApp();
  ({ app, pool } = context);
  email = `legacy-${randomUUID().slice(0, 8)}@test.local`;
  userId = await new PostgresIdentity(pool).createAccount({
    organizationId: ORG,
    email,
    displayName: 'Legacy user',
    passwordHash: DJANGO,
    mustChangePassword: false,
  });
});

afterAll(async () => {
  await setFlag(false);
  await context.close();
});

describe('legacy password hashes', () => {
  it('are refused while legacy_hash_login is off', async () => {
    await setFlag(false);
    const res = await signIn('bmc store 2025');
    expect(res.status).toBe(401);
    expect(await storedHash()).toBe(DJANGO);
  });

  it('are accepted while it is on, then replaced by Argon2id', async () => {
    await setFlag(true);
    expect((await signIn('bmc store 2026')).status).toBe(401);
    const ok = await signIn('bmc store 2025');
    expect(ok.status).toBe(200);
    expect((ok.body as { accessToken?: string }).accessToken).toMatch(/^ey/);
    expect(await storedHash()).toMatch(/^\$argon2id\$/);

    // Once re-hashed, the flag no longer matters for this user.
    await setFlag(false);
    expect((await signIn('bmc store 2025')).status).toBe(200);
  });
});
