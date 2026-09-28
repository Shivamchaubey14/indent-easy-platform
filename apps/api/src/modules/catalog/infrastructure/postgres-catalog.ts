import type { UserRef } from '@ie/graphql';
import { recordAudit } from '../../../shared/audit.js';
import { currentContext } from '../../../shared/context.js';
import { type Pool, type PoolClient, withOrgContext } from '../../../shared/database.js';
import type { ExternalName } from '../domain/display-name.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** A unique value already in use, named by the input field and the message key to show. */
export class DuplicateValue extends Error {
  constructor(
    readonly field: string[],
    readonly messageKey: string,
  ) {
    super(`duplicate ${field.join('.')}`);
    this.name = 'DuplicateValue';
  }
}

/** An id in the input that names nothing this organisation can see. */
export class UnknownReference extends Error {
  constructor(readonly field: string[]) {
    super(`unknown ${field.join('.')}`);
    this.name = 'UnknownReference';
  }
}

export class VersionConflict extends Error {
  constructor() {
    super('version conflict');
    this.name = 'VersionConflict';
  }
}

export class RecordNotFound extends Error {
  constructor() {
    super('not found');
    this.name = 'RecordNotFound';
  }
}

/** The input a rule refused, e.g. a category that would become its own ancestor. */
export class RuleViolation extends Error {
  constructor(
    readonly field: string[],
    readonly messageKey: string,
  ) {
    super(messageKey);
    this.name = 'RuleViolation';
  }
}

const UNIQUE: Record<string, [string[], string]> = {
  uq_uom_code: [['code'], 'validation.codeTaken'],
  uq_uom_conversion: [['toUomId'], 'validation.conversionExists'],
  uq_category_code: [['code'], 'validation.codeTaken'],
  uq_external_system: [['code'], 'validation.codeTaken'],
  uq_product_code: [['code'], 'validation.codeTaken'],
  uq_product_name_size: [['name'], 'validation.nameSizeTaken'],
  uq_ext_code: [['externalCodes'], 'validation.externalCodeTaken'],
  uq_vendor_code: [['code'], 'validation.codeTaken'],
  uq_vendor_name: [['name'], 'validation.nameTaken'],
  uq_vendor_gstin: [['gstin'], 'validation.gstinTaken'],
  uq_mpp_code: [['code'], 'validation.codeTaken'],
};

/** Turns unique-constraint violations into DuplicateValue; rethrows anything else. */
function rethrowDuplicate(err: unknown): never {
  const pgError = err as { code?: string; constraint?: string };
  const known = pgError.code === '23505' && pgError.constraint && UNIQUE[pgError.constraint];
  if (known) throw new DuplicateValue(...known);
  throw err;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface UomRecord {
  id: string;
  code: string;
  name: string;
  nameHi: string | null;
  decimalsAllowed: number;
}

export interface CategoryRecord {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  requiresInspection: boolean;
  owner: UserRef | null;
}

export interface ExternalSystemRecord {
  id: string;
  code: string;
  name: string;
  displayPriority: number;
}

export interface ConversionRecord {
  id: string;
  fromUomId: string;
  toUomId: string;
  productId: string | null;
  factor: string;
}

export interface ExternalCodeRecord extends ExternalName {
  code: string | null;
}

export interface ProductRecord {
  id: string;
  code: string;
  name: string;
  nameHi: string | null;
  sizeLabel: string | null;
  baseUomId: string;
  categoryId: string | null;
  materialType: string | null;
  hsnCode: string | null;
  standardPrice: string;
  isStockItem: boolean;
  isService: boolean;
  batchTracked: boolean;
  serialTracked: boolean;
  reorderLevel: string | null;
  owner: UserRef | null;
  externalCodes: ExternalCodeRecord[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  createdBy: UserRef | null;
  updatedAt: string | null;
  updatedBy: UserRef | null;
  version: number;
}

export interface VendorContactRecord {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  purposes: string[];
}

export interface VendorRecord {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  sapVendorCode: string | null;
  paymentTermsDays: number | null;
  address: string | null;
  contacts: VendorContactRecord[];
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  createdAt: string;
  createdBy: UserRef | null;
  updatedAt: string | null;
  updatedBy: UserRef | null;
  version: number;
}

export interface VendorProductRecord {
  vendorId: string;
  productId: string;
  priority: number;
  isPrimary: boolean;
  lastPrice: string | null;
  leadTimeDays: number | null;
}

export interface MppRecord {
  id: string;
  code: string;
  name: string;
  bmcLocationId: string;
  sahayakName: string | null;
  sahayakMobile: string | null;
  cycleBand: 'DAYS_1_10' | 'DAYS_11_20' | 'DAYS_21_31' | null;
  village: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
}

// ---------------------------------------------------------------------------
// Command inputs (already validated)
// ---------------------------------------------------------------------------

export interface ProductFields {
  code: string;
  name: string;
  nameHi: string | null;
  sizeLabel: string | null;
  baseUomId: string;
  categoryId: string | null;
  materialType: string | null;
  hsnCode: string | null;
  standardPrice: string;
  isStockItem: boolean;
  isService: boolean;
  batchTracked: boolean;
  serialTracked: boolean;
  reorderLevel: string | null;
  ownerUserId: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ExternalCodeInput {
  system: string;
  code: string | null;
  name: string;
  isPrimary: boolean;
}

export interface VendorFields {
  code: string | null;
  name: string;
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  sapVendorCode: string | null;
  paymentTermsDays: number | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
}

export interface VendorContactInput {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  purposes: string[];
}

export interface MppFields {
  code: string;
  name: string;
  bmcLocationId: string;
  sahayakName: string | null;
  sahayakMobile: string | null;
  cycleBand: string | null;
  village: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ProductListFilter {
  search?: string | null;
  categoryIds?: string[] | null;
  status?: string[] | null;
  isService?: boolean | null;
  vendorId?: string | null;
  externalSystem?: string | null;
  externalCode?: string | null;
}

export interface VendorListFilter {
  search?: string | null;
  status?: string[] | null;
  productId?: string | null;
}

export interface MppListFilter {
  search?: string | null;
  bmcLocationIds?: string[] | null;
  status?: string[] | null;
}

export type ProductSortField = 'NAME' | 'CODE' | 'UPDATED_AT';

export interface Page {
  first: number;
  after?: string | null;
}

export interface PageResult {
  ids: string[];
  cursors: string[];
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Cursor {
  s: string;
  i: string;
}
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(value: string | null | undefined): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as Partial<Cursor>;
    return typeof parsed.s === 'string' && typeof parsed.i === 'string'
      ? { s: parsed.s, i: parsed.i }
      : null;
  } catch {
    return null;
  }
}

const likePattern = (search: string) => `%${search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Collects WHERE fragments; `$?` in a fragment becomes the next parameter number. */
class Conditions {
  readonly where: string[] = [];
  readonly params: unknown[] = [];
  add(sql: string, value: unknown) {
    this.params.push(value);
    this.where.push(sql.replaceAll('$?', `$${this.params.length}`));
  }
  raw(sql: string) {
    this.where.push(sql);
  }
}

/**
 * Keyset pagination over `sortKey` (a text expression) and id. Counts the filtered total, then
 * reads one row more than the page to know whether another page follows.
 */
async function pageOf(
  client: PoolClient,
  options: {
    from: string;
    alias: string;
    sortKey: string;
    descending?: boolean;
    conditions: Conditions;
    page: Page;
  },
): Promise<PageResult> {
  const { from, alias, sortKey, conditions, page } = options;
  const filtered = conditions.where.length ? `WHERE ${conditions.where.join(' AND ')}` : '';
  const total = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ${from} ${filtered}`,
    conditions.params,
  );
  const cursor = decodeCursor(page.after);
  const where = [...conditions.where];
  const params = [...conditions.params];
  const direction = options.descending ? 'DESC' : 'ASC';
  if (cursor) {
    params.push(cursor.s, cursor.i);
    where.push(
      `(${sortKey}, ${alias}.id::text) ${options.descending ? '<' : '>'} ($${params.length - 1}, $${params.length})`,
    );
  }
  params.push(page.first + 1);
  const { rows } = await client.query<{ id: string; sort: string }>(
    `SELECT ${alias}.id, ${sortKey} AS sort FROM ${from}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${sortKey} ${direction}, ${alias}.id::text ${direction}
     LIMIT $${params.length}`,
    params,
  );
  const pageRows = rows.slice(0, page.first);
  return {
    ids: pageRows.map((r) => r.id),
    cursors: pageRows.map((r) => encodeCursor({ s: r.sort, i: r.id })),
    totalCount: total.rows[0]?.count ?? 0,
    hasNextPage: rows.length > page.first,
    hasPreviousPage: cursor !== null,
  };
}

/** Whether `id` is a row of `table` this organisation can see (RLS applies; FKs don't). */
async function visible(
  client: PoolClient,
  table: string,
  id: string,
  extra = '',
): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1 ${extra}`, [id]);
  return (rowCount ?? 0) > 0;
}

async function requireVisible(
  client: PoolClient,
  field: string[],
  table: string,
  id: string | null,
  extra = '',
): Promise<void> {
  if (id !== null && !(await visible(client, table, id, extra))) throw new UnknownReference(field);
}

const ACTIVE_USER = "AND status IN ('ACTIVE', 'INVITED', 'LOCKED')";
const actorId = () => currentContext()?.principal?.userId ?? null;

const USER_REF = (alias: string) =>
  `CASE WHEN ${alias}.id IS NULL THEN NULL ELSE json_build_object(
     'id', ${alias}.id, 'displayName', ${alias}.display_name, 'employeeCode', ${alias}.employee_code)
   END`;

/**
 * Locks the row for update and checks the caller's expected version (optimistic locking, §26).
 * Returns the audit snapshot before the change.
 */
async function lockForUpdate(
  client: PoolClient,
  table: string,
  id: string,
  expectedVersion: number | null,
  select: string,
): Promise<Record<string, unknown>> {
  if (!UUID.test(id)) throw new RecordNotFound();
  const { rows } = await client.query<Record<string, unknown> & { version?: number }>(
    `SELECT ${select} FROM ${table} WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new RecordNotFound();
  if (expectedVersion !== null && row.version !== undefined && row.version !== expectedVersion) {
    throw new VersionConflict();
  }
  return row;
}

async function snapshotOf(client: PoolClient, table: string, id: string, select: string) {
  const { rows } = await client.query<Record<string, unknown>>(
    `SELECT ${select} FROM ${table} WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

const UOM_SELECT = `code, name, name_hi AS "nameHi", decimals_allowed AS "decimalsAllowed"`;
const CATEGORY_SELECT = `code, name, parent_id AS "parentId", owner_user_id AS "ownerUserId",
  requires_inspection AS "requiresInspection"`;
const SYSTEM_SELECT = `code, name, display_priority AS "displayPriority"`;
const PRODUCT_SELECT = `code, name, name_hi AS "nameHi", size_label AS "sizeLabel",
  base_uom_id AS "baseUomId", category_id AS "categoryId", material_type AS "materialType",
  hsn_code AS "hsnCode", standard_price::text AS "standardPrice", is_stock_item AS "isStockItem",
  is_service AS "isService", batch_tracked AS "batchTracked", serial_tracked AS "serialTracked",
  reorder_level::text AS "reorderLevel", owner_user_id AS "ownerUserId", status, version,
  ARRAY(SELECT s.code || ':' || coalesce(x.external_code, '') || ':' || x.external_name
               || CASE WHEN x.is_primary THEN ' (primary)' ELSE '' END
        FROM catalog.product_external_code x JOIN catalog.external_system s ON s.id = x.external_system_id
        WHERE x.product_id = catalog.product.id AND x.status = 'ACTIVE' ORDER BY 1) AS "externalCodes"`;
const VENDOR_SELECT = `code, name, legal_name AS "legalName", gstin, pan IS NOT NULL AS "hasPan",
  sap_vendor_code AS "sapVendorCode", payment_terms_days AS "paymentTermsDays",
  address->>'text' AS address, status, version,
  ARRAY(SELECT concat_ws(' ', c.name, c.email, c.phone_e164, array_to_string(c.purposes, ','))
        FROM catalog.vendor_contact c WHERE c.vendor_id = catalog.vendor.id AND c.status = 'ACTIVE'
        ORDER BY 1) AS contacts`;
const MPP_SELECT = `code, name, bmc_location_id AS "bmcLocationId", sahayak_name AS "sahayakName",
  sahayak_mobile_e164 AS "sahayakMobile", cycle_band AS "cycleBand", village, status, version`;

/** Catalogue masters (SRS §11.3). Every change is audited in its own transaction. */
export class PostgresCatalog {
  constructor(private readonly pool: Pool) {}

  // ---- reference data --------------------------------------------------------------------

  /** Units, categories and external systems: small tables, loaded whole once per request. */
  reference(organizationId: string) {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const uoms = await client.query<UomRecord>(
        `SELECT id, ${UOM_SELECT} FROM catalog.uom ORDER BY code`,
      );
      const categories = await client.query<CategoryRecord>(
        `SELECT c.id, c.code, c.name, c.parent_id AS "parentId",
                c.requires_inspection AS "requiresInspection", ${USER_REF('u')} AS owner
         FROM catalog.product_category c LEFT JOIN identity.app_user u ON u.id = c.owner_user_id
         ORDER BY c.name`,
      );
      const systems = await client.query<ExternalSystemRecord>(
        `SELECT id, ${SYSTEM_SELECT} FROM catalog.external_system
         ORDER BY display_priority = 0, display_priority, code`,
      );
      return { uoms: uoms.rows, categories: categories.rows, externalSystems: systems.rows };
    });
  }

  /** Which of these ids are product categories of the organisation. */
  existingCategoryIds(organizationId: string, ids: readonly string[]): Promise<Set<string>> {
    const valid = ids.filter((i) => UUID.test(i));
    if (!valid.length) return Promise.resolve(new Set());
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        'SELECT id FROM catalog.product_category WHERE id = ANY($1::uuid[])',
        [valid],
      );
      return new Set(rows.map((r) => r.id));
    });
  }

  conversions(organizationId: string, productId: string | null): Promise<ConversionRecord[]> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<ConversionRecord>(
        `SELECT c.id, c.from_uom_id AS "fromUomId", c.to_uom_id AS "toUomId",
                c.product_id AS "productId", c.factor::text AS factor
         FROM catalog.uom_conversion c
         JOIN catalog.uom f ON f.id = c.from_uom_id
         JOIN catalog.uom t ON t.id = c.to_uom_id
         WHERE c.product_id IS NULL OR c.product_id = $1
         ORDER BY c.product_id NULLS FIRST, f.code, t.code`,
        [productId && UUID.test(productId) ? productId : NIL_UUID],
      );
      return rows;
    });
  }

  saveUom(
    organizationId: string,
    id: string | null,
    fields: { code: string; name: string; nameHi: string | null; decimalsAllowed: number },
  ): Promise<string> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const values = [fields.code, fields.name, fields.nameHi, fields.decimalsAllowed];
      let before: object | null = null;
      let savedId: string;
      try {
        if (id) {
          before = await lockForUpdate(client, 'catalog.uom', id, null, UOM_SELECT);
          await client.query(
            `UPDATE catalog.uom SET code = $2, name = $3, name_hi = $4, decimals_allowed = $5
             WHERE id = $1`,
            [id, ...values],
          );
          savedId = id;
        } else {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO catalog.uom (organization_id, code, name, name_hi, decimals_allowed)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [organizationId, ...values],
          );
          savedId = rows[0]!.id;
        }
      } catch (err) {
        rethrowDuplicate(err);
      }
      await recordAudit(client, {
        organizationId,
        action: before ? 'UOM_UPDATED' : 'UOM_CREATED',
        entityType: 'Uom',
        entityId: savedId,
        entityNumber: fields.code,
        before,
        after: await snapshotOf(client, 'catalog.uom', savedId, UOM_SELECT),
      });
      return savedId;
    });
  }

  saveConversion(
    organizationId: string,
    input: { fromUomId: string; toUomId: string; productId: string | null; factor: string },
  ): Promise<string> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      await requireVisible(client, ['fromUomId'], 'catalog.uom', input.fromUomId);
      await requireVisible(client, ['toUomId'], 'catalog.uom', input.toUomId);
      await requireVisible(
        client,
        ['productId'],
        'catalog.product',
        input.productId,
        'AND deleted_at IS NULL',
      );
      const existing = await client.query<{ id: string; factor: string }>(
        `SELECT id, factor::text AS factor FROM catalog.uom_conversion
         WHERE from_uom_id = $1 AND to_uom_id = $2
           AND coalesce(product_id, '${NIL_UUID}'::uuid) = coalesce($3::uuid, '${NIL_UUID}'::uuid)
         FOR UPDATE`,
        [input.fromUomId, input.toUomId, input.productId],
      );
      const found = existing.rows[0];
      // The reverse direction would make two factors that can disagree.
      const reverse = await client.query(
        `SELECT 1 FROM catalog.uom_conversion
         WHERE from_uom_id = $2 AND to_uom_id = $1
           AND coalesce(product_id, '${NIL_UUID}'::uuid) = coalesce($3::uuid, '${NIL_UUID}'::uuid)`,
        [input.fromUomId, input.toUomId, input.productId],
      );
      if (reverse.rowCount) throw new RuleViolation(['toUomId'], 'validation.conversionExists');
      let savedId: string;
      if (found) {
        await client.query('UPDATE catalog.uom_conversion SET factor = $2 WHERE id = $1', [
          found.id,
          input.factor,
        ]);
        savedId = found.id;
      } else {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO catalog.uom_conversion
             (organization_id, from_uom_id, to_uom_id, product_id, factor)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [organizationId, input.fromUomId, input.toUomId, input.productId, input.factor],
        );
        savedId = rows[0]!.id;
      }
      await recordAudit(client, {
        organizationId,
        action: found ? 'UOM_CONVERSION_UPDATED' : 'UOM_CONVERSION_CREATED',
        entityType: 'UomConversion',
        entityId: savedId,
        before: found ? { ...input, factor: found.factor } : null,
        after: input,
      });
      return savedId;
    });
  }

  deleteConversion(organizationId: string, id: string): Promise<void> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      if (!UUID.test(id)) throw new RecordNotFound();
      const { rows } = await client.query<Record<string, unknown>>(
        `DELETE FROM catalog.uom_conversion WHERE id = $1
         RETURNING from_uom_id AS "fromUomId", to_uom_id AS "toUomId",
                   product_id AS "productId", factor::text AS factor`,
        [id],
      );
      if (!rows[0]) throw new RecordNotFound();
      await recordAudit(client, {
        organizationId,
        action: 'UOM_CONVERSION_DELETED',
        entityType: 'UomConversion',
        entityId: id,
        before: rows[0],
        after: null,
      });
    });
  }

  saveCategory(
    organizationId: string,
    id: string | null,
    fields: {
      code: string;
      name: string;
      parentId: string | null;
      ownerUserId: string | null;
      requiresInspection: boolean;
    },
  ): Promise<string> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      await requireVisible(client, ['parentId'], 'catalog.product_category', fields.parentId);
      await requireVisible(
        client,
        ['ownerUserId'],
        'identity.app_user',
        fields.ownerUserId,
        ACTIVE_USER,
      );
      let before: object | null = null;
      if (id) {
        before = await lockForUpdate(client, 'catalog.product_category', id, null, CATEGORY_SELECT);
        if (fields.parentId) {
          // The new parent must not be the category itself or one of its descendants.
          const { rowCount } = await client.query(
            `WITH RECURSIVE up(id, parent_id) AS (
               SELECT id, parent_id FROM catalog.product_category WHERE id = $1
               UNION ALL
               SELECT c.id, c.parent_id FROM catalog.product_category c JOIN up ON c.id = up.parent_id
             ) SELECT 1 FROM up WHERE id = $2`,
            [fields.parentId, id],
          );
          if (rowCount) throw new RuleViolation(['parentId'], 'validation.categoryCycle');
        }
      }
      const values = [
        fields.code,
        fields.name,
        fields.parentId,
        fields.ownerUserId,
        fields.requiresInspection,
      ];
      let savedId: string;
      try {
        if (id) {
          await client.query(
            `UPDATE catalog.product_category
             SET code = $2, name = $3, parent_id = $4, owner_user_id = $5, requires_inspection = $6
             WHERE id = $1`,
            [id, ...values],
          );
          savedId = id;
        } else {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO catalog.product_category
               (organization_id, code, name, parent_id, owner_user_id, requires_inspection)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [organizationId, ...values],
          );
          savedId = rows[0]!.id;
        }
      } catch (err) {
        rethrowDuplicate(err);
      }
      await recordAudit(client, {
        organizationId,
        action: before ? 'PRODUCT_CATEGORY_UPDATED' : 'PRODUCT_CATEGORY_CREATED',
        entityType: 'ProductCategory',
        entityId: savedId,
        entityNumber: fields.code,
        before,
        after: await snapshotOf(client, 'catalog.product_category', savedId, CATEGORY_SELECT),
      });
      return savedId;
    });
  }

  saveExternalSystem(
    organizationId: string,
    id: string | null,
    fields: { code: string; name: string; displayPriority: number },
  ): Promise<string> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const values = [fields.code, fields.name, fields.displayPriority];
      let before: object | null = null;
      let savedId: string;
      try {
        if (id) {
          before = await lockForUpdate(client, 'catalog.external_system', id, null, SYSTEM_SELECT);
          await client.query(
            `UPDATE catalog.external_system SET code = $2, name = $3, display_priority = $4
             WHERE id = $1`,
            [id, ...values],
          );
          savedId = id;
        } else {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO catalog.external_system (organization_id, code, name, display_priority)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [organizationId, ...values],
          );
          savedId = rows[0]!.id;
        }
      } catch (err) {
        rethrowDuplicate(err);
      }
      await recordAudit(client, {
        organizationId,
        action: before ? 'EXTERNAL_SYSTEM_UPDATED' : 'EXTERNAL_SYSTEM_CREATED',
        entityType: 'ExternalSystem',
        entityId: savedId,
        entityNumber: fields.code,
        before,
        after: await snapshotOf(client, 'catalog.external_system', savedId, SYSTEM_SELECT),
      });
      return savedId;
    });
  }

  // ---- products ----------------------------------------------------------------------------

  listProducts(
    organizationId: string,
    filter: ProductListFilter,
    sort: { field: ProductSortField; descending: boolean },
    page: Page,
  ): Promise<PageResult> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const c = new Conditions();
      c.raw('p.deleted_at IS NULL');
      if (filter.search?.trim()) {
        c.add(
          `(p.code ILIKE $? OR p.name ILIKE $? OR p.size_label ILIKE $? OR EXISTS (
             SELECT 1 FROM catalog.product_external_code x
             WHERE x.product_id = p.id AND x.status = 'ACTIVE'
               AND (x.external_code ILIKE $? OR x.external_name ILIKE $?)))`,
          likePattern(filter.search),
        );
      }
      if (filter.categoryIds?.length) {
        c.add(
          'p.category_id = ANY($?::uuid[])',
          filter.categoryIds.filter((i) => UUID.test(i)),
        );
      }
      if (filter.status?.length) c.add('p.status = ANY($?)', filter.status);
      if (typeof filter.isService === 'boolean') c.add('p.is_service = $?', filter.isService);
      if (filter.vendorId) {
        c.add(
          `EXISTS (SELECT 1 FROM catalog.vendor_product vp
                   WHERE vp.product_id = p.id AND vp.vendor_id::text = $?)`,
          filter.vendorId,
        );
      }
      if (filter.externalSystem || filter.externalCode) {
        const conditions = ["x.product_id = p.id AND x.status = 'ACTIVE'"];
        if (filter.externalSystem) {
          c.params.push(filter.externalSystem.toUpperCase());
          conditions.push(`s.code = $${c.params.length}`);
        }
        if (filter.externalCode) {
          c.params.push(filter.externalCode.trim());
          // SAP material numbers are matched with or without leading zeros (legacy behaviour).
          conditions.push(`ltrim(x.external_code, '0') = ltrim($${c.params.length}, '0')`);
        }
        c.raw(
          `EXISTS (SELECT 1 FROM catalog.product_external_code x
                   JOIN catalog.external_system s ON s.id = x.external_system_id
                   WHERE ${conditions.join(' AND ')})`,
        );
      }
      const sortKey = {
        NAME: 'lower(p.name)',
        CODE: 'p.code',
        UPDATED_AT: `to_char(coalesce(p.updated_at, p.created_at) AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS')`,
      }[sort.field];
      return pageOf(client, {
        from: 'catalog.product p',
        alias: 'p',
        sortKey,
        descending: sort.descending,
        conditions: c,
        page,
      });
    });
  }

  products(organizationId: string, ids: readonly string[]): Promise<ProductRecord[]> {
    const valid = ids.filter((i) => UUID.test(i));
    if (!valid.length) return Promise.resolve([]);
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<ProductRecord>(
        `SELECT p.id, p.code, p.name, p.name_hi AS "nameHi", p.size_label AS "sizeLabel",
                p.base_uom_id AS "baseUomId", p.category_id AS "categoryId",
                p.material_type AS "materialType", p.hsn_code AS "hsnCode",
                p.standard_price::text AS "standardPrice", p.is_stock_item AS "isStockItem",
                p.is_service AS "isService", p.batch_tracked AS "batchTracked",
                p.serial_tracked AS "serialTracked", p.reorder_level::text AS "reorderLevel",
                ${USER_REF('o')} AS owner, p.status,
                to_json(p.created_at) #>> '{}' AS "createdAt", ${USER_REF('cu')} AS "createdBy",
                to_json(p.updated_at) #>> '{}' AS "updatedAt", ${USER_REF('uu')} AS "updatedBy",
                p.version,
                coalesce((
                  SELECT json_agg(json_build_object(
                           'system', s.code, 'code', x.external_code, 'name', x.external_name,
                           'isPrimary', x.is_primary, 'displayPriority', s.display_priority)
                         ORDER BY s.display_priority, s.code, NOT x.is_primary, x.external_name)
                  FROM catalog.product_external_code x
                  JOIN catalog.external_system s ON s.id = x.external_system_id
                  WHERE x.product_id = p.id AND x.status = 'ACTIVE'), '[]') AS "externalCodes"
         FROM catalog.product p
         LEFT JOIN identity.app_user o ON o.id = p.owner_user_id
         LEFT JOIN identity.app_user cu ON cu.id = p.created_by
         LEFT JOIN identity.app_user uu ON uu.id = p.updated_by
         WHERE p.id = ANY($1::uuid[]) AND p.deleted_at IS NULL`,
        [valid],
      );
      const byId = new Map(rows.map((r) => [r.id, r]));
      return valid.map((i) => byId.get(i)).filter((r): r is ProductRecord => r !== undefined);
    });
  }

  /** The product with this internal code, or with this code in an external system. */
  productIdByCode(
    organizationId: string,
    code: string,
    system: string | null,
  ): Promise<string | null> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = system
        ? await client.query<{ id: string }>(
            `SELECT p.id FROM catalog.product p
             JOIN catalog.product_external_code x ON x.product_id = p.id AND x.status = 'ACTIVE'
             JOIN catalog.external_system s ON s.id = x.external_system_id
             WHERE s.code = $1 AND ltrim(x.external_code, '0') = ltrim($2, '0')
               AND p.deleted_at IS NULL
             ORDER BY x.is_primary DESC LIMIT 1`,
            [system.toUpperCase(), code.trim()],
          )
        : await client.query<{ id: string }>(
            'SELECT id FROM catalog.product WHERE code = $1 AND deleted_at IS NULL',
            [code.trim().toUpperCase()],
          );
      return rows[0]?.id ?? null;
    });
  }

  saveProduct(
    organizationId: string,
    input: {
      id: string | null;
      expectedVersion: number | null;
      fields: ProductFields;
      /** Replaces the product's external codes; null leaves them as they are. */
      externalCodes: ExternalCodeInput[] | null;
    },
  ): Promise<string> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { fields } = input;
      await requireVisible(client, ['baseUomId'], 'catalog.uom', fields.baseUomId);
      await requireVisible(client, ['categoryId'], 'catalog.product_category', fields.categoryId);
      await requireVisible(
        client,
        ['ownerUserId'],
        'identity.app_user',
        fields.ownerUserId,
        ACTIVE_USER,
      );
      const values = [
        fields.code,
        fields.name,
        fields.nameHi,
        fields.sizeLabel,
        fields.baseUomId,
        fields.categoryId,
        fields.materialType,
        fields.hsnCode,
        fields.standardPrice,
        fields.isStockItem,
        fields.isService,
        fields.batchTracked,
        fields.serialTracked,
        fields.reorderLevel,
        fields.ownerUserId,
        fields.status,
        actorId(),
      ];
      let before: Record<string, unknown> | null = null;
      let productId: string;
      try {
        if (input.id) {
          before = await lockForUpdate(
            client,
            'catalog.product',
            input.id,
            input.expectedVersion,
            PRODUCT_SELECT,
          );
          await client.query(
            `UPDATE catalog.product SET code = $2, name = $3, name_hi = $4, size_label = $5,
               base_uom_id = $6, category_id = $7, material_type = $8, hsn_code = $9,
               standard_price = $10, is_stock_item = $11, is_service = $12, batch_tracked = $13,
               serial_tracked = $14, reorder_level = $15, owner_user_id = $16, status = $17,
               updated_by = $18, updated_at = now(), version = version + 1
             WHERE id = $1`,
            [input.id, ...values],
          );
          productId = input.id;
        } else {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO catalog.product (organization_id, code, name, name_hi, size_label,
               base_uom_id, category_id, material_type, hsn_code, standard_price, is_stock_item,
               is_service, batch_tracked, serial_tracked, reorder_level, owner_user_id, status,
               created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
             RETURNING id`,
            [organizationId, ...values],
          );
          productId = rows[0]!.id;
        }
        if (input.externalCodes) {
          await this.replaceExternalCodes(client, organizationId, productId, input.externalCodes);
        }
      } catch (err) {
        rethrowDuplicate(err);
      }
      await recordAudit(client, {
        organizationId,
        action: before ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED',
        entityType: 'Product',
        entityId: productId,
        entityNumber: fields.code,
        before,
        after: await snapshotOf(client, 'catalog.product', productId, PRODUCT_SELECT),
      });
      return productId;
    });
  }

  private async replaceExternalCodes(
    client: PoolClient,
    organizationId: string,
    productId: string,
    codes: ExternalCodeInput[],
  ) {
    const systems = await client.query<{ id: string; code: string }>(
      'SELECT id, code FROM catalog.external_system',
    );
    const systemId = new Map(systems.rows.map((s) => [s.code, s.id]));
    codes.forEach((c, i) => {
      if (!systemId.has(c.system))
        throw new UnknownReference(['externalCodes', String(i), 'system']);
    });
    // Nothing references these rows, so replacing them keeps the unique indexes simple.
    await client.query('DELETE FROM catalog.product_external_code WHERE product_id = $1', [
      productId,
    ]);
    for (const c of codes) {
      await client.query(
        `INSERT INTO catalog.product_external_code
           (organization_id, product_id, external_system_id, external_code, external_name, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [organizationId, productId, systemId.get(c.system), c.code, c.name, c.isPrimary],
      );
    }
  }

  // ---- vendors -----------------------------------------------------------------------------

  listVendors(organizationId: string, filter: VendorListFilter, page: Page): Promise<PageResult> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const c = new Conditions();
      if (filter.search?.trim()) {
        c.add(
          `(v.code ILIKE $? OR v.name ILIKE $? OR v.legal_name ILIKE $? OR v.gstin ILIKE $?
            OR v.sap_vendor_code ILIKE $?)`,
          likePattern(filter.search),
        );
      }
      if (filter.status?.length) c.add('v.status = ANY($?)', filter.status);
      if (filter.productId) {
        c.add(
          `EXISTS (SELECT 1 FROM catalog.vendor_product vp
                   WHERE vp.vendor_id = v.id AND vp.product_id::text = $?)`,
          filter.productId,
        );
      }
      return pageOf(client, {
        from: 'catalog.vendor v',
        alias: 'v',
        sortKey: 'lower(v.name)',
        conditions: c,
        page,
      });
    });
  }

  vendors(organizationId: string, ids: readonly string[]): Promise<VendorRecord[]> {
    const valid = ids.filter((i) => UUID.test(i));
    if (!valid.length) return Promise.resolve([]);
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<VendorRecord>(
        `SELECT v.id, v.code, v.name, v.legal_name AS "legalName", v.gstin, v.pan,
                v.sap_vendor_code AS "sapVendorCode", v.payment_terms_days AS "paymentTermsDays",
                v.address->>'text' AS address, v.status,
                to_json(v.created_at) #>> '{}' AS "createdAt", ${USER_REF('cu')} AS "createdBy",
                to_json(v.updated_at) #>> '{}' AS "updatedAt", ${USER_REF('uu')} AS "updatedBy",
                v.version,
                coalesce((
                  SELECT json_agg(json_build_object(
                           'id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone_e164,
                           'purposes', c.purposes) ORDER BY c.name NULLS LAST, c.email)
                  FROM catalog.vendor_contact c
                  WHERE c.vendor_id = v.id AND c.status = 'ACTIVE'), '[]') AS contacts
         FROM catalog.vendor v
         LEFT JOIN identity.app_user cu ON cu.id = v.created_by
         LEFT JOIN identity.app_user uu ON uu.id = v.updated_by
         WHERE v.id = ANY($1::uuid[])`,
        [valid],
      );
      const byId = new Map(rows.map((r) => [r.id, r]));
      return valid.map((i) => byId.get(i)).filter((r): r is VendorRecord => r !== undefined);
    });
  }

  /** Vendor–product rows for these vendors or these products. */
  vendorProducts(
    organizationId: string,
    by: { vendorIds?: readonly string[]; productIds?: readonly string[] },
  ): Promise<VendorProductRecord[]> {
    const column = by.vendorIds ? 'vendor_id' : 'product_id';
    const ids = (by.vendorIds ?? by.productIds ?? []).filter((i) => UUID.test(i));
    if (!ids.length) return Promise.resolve([]);
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<VendorProductRecord>(
        `SELECT vp.vendor_id AS "vendorId", vp.product_id AS "productId", vp.priority,
                vp.is_primary AS "isPrimary", vp.last_price::text AS "lastPrice",
                vp.lead_time_days AS "leadTimeDays"
         FROM catalog.vendor_product vp
         WHERE vp.${column} = ANY($1::uuid[])
         ORDER BY vp.is_primary DESC, vp.priority, vp.created_at`,
        [ids],
      );
      return rows;
    });
  }

  saveVendor(
    organizationId: string,
    input: {
      id: string | null;
      expectedVersion: number | null;
      fields: VendorFields;
      contacts: VendorContactInput[];
    },
  ): Promise<string> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { fields } = input;
      let before: Record<string, unknown> | null = null;
      let vendorId: string;
      try {
        if (input.id) {
          before = await lockForUpdate(
            client,
            'catalog.vendor',
            input.id,
            input.expectedVersion,
            VENDOR_SELECT,
          );
        }
        const code =
          fields.code ??
          (before?.['code'] as string | undefined) ??
          (await nextVendorCode(client, organizationId));
        const values = [
          code,
          fields.name,
          fields.legalName,
          fields.gstin,
          fields.pan,
          fields.sapVendorCode,
          fields.paymentTermsDays,
          fields.address === null ? null : JSON.stringify({ text: fields.address }),
          fields.status,
          actorId(),
        ];
        if (input.id) {
          await client.query(
            `UPDATE catalog.vendor SET code = $2, name = $3, legal_name = $4, gstin = $5, pan = $6,
               sap_vendor_code = $7, payment_terms_days = $8, address = $9::jsonb, status = $10,
               updated_by = $11, updated_at = now(), version = version + 1
             WHERE id = $1`,
            [input.id, ...values],
          );
          vendorId = input.id;
        } else {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO catalog.vendor (organization_id, code, name, legal_name, gstin, pan,
               sap_vendor_code, payment_terms_days, address, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11) RETURNING id`,
            [organizationId, ...values],
          );
          vendorId = rows[0]!.id;
        }
      } catch (err) {
        rethrowDuplicate(err);
      }
      await this.replaceContacts(client, organizationId, vendorId, input.contacts);
      await recordAudit(client, {
        organizationId,
        action: before ? 'VENDOR_UPDATED' : 'VENDOR_CREATED',
        entityType: 'Vendor',
        entityId: vendorId,
        entityNumber: fields.name,
        before,
        after: await snapshotOf(client, 'catalog.vendor', vendorId, VENDOR_SELECT),
      });
      return vendorId;
    });
  }

  /** Keeps contacts that come back with their id, adds new ones, retires the rest. */
  private async replaceContacts(
    client: PoolClient,
    organizationId: string,
    vendorId: string,
    contacts: VendorContactInput[],
  ) {
    const kept: string[] = [];
    for (const [i, contact] of contacts.entries()) {
      const values = [contact.name, contact.email, contact.phone, contact.purposes];
      if (contact.id) {
        const { rowCount } = await client.query(
          `UPDATE catalog.vendor_contact
           SET name = $3, email = $4, phone_e164 = $5, purposes = $6, status = 'ACTIVE'
           WHERE id = $1 AND vendor_id = $2`,
          [UUID.test(contact.id) ? contact.id : NIL_UUID, vendorId, ...values],
        );
        if (!rowCount) throw new UnknownReference(['contacts', String(i), 'id']);
        kept.push(contact.id);
      } else {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO catalog.vendor_contact
             (organization_id, vendor_id, name, email, phone_e164, purposes)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [organizationId, vendorId, ...values],
        );
        kept.push(rows[0]!.id);
      }
    }
    // Retired, not deleted: purchase orders will record which contact they were sent to.
    await client.query(
      `UPDATE catalog.vendor_contact SET status = 'INACTIVE'
       WHERE vendor_id = $1 AND NOT (id = ANY($2::uuid[]))`,
      [vendorId, kept],
    );
  }

  setVendorProducts(
    organizationId: string,
    vendorId: string,
    items: {
      productId: string;
      priority: number;
      isPrimary: boolean;
      leadTimeDays: number | null;
    }[],
  ): Promise<void> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      await lockForUpdate(client, 'catalog.vendor', vendorId, null, 'id');
      const productIds = items.map((i) => i.productId);
      if (productIds.some((p) => !UUID.test(p))) {
        throw new UnknownReference([
          'items',
          String(productIds.findIndex((p) => !UUID.test(p))),
          'productId',
        ]);
      }
      const known = await client.query<{ id: string }>(
        'SELECT id FROM catalog.product WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL',
        [productIds],
      );
      const knownIds = new Set(known.rows.map((r) => r.id));
      const missing = productIds.findIndex((p) => !knownIds.has(p));
      if (missing >= 0) throw new UnknownReference(['items', String(missing), 'productId']);

      const beforeRows = await client.query<{
        productId: string;
        priority: number;
        isPrimary: boolean;
      }>(
        `SELECT product_id AS "productId", priority, is_primary AS "isPrimary"
         FROM catalog.vendor_product WHERE vendor_id = $1 ORDER BY product_id`,
        [vendorId],
      );
      await client.query(
        'DELETE FROM catalog.vendor_product WHERE vendor_id = $1 AND NOT (product_id = ANY($2::uuid[]))',
        [vendorId, productIds],
      );
      for (const item of items) {
        // last_price is learnt from purchase orders, so an existing row keeps it.
        await client.query(
          `INSERT INTO catalog.vendor_product
             (organization_id, vendor_id, product_id, priority, is_primary, lead_time_days)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (vendor_id, product_id) DO UPDATE
           SET priority = EXCLUDED.priority, is_primary = EXCLUDED.is_primary,
               lead_time_days = EXCLUDED.lead_time_days`,
          [
            organizationId,
            vendorId,
            item.productId,
            item.priority,
            item.isPrimary,
            item.leadTimeDays,
          ],
        );
      }
      await recordAudit(client, {
        organizationId,
        action: 'VENDOR_PRODUCTS_SET',
        entityType: 'Vendor',
        entityId: vendorId,
        before: { products: beforeRows.rows },
        after: {
          products: [...items]
            .sort((a, b) => a.productId.localeCompare(b.productId))
            .map(({ productId, priority, isPrimary }) => ({ productId, priority, isPrimary })),
        },
      });
    });
  }

  // ---- MPPs --------------------------------------------------------------------------------

  listMpps(
    organizationId: string,
    filter: MppListFilter,
    scope: { kind: 'all' } | { kind: 'some'; locationIds: readonly string[] },
    page: Page,
  ): Promise<PageResult> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const c = new Conditions();
      if (scope.kind === 'some') c.add('m.bmc_location_id = ANY($?::uuid[])', scope.locationIds);
      if (filter.search?.trim()) {
        c.add(
          `(m.code ILIKE $? OR m.name ILIKE $? OR m.village ILIKE $? OR m.sahayak_name ILIKE $?)`,
          likePattern(filter.search),
        );
      }
      if (filter.bmcLocationIds?.length) {
        c.add(
          'm.bmc_location_id = ANY($?::uuid[])',
          filter.bmcLocationIds.filter((i) => UUID.test(i)),
        );
      }
      if (filter.status?.length) c.add('m.status = ANY($?)', filter.status);
      return pageOf(client, {
        from: 'catalog.mpp m',
        alias: 'm',
        sortKey: 'lower(m.name)',
        conditions: c,
        page,
      });
    });
  }

  mpps(organizationId: string, ids: readonly string[]): Promise<MppRecord[]> {
    const valid = ids.filter((i) => UUID.test(i));
    if (!valid.length) return Promise.resolve([]);
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<MppRecord>(
        `SELECT id, ${MPP_SELECT} FROM catalog.mpp WHERE id = ANY($1::uuid[])`,
        [valid],
      );
      const byId = new Map(rows.map((r) => [r.id, r]));
      return valid.map((i) => byId.get(i)).filter((r): r is MppRecord => r !== undefined);
    });
  }

  saveMpp(
    organizationId: string,
    input: {
      id: string | null;
      expectedVersion: number | null;
      fields: MppFields;
      /** Checked before the change: may the caller manage MPPs at this BMC? */
      mayManageAt: (locationId: string) => boolean;
    },
  ): Promise<string> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { fields } = input;
      await requireVisible(
        client,
        ['bmcLocationId'],
        'org.location',
        fields.bmcLocationId,
        "AND type IN ('BMC', 'MCC')",
      );
      let before: Record<string, unknown> | null = null;
      if (input.id) {
        before = await lockForUpdate(
          client,
          'catalog.mpp',
          input.id,
          input.expectedVersion,
          MPP_SELECT,
        );
        // Moving an MPP needs rights at the BMC it leaves as well as the one it joins.
        if (!input.mayManageAt(before['bmcLocationId'] as string)) throw new RecordNotFound();
      }
      const values = [
        fields.code,
        fields.name,
        fields.bmcLocationId,
        fields.sahayakName,
        fields.sahayakMobile,
        fields.cycleBand,
        fields.village,
        fields.status,
      ];
      let mppId: string;
      try {
        if (input.id) {
          await client.query(
            `UPDATE catalog.mpp SET code = $2, name = $3, bmc_location_id = $4, sahayak_name = $5,
               sahayak_mobile_e164 = $6, cycle_band = $7, village = $8, status = $9,
               updated_at = now(), version = version + 1
             WHERE id = $1`,
            [input.id, ...values],
          );
          mppId = input.id;
        } else {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO catalog.mpp (organization_id, code, name, bmc_location_id, sahayak_name,
               sahayak_mobile_e164, cycle_band, village, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [organizationId, ...values],
          );
          mppId = rows[0]!.id;
        }
      } catch (err) {
        rethrowDuplicate(err);
      }
      await recordAudit(client, {
        organizationId,
        action: before ? 'MPP_UPDATED' : 'MPP_CREATED',
        entityType: 'Mpp',
        entityId: mppId,
        entityNumber: fields.code,
        before,
        after: await snapshotOf(client, 'catalog.mpp', mppId, MPP_SELECT),
      });
      return mppId;
    });
  }
}

/** Next V0001-style code; legacy vendors had none. */
async function nextVendorCode(client: PoolClient, organizationId: string): Promise<string> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `vendor-code:${organizationId}`,
  ]);
  const { rows } = await client.query<{ next: number }>(
    `SELECT coalesce(max(substring(code FROM '^V([0-9]+)$')::int), 0) + 1 AS next
     FROM catalog.vendor`,
  );
  return `V${String(rows[0]?.next ?? 1).padStart(4, '0')}`;
}
