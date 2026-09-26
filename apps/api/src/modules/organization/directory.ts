import type { Department, Designation, Location, Warehouse } from '@ie/graphql';
import { type Pool, withOrgContext } from '../../shared/database.js';

/** A location as resolvers see it; its warehouses are resolved from the directory. */
export type LocationRecord = Omit<Location, 'warehouses'>;
export type WarehouseRecord = Omit<Warehouse, 'location'> & { locationId: string | null };

/**
 * The organisation's structure: locations, warehouses, departments and designations. These are
 * small tables (hundreds of rows at most, §5.9), so one request loads them once and every
 * resolver looks things up by id instead of querying per field.
 */
export interface Directory {
  locations: readonly LocationRecord[];
  warehouses: readonly WarehouseRecord[];
  departments: readonly Department[];
  designations: readonly Designation[];
  location(id: string | null | undefined): LocationRecord | null;
  department(id: string | null | undefined): Department | null;
  designation(id: string | null | undefined): Designation | null;
  warehousesOf(locationId: string): WarehouseRecord[];
}

const byId = <T extends { id: string }>(items: readonly T[]) => {
  const map = new Map(items.map((item) => [item.id, item]));
  return (id: string | null | undefined) => (id ? (map.get(id) ?? null) : null);
};

export async function loadDirectory(pool: Pool, organizationId: string): Promise<Directory> {
  const [locations, warehouses, departments, designations] = await withOrgContext(
    pool,
    organizationId,
    (client) =>
      Promise.all([
        client.query<LocationRecord>(
          `SELECT id, code, name, name_hi AS "nameHi", type, sap_plant_code AS "sapPlantCode",
                  address, excluded_from_cross_view AS "excludedFromCrossView",
                  status = 'ACTIVE' AS active
           FROM org.location ORDER BY name`,
        ),
        client.query<WarehouseRecord>(
          `SELECT id, code, name, type, location_id AS "locationId"
           FROM org.warehouse WHERE status = 'ACTIVE' ORDER BY code`,
        ),
        client.query<Department>('SELECT id, code, name FROM org.department ORDER BY name'),
        client.query<Designation>('SELECT id, code, name FROM org.designation ORDER BY name'),
      ]),
  );
  return {
    locations: locations.rows,
    warehouses: warehouses.rows,
    departments: departments.rows,
    designations: designations.rows,
    location: byId(locations.rows),
    department: byId(departments.rows),
    designation: byId(designations.rows),
    warehousesOf: (locationId) => warehouses.rows.filter((w) => w.locationId === locationId),
  };
}
