/*
 * M1 end to end on a synthetic legacy dump (no real data): staging, the transforms, the
 * reconciliation report, re-running (idempotent) and a dry run. Runs as the schema owner, like
 * the real migration, in an organisation of its own.
 */
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMasters, stageDump } from './run.js';

try {
  process.loadEnvFile('../../.env');
} catch {
  // CI provides the variables directly.
}

const run = randomUUID().slice(0, 6);
// Django PBKDF2 hash of 'bmc store 2025' (as in the sign-in test).
const DJANGO = 'pbkdf2_sha256$1000$Xq3vLr9TzP1kWm2A$FXLv4vVQzzhkF1rWAQLh+5BAQ+WUhQ9z32uxP67tOZ4=';
const id = (n: number) => 9_000_000 + n; // legacy ids no other test uses

/** A small mysqldump in the legacy schema, with the messes the real data is known to have. */
function dump(): string {
  const users = [
    [
      id(1),
      DJANGO,
      1,
      'Asha',
      'Admin',
      1,
      `admin-${run}@legacy.test`,
      'AYODHYA H.O',
      null,
      0,
      0,
      0,
      0,
      'SH117',
      'IT & MIS',
    ],
    [
      id(2),
      DJANGO,
      0,
      'Hari',
      'Hod',
      1,
      `hod-${run}@legacy.test`,
      'AKBARPUR',
      null,
      1,
      0,
      0,
      0,
      'SH168',
      'OPERATIONS',
    ],
    [
      id(3),
      '!unusable',
      0,
      'Sita',
      'Store',
      1,
      `store-${run}@legacy.test`,
      'Akbarpur ',
      null,
      0,
      0,
      0,
      0,
      'SH168',
      'Dairy Farming',
    ],
    [
      id(4),
      'bcrypt_sha256$$2b$12$x',
      0,
      'Old',
      'User',
      0,
      `old-${run}@legacy.test`,
      'NEW BMC X',
      null,
      0,
      1,
      0,
      0,
      'SH999',
      'PURCHASE',
    ],
  ];
  const q = (v: string | number | null) =>
    v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`;
  const values = (rows: (string | number | null)[][]) =>
    rows.map((r) => `(${r.map(q).join(',')})`).join(',');
  return [
    'CREATE TABLE `main_app_customuser` (',
    ...[
      'id',
      'password',
      'is_superuser',
      'first_name',
      'last_name',
      'is_active',
      'email',
      'location',
      'delivery_point_code',
      'is_hod',
      'is_purchase',
      'is_finance',
      'is_logistic',
      'employee_code',
      'department',
    ].map((c) => `  \`${c}\` text,`),
    ') ENGINE=InnoDB;',
    `INSERT INTO \`main_app_customuser\` VALUES ${values(users)};`,
    'CREATE TABLE `main_app_mccbmcuser` (',
    '  `id` bigint,',
    '  `user_id` bigint,',
    '  `location` text',
    ');',
    `INSERT INTO \`main_app_mccbmcuser\` VALUES (${id(1)},${id(3)},'RAM SANEHI GHAT');`,
    'CREATE TABLE `main_app_employee` (',
    '  `id` bigint,',
    '  `employee_code` text,',
    '  `employee_name` text',
    ');',
    `INSERT INTO \`main_app_employee\` VALUES (${id(1)},'SH117','Asha Admin'),(${id(2)},'SH168','Hari Hod');`,
    'CREATE TABLE `main_app_bmcorMCC` (',
    '  `id` bigint,',
    '  `name` text,',
    '  `plant` text',
    ');',
    `INSERT INTO \`main_app_bmcorMCC\` VALUES (${id(1)},'Akbarpur','P101'),(${id(2)},'Mihipurwa MCC','P102');`,
    'CREATE TABLE `main_app_product` (',
    ...[
      'id',
      'product_code',
      'name',
      'size',
      'uom',
      'material_type',
      'category',
      'price',
      'is_active',
      'hod_id',
    ].map((c) => `  \`${c}\` text,`),
    ');',
    `INSERT INTO \`main_app_product\` VALUES ${values([
      [
        id(1),
        `CF${run}`,
        `Cattle Feed ${run}`,
        '50 kg',
        '50kg',
        'FEED',
        'Consumable',
        1250.5,
        1,
        id(2),
      ],
      [id(2), null, `Mineral Mix ${run}`, null, 'BOXES', null, 'Gadgets', 90, 1, null],
      [id(3), null, `Vet Visit ${run}`, null, 'NONE', null, 'Service', 0, 0, null],
    ])};`,
    'CREATE TABLE `main_app_productmapping` (',
    ...['id', 'system', 'product_name', 'product_code', 'description', 'uom'].map(
      (c) => `  \`${c}\` text,`,
    ),
    ');',
    `INSERT INTO \`main_app_productmapping\` VALUES ${values([
      [id(1), 'INDENT_EASY', `Cattle Feed ${run}`, null, null, '50kg'],
      [
        id(2),
        'SAP',
        `CATTLE FEED 50KG ${run}`,
        `36${run.replace(/\D/g, '').padEnd(6, '1').slice(0, 6)}`,
        null,
        'BAG',
      ],
      [id(3), 'NDDB', `Pashu Aahar ${run}`, `ND${run}X`, null, null],
      [id(4), 'INDENT_EASY', `No Such Product ${run}`, null, null, null],
      [id(5), 'SAP', `Ghost ${run}`, '3999999', null, null],
    ])};`,
    'CREATE TABLE `main_app_productmappinggroup` (',
    '  `id` bigint,',
    '  `name` text',
    ');',
    `INSERT INTO \`main_app_productmappinggroup\` VALUES (${id(1)},'CATTLE_FEED_${run}'),(${id(2)},'GHOST_${run}');`,
    'CREATE TABLE `main_app_productmappingrelation` (',
    '  `id` bigint,',
    '  `group_id` bigint,',
    '  `product_mapping_id` bigint,',
    '  `is_primary` tinyint',
    ');',
    `INSERT INTO \`main_app_productmappingrelation\` VALUES (${id(1)},${id(1)},${id(1)},1),(${id(2)},${id(1)},${id(2)},1),(${id(3)},${id(1)},${id(3)},1),(${id(4)},${id(2)},${id(4)},1),(${id(5)},${id(2)},${id(5)},1);`,
    'CREATE TABLE `main_app_vendor` (',
    '  `id` bigint,',
    '  `name` text,',
    '  `email` text,',
    '  `address` text',
    ');',
    `INSERT INTO \`main_app_vendor\` VALUES ${values([
      [id(1), `GENFLOW AI PVT LTD ${run}`, 'sales@genflow.test, accounts@genflow.test', 'Lucknow'],
      [
        id(2),
        `Genflow AI Private Limited ${run}`,
        'sales@genflow.test;dispatch@genflow.test',
        null,
      ],
      [id(3), `Anand Feeds ${run}`, 'NULL', null],
      [id(4), `Bad Mail ${run}`, 'not-an-email', null],
    ])};`,
    'CREATE TABLE `main_app_productvendor` (',
    '  `id` bigint,',
    '  `product_id` bigint,',
    '  `vendor_id` bigint',
    ');',
    `INSERT INTO \`main_app_productvendor\` VALUES (${id(1)},${id(1)},${id(1)}),(${id(2)},${id(1)},${id(2)}),(${id(3)},${id(2)},${id(3)});`,
    'CREATE TABLE `main_app_mppwithcode` (',
    ...[
      'id',
      'mpp_transaction_code',
      'bmc_or_mcc_id',
      'name_with_code',
      'sahayak_mobile_number',
      'cycle',
      'location',
      'status',
    ].map((c) => `  \`${c}\` text,`),
    ');',
    `INSERT INTO \`main_app_mppwithcode\` VALUES ${values([
      [id(1), `M${run}1`, id(1), `Bakewar (M${run}1)`, '9876543210', '1-10', 'Bakewar', 'Active'],
      [id(2), null, id(1), 'Nameless', null, null, null, 'Active'],
      [id(3), `M${run}3`, id(2), `M${run}3 - Lakhna`, '12345', '5-6', 'Lakhna', 'Inactive'],
    ])};`,
    'CREATE TABLE `main_app_whatsapplog` (',
    '  `id` bigint,',
    '  `phone` text',
    ');',
    `INSERT INTO \`main_app_whatsapplog\` VALUES (${id(1)},'+919876543210');`,
  ].join('\n');
}

let pool: pg.Pool;
let org: string;
let file: string;

const one = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) =>
  (await pool.query<T>(sql, params)).rows;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: process.env['MIGRATION_DATABASE_URL'], max: 2 });
  // A fresh organisation, set up like org:bootstrap does.
  org = (
    await one<{ id: string }>(
      `INSERT INTO org.organization (name, legal_name, base_currency, time_zone)
       VALUES ($1, $1, 'INR', 'Asia/Kolkata') RETURNING id`,
      [`Legacy test ${run}`],
    )
  )[0]!.id;
  for (const fn of [
    'identity.seed_role_templates',
    'catalog.seed_reference',
    'docs.seed_document_types',
    'config.seed_configuration',
  ]) {
    await pool.query(`SELECT ${fn}($1)`, [org]);
  }
  file = join(mkdtempSync(join(tmpdir(), 'ie-legacy-')), 'dump.sql');
  writeFileSync(file, dump());
});

afterAll(async () => {
  await pool.end();
});

describe('legacy M1', () => {
  it('stages the dump without WhatsApp data', async () => {
    const staged = await stageDump(pool, file);
    expect(staged.skipped).toEqual(['main_app_whatsapplog']);
    expect(staged.tables.get('main_app_customuser')).toBe(4);
  });

  it('a dry run reports without changing anything', async () => {
    const report = await runMasters(pool, org, { commit: false });
    expect(report.counts['users']?.created).toBe(4);
    expect(await one('SELECT 1 FROM identity.app_user WHERE organization_id = $1', [org])).toEqual(
      [],
    );
  });

  it('migrates the masters and lists what needs a decision', async () => {
    const report = await runMasters(pool, org, { commit: true });

    // Locations: the 13 legacy ones, BMC table names and user strings, matched case-insensitively.
    const locations = await one<{ name: string; type: string; sap: string | null }>(
      `SELECT name, type, sap_plant_code AS sap FROM org.location WHERE organization_id = $1 ORDER BY name`,
      [org],
    );
    expect(locations.find((l) => l.name === 'AYODHYA H.O')?.type).toBe('HEAD_OFFICE');
    expect(locations.find((l) => l.name === 'Akbarpur')).toMatchObject({
      type: 'BMC',
      sap: 'P101',
    });
    expect(locations.filter((l) => l.name.toUpperCase() === 'AKBARPUR')).toHaveLength(1);
    expect(locations.find((l) => l.name === 'Mihipurwa MCC')?.type).toBe('MCC');
    expect(report.issues).toContainEqual(
      expect.objectContaining({ legacyKey: 'NEW BMC X', problem: 'Location type not known' }),
    );

    // Users: roles from the flags, passwords per DEC-004, duplicate employee code reported.
    const users = await one<{
      email: string;
      roles: string[];
      hash: string | null;
      code: string | null;
      status: string;
    }>(
      `SELECT u.email, array_agg(r.code ORDER BY r.code) AS roles, u.password_hash AS hash,
              u.employee_code AS code, u.status
       FROM identity.app_user u JOIN identity.user_role ur ON ur.user_id = u.id
       JOIN identity.role r ON r.id = ur.role_id WHERE u.organization_id = $1 GROUP BY u.id ORDER BY u.email`,
      [org],
    );
    const user = (prefix: string) => users.find((u) => u.email.startsWith(prefix))!;
    expect(user('admin').roles).toEqual(['ADMIN', 'SUPER_ADMIN']);
    expect(user('admin').hash).toBe(DJANGO);
    expect(user('hod').roles).toEqual(['HOD']);
    expect(user('store')).toMatchObject({ roles: ['STORE_USER'], hash: null, code: null });
    expect(user('old')).toMatchObject({ roles: ['PURCHASE_USER'], hash: null, status: 'DISABLED' });
    expect(
      report.issues
        .filter((i) => i.entity === 'users')
        .map((i) => i.problem)
        .sort(),
    ).toEqual([
      'Employee code used by another user',
      'Password cannot be carried over',
      'Password cannot be carried over',
    ]);
    const storeLocations = await one<{ name: string }>(
      `SELECT l.name FROM identity.user_location ul JOIN org.location l ON l.id = ul.location_id
       JOIN identity.app_user u ON u.id = ul.user_id WHERE u.email = $1 ORDER BY l.name`,
      [`store-${run}@legacy.test`],
    );
    expect(storeLocations.map((l) => l.name)).toEqual(['Akbarpur', 'RAM SANEHI GHAT']);

    // Products: generated codes, unknown unit and category reported, owner from the HOD.
    const products = await one<{
      code: string;
      uom: string;
      category: string | null;
      service: boolean;
      owner: string | null;
    }>(
      `SELECT p.code, u.code AS uom, c.code AS category, p.is_service AS service, o.email AS owner
       FROM catalog.product p JOIN catalog.uom u ON u.id = p.base_uom_id
       LEFT JOIN catalog.product_category c ON c.id = p.category_id
       LEFT JOIN identity.app_user o ON o.id = p.owner_user_id
       WHERE p.organization_id = $1 ORDER BY p.code`,
      [org],
    );
    expect(products.find((p) => p.code === `CF${run}`.toUpperCase())).toMatchObject({
      uom: '50KG',
      category: 'CONSUMABLE',
      owner: `hod-${run}@legacy.test`,
    });
    expect(products.find((p) => p.code === `P${String(id(3)).padStart(5, '0')}`)).toMatchObject({
      category: 'SERVICE',
      service: true,
    });
    expect(report.issues).toContainEqual(
      expect.objectContaining({ problem: 'Unknown unit BOXES' }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({ problem: 'Unknown category Gadgets' }),
    );

    // SAP/NDDB codes from the mapping group; the group without a product is reported.
    const codes = await one<{ system: string; name: string }>(
      `SELECT s.code AS system, x.external_name AS name FROM catalog.product_external_code x
       JOIN catalog.external_system s ON s.id = x.external_system_id WHERE x.organization_id = $1 ORDER BY s.code`,
      [org],
    );
    expect(codes).toEqual([
      { system: 'NDDB', name: `Pashu Aahar ${run}` },
      { system: 'SAP', name: `CATTLE FEED 50KG ${run}` },
    ]);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        legacyKey: `GHOST_${run}`,
        problem: 'Mapping group without a matching product',
      }),
    );

    // Vendors: duplicates merged with all their e-mails; NULL and invalid e-mails dropped.
    const vendors = await one<{ name: string; ids: string[]; emails: string[] | null }>(
      `SELECT v.name, v.legacy_vendor_ids::text[] AS ids,
              array_agg(c.email::text ORDER BY c.email) FILTER (WHERE c.email IS NOT NULL) AS emails
       FROM catalog.vendor v LEFT JOIN catalog.vendor_contact c ON c.vendor_id = v.id
       WHERE v.organization_id = $1 GROUP BY v.id ORDER BY v.name`,
      [org],
    );
    expect(vendors).toHaveLength(3);
    expect(vendors.find((v) => v.name.startsWith('GENFLOW'))).toMatchObject({
      ids: [String(id(1)), String(id(2))],
      emails: ['accounts@genflow.test', 'dispatch@genflow.test', 'sales@genflow.test'],
    });
    expect(report.counts['vendors']).toMatchObject({ legacy: 4, created: 3, merged: 1 });
    // The two legacy links to the merged vendor become one.
    expect(report.counts['vendorProducts']).toMatchObject({ legacy: 3, created: 2, merged: 1 });

    // MPPs: name without the code, E.164 mobile, bands; problems reported, none invented.
    const mpps = await one<{
      code: string;
      name: string;
      mobile: string | null;
      band: string | null;
      status: string;
    }>(
      `SELECT code, name, sahayak_mobile_e164 AS mobile, cycle_band AS band, status
       FROM catalog.mpp WHERE organization_id = $1 ORDER BY code`,
      [org],
    );
    expect(mpps).toEqual([
      {
        code: `M${run}1`.toUpperCase(),
        name: 'Bakewar',
        mobile: '+919876543210',
        band: 'DAYS_1_10',
        status: 'ACTIVE',
      },
      {
        code: `M${run}3`.toUpperCase(),
        name: 'Lakhna',
        mobile: null,
        band: null,
        status: 'INACTIVE',
      },
    ]);
    expect(report.counts['mpps']).toMatchObject({ legacy: 3, created: 2, skipped: 1 });
  });

  it('skips users whose e-mail already belongs to another organisation', async () => {
    const other = (
      await one<{ id: string }>(
        `INSERT INTO org.organization (name, legal_name, base_currency, time_zone)
         VALUES ($1, $1, 'INR', 'Asia/Kolkata') RETURNING id`,
        [`Legacy other ${run}`],
      )
    )[0]!.id;
    await pool.query('SELECT identity.seed_role_templates($1)', [other]);
    await pool.query('SELECT catalog.seed_reference($1)', [other]);
    await pool.query('SELECT config.seed_configuration($1)', [other]);
    const report = await runMasters(pool, other, { commit: false });
    expect(report.counts['users']).toMatchObject({ legacy: 4, created: 0, skipped: 4 });
    expect(
      report.issues.filter((i) => i.problem === 'E-mail already used by another organisation'),
    ).toHaveLength(4);
  });

  it('can run again without creating anything twice', async () => {
    const again = await runMasters(pool, org, { commit: true });
    for (const [entity, count] of Object.entries(again.counts)) {
      expect({ entity, created: count.created }).toEqual({ entity, created: 0 });
    }
    expect(
      await one('SELECT 1 FROM catalog.vendor WHERE organization_id = $1', [org]),
    ).toHaveLength(3);
  });
});
