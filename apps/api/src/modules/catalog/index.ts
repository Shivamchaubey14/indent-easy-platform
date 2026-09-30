import type { Pool } from '../../shared/database.js';
import { CatalogService } from './application/catalog-service.js';
import { mppImport } from './imports/mpp-import.js';
import { productMappingImport } from './imports/product-mapping-import.js';
import { vendorProductImport } from './imports/vendor-product-import.js';
import { PostgresCatalog } from './infrastructure/postgres-catalog.js';
import type { CatalogQueries } from './interface/graphql.js';

export { catalogResolvers, categoriesById, type CatalogQueries } from './interface/graphql.js';
export { displayName } from './domain/display-name.js';
export { cycleBandOf, INVALID, mobileE164 } from './imports/common.js';

/** The catalogue's spreadsheet imports (MST-004, MST-007, MST-009). */
export const CATALOG_IMPORTS = [productMappingImport, vendorProductImport, mppImport];

/** Wires the catalogue module: products, units, categories, vendors and MPPs (SRS §11.3). */
export function createCatalog(pool: Pool): CatalogQueries {
  const store = new PostgresCatalog(pool);
  return { store, service: new CatalogService(store) };
}
