import type { PoolClient } from '../shared/database.js';
import { cycleBandOf, INVALID, mobileE164 } from '../modules/catalog/index.js';
import choices from './choices.json' with { type: 'json' };
import type { Cell, LegacyRow } from './dump.js';

/*
 * M1 — master data from the legacy app (SRS §52.2, mapping matrix §52.3): locations,
 * departments, employees, users and roles, products (with SAP/NDDB codes), vendors (+ contacts),
 * vendor products and MPPs. Every step is idempotent through legacy.id_map, so the migration can
 * be run again after the business fixes something (dress rehearsals, M6). Nothing is guessed
 * silently: every record that needs a decision is listed in the report.
 */

export interface EntityCount {
  legacy: number;
  created: number;
  matched: number;
  merged: number;
  skipped: number;
}

export interface Issue {
  entity: string;
  legacyKey: string;
  problem: string;
  detail?: string;
}

export class Report {
  readonly counts: Record<string, EntityCount> = {};
  readonly issues: Issue[] = [];

  count(entity: string, field: keyof EntityCount, n = 1) {
    this.counts[entity] ??= { legacy: 0, created: 0, matched: 0, merged: 0, skipped: 0 };
    this.counts[entity][field] += n;
  }

  issue(entity: string, legacyKey: unknown, problem: string, detail?: string) {
    this.issues.push({ entity, legacyKey: String(legacyKey), problem, ...(detail && { detail }) });
  }
}

interface Context {
  client: PoolClient;
  org: string;
  report: Report;
}

// ---- Helpers ------------------------------------------------------------------------------------

const text = (value: Cell | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const s = String(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
  return s === '' || s.toUpperCase() === 'NULL' ? null : s;
};
const key = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
const flag = (value: Cell | undefined) => value === 1 || value === '1';

/** A master code from a name: capitals, digits and hyphens, at most 20 characters. */
export function codeFrom(name: string): string {
  const code = key(name).replace(/ /g, '-').slice(0, 20).replace(/-+$/, '');
  return code || 'X';
}

async function rows(ctx: Context, table: string): Promise<LegacyRow[]> {
  const { rows: found } = await ctx.client.query<{ data: LegacyRow }>(
    `SELECT data FROM legacy.source_row WHERE lower(table_name) = lower($1)
     ORDER BY CASE WHEN legacy_id ~ '^[0-9]+$' THEN legacy_id::bigint END, legacy_id`,
    [table],
  );
  return found.map((r) => r.data);
}

async function mapped(ctx: Context, entity: string, legacyKey: string): Promise<string | null> {
  const { rows: found } = await ctx.client.query<{ new_id: string }>(
    'SELECT new_id FROM legacy.id_map WHERE organization_id = $1 AND entity = $2 AND legacy_key = $3',
    [ctx.org, entity, legacyKey],
  );
  return found[0]?.new_id ?? null;
}

async function remember(ctx: Context, entity: string, legacyKey: string, id: string) {
  await ctx.client.query(
    `INSERT INTO legacy.id_map (organization_id, entity, legacy_key, new_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (organization_id, entity, legacy_key) DO UPDATE SET new_id = EXCLUDED.new_id`,
    [ctx.org, entity, legacyKey, id],
  );
}

/** A code not yet used in `table`: the base, then BASE-2, BASE-3… */
async function freeCode(ctx: Context, table: string, base: string): Promise<string> {
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : `-${n}`;
    const code = base.slice(0, 20 - suffix.length) + suffix;
    const { rowCount } = await ctx.client.query(
      `SELECT 1 FROM ${table} WHERE organization_id = $1 AND code = $2`,
      [ctx.org, code],
    );
    if (!rowCount) return code;
  }
}

// ---- Locations ------------------------------------------------------------------------------------

function locationType(name: string, fromBmcTable: boolean): string {
  if (/\bH\.?\s?O\.?$|HEAD\s*OFFICE/i.test(name)) return 'HEAD_OFFICE';
  if (fromBmcTable) return /\bMCC\b/i.test(name) ? 'MCC' : 'BMC';
  return 'OTHER';
}

/** The location a legacy location string names (created if new). */
async function location(
  ctx: Context,
  name: string,
  source: { fromBmcTable: boolean; plant?: string | null },
): Promise<string> {
  const k = key(name);
  const known = await mapped(ctx, 'location', k);
  if (known) return known;
  const { rows: existing } = await ctx.client.query<{ id: string }>(
    `SELECT id FROM org.location WHERE organization_id = $1
       AND ($2 = regexp_replace(upper(name), '[^A-Z0-9]+', ' ', 'g')
            OR $2 = regexp_replace(upper(coalesce(legacy_name, '')), '[^A-Z0-9]+', ' ', 'g')
            OR code = $3)
     LIMIT 1`,
    [ctx.org, k, codeFrom(name)],
  );
  let id = existing[0]?.id;
  if (id) ctx.report.count('locations', 'matched');
  else {
    const type = locationType(name, source.fromBmcTable);
    const { rows: created } = await ctx.client.query<{ id: string }>(
      `INSERT INTO org.location (organization_id, code, name, type, sap_plant_code, legacy_name)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        ctx.org,
        await freeCode(ctx, 'org.location', codeFrom(name)),
        name,
        type,
        source.plant ?? null,
        name,
      ],
    );
    id = created[0]!.id;
    ctx.report.count('locations', 'created');
    if (type === 'OTHER') {
      ctx.report.issue(
        'locations',
        name,
        'Location type not known',
        'Created as OTHER; set BMC, MCC, plant or warehouse.',
      );
    }
  }
  await remember(ctx, 'location', k, id);
  return id;
}

async function migrateLocations(ctx: Context) {
  const names = new Map<string, { name: string; fromBmcTable: boolean; plant: string | null }>();
  const add = (name: string | null, fromBmcTable: boolean, plant: string | null = null) => {
    if (!name) return;
    const k = key(name);
    const current = names.get(k);
    if (!current || (fromBmcTable && !current.fromBmcTable))
      names.set(k, { name, fromBmcTable, plant });
  };
  for (const name of choices.locations) add(text(name), false);
  const bmcs = await rows(ctx, 'main_app_bmcorMCC');
  for (const bmc of bmcs) add(text(bmc['name']), true, text(bmc['plant']));
  for (const user of await rows(ctx, 'main_app_customuser')) add(text(user['location']), false);
  for (const link of await rows(ctx, 'main_app_mccbmcuser')) add(text(link['location']), false);
  ctx.report.count('locations', 'legacy', names.size);
  for (const { name, fromBmcTable, plant } of names.values()) {
    await location(ctx, name, { fromBmcTable, plant });
  }
  // BMC/MCC rows are referenced by id from MPPs.
  for (const bmc of bmcs) {
    const name = text(bmc['name']);
    if (name)
      await remember(ctx, 'bmc', String(bmc['id']), (await mapped(ctx, 'location', key(name)))!);
  }
}

// ---- Departments and employees ----------------------------------------------------------------

async function department(ctx: Context, legacy: string, label: string): Promise<string> {
  const k = key(legacy);
  const known = await mapped(ctx, 'department', k);
  if (known) return known;
  const { rows: existing } = await ctx.client.query<{ id: string }>(
    `SELECT id FROM org.department WHERE organization_id = $1
       AND (code = $2 OR regexp_replace(upper(name), '[^A-Z0-9]+', ' ', 'g') = $3) LIMIT 1`,
    [ctx.org, codeFrom(legacy), k],
  );
  let id = existing[0]?.id;
  if (id) ctx.report.count('departments', 'matched');
  else {
    const { rows: created } = await ctx.client.query<{ id: string }>(
      'INSERT INTO org.department (organization_id, code, name) VALUES ($1, $2, $3) RETURNING id',
      [ctx.org, await freeCode(ctx, 'org.department', codeFrom(legacy)), label],
    );
    id = created[0]!.id;
    ctx.report.count('departments', 'created');
  }
  await remember(ctx, 'department', k, id);
  return id;
}

async function migrateDepartments(ctx: Context) {
  const all = new Map<string, [string, string]>();
  for (const [code, label] of choices.departments) all.set(key(code!), [code!, label!]);
  for (const user of await rows(ctx, 'main_app_customuser')) {
    const d = text(user['department']);
    if (d && !all.has(key(d))) {
      all.set(key(d), [d, d]);
      ctx.report.issue('departments', d, 'Department only found on users', 'Check the name.');
    }
  }
  ctx.report.count('departments', 'legacy', all.size);
  for (const [code, label] of all.values()) await department(ctx, code, label);
}

async function migrateEmployees(ctx: Context) {
  const employees = new Map<string, string>();
  for (const e of await rows(ctx, 'main_app_employee')) {
    const code = text(e['employee_code'])?.toUpperCase();
    if (code) employees.set(code, text(e['employee_name']) ?? code);
  }
  for (const code of choices.employeeCodes) {
    const c = code.toUpperCase();
    if (!employees.has(c)) {
      employees.set(c, c);
      ctx.report.issue(
        'employees',
        c,
        'Employee code without a name',
        'Listed in the legacy code list only; named after the code.',
      );
    }
  }
  ctx.report.count('employees', 'legacy', employees.size);
  for (const [code, name] of employees) {
    const { rows: saved } = await ctx.client.query<{ id: string; created: boolean }>(
      `INSERT INTO org.employee (organization_id, employee_code, name) VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, employee_code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, (xmax = 0) AS created`,
      [ctx.org, code, name],
    );
    ctx.report.count('employees', saved[0]!.created ? 'created' : 'matched');
    await remember(ctx, 'employee', code, saved[0]!.id);
  }
}

// ---- Users and roles ------------------------------------------------------------------------

/** Legacy role flags → role templates (SRS §52.3). */
function rolesOf(user: LegacyRow): string[] {
  const roles: string[] = [];
  if (flag(user['is_superuser'])) roles.push('ADMIN', 'SUPER_ADMIN');
  if (flag(user['is_hod'])) roles.push('HOD');
  if (flag(user['is_purchase'])) roles.push('PURCHASE_USER');
  if (flag(user['is_finance'])) roles.push('FINANCE_USER');
  if (flag(user['is_logistic'])) roles.push('LOGISTICS_USER');
  return roles.length > 0 ? roles : ['STORE_USER'];
}

async function migrateUsers(ctx: Context) {
  const users = await rows(ctx, 'main_app_customuser');
  ctx.report.count('users', 'legacy', users.length);
  const { rows: roleRows } = await ctx.client.query<{ id: string; code: string }>(
    'SELECT id, code FROM identity.role WHERE organization_id = $1',
    [ctx.org],
  );
  const roleId = new Map(roleRows.map((r) => [r.code, r.id]));
  const codesTaken = new Set<string>();
  const links = await rows(ctx, 'main_app_mccbmcuser');

  for (const user of users) {
    const legacyId = String(user['id']);
    const email = text(user['email'])?.toLowerCase();
    if (!email) {
      ctx.report.count('users', 'skipped');
      ctx.report.issue('users', legacyId, 'User without e-mail', 'Not migrated.');
      continue;
    }
    let employeeCode = text(user['employee_code'])?.toUpperCase() ?? null;
    if (employeeCode && codesTaken.has(employeeCode)) {
      ctx.report.issue(
        'users',
        email,
        'Employee code used by another user',
        `${employeeCode} left empty for this user.`,
      );
      employeeCode = null;
    }
    if (employeeCode) codesTaken.add(employeeCode);
    const name =
      [text(user['first_name']), text(user['last_name'])].filter(Boolean).join(' ') ||
      email.split('@')[0]!;
    const locationName = text(user['location']);
    const primary = locationName ? await mapped(ctx, 'location', key(locationName)) : null;
    const departmentName = text(user['department']);
    const departmentId = departmentName
      ? await mapped(ctx, 'department', key(departmentName))
      : null;

    // OQ-025 (DEC-004): Django PBKDF2 hashes are kept and re-hashed at the first sign-in.
    const raw = text(user['password']);
    const passwordHash = raw?.startsWith('pbkdf2_sha256$') ? raw : null;
    if (!passwordHash) {
      ctx.report.issue(
        'users',
        email,
        'Password cannot be carried over',
        raw?.startsWith('!')
          ? 'The legacy account had no usable password.'
          : 'Not a Django PBKDF2 hash: the user must reset the password.',
      );
    }

    // E-mail addresses are unique across organisations, so look everywhere.
    const { rows: byEmail } = await ctx.client.query<{ id: string; organization_id: string }>(
      'SELECT id, organization_id FROM identity.app_user WHERE email = $1',
      [email],
    );
    if (byEmail[0] && byEmail[0].organization_id !== ctx.org) {
      ctx.report.count('users', 'skipped');
      ctx.report.issue(
        'users',
        email,
        'E-mail already used by another organisation',
        'Not migrated.',
      );
      continue;
    }
    const existing = (await mapped(ctx, 'user', legacyId)) ?? byEmail[0]?.id;
    let userId: string;
    if (existing) {
      // An account that already exists here (e.g. set up by hand) keeps its password and roles.
      await ctx.client.query(
        `UPDATE identity.app_user SET legacy_user_id = $2,
           employee_code = coalesce(employee_code, $3), department_id = coalesce(department_id, $4),
           primary_location_id = coalesce(primary_location_id, $5)
         WHERE id = $1`,
        [existing, user['id'], employeeCode, departmentId, primary],
      );
      userId = existing;
      ctx.report.count('users', 'matched');
    } else {
      const { rows: created } = await ctx.client.query<{ id: string }>(
        `INSERT INTO identity.app_user (organization_id, email, display_name, employee_code,
           department_id, primary_location_id, delivery_point_code, status, password_hash,
           must_change_password, legacy_user_id, last_login_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, coalesce($13::timestamptz, now()))
         RETURNING id`,
        [
          ctx.org,
          email,
          name,
          employeeCode,
          departmentId,
          primary,
          text(user['delivery_point_code']),
          flag(user['is_active']) ? 'ACTIVE' : 'DISABLED',
          passwordHash,
          false,
          user['id'],
          text(user['last_login']),
          text(user['date_joined']),
        ],
      );
      userId = created[0]!.id;
      ctx.report.count('users', 'created');
      for (const code of rolesOf(user)) {
        const role = roleId.get(code);
        if (!role) {
          ctx.report.issue('users', email, `Role ${code} not set up`, 'Run org:bootstrap first.');
          continue;
        }
        await ctx.client.query(
          'INSERT INTO identity.user_role (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, role],
        );
      }
    }
    await remember(ctx, 'user', legacyId, userId);
    const locations = new Set(
      [
        primary,
        ...(await Promise.all(
          links
            .filter((l) => String(l['user_id']) === legacyId)
            .map(async (l) => {
              const n = text(l['location']);
              return n ? mapped(ctx, 'location', key(n)) : null;
            }),
        )),
      ].filter((id): id is string => Boolean(id)),
    );
    for (const loc of locations) {
      await ctx.client.query(
        'INSERT INTO identity.user_location (user_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, loc],
      );
    }
    if (employeeCode) {
      await ctx.client.query(
        'UPDATE org.employee SET user_id = $3 WHERE organization_id = $1 AND employee_code = $2',
        [ctx.org, employeeCode, userId],
      );
    }
  }
}

// ---- Products and SAP/NDDB codes ----------------------------------------------------------------

async function uomId(ctx: Context, legacy: string | null, product: string): Promise<string> {
  const code = legacy ?? 'NONE';
  const { rows: found } = await ctx.client.query<{ id: string }>(
    `SELECT id FROM catalog.uom WHERE organization_id = $1
       AND ($2 = ANY(legacy_codes) OR upper(code) = upper($2)) LIMIT 1`,
    [ctx.org, code],
  );
  if (found[0]) return found[0].id;
  ctx.report.issue('products', product, `Unknown unit ${code}`, 'Set to NONE.');
  const { rows: none } = await ctx.client.query<{ id: string }>(
    "SELECT id FROM catalog.uom WHERE organization_id = $1 AND code = 'NONE'",
    [ctx.org],
  );
  return none[0]!.id;
}

async function migrateProducts(ctx: Context) {
  const products = await rows(ctx, 'main_app_product');
  ctx.report.count('products', 'legacy', products.length);
  const { rows: categories } = await ctx.client.query<{ id: string; code: string; name: string }>(
    'SELECT id, code, name FROM catalog.product_category WHERE organization_id = $1',
    [ctx.org],
  );
  for (const p of products) {
    const legacyId = String(p['id']);
    const name = text(p['name']);
    if (!name) {
      ctx.report.count('products', 'skipped');
      ctx.report.issue('products', legacyId, 'Product without a name', 'Not migrated.');
      continue;
    }
    const categoryText = text(p['category']);
    const category = categoryText
      ? categories.find(
          (c) => key(c.name) === key(categoryText) || key(c.code) === key(categoryText),
        )
      : undefined;
    if (categoryText && !category) {
      ctx.report.issue(
        'products',
        name,
        `Unknown category ${categoryText}`,
        'Left without a category.',
      );
    }
    const isService = category?.code === 'SERVICE';
    const code =
      text(p['product_code'])?.toUpperCase().replace(/\s+/g, '') ?? `P${legacyId.padStart(5, '0')}`;
    const hod = p['hod_id'] === null ? null : await mapped(ctx, 'user', String(p['hod_id']));
    const values = [
      name,
      text(p['size']),
      await uomId(ctx, text(p['uom']), name),
      category?.id ?? null,
      text(p['material_type']),
      Number(p['price'] ?? 0),
      !isService,
      isService,
      hod,
      flag(p['is_active']) ? 'ACTIVE' : 'INACTIVE',
    ];
    const existing =
      (await mapped(ctx, 'product', legacyId)) ??
      (
        await ctx.client.query<{ id: string }>(
          'SELECT id FROM catalog.product WHERE organization_id = $1 AND (code = $2 OR legacy_product_id = $3)',
          [ctx.org, code, p['id']],
        )
      ).rows[0]?.id;
    let id: string;
    if (existing) {
      await ctx.client.query(
        `UPDATE catalog.product SET name = $2, size_label = $3, base_uom_id = $4, category_id = $5,
           material_type = $6, standard_price = $7, is_stock_item = $8, is_service = $9,
           owner_user_id = $10, status = $11, legacy_product_id = $12
         WHERE id = $1`,
        [existing, ...values, p['id']],
      );
      id = existing;
      ctx.report.count('products', 'matched');
    } else {
      await ctx.client.query('SAVEPOINT product');
      try {
        const { rows: created } = await ctx.client.query<{ id: string }>(
          `INSERT INTO catalog.product (organization_id, code, name, size_label, base_uom_id,
             category_id, material_type, standard_price, is_stock_item, is_service, owner_user_id,
             status, legacy_product_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
          [ctx.org, code, ...values, p['id']],
        );
        id = created[0]!.id;
        await ctx.client.query('RELEASE SAVEPOINT product');
        ctx.report.count('products', 'created');
      } catch (err) {
        await ctx.client.query('ROLLBACK TO SAVEPOINT product');
        ctx.report.count('products', 'skipped');
        ctx.report.issue('products', name, 'Could not be created', (err as Error).message);
        continue;
      }
    }
    await remember(ctx, 'product', legacyId, id);
  }
}

async function migrateExternalCodes(ctx: Context) {
  const groups = await rows(ctx, 'main_app_productmappinggroup');
  const mappings = new Map(
    (await rows(ctx, 'main_app_productmapping')).map((m) => [String(m['id']), m]),
  );
  const relations = await rows(ctx, 'main_app_productmappingrelation');
  ctx.report.count(
    'externalCodes',
    'legacy',
    [...mappings.values()].filter((m) => text(m['system']) !== 'INDENT_EASY').length,
  );
  const { rows: systems } = await ctx.client.query<{ id: string; code: string }>(
    'SELECT id, code FROM catalog.external_system WHERE organization_id = $1',
    [ctx.org],
  );
  const systemId = new Map(systems.map((s) => [s.code, s.id]));

  for (const group of groups) {
    const groupName = text(group['name']) ?? String(group['id']);
    const members = relations
      .filter((r) => String(r['group_id']) === String(group['id']))
      .map((r) => ({ relation: r, mapping: mappings.get(String(r['product_mapping_id'])) }))
      .filter((m): m is { relation: LegacyRow; mapping: LegacyRow } => Boolean(m.mapping));
    // The group's product: its INDENT_EASY mapping, matched to a product by code or name.
    const own = members.find((m) => text(m.mapping['system']) === 'INDENT_EASY')?.mapping;
    const candidates = [
      text(own?.['product_code'] ?? null),
      text(own?.['product_name'] ?? null),
      groupName,
    ].filter((v): v is string => Boolean(v));
    let productId: string | undefined;
    for (const candidate of candidates) {
      const { rows: found } = await ctx.client.query<{ id: string }>(
        `SELECT id FROM catalog.product WHERE organization_id = $1
           AND (code = upper($2) OR regexp_replace(upper(name), '[^A-Z0-9]+', ' ', 'g') = $3) LIMIT 2`,
        [ctx.org, candidate.replace(/\s+/g, ''), key(candidate)],
      );
      if (found.length === 1) {
        productId = found[0]!.id;
        break;
      }
    }
    if (!productId) {
      const external = members.filter((m) => text(m.mapping['system']) !== 'INDENT_EASY');
      ctx.report.count('externalCodes', 'skipped', external.length);
      ctx.report.issue(
        'externalCodes',
        groupName,
        'Mapping group without a matching product',
        `${external.length} SAP/NDDB codes not migrated.`,
      );
      continue;
    }
    const primarySeen = new Set<string>();
    for (const { relation, mapping } of members) {
      const system = text(mapping['system'])?.toUpperCase();
      if (!system || system === 'INDENT_EASY') continue;
      const sid = systemId.get(system);
      const name = text(mapping['product_name']);
      if (!sid || !name) {
        ctx.report.count('externalCodes', 'skipped');
        ctx.report.issue(
          'externalCodes',
          `${groupName}/${String(mapping['id'])}`,
          sid ? 'Code without a name' : `Unknown system ${system}`,
        );
        continue;
      }
      const code = text(mapping['product_code'])?.toUpperCase().replace(/\s+/g, '') ?? null;
      const primary = flag(relation['is_primary']) && !primarySeen.has(system);
      const { rows: taken } = await ctx.client.query<{ product_id: string }>(
        `SELECT product_id FROM catalog.product_external_code WHERE organization_id = $1
           AND external_system_id = $2 AND external_code = $3 AND status = 'ACTIVE'`,
        [ctx.org, sid, code],
      );
      if (code && taken[0]) {
        if (taken[0].product_id === productId) ctx.report.count('externalCodes', 'matched');
        else {
          ctx.report.count('externalCodes', 'skipped');
          ctx.report.issue(
            'externalCodes',
            `${system} ${code}`,
            'Code already belongs to another product',
            `Group ${groupName}.`,
          );
        }
        continue;
      }
      if (primary) {
        primarySeen.add(system);
        await ctx.client.query(
          `UPDATE catalog.product_external_code SET is_primary = false
           WHERE product_id = $1 AND external_system_id = $2 AND is_primary`,
          [productId, sid],
        );
      }
      await ctx.client.query(
        `INSERT INTO catalog.product_external_code (organization_id, product_id, external_system_id,
           external_code, external_name, uom_text, is_primary, legacy_group_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [ctx.org, productId, sid, code, name, text(mapping['uom']), primary, groupName],
      );
      ctx.report.count('externalCodes', 'created');
    }
  }
}

// ---- Vendors ----------------------------------------------------------------------------------

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
/** Names compared for merging duplicates (OQ-006): case, punctuation and "PVT LTD" spelling. */
const vendorKey = (name: string) =>
  key(name)
    .replace(/\bPRIVATE\b/g, 'PVT')
    .replace(/\bLIMITED\b/g, 'LTD');

async function migrateVendors(ctx: Context) {
  const vendors = await rows(ctx, 'main_app_vendor');
  ctx.report.count('vendors', 'legacy', vendors.length);
  const groups = new Map<string, LegacyRow[]>();
  for (const v of vendors) {
    const name = text(v['name']);
    if (!name) {
      ctx.report.count('vendors', 'skipped');
      ctx.report.issue('vendors', String(v['id']), 'Vendor without a name', 'Not migrated.');
      continue;
    }
    groups.set(vendorKey(name), [...(groups.get(vendorKey(name)) ?? []), v]);
  }
  for (const group of groups.values()) {
    const first = group[0]!;
    const name = text(first['name'])!;
    const legacyIds = group.map((v) => Number(v['id']));
    if (group.length > 1) {
      ctx.report.count('vendors', 'merged', group.length - 1);
      ctx.report.issue(
        'vendors',
        name,
        'Duplicate vendors merged',
        `Legacy ids ${legacyIds.join(', ')} (OQ-006).`,
      );
    }
    const emails = [
      ...new Set(
        group.flatMap((v) =>
          (text(v['email']) ?? '')
            .split(/[,;\s]+/)
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
        ),
      ),
    ];
    const bad = emails.filter((e) => !EMAIL.test(e));
    if (bad.length)
      ctx.report.issue('vendors', name, 'Invalid e-mail addresses dropped', bad.join(', '));
    const address = group.map((v) => text(v['address'])).find(Boolean) ?? null;

    let id =
      (await mapped(ctx, 'vendor', String(first['id']))) ??
      (
        await ctx.client.query<{ id: string }>(
          `SELECT id FROM catalog.vendor WHERE organization_id = $1
           AND (lower(name) = lower($2) OR legacy_vendor_ids && $3::bigint[]) LIMIT 1`,
          [ctx.org, name, legacyIds],
        )
      ).rows[0]?.id;
    if (id) {
      await ctx.client.query(
        `UPDATE catalog.vendor SET legacy_vendor_ids = (SELECT array_agg(DISTINCT x) FROM unnest(legacy_vendor_ids || $2::bigint[]) x)
         WHERE id = $1`,
        [id, legacyIds],
      );
      ctx.report.count('vendors', 'matched');
    } else {
      const { rows: last } = await ctx.client.query<{ n: number | null }>(
        `SELECT max(substring(code FROM '^V([0-9]+)$')::int) AS n FROM catalog.vendor WHERE organization_id = $1`,
        [ctx.org],
      );
      const code = `V${String((last[0]?.n ?? 0) + 1).padStart(4, '0')}`;
      const { rows: created } = await ctx.client.query<{ id: string }>(
        `INSERT INTO catalog.vendor (organization_id, code, name, address, status, legacy_vendor_ids)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5) RETURNING id`,
        [
          ctx.org,
          code,
          name,
          address === null ? null : JSON.stringify({ text: address }),
          legacyIds,
        ],
      );
      id = created[0]!.id;
      ctx.report.count('vendors', 'created');
      for (const email of emails.filter((e) => EMAIL.test(e))) {
        await ctx.client.query(
          `INSERT INTO catalog.vendor_contact (organization_id, vendor_id, email, purposes)
           VALUES ($1, $2, $3, ARRAY['PO'])`,
          [ctx.org, id, email],
        );
      }
    }
    for (const legacyId of legacyIds) await remember(ctx, 'vendor', String(legacyId), id);
  }

  const links = await rows(ctx, 'main_app_productvendor');
  ctx.report.count('vendorProducts', 'legacy', links.length);
  for (const link of links) {
    const vendor = await mapped(ctx, 'vendor', String(link['vendor_id']));
    const product = await mapped(ctx, 'product', String(link['product_id']));
    if (!vendor || !product) {
      ctx.report.count('vendorProducts', 'skipped');
      ctx.report.issue('vendorProducts', String(link['id']), 'Vendor or product not migrated');
      continue;
    }
    const { rowCount } = await ctx.client.query(
      `INSERT INTO catalog.vendor_product (organization_id, vendor_id, product_id)
       VALUES ($1, $2, $3) ON CONFLICT (vendor_id, product_id) DO NOTHING`,
      [ctx.org, vendor, product],
    );
    ctx.report.count('vendorProducts', rowCount ? 'created' : 'merged');
  }
}

// ---- MPPs -------------------------------------------------------------------------------------

async function migrateMpps(ctx: Context) {
  const mpps = await rows(ctx, 'main_app_mppwithcode');
  ctx.report.count('mpps', 'legacy', mpps.length);
  for (const m of mpps) {
    const legacyId = String(m['id']);
    const code = text(m['mpp_transaction_code'])?.toUpperCase().replace(/\s+/g, '');
    const label = text(m['name_with_code']) ?? legacyId;
    if (!code) {
      ctx.report.count('mpps', 'skipped');
      ctx.report.issue('mpps', label, 'MPP without a transaction code', 'Not migrated.');
      continue;
    }
    const bmc = await mapped(ctx, 'bmc', String(m['bmc_or_mcc_id']));
    if (!bmc) {
      ctx.report.count('mpps', 'skipped');
      ctx.report.issue('mpps', code, 'BMC/MCC not found', 'Not migrated.');
      continue;
    }
    // "Name (code)" or "code - Name" in the legacy field: keep the name only.
    const name =
      label
        .replace(
          new RegExp(`[\\s(\\-–:]*${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s)\\-–:]*`, 'i'),
          ' ',
        )
        .trim() || label;
    const mobile = mobileE164(text(m['sahayak_mobile_number']));
    if (mobile === INVALID)
      ctx.report.issue(
        'mpps',
        code,
        'Sahayak mobile not valid',
        String(m['sahayak_mobile_number']),
      );
    const band = cycleBandOf(text(m['cycle']));
    if (band === INVALID)
      ctx.report.issue('mpps', code, 'Cycle band not recognised', String(m['cycle']));
    const status = /inactive|0|false/i.test(String(m['status'] ?? '')) ? 'INACTIVE' : 'ACTIVE';
    const values = [
      code,
      name,
      bmc,
      mobile === INVALID ? null : mobile,
      band === INVALID ? null : band,
      text(m['location']),
      status,
      m['id'],
    ];
    const { rows: saved } = await ctx.client.query<{ id: string; created: boolean }>(
      `INSERT INTO catalog.mpp (organization_id, code, name, bmc_location_id, sahayak_mobile_e164,
         cycle_band, village, status, legacy_mpp_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name,
         bmc_location_id = EXCLUDED.bmc_location_id, sahayak_mobile_e164 = EXCLUDED.sahayak_mobile_e164,
         cycle_band = EXCLUDED.cycle_band, village = EXCLUDED.village, status = EXCLUDED.status,
         legacy_mpp_id = EXCLUDED.legacy_mpp_id, updated_at = now()
       RETURNING id, (xmax = 0) AS created`,
      [ctx.org, ...values],
    );
    ctx.report.count('mpps', saved[0]!.created ? 'created' : 'matched');
    await remember(ctx, 'mpp', legacyId, saved[0]!.id);
  }
}

/** Runs M1 in order (later steps use the ids of earlier ones) in the caller's transaction. */
export async function migrateMasters(client: PoolClient, organizationId: string): Promise<Report> {
  const ctx: Context = { client, org: organizationId, report: new Report() };
  await client.query("SELECT set_config('app.org_id', $1, true)", [organizationId]);
  await migrateLocations(ctx);
  await migrateDepartments(ctx);
  await migrateEmployees(ctx);
  await migrateUsers(ctx);
  await migrateProducts(ctx);
  await migrateExternalCodes(ctx);
  await migrateVendors(ctx);
  await migrateMpps(ctx);
  return ctx.report;
}
