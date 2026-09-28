import type { UserError } from '@ie/graphql';
import type { GraphQLContext } from '../../../graphql/context.js';
import { batchLoader, perRequest } from '../../../graphql/loaders.js';
import type { CatalogResult, CatalogService } from '../application/catalog-service.js';
import { displayName } from '../domain/display-name.js';
import type {
  CategoryRecord,
  ConversionRecord,
  ExternalSystemRecord,
  MppListFilter,
  MppRecord,
  PageResult,
  PostgresCatalog,
  ProductListFilter,
  ProductRecord,
  ProductSortField,
  UomRecord,
  VendorListFilter,
  VendorProductRecord,
  VendorRecord,
} from '../infrastructure/postgres-catalog.js';

/** What the catalogue resolvers need (wired in the module's index). */
export interface CatalogQueries {
  service: CatalogService;
  store: PostgresCatalog;
}

interface Reference {
  uoms: UomRecord[];
  categories: CategoryRecord[];
  externalSystems: ExternalSystemRecord[];
  uom: (id: string | null) => UomRecord | null;
  category: (id: string | null) => CategoryRecord | null;
}

type PaginationArgs = { first?: number | null; after?: string | null } | null | undefined;

const org = (ctx: GraphQLContext) => ctx.viewer().organizationId;
const catalog = (ctx: GraphQLContext) => ctx.services.catalog;
const money = (amount: string | null) => (amount === null ? null : { amount, currency: 'INR' });

async function loadReference(ctx: GraphQLContext): Promise<Reference> {
  const data = await catalog(ctx).store.reference(org(ctx));
  const uoms = new Map(data.uoms.map((u) => [u.id, u]));
  const categories = new Map(data.categories.map((c) => [c.id, c]));
  return {
    ...data,
    uom: (id) => (id ? (uoms.get(id) ?? null) : null),
    category: (id) => (id ? (categories.get(id) ?? null) : null),
  };
}

/** Units, categories and systems for this request (reloaded after a change to them). */
const reference = (ctx: GraphQLContext, fresh = false): Promise<Reference> =>
  fresh ? loadReference(ctx) : perRequest(ctx, 'catalog.reference', () => loadReference(ctx));

const byIdLoader = <V extends { id: string }>(
  ctx: GraphQLContext,
  key: string,
  load: (ids: string[]) => Promise<V[]>,
) =>
  perRequest(ctx, key, () =>
    batchLoader<V>(async (ids) => new Map((await load(ids)).map((v) => [v.id, v]))),
  );

const productLoader = (ctx: GraphQLContext) =>
  byIdLoader(ctx, 'catalog.product', (ids) => catalog(ctx).store.products(org(ctx), ids));
const vendorLoader = (ctx: GraphQLContext) =>
  byIdLoader(ctx, 'catalog.vendor', (ids) => catalog(ctx).store.vendors(org(ctx), ids));

const vendorProductsLoader = (ctx: GraphQLContext, by: 'vendorId' | 'productId') =>
  perRequest(ctx, `catalog.vendorProducts.${by}`, () =>
    batchLoader<VendorProductRecord[]>(async (ids) => {
      const rows = await catalog(ctx).store.vendorProducts(
        org(ctx),
        by === 'vendorId' ? { vendorIds: ids } : { productIds: ids },
      );
      const grouped = new Map<string, VendorProductRecord[]>(ids.map((i) => [i, []]));
      for (const row of rows) grouped.get(row[by])?.push(row);
      return grouped;
    }),
  );

function connection<T>(page: PageResult, nodes: T[]) {
  return {
    edges: nodes.map((node, i) => ({ node, cursor: page.cursors[i] })),
    totalCount: page.totalCount,
    pageInfo: {
      hasNextPage: page.hasNextPage,
      hasPreviousPage: page.hasPreviousPage,
      startCursor: page.cursors[0] ?? null,
      endCursor: page.cursors.at(-1) ?? null,
    },
  };
}

const pageArgs = (pagination: PaginationArgs) => ({
  first: Math.min(Math.max(pagination?.first ?? 20, 1), 100),
  after: pagination?.after ?? null,
});

async function actor(ctx: GraphQLContext) {
  return { organizationId: org(ctx), grants: (await ctx.access()).grants };
}

/** A mutation payload: the saved record under `key`, or the problems. */
async function payload<K extends string, T>(
  key: K,
  result: CatalogResult,
  find: (id: string) => Promise<T | null | undefined>,
): Promise<Record<K, T | null> & { userErrors: UserError[] }> {
  const saved = result.ok ? ((await find(result.id)) ?? null) : null;
  return { [key]: saved, userErrors: result.ok ? [] : result.userErrors } as Record<K, T | null> & {
    userErrors: UserError[];
  };
}

async function mppVisible(ctx: GraphQLContext, mpp: MppRecord | undefined) {
  if (!mpp) return null;
  const { grants } = await ctx.access();
  return grants.canAccess('mpp:read', { locationId: mpp.bmcLocationId }) ? mpp : null;
}

export const catalogResolvers = {
  Query: {
    uoms: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => (await reference(ctx)).uoms,
    uomConversions: (_p: unknown, args: { productId?: string | null }, ctx: GraphQLContext) =>
      catalog(ctx).store.conversions(org(ctx), args.productId ?? null),
    productCategories: async (_p: unknown, _a: unknown, ctx: GraphQLContext) =>
      (await reference(ctx)).categories,
    externalSystems: async (_p: unknown, _a: unknown, ctx: GraphQLContext) =>
      (await reference(ctx)).externalSystems,
    products: async (
      _p: unknown,
      args: {
        filter?: ProductListFilter | null;
        sort?: { field: ProductSortField; direction: 'ASC' | 'DESC' } | null;
        pagination?: PaginationArgs;
      },
      ctx: GraphQLContext,
    ) => {
      const page = await catalog(ctx).store.listProducts(
        org(ctx),
        args.filter ?? {},
        {
          field: args.sort?.field ?? 'NAME',
          descending: args.sort?.direction === 'DESC',
        },
        pageArgs(args.pagination),
      );
      return connection(page, await catalog(ctx).store.products(org(ctx), page.ids));
    },
    product: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) =>
      (await productLoader(ctx)(args.id)) ?? null,
    productByCode: async (
      _p: unknown,
      args: { code: string; system?: string | null },
      ctx: GraphQLContext,
    ) => {
      const id = await catalog(ctx).store.productIdByCode(org(ctx), args.code, args.system ?? null);
      return id ? ((await productLoader(ctx)(id)) ?? null) : null;
    },
    vendors: async (
      _p: unknown,
      args: { filter?: VendorListFilter | null; pagination?: PaginationArgs },
      ctx: GraphQLContext,
    ) => {
      const page = await catalog(ctx).store.listVendors(
        org(ctx),
        args.filter ?? {},
        pageArgs(args.pagination),
      );
      return connection(page, await catalog(ctx).store.vendors(org(ctx), page.ids));
    },
    vendor: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) =>
      (await vendorLoader(ctx)(args.id)) ?? null,
    mpps: async (
      _p: unknown,
      args: { filter?: MppListFilter | null; pagination?: PaginationArgs },
      ctx: GraphQLContext,
    ) => {
      const { grants } = await ctx.access();
      const page = await catalog(ctx).store.listMpps(
        org(ctx),
        args.filter ?? {},
        grants.locationScope('mpp:read'),
        pageArgs(args.pagination),
      );
      return connection(page, await catalog(ctx).store.mpps(org(ctx), page.ids));
    },
    mpp: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const [mpp] = await catalog(ctx).store.mpps(org(ctx), [args.id]);
      return mppVisible(ctx, mpp);
    },
  },
  Mutation: {
    saveUom: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      payload('uom', await catalog(ctx).service.saveUom(await actor(ctx), args.input), async (id) =>
        (await reference(ctx, true)).uom(id),
      ),
    saveUomConversion: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) => {
      const result = await catalog(ctx).service.saveConversion(await actor(ctx), args.input);
      const productId = (args.input as { productId?: string | null }).productId ?? null;
      return payload('conversion', result, async (id) =>
        (await catalog(ctx).store.conversions(org(ctx), productId)).find((c) => c.id === id),
      );
    },
    deleteUomConversion: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const result = await catalog(ctx).service.deleteConversion(await actor(ctx), args.id);
      return result.ok
        ? { deletedId: result.id, userErrors: [] }
        : { deletedId: null, userErrors: result.userErrors };
    },
    saveProductCategory: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      payload(
        'category',
        await catalog(ctx).service.saveCategory(await actor(ctx), args.input),
        async (id) => (await reference(ctx, true)).category(id),
      ),
    saveExternalSystem: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      payload(
        'externalSystem',
        await catalog(ctx).service.saveExternalSystem(await actor(ctx), args.input),
        async (id) => (await reference(ctx, true)).externalSystems.find((s) => s.id === id),
      ),
    saveProduct: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      payload(
        'product',
        await catalog(ctx).service.saveProduct(await actor(ctx), args.input),
        async (id) => (await catalog(ctx).store.products(org(ctx), [id]))[0],
      ),
    saveVendor: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      payload(
        'vendor',
        await catalog(ctx).service.saveVendor(await actor(ctx), args.input),
        async (id) => (await catalog(ctx).store.vendors(org(ctx), [id]))[0],
      ),
    setVendorProducts: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      payload(
        'vendor',
        await catalog(ctx).service.setVendorProducts(await actor(ctx), args.input),
        async (id) => (await catalog(ctx).store.vendors(org(ctx), [id]))[0],
      ),
    saveMpp: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      payload(
        'mpp',
        await catalog(ctx).service.saveMpp(await actor(ctx), args.input),
        async (id) => (await catalog(ctx).store.mpps(org(ctx), [id]))[0],
      ),
  },
  ProductCategory: {
    parent: async (category: CategoryRecord, _a: unknown, ctx: GraphQLContext) =>
      (await reference(ctx)).category(category.parentId),
  },
  UomConversion: {
    from: async (c: ConversionRecord, _a: unknown, ctx: GraphQLContext) =>
      (await reference(ctx)).uom(c.fromUomId),
    to: async (c: ConversionRecord, _a: unknown, ctx: GraphQLContext) =>
      (await reference(ctx)).uom(c.toUomId),
    product: async (c: ConversionRecord, _a: unknown, ctx: GraphQLContext) =>
      c.productId ? ((await productLoader(ctx)(c.productId)) ?? null) : null,
  },
  Product: {
    displayName: (p: ProductRecord) => displayName(p.name, p.externalCodes),
    baseUom: async (p: ProductRecord, _a: unknown, ctx: GraphQLContext) =>
      (await reference(ctx)).uom(p.baseUomId),
    category: async (p: ProductRecord, _a: unknown, ctx: GraphQLContext) =>
      (await reference(ctx)).category(p.categoryId),
    standardPrice: (p: ProductRecord) => money(p.standardPrice),
    // Store users read products but not who supplies them.
    vendors: async (p: ProductRecord, _a: unknown, ctx: GraphQLContext) =>
      (await ctx.access()).grants.can('vendor:read')
        ? ((await vendorProductsLoader(ctx, 'productId')(p.id)) ?? [])
        : [],
    // Stock balances arrive with the inventory ledger (Phase 4).
    stock: () => [],
  },
  Vendor: {
    products: async (v: VendorRecord, _a: unknown, ctx: GraphQLContext) =>
      (await vendorProductsLoader(ctx, 'vendorId')(v.id)) ?? [],
    // Delivery performance needs purchase orders and GRNs (Phases 3 and 5).
    performance: () => null,
  },
  VendorProduct: {
    vendor: async (vp: VendorProductRecord, _a: unknown, ctx: GraphQLContext) =>
      vendorLoader(ctx)(vp.vendorId),
    product: async (vp: VendorProductRecord, _a: unknown, ctx: GraphQLContext) =>
      productLoader(ctx)(vp.productId),
    lastPrice: (vp: VendorProductRecord) => money(vp.lastPrice),
  },
  Mpp: {
    bmc: async (mpp: MppRecord, _a: unknown, ctx: GraphQLContext) =>
      (await ctx.directory()).location(mpp.bmcLocationId),
  },
};

/** Product categories by id for other modules' resolvers (e.g. role scopes), per request. */
export async function categoriesById(
  ctx: GraphQLContext,
  ids: readonly string[],
): Promise<CategoryRecord[]> {
  const ref = await reference(ctx);
  return ids.map((id) => ref.category(id)).filter((c): c is CategoryRecord => c !== null);
}
