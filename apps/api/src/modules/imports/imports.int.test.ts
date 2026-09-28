/*
 * Master imports end to end against real PostgreSQL, Redis and S3: a spreadsheet is uploaded,
 * checked, previewed, committed and applied by the worker's runner (run in-process here), for
 * MPPs, vendor products and product mappings; plus duplicates, deactivation of missing MPPs,
 * templates and permissions.
 */
import { createHash, randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import type pg from 'pg';
import { pino } from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { createApp } from '../../app.js';
import { CONSUMERS } from '../../events/consumers.js';
import { envelopeFromRow, type OutboxRow } from '../../events/outbox.js';
import { processEvent } from '../../events/process.js';
import { withOrgContext } from '../../shared/database.js';
import { ensureBuckets, integrationApp, ORG } from '../../test/integration-app.js';
import { CATALOG_IMPORTS } from '../catalog/index.js';
import { passwords, PostgresIdentity } from '../identity/index.js';
import { createImportRunner, type ImportRunner } from './index.js';

const run = randomUUID().slice(0, 5).toUpperCase();
const PASSWORD = 'first milk of the monsoon';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const silent = pino({ level: process.env['TEST_LOG'] ?? 'silent' });

let context: Awaited<ReturnType<typeof integrationApp>>;
let app: ReturnType<typeof createApp>;
let pool: pg.Pool;
let runner: ImportRunner;
let admin: string;
let store: string;
const bmc = { code: `BI${run}`, id: '' };
const otherBmc = { code: `BJ${run}`, id: '' };
const users: string[] = [];

interface GraphQLBody<T> {
  data?: T | null;
  errors?: { message: string }[];
}

async function gql<T>(token: string, query: string, variables: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/graphql')
    .set('Authorization', `Bearer ${token}`)
    .send({ query, variables });
  const body = res.body as GraphQLBody<T>;
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data!;
}

async function account(roleCode: string) {
  const identity = new PostgresIdentity(pool);
  const email = `imports-${run.toLowerCase()}-${users.length}@test.local`;
  const id = await identity.createAccount({
    organizationId: ORG,
    email,
    displayName: `Imports test ${users.length}`,
    passwordHash: await passwords.hash(PASSWORD),
    mustChangePassword: false,
  });
  users.push(id);
  await identity.assignRole({ organizationId: ORG, userId: id, roleCode, locationCodes: [] });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Client-Name', 'mobile')
    .set('X-Forwarded-For', `10.81.${users.length}.${Math.floor(Math.random() * 250)}`)
    .send({ identifier: email, password: PASSWORD });
  return (res.body as { accessToken: string }).accessToken;
}

async function workbook(rows: unknown[][]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Data');
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await book.xlsx.writeBuffer());
}

/** Uploads a file and lets the worker's document check pass it; returns the document id. */
async function uploadFile(token: string, file: Buffer, name = 'import.xlsx'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/files/upload-intents')
    .set('Authorization', `Bearer ${token}`)
    .send({
      documentType: 'IMPORT_FILE',
      fileName: name,
      mimeType: XLSX,
      sizeBytes: file.length,
      sha256: createHash('sha256').update(file).digest('hex'),
    });
  const intent = res.body as {
    documentId: string;
    upload: { url: string; headers: Record<string, string> };
  };
  await fetch(intent.upload.url, {
    method: 'PUT',
    headers: intent.upload.headers,
    body: new Uint8Array(file),
  });
  await request(app)
    .post(`/api/v1/files/${intent.documentId}/complete`)
    .set('Authorization', `Bearer ${token}`);
  const { rows } = await pool.query<OutboxRow>(
    `SELECT * FROM events.outbox WHERE event_type = 'DocumentUploaded' AND aggregate_id = $1`,
    [intent.documentId],
  );
  const check = CONSUMERS.find((c) => c.name === 'document-check')!;
  for (const row of rows) {
    await processEvent(pool, check, envelopeFromRow(row), silent, {
      documents: context.documents.service,
    });
  }
  return intent.documentId;
}

const BATCH = `id kind status previewOnly totalRows processedRows succeededRows failedRows
  summary { created updated unchanged deactivated rejected warnings }
  errors(first: 50) { totalCount edges { node { rowIndex field value rule message suggestion critical } } }
  resultDocument { fileName status downloadUrl }`;

interface Batch {
  id: string;
  status: string;
  summary: Record<string, number> | null;
  failedRows: number;
  succeededRows: number;
  errors: {
    totalCount: number;
    edges: {
      node: {
        rowIndex: number;
        rule: string;
        field: string | null;
        critical: boolean;
        suggestion: string | null;
      };
    }[];
  };
  resultDocument: { status: string; downloadUrl: string | null } | null;
}

/** Runs the worker until the batch leaves the waiting states. */
async function settle(token: string, id: string): Promise<Batch> {
  for (let i = 0; i < 20; i++) {
    const { importBatch } = await gql<{ importBatch: Batch }>(
      token,
      `query($id: ID!) { importBatch(id: $id) { ${BATCH} } }`,
      { id },
    );
    if (!['UPLOADED', 'VALIDATING', 'PROCESSING'].includes(importBatch.status)) return importBatch;
    await runner.runOnce();
  }
  throw new Error('import did not settle');
}

async function start(
  token: string,
  kind: string,
  rows: unknown[][] | Buffer,
  input: Record<string, unknown> = {},
) {
  const file = Buffer.isBuffer(rows) ? rows : await workbook(rows);
  const documentId = await uploadFile(token, file);
  const { startImport } = await gql<{
    startImport: { batch: Batch | null; userErrors: { code: string; message: string }[] };
  }>(
    token,
    `mutation($input: StartImportInput!) { startImport(input: $input) {
       batch { id status } userErrors { code message } } }`,
    { input: { kind, documentId, ...input } },
  );
  return startImport;
}

async function preview(
  token: string,
  kind: string,
  rows: unknown[][] | Buffer,
  input: Record<string, unknown> = {},
) {
  const started = await start(token, kind, rows, input);
  expect(started.userErrors).toEqual([]);
  return settle(token, started.batch!.id);
}

async function commit(token: string, id: string) {
  const { commitImport } = await gql<{ commitImport: { userErrors: unknown[] } }>(
    token,
    `mutation($id: ID!) { commitImport(input: { batchId: $id }) { userErrors { code } } }`,
    { id },
  );
  expect(commitImport.userErrors).toEqual([]);
  return settle(token, id);
}

const mppByCode = (code: string) =>
  withOrgContext(pool, ORG, async (client) => {
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT m.name, l.code AS bmc, m.sahayak_mobile_e164 AS mobile, m.cycle_band AS band, m.status
       FROM catalog.mpp m JOIN org.location l ON l.id = m.bmc_location_id WHERE m.code = $1`,
      [code],
    );
    return rows[0];
  });

beforeAll(async () => {
  context = await integrationApp();
  ({ app, pool } = context);
  await ensureBuckets(context.config);
  runner = createImportRunner(
    pool,
    context.documents,
    CATALOG_IMPORTS,
    silent,
    context.config.timezone,
  );
  await withOrgContext(pool, ORG, async (client) => {
    for (const centre of [bmc, otherBmc]) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO org.location (organization_id, code, name, type) VALUES ($1, $2, $3, 'BMC') RETURNING id`,
        [ORG, centre.code, `Import test ${centre.code}`],
      );
      centre.id = rows[0]!.id;
    }
  });
  admin = await account('ADMIN');
  store = await account('STORE_USER');
});

afterAll(async () => {
  await context.close();
});

const MPP_HEADER = [
  'MPP Code',
  'MPP Name',
  'BMC/MCC Code',
  'Sahayak Name',
  'Sahayak Mobile',
  'Cycle Band',
  'Village',
];

describe('MPP import', () => {
  it('previews, then applies on commit: legacy mobiles and bands are normalised', async () => {
    const batch = await preview(admin, 'MPP_MASTER', [
      MPP_HEADER,
      [`M1${run}`, 'Bakewar', bmc.code, 'Ram Singh', 9876543210, '1-10', 'Bakewar'],
      [`M2${run}`, 'Lakhna', bmc.code.toLowerCase(), null, '09876543211', '11 - 20', null],
      [`M3${run}`, 'Nowhere', 'NO-SUCH-BMC', null, '12345', '1-15', null],
    ]);
    expect(batch.status).toBe('PREVIEW_READY');
    expect(batch.summary).toEqual({
      created: 2,
      updated: 0,
      unchanged: 0,
      deactivated: 0,
      rejected: 1,
      warnings: 0,
    });
    const rules = batch.errors.edges.map((e) => e.node);
    expect(rules.map((r) => [r.rowIndex, r.rule])).toEqual([
      [4, 'UNKNOWN_BMC'],
      [4, 'MOBILE_FORMAT'],
      [4, 'CYCLE_BAND'],
    ]);
    expect(batch.resultDocument?.status).toBe('AVAILABLE');
    expect(await mppByCode(`M1${run}`)).toBeUndefined(); // nothing applied yet

    const done = await commit(admin, batch.id);
    expect(done.status).toBe('PROCESSED_WITH_EXCEPTIONS');
    expect([done.succeededRows, done.failedRows]).toEqual([2, 1]);
    expect(await mppByCode(`M1${run}`)).toEqual({
      name: 'Bakewar',
      bmc: bmc.code,
      mobile: '+919876543210',
      band: 'DAYS_1_10',
      status: 'ACTIVE',
    });
    expect(await mppByCode(`M2${run}`)).toMatchObject({
      mobile: '+919876543211',
      band: 'DAYS_11_20',
    });

    // Row audit is isolated per organisation like everything else.
    const audit = await withOrgContext(pool, ORG, async (client) => {
      const { rows } = await client.query<{ action: string }>(
        `SELECT action FROM io.import_row_audit WHERE batch_id = $1 ORDER BY row_index`,
        [batch.id],
      );
      return rows;
    });
    expect(audit.map((a) => a.action)).toEqual(['CREATE', 'CREATE', 'REJECT']);
    const { rows: outsider } = await pool.query(
      'SELECT 1 FROM io.import_row_audit WHERE batch_id = $1',
      [batch.id],
    );
    expect(outsider).toEqual([]);
    const { rows: events } = await pool.query(
      `SELECT payload FROM events.outbox WHERE event_type = 'ImportCompleted' AND aggregate_id = $1`,
      [batch.id],
    );
    expect(events[0]).toMatchObject({
      payload: { kind: 'MPP_MASTER', succeededRows: 2, failedRows: 1 },
    });

    // The report is a real workbook with the outcome of every row.
    const report = await fetch(done.resultDocument!.downloadUrl!);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await report.arrayBuffer());
    const sheet = book.worksheets[0]!;
    expect(sheet.getRow(1).getCell(2).value).toBe('Outcome');
    expect(sheet.getRow(4).getCell(2).value).toBe('Rejected');
  });

  it('refuses the same file again unless forced, and deactivates only missing MPPs of the BMCs in the file', async () => {
    await preview(admin, 'MPP_MASTER', [
      MPP_HEADER,
      [`M9${run}`, 'Other centre', otherBmc.code, null, null, null, null],
    ]).then((b) => commit(admin, b.id));

    // One file, uploaded twice: workbooks carry their creation time, so rebuilding gives new bytes.
    const rows = await workbook([
      MPP_HEADER,
      [`M1${run}`, 'Bakewar Dairy', bmc.code, 'Ram Singh', '9876543210', '1-10', 'Bakewar'],
    ]);
    const first = await preview(admin, 'MPP_MASTER', rows, {
      options: { deactivateMissing: true },
    });
    expect(first.summary).toMatchObject({ updated: 1, deactivated: 1 });
    await commit(admin, first.id);
    expect(await mppByCode(`M1${run}`)).toMatchObject({ name: 'Bakewar Dairy', status: 'ACTIVE' });
    expect(await mppByCode(`M2${run}`)).toMatchObject({ status: 'INACTIVE' }); // same BMC, not in file
    expect(await mppByCode(`M9${run}`)).toMatchObject({ status: 'ACTIVE' }); // other BMC untouched

    const again = await start(admin, 'MPP_MASTER', rows);
    expect(again.userErrors).toEqual([
      { code: 'RECONCILIATION_DUPLICATE_FILE', message: 'validation.importDuplicateFile' },
    ]);
    const forced = await preview(admin, 'MPP_MASTER', rows, { force: true });
    expect(forced.summary).toMatchObject({ unchanged: 1 });
  });

  it('refuses a file without the required columns', async () => {
    const batch = await preview(admin, 'MPP_MASTER', [
      ['Code', 'Name'],
      ['X', 'Y'],
    ]);
    expect(batch.status).toBe('VALIDATION_FAILED');
    expect(batch.errors.edges[0]!.node).toMatchObject({ rowIndex: 0, rule: 'COLUMNS_MISSING' });
  });
});

describe('vendor product import', () => {
  it('adds and updates vendor–product pairs', async () => {
    const saved = await gql<{ saveVendor: { vendor: { code: string } } }>(
      admin,
      `mutation($input: SaveVendorInput!) { saveVendor(input: $input) { vendor { code } } }`,
      { input: { name: `Import vendor ${run}`, contacts: [] } },
    );
    const vendorCode = saved.saveVendor.vendor.code;
    const kg = await withOrgContext(pool, ORG, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM catalog.uom WHERE code = 'KG'`,
      );
      return rows[0]!.id;
    });
    for (const code of [`VP1${run}`, `VP2${run}`]) {
      await gql(
        admin,
        `mutation($input: SaveProductInput!) { saveProduct(input: $input) { userErrors { message } } }`,
        {
          input: {
            code,
            name: `Import product ${code}`,
            baseUomId: kg,
            isStockItem: true,
            isService: false,
          },
        },
      );
    }
    const header = ['Vendor Code', 'Product Code', 'Priority', 'Primary', 'Lead Time Days'];
    const first = await preview(admin, 'VENDOR_PRODUCT', [
      header,
      [vendorCode, `VP1${run}`, 1, 'Yes', 7],
      [vendorCode, `NOPE${run}`, 1, 'No', null],
    ]);
    expect(first.summary).toMatchObject({ created: 1, rejected: 1 });
    expect(first.errors.edges[0]!.node).toMatchObject({ rule: 'UNKNOWN_PRODUCT', critical: true });
    await commit(admin, first.id);

    const second = await preview(admin, 'VENDOR_PRODUCT', [
      header,
      [vendorCode, `VP1${run}`, 2, 'No', 7],
      [vendorCode, `VP2${run}`, null, null, null],
    ]);
    expect(second.summary).toMatchObject({ created: 1, updated: 1, rejected: 0 });
    await commit(admin, second.id);
    const pairs = await withOrgContext(pool, ORG, async (client) => {
      const { rows } = await client.query<{ code: string; priority: number; primary: boolean }>(
        `SELECT p.code, vp.priority, vp.is_primary AS primary FROM catalog.vendor_product vp
         JOIN catalog.vendor v ON v.id = vp.vendor_id JOIN catalog.product p ON p.id = vp.product_id
         WHERE v.code = $1 ORDER BY p.code`,
        [vendorCode],
      );
      return rows;
    });
    expect(pairs).toEqual([
      { code: `VP1${run}`, priority: 2, primary: false },
      { code: `VP2${run}`, priority: 1, primary: false },
    ]);
  });
});

describe('product mapping import', () => {
  it('maps SAP and NDDB codes with the legacy checks and exports them in the template', async () => {
    const header = [
      'INDENT_EASY_Product_Code',
      'Group Name',
      'SAP_Product_Code',
      'SAP_Product_Name',
      'NDDB_Product_Code',
      'NDDB_Product_Name',
      'UOM',
      'Is_Primary',
    ];
    // A SAP code no earlier run used: 36 + 8 random digits (valid SAP format, 7-10 digits).
    const sap = `36${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const batch = await preview(admin, 'PRODUCT_MAPPING', [
      header,
      [
        `VP1${run}`,
        'Cattle feed',
        Number(sap),
        'Cattle Feed 50 Kg',
        `ND${run}`,
        'Pashu Aahar',
        'KG',
        'NDDB',
      ],
      [`VP2${run}`, 'Mineral', Number(sap), 'Mineral Mixture', null, null, 'BOXES', 'SAP'],
      ['NO-SUCH', 'Ghost', '1234567', 'Ghost', null, null, null, null],
    ]);
    const issues = batch.errors.edges.map((e) => [e.node.rowIndex, e.node.rule, e.node.critical]);
    // Row 2: NDDB code "ND<run>" has letters after ND → format warning only.
    expect(issues).toContainEqual([2, 'PRODUCT_CODE_FORMAT', false]);
    // Row 3: same SAP code as row 2 for another product → critical conflict; unknown UOM → warning.
    expect(issues).toContainEqual([3, 'CONFLICTING_MAPPINGS', true]);
    expect(issues).toContainEqual([3, 'VALID_UOM', false]);
    expect(issues).toContainEqual([4, 'PRODUCT_NOT_FOUND', true]);
    expect(batch.summary).toMatchObject({ updated: 0, rejected: 2, warnings: 1 });
    await commit(admin, batch.id);

    const template = await request(app)
      .get('/api/v1/imports/templates/PRODUCT_MAPPING')
      .set('Authorization', `Bearer ${admin}`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
    expect(template.status).toBe(200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(template.body as Buffer).buffer);
    const rows = book.worksheets[0]!.getSheetValues() as unknown[][];
    const mine = rows.find((r) => r?.[1] === `VP1${run}`)!;
    expect(mine.slice(1, 8)).toEqual([
      `VP1${run}`,
      `Import product VP1${run}`,
      'Cattle feed',
      sap,
      'Cattle Feed 50 Kg',
      `ND${run}`,
      'Pashu Aahar',
    ]);

    // The mapped SAP code now finds the product.
    const found = await gql<{
      products: { edges: { node: { code: string; displayName: string } }[] };
    }>(
      admin,
      `query($s: String!) { products(filter: { search: $s }) { edges { node { code displayName } } } }`,
      { s: sap },
    );
    expect(found.products.edges.map((e) => e.node)).toEqual([
      { code: `VP1${run}`, displayName: 'Pashu Aahar' },
    ]);
  });
});

describe('permissions', () => {
  it('refuses imports and templates to users without the kind permission', async () => {
    const res = await request(app)
      .get('/api/v1/imports/templates/MPP_MASTER')
      .set('Authorization', `Bearer ${store}`);
    expect(res.status).toBe(403);
    const { importBatches } = await gql<{ importBatches: unknown[] }>(
      store,
      `{ importBatches(kinds: [MPP_MASTER]) { id } }`,
    );
    expect(importBatches).toEqual([]);
  });
});
