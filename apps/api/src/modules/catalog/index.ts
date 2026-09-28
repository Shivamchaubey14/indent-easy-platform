import type { Pool } from '../../shared/database.js';
import { CatalogService } from './application/catalog-service.js';
import { PostgresCatalog } from './infrastructure/postgres-catalog.js';
import type { CatalogQueries } from './interface/graphql.js';

export { catalogResolvers, categoriesById, type CatalogQueries } from './interface/graphql.js';
export { displayName } from './domain/display-name.js';

/** Wires the catalogue module: products, units, categories, vendors and MPPs (SRS §11.3). */
export function createCatalog(pool: Pool): CatalogQueries {
  const store = new PostgresCatalog(pool);
  return { store, service: new CatalogService(store) };
}
