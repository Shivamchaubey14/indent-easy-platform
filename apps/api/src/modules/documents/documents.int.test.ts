/*
 * File uploads end to end against real PostgreSQL, Redis and S3 (MinIO): upload intent, direct
 * PUT to the signed URL, completion, the worker's check (run here in-process), download, and the
 * refusals: wrong type, too large, tampered file, disguised file, other people's files.
 */
import { createHash, randomUUID } from 'node:crypto';
import { HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type pg from 'pg';
import request from 'supertest';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { createApp } from '../../app.js';
import { CONSUMERS } from '../../events/consumers.js';
import { envelopeFromRow, type OutboxRow } from '../../events/outbox.js';
import { processEvent } from '../../events/process.js';
import { withOrgContext } from '../../shared/database.js';
import { ensureBuckets, integrationApp, ORG } from '../../test/integration-app.js';
import { passwords, PostgresIdentity } from '../identity/index.js';

const run = randomUUID().slice(0, 6).toLowerCase();
const PASSWORD = 'first milk of the monsoon';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// A tiny but real-looking XLSX head: ZIP signature, then filler.
const SPREADSHEET = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(200, 7)]);

let context: Awaited<ReturnType<typeof integrationApp>>;
let app: ReturnType<typeof createApp>;
let pool: pg.Pool;
let s3: S3Client;
let admin: string;
let store: string;
const users: string[] = [];

const silent = pino({ level: 'silent' });
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

async function account(roleCode: string) {
  const identity = new PostgresIdentity(pool);
  const email = `docs-${run}-${users.length}@test.local`;
  const id = await identity.createAccount({
    organizationId: ORG,
    email,
    displayName: `Documents test ${users.length}`,
    passwordHash: await passwords.hash(PASSWORD),
    mustChangePassword: false,
  });
  users.push(id);
  await identity.assignRole({ organizationId: ORG, userId: id, roleCode, locationCodes: [] });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Client-Name', 'mobile')
    .set('X-Forwarded-For', `10.79.${users.length}.${Math.floor(Math.random() * 250)}`)
    .send({ identifier: email, password: PASSWORD });
  return (res.body as { accessToken: string }).accessToken;
}

interface Intent {
  documentId: string;
  upload: { url: string; headers: Record<string, string> };
}

async function intent(token: string, body: Record<string, unknown>) {
  return request(app)
    .post('/api/v1/files/upload-intents')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/** Intent + PUT + complete; returns the document id. */
async function upload(
  token: string,
  file: Buffer,
  declared: Partial<{ sha256: string; mimeType: string }> = {},
) {
  const res = await intent(token, {
    documentType: 'IMPORT_FILE',
    fileName: 'MPP list.xlsx',
    mimeType: declared.mimeType ?? XLSX,
    sizeBytes: file.length,
    sha256: declared.sha256 ?? sha256(file),
  });
  expect(res.status).toBe(201);
  const { documentId, upload: put } = res.body as Intent;
  const stored = await fetch(put.url, {
    method: 'PUT',
    headers: put.headers,
    body: new Uint8Array(file),
  });
  return { documentId, put: stored.status };
}

/** Runs the worker's document check for the pending DocumentUploaded event of a document. */
async function runCheck(documentId: string) {
  const { rows } = await pool.query<OutboxRow>(
    `SELECT * FROM events.outbox WHERE event_type = 'DocumentUploaded' AND aggregate_id = $1`,
    [documentId],
  );
  const consumer = CONSUMERS.find((c) => c.name === 'document-check')!;
  for (const row of rows) {
    await processEvent(pool, consumer, envelopeFromRow(row), silent, {
      documents: context.documents.service,
    });
  }
}

const statusOf = async (documentId: string) =>
  withOrgContext(pool, ORG, async (client) => {
    const { rows } = await client.query<{ status: string; scan: string }>(
      `SELECT d.status, v.scan_status AS scan FROM docs.document d
       JOIN docs.document_version v ON v.document_id = d.id WHERE d.id = $1`,
      [documentId],
    );
    return rows[0];
  });

beforeAll(async () => {
  context = await integrationApp();
  ({ app, pool } = context);
  s3 = await ensureBuckets(context.config);
  admin = await account('ADMIN');
  store = await account('STORE_USER');
});

afterAll(async () => {
  await context.close();
});

describe('uploading a file', () => {
  it('goes from intent to AVAILABLE and can be downloaded by its owner', async () => {
    const { documentId, put } = await upload(admin, SPREADSHEET);
    expect(put).toBe(200);

    const done = await request(app)
      .post(`/api/v1/files/${documentId}/complete`)
      .set('Authorization', `Bearer ${admin}`);
    expect(done.status).toBe(202);
    expect(done.body).toMatchObject({
      documentId,
      status: 'PENDING_SCAN',
      typeCode: 'IMPORT_FILE',
    });

    await runCheck(documentId);
    // No scanner is configured in tests: checked by checksum and signature, recorded as skipped.
    expect(await statusOf(documentId)).toEqual({ status: 'AVAILABLE', scan: 'SKIPPED' });

    const link = await request(app)
      .get(`/api/v1/files/${documentId}/download`)
      .set('Authorization', `Bearer ${admin}`);
    expect(link.status).toBe(302);
    const file = await fetch(link.headers['location'] as string);
    expect(Buffer.from(await file.arrayBuffer())).toEqual(SPREADSHEET);
    expect(file.headers.get('content-disposition')).toContain(
      'attachment; filename="MPP list.xlsx"',
    );
  });

  it('completing twice changes nothing and raises one event', async () => {
    const { documentId } = await upload(admin, SPREADSHEET);
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post(`/api/v1/files/${documentId}/complete`)
        .set('Authorization', `Bearer ${admin}`);
    }
    const { rows } = await pool.query(
      `SELECT 1 FROM events.outbox WHERE event_type = 'DocumentUploaded' AND aggregate_id = $1`,
      [documentId],
    );
    expect(rows).toHaveLength(1);
  });

  it('refuses completion before the file is there', async () => {
    const res = await intent(admin, {
      documentType: 'IMPORT_FILE',
      fileName: 'late.xlsx',
      mimeType: XLSX,
      sizeBytes: 10,
      sha256: sha256(Buffer.alloc(10)),
    });
    const done = await request(app)
      .post(`/api/v1/files/${(res.body as Intent).documentId}/complete`)
      .set('Authorization', `Bearer ${admin}`);
    expect(done.status).toBe(422);
    expect(done.body).toMatchObject({ code: 'VALIDATION_FAILED', details: { reason: 'MISSING' } });
  });
});

describe('refusals', () => {
  it('refuses a type the document type does not allow, and files over its limit', async () => {
    const exe = await intent(admin, {
      documentType: 'IMPORT_FILE',
      fileName: 'setup.exe',
      mimeType: 'application/x-msdownload',
      sizeBytes: 100,
      sha256: sha256(Buffer.alloc(1)),
    });
    expect(exe.status).toBe(415);
    expect(exe.body).toMatchObject({ code: 'DOCUMENT_TYPE_NOT_ALLOWED' });

    const big = await intent(admin, {
      documentType: 'IMPORT_FILE',
      fileName: 'huge.xlsx',
      mimeType: XLSX,
      sizeBytes: 26 * 1024 * 1024,
      sha256: sha256(Buffer.alloc(1)),
    });
    expect(big.status).toBe(413);
  });

  it('object storage refuses a file that does not match the declared checksum', async () => {
    const { put } = await upload(admin, SPREADSHEET, { sha256: sha256(Buffer.from('other')) });
    expect(put).toBe(400);
  });

  it('quarantines a file whose content is not what its type says', async () => {
    const disguised = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100, 1)]);
    const { documentId } = await upload(admin, disguised);
    await request(app)
      .post(`/api/v1/files/${documentId}/complete`)
      .set('Authorization', `Bearer ${admin}`);
    await runCheck(documentId);
    expect(await statusOf(documentId)).toEqual({ status: 'QUARANTINED', scan: 'ERROR' });

    const link = await request(app)
      .get(`/api/v1/files/${documentId}/download`)
      .set('Authorization', `Bearer ${admin}`);
    expect(link.status).toBe(409);
    const key = await withOrgContext(pool, ORG, async (client) => {
      const { rows } = await client.query<{ key: string }>(
        'SELECT storage_key AS key FROM docs.document_version WHERE document_id = $1',
        [documentId],
      );
      return rows[0]!.key;
    });
    await expect(
      s3.send(
        new HeadObjectCommand({ Bucket: context.config.storage.buckets.quarantine, Key: key }),
      ),
    ).resolves.toBeTruthy();
  });

  it("hides another person's import file and refuses import uploads without an import permission", async () => {
    const { documentId } = await upload(admin, SPREADSHEET);
    const seen = await request(app)
      .get(`/api/v1/files/${documentId}`)
      .set('Authorization', `Bearer ${store}`);
    expect(seen.status).toBe(404);

    const res = await intent(store, {
      documentType: 'IMPORT_FILE',
      fileName: 'mine.xlsx',
      mimeType: XLSX,
      sizeBytes: SPREADSHEET.length,
      sha256: sha256(SPREADSHEET),
    });
    expect(res.status).toBe(403);
  });

  it('needs a signed-in user', async () => {
    const res = await request(app).post('/api/v1/files/upload-intents').send({});
    expect(res.status).toBe(401);
  });
});
