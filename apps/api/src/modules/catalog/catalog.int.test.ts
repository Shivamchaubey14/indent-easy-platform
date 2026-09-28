/*
 * Catalogue masters over GraphQL against real PostgreSQL and Redis: reference data, products
 * with external codes, vendors, MPP scopes, permissions and row-level security.
 */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { createApp } from '../../app.js';
import { withOrgContext } from '../../shared/database.js';
import { integrationApp, ORG } from '../../test/integration-app.js';
import { passwords, PostgresIdentity } from '../identity/index.js';

const run = randomUUID().slice(0, 6).toUpperCase();
const PASSWORD = 'first milk of the monsoon';
const users: string[] = [];
const locations: string[] = [];

let pool: pg.Pool;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let admin: string;
let purchase: string;
let hod: string;
let store: string;
let bmc: { id: string; code: string };
let otherBmc: { id: string; code: string };
let kg: string;
let bag50: string;

interface GraphQLBody<T> {
  data?: T | null;
  errors?: { message: string; extensions: Record<string, unknown> }[];
}
interface UserErrorShape {
  code: string;
  message: string;
  field: string[];
}

async function account(roleCode: string, locationCodes: string[] = []) {
  const identity = new PostgresIdentity(pool);
  const email = `catalog-${run.toLowerCase()}-${users.length}@test.local`;
  const id = await identity.createAccount({
    organizationId: ORG,
    email,
    displayName: `Catalogue test ${users.length}`,
    passwordHash: await passwords.hash(PASSWORD),
    mustChangePassword: false,
  });
  users.push(id);
  await identity.assignRole({ organizationId: ORG, userId: id, roleCode, locationCodes });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Client-Name', 'mobile')
    .set('X-Forwarded-For', `10.78.${users.length}.${Math.floor(Math.random() * 250)}`)
    .send({ identifier: email, password: PASSWORD });
  return { id, token: (res.body as { accessToken: string }).accessToken };
}

async function gql<T>(
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

const SAVE_PRODUCT = `mutation($input: SaveProductInput!) {
  saveProduct(input: $input) {
    product {
      id code name displayName version status
      baseUom { code } category { code }
      standardPrice { amount currency }
      externalCodes { system code name isPrimary }
    }
    userErrors { code message field }
  }
}`;
type SavedProduct = {
  saveProduct: {
    product: {
      id: string;
      version: number;
      displayName: string;
      externalCodes: { system: string; code: string | null }[];
    } | null;
    userErrors: UserErrorShape[];
  };
};

const SAVE_VENDOR = `mutation($input: SaveVendorInput!) {
  saveVendor(input: $input) {
    vendor { id code name status version contacts { id email phone purposes } }
    userErrors { code message field }
  }
}`;
type SavedVendor = {
  saveVendor: {
    vendor: { id: string; code: string; version: number; contacts: { id: string }[] } | null;
    userErrors: UserErrorShape[];
  };
};

const SAVE_MPP = `mutation($input: SaveMppInput!) {
  saveMpp(input: $input) { mpp { id code bmc { code } sahayakMobile } userErrors { code message field } }
}`;

const productInput = (overrides: Record<string, unknown> = {}) => ({
  code: `P${run}-1`,
  name: `Cattle feed ${run}`,
  sizeLabel: '50 kg',
  baseUomId: bag50,
  isStockItem: true,
  isService: false,
  standardPrice: '1450.00',
  ...overrides,
});

beforeAll(async () => {
  ({ app, pool, close } = await integrationApp());
  const created = await withOrgContext(pool, ORG, (client) =>
    client.query<{ id: string; code: string }>(
      `INSERT INTO org.location (organization_id, code, name, type)
       VALUES ($1, $2, 'Catalogue BMC', 'BMC'), ($1, $3, 'Other BMC', 'BMC') RETURNING id, code`,
      [ORG, `C${run}`, `O${run}`],
    ),
  );
  [bmc, otherBmc] = created.rows as [{ id: string; code: string }, { id: string; code: string }];
  locations.push(bmc.id, otherBmc.id);
  const uoms = await withOrgContext(pool, ORG, (client) =>
    client.query<{ id: string; code: string }>(
      "SELECT id, code FROM catalog.uom WHERE code IN ('KG', '50KG')",
    ),
  );
  kg = uoms.rows.find((u) => u.code === 'KG')!.id;
  bag50 = uoms.rows.find((u) => u.code === '50KG')!.id;
  admin = (await account('ADMIN')).token;
  purchase = (await account('PURCHASE_USER')).token;
  hod = (await account('HOD')).token;
  store = (await account('STORE_USER', [bmc.code])).token;
});

afterAll(async () => {
  await withOrgContext(pool, ORG, async (client) => {
    const products = `SELECT id FROM catalog.product WHERE code LIKE 'P${run}%'`;
    const vendors = `SELECT id FROM catalog.vendor WHERE name LIKE '%${run}%'`;
    await client.query(`DELETE FROM catalog.vendor_product WHERE product_id IN (${products})`);
    await client.query(`DELETE FROM catalog.vendor_contact WHERE vendor_id IN (${vendors})`);
    await client.query(`DELETE FROM catalog.vendor WHERE id IN (${vendors})`);
    await client.query(
      `DELETE FROM catalog.product_external_code WHERE product_id IN (${products})`,
    );
    await client.query(
      `DELETE FROM catalog.uom_conversion WHERE product_id IN (${products})
         OR from_uom_id IN (SELECT id FROM catalog.uom WHERE code LIKE 'U${run}%')`,
    );
    await client.query(`DELETE FROM catalog.product WHERE code LIKE 'P${run}%'`);
    await client.query(`DELETE FROM catalog.uom WHERE code LIKE 'U${run}%'`);
    await client.query(`DELETE FROM catalog.mpp WHERE code LIKE 'M${run}%'`);
    await client.query(`DELETE FROM catalog.product_category WHERE code LIKE 'K${run}%'`);
    await client.query(`DELETE FROM catalog.external_system WHERE code LIKE 'X${run}%'`);
  });
  await pool.query('DELETE FROM identity.session WHERE user_id = ANY($1)', [users]);
  await withOrgContext(pool, ORG, async (client) => {
    await client.query('DELETE FROM identity.app_user WHERE id = ANY($1)', [users]);
    await client.query('DELETE FROM org.location WHERE id = ANY($1)', [locations]);
  });
  await close();
});

describe('reference data', () => {
  it('gives every signed-in user the seeded units, conversions, categories and systems', async () => {
    const body = await gql<{
      uoms: { code: string }[];
      uomConversions: { from: { code: string }; to: { code: string }; factor: string }[];
      productCategories: { code: string }[];
      externalSystems: { code: string; displayPriority: number }[];
    }>(
      store,
      `{ uoms { code } uomConversions { from { code } to { code } factor }
         productCategories { code } externalSystems { code displayPriority } }`,
    );
    expect(body.errors).toBeUndefined();
    const data = body.data!;
    expect(data.uoms.map((u) => u.code)).toEqual(expect.arrayContaining(['KG', '50KG', '3KG']));
    expect(data.uoms.filter((u) => u.code.toUpperCase() === '3KG')).toHaveLength(1);
    expect(data.uomConversions).toContainEqual({
      from: { code: '50KG' },
      to: { code: 'KG' },
      factor: '50.000000',
    });
    expect(data.productCategories.map((c) => c.code)).toEqual(
      expect.arrayContaining(['CONSUMABLE', 'SPARE_PART', 'SERVICE']),
    );
    expect(data.externalSystems.slice(0, 2).map((s) => s.code)).toEqual(['NDDB', 'SAP']);
  });

  it('lets an administrator add units and conversions, refusing the reverse direction', async () => {
    const saved = await gql<{ saveUom: { uom: { id: string; code: string } } }>(
      admin,
      `mutation($input: SaveUomInput!) { saveUom(input: $input) { uom { id code } userErrors { message } } }`,
      { input: { code: `u${run}`, name: 'Crate of 12', decimalsAllowed: 0 } },
    );
    const crate = saved.data!.saveUom.uom;
    expect(crate.code).toBe(`U${run}`);
    const CONVERT = `mutation($input: SaveUomConversionInput!) {
      saveUomConversion(input: $input) { conversion { id factor } userErrors { code message field } }
    }`;
    type Converted = {
      saveUomConversion: {
        conversion: { id: string; factor: string } | null;
        userErrors: UserErrorShape[];
      };
    };
    const first = await gql<Converted>(admin, CONVERT, {
      input: { fromUomId: crate.id, toUomId: kg, factor: '12' },
    });
    expect(first.data!.saveUomConversion.conversion?.factor).toBe('12.000000');
    const changed = await gql<Converted>(admin, CONVERT, {
      input: { fromUomId: crate.id, toUomId: kg, factor: '12.5' },
    });
    expect(changed.data!.saveUomConversion.conversion).toEqual({
      id: first.data!.saveUomConversion.conversion!.id,
      factor: '12.500000',
    });
    const reverse = await gql<Converted>(admin, CONVERT, {
      input: { fromUomId: kg, toUomId: crate.id, factor: '0.08' },
    });
    expect(reverse.data!.saveUomConversion.userErrors[0]?.message).toBe(
      'validation.conversionExists',
    );
  });

  it('refuses a category that would become its own ancestor', async () => {
    const SAVE = `mutation($input: SaveProductCategoryInput!) {
      saveProductCategory(input: $input) { category { id parent { code } } userErrors { message field } }
    }`;
    type Saved = {
      saveProductCategory: {
        category: { id: string; parent: { code: string } | null } | null;
        userErrors: { message: string; field: string[] }[];
      };
    };
    const parent = await gql<Saved>(admin, SAVE, { input: { code: `K${run}A`, name: 'Feed' } });
    const parentId = parent.data!.saveProductCategory.category!.id;
    const child = await gql<Saved>(admin, SAVE, {
      input: { code: `K${run}B`, name: 'Mineral mixture', parentId },
    });
    expect(child.data!.saveProductCategory.category!.parent).toEqual({ code: `K${run}A` });
    const cycle = await gql<Saved>(admin, SAVE, {
      input: {
        id: parentId,
        code: `K${run}A`,
        name: 'Feed',
        parentId: child.data!.saveProductCategory.category!.id,
      },
    });
    expect(cycle.data!.saveProductCategory.userErrors).toEqual([
      { message: 'validation.categoryCycle', field: ['input', 'parentId'] },
    ]);
  });
});

describe('products', () => {
  let productId: string;

  it('creates a product whose display name follows NDDB, then SAP, and audits it', async () => {
    const body = await gql<SavedProduct>(admin, SAVE_PRODUCT, {
      input: productInput({
        externalCodes: [
          {
            system: 'SAP',
            code: `000${run.replace(/\D/g, '9')}77`,
            name: 'CATTLE FEED TYPE II 50KG',
          },
          { system: 'NDDB', name: 'Cattle feed (BIS type II)' },
        ],
      }),
    });
    expect(body.errors).toBeUndefined();
    const { product, userErrors } = body.data!.saveProduct;
    expect(userErrors).toEqual([]);
    expect(product).toMatchObject({
      code: `P${run}-1`,
      displayName: 'Cattle feed (BIS type II)',
      version: 1,
      status: 'ACTIVE',
      baseUom: { code: '50KG' },
      standardPrice: { amount: '1450.00', currency: 'INR' },
    });
    productId = product!.id;
    const audit = await withOrgContext(pool, ORG, (client) =>
      client.query<{ action: string }>('SELECT action FROM audit.audit_log WHERE entity_id = $1', [
        productId,
      ]),
    );
    expect(audit.rows.map((r) => r.action)).toEqual(['PRODUCT_CREATED']);
  });

  it('finds the product by SAP code with or without leading zeros, and by search', async () => {
    const sapCode = `${run.replace(/\D/g, '9')}77`;
    const body = await gql<{
      byCode: { id: string } | null;
      search: { totalCount: number; edges: { node: { id: string } }[] };
    }>(
      store,
      `query($code: String!, $search: String!) {
        byCode: productByCode(code: $code, system: "SAP") { id }
        search: products(filter: { search: $search }) { totalCount edges { node { id } } }
      }`,
      { code: sapCode, search: sapCode },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data!.byCode?.id).toBe(productId);
    expect(body.data!.search.edges.map((e) => e.node.id)).toEqual([productId]);
  });

  it('refuses a duplicate name and size, a stocked service and a stale version', async () => {
    const duplicate = await gql<SavedProduct>(admin, SAVE_PRODUCT, {
      input: productInput({ code: `P${run}-2`, name: ` cattle FEED ${run} ` }),
    });
    expect(duplicate.data!.saveProduct.userErrors).toEqual([
      { code: 'CONFLICT', message: 'validation.nameSizeTaken', field: ['input', 'name'] },
    ]);
    const service = await gql<SavedProduct>(admin, SAVE_PRODUCT, {
      input: productInput({ code: `P${run}-3`, name: 'AI service', isService: true }),
    });
    expect(service.data!.saveProduct.userErrors[0]?.message).toBe('validation.serviceNotStock');

    const updated = await gql<SavedProduct>(admin, SAVE_PRODUCT, {
      input: productInput({ id: productId, expectedVersion: 1, name: `Cattle feed ${run} II` }),
    });
    expect(updated.data!.saveProduct.product?.version).toBe(2);
    // Without externalCodes the codes are left as they were.
    expect(updated.data!.saveProduct.product?.externalCodes).toHaveLength(2);
    const stale = await gql<SavedProduct>(admin, SAVE_PRODUCT, {
      input: productInput({ id: productId, expectedVersion: 1 }),
    });
    expect(stale.data!.saveProduct.userErrors[0]?.code).toBe('VERSION_CONFLICT');
  });

  it('refuses product changes to purchase users, who may only read', async () => {
    const body = await gql<SavedProduct>(purchase, SAVE_PRODUCT, {
      input: productInput({ code: `P${run}-4`, name: 'Refused' }),
    });
    expect(body.errors?.[0]?.extensions['code']).toBe('FORBIDDEN');
  });
});

describe('vendors', () => {
  let vendorId: string;

  it('lets purchase create a vendor with a generated code and contacts', async () => {
    const body = await gql<SavedVendor>(purchase, SAVE_VENDOR, {
      input: {
        name: `Genflow ${run}`,
        gstin: '09aaacg1234c1z5',
        contacts: [
          { name: 'Orders', email: `orders-${run.toLowerCase()}@genflow.test`, purposes: ['PO'] },
          { phone: '+91 98765 43210', purposes: ['DISPATCH'] },
        ],
      },
    });
    expect(body.errors).toBeUndefined();
    const { vendor, userErrors } = body.data!.saveVendor;
    expect(userErrors).toEqual([]);
    expect(vendor!.code).toMatch(/^V\d{4,}$/);
    expect(vendor!.contacts).toHaveLength(2);
    vendorId = vendor!.id;
  });

  it('keeps contacts that come back with their id and retires the rest', async () => {
    const current = await gql<{ vendor: { contacts: { id: string; email: string | null }[] } }>(
      purchase,
      `query($id: ID!) { vendor(id: $id) { contacts { id email } } }`,
      { id: vendorId },
    );
    const orders = current.data!.vendor.contacts.find((c) => c.email)!;
    const body = await gql<SavedVendor>(purchase, SAVE_VENDOR, {
      input: {
        id: vendorId,
        expectedVersion: 1,
        name: `Genflow ${run}`,
        contacts: [{ id: orders.id, email: orders.email, purposes: ['PO', 'ACCOUNTS'] }],
      },
    });
    expect(body.data!.saveVendor.vendor!.contacts).toEqual([
      { id: orders.id, email: orders.email, phone: null, purposes: ['PO', 'ACCOUNTS'] },
    ]);
  });

  it('needs vendor:deactivate to block a vendor', async () => {
    const body = await gql<SavedVendor>(purchase, SAVE_VENDOR, {
      input: { id: vendorId, name: `Genflow ${run}`, contacts: [], status: 'BLOCKED' },
    });
    expect(body.errors?.[0]?.extensions['code']).toBe('FORBIDDEN');
  });

  it('maps products to the vendor; readers without vendor:read see no suppliers', async () => {
    const product = await gql<SavedProduct>(admin, SAVE_PRODUCT, {
      input: productInput({ code: `P${run}-5`, name: `Mineral mixture ${run}`, sizeLabel: '1 kg' }),
    });
    const productId = product.data!.saveProduct.product!.id;
    const mapped = await gql<{
      setVendorProducts: {
        vendor: { products: { product: { id: string }; isPrimary: boolean }[] };
      };
    }>(
      purchase,
      `mutation($input: SetVendorProductsInput!) {
        setVendorProducts(input: $input) {
          vendor { products { product { id } isPrimary } } userErrors { message }
        }
      }`,
      { input: { vendorId, items: [{ productId, isPrimary: true }] } },
    );
    expect(mapped.data!.setVendorProducts.vendor.products).toEqual([
      { product: { id: productId }, isPrimary: true },
    ]);
    const QUERY = `query($id: ID!) { product(id: $id) { vendors { vendor { name } } } }`;
    const seen = await gql<{ product: { vendors: { vendor: { name: string } }[] } }>(store, QUERY, {
      id: productId,
    });
    expect(seen.data!.product.vendors).toEqual([{ vendor: { name: `Genflow ${run}` } }]);
    const hidden = await gql<{ product: { vendors: unknown[] } }>(hod, QUERY, { id: productId });
    expect(hidden.data!.product.vendors).toEqual([]);
  });
});

describe('MPPs', () => {
  it('stores the Sahayak mobile in E.164 and only shows MPPs in the reader’s scope', async () => {
    const here = await gql<{ saveMpp: { mpp: { id: string; sahayakMobile: string } } }>(
      admin,
      SAVE_MPP,
      {
        input: {
          code: `M${run}1`,
          name: 'Rampur',
          bmcLocationId: bmc.id,
          sahayakMobile: '+91 98765 43210',
          cycleBand: 'DAYS_1_10',
        },
      },
    );
    expect(here.data!.saveMpp.mpp.sahayakMobile).toBe('+919876543210');
    const there = await gql<{ saveMpp: { mpp: { id: string } } }>(admin, SAVE_MPP, {
      input: { code: `M${run}2`, name: 'Sonpur', bmcLocationId: otherBmc.id },
    });
    const body = await gql<{
      mpps: { edges: { node: { code: string } }[] };
      other: { id: string } | null;
    }>(
      store,
      `query($search: String!, $other: ID!) {
        mpps(filter: { search: $search }) { edges { node { code } } }
        other: mpp(id: $other) { id }
      }`,
      { search: `M${run}`, other: there.data!.saveMpp.mpp.id },
    );
    expect(body.data!.mpps.edges.map((e) => e.node.code)).toEqual([`M${run}1`]);
    expect(body.data!.other).toBeNull();
  });

  it('refuses an MPP at a location that is not a BMC or MCC', async () => {
    const office = await withOrgContext(pool, ORG, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO org.location (organization_id, code, name, type)
         VALUES ($1, $2, 'Catalogue office', 'HEAD_OFFICE') RETURNING id`,
        [ORG, `H${run}`],
      ),
    );
    locations.push(office.rows[0]!.id);
    const body = await gql<{ saveMpp: { userErrors: UserErrorShape[] } }>(admin, SAVE_MPP, {
      input: { code: `M${run}3`, name: 'Nowhere', bmcLocationId: office.rows[0]!.id },
    });
    expect(body.data!.saveMpp.userErrors).toEqual([
      { code: 'NOT_FOUND', message: 'validation.notFound', field: ['input', 'bmcLocationId'] },
    ]);
  });
});

describe('isolation', () => {
  it('hides catalogue child rows from other organisations', async () => {
    const counts = await withOrgContext(pool, randomUUID(), (client) =>
      client.query<{ conversions: number; contacts: number; mappings: number }>(
        `SELECT (SELECT count(*)::int FROM catalog.uom_conversion) AS conversions,
                (SELECT count(*)::int FROM catalog.vendor_contact) AS contacts,
                (SELECT count(*)::int FROM catalog.vendor_product) AS mappings`,
      ),
    );
    expect(counts.rows[0]).toEqual({ conversions: 0, contacts: 0, mappings: 0 });
  });
});
