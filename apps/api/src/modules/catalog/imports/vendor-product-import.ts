import type { ImportKindHandler, PlannedRow } from '../../imports/index.js';
import { codeOf, critical, INVALID, nameKey, parseFlag, parseWhole, sameValues } from './common.js';

interface Mapping {
  priority: number;
  isPrimary: boolean;
  leadTimeDays: number | null;
}

const COLUMNS = [
  { key: 'vendorCode', header: 'Vendor Code', aliases: ['Vendor Id'] },
  { key: 'vendorName', header: 'Vendor Name', aliases: ['Vendor', 'Supplier'] },
  {
    key: 'productCode',
    header: 'Product Code',
    aliases: ['Item Code', 'Material Code'],
    required: true,
  },
  { key: 'productName', header: 'Product Name', aliases: ['Product', 'Item'] },
  { key: 'priority', header: 'Priority' },
  { key: 'isPrimary', header: 'Primary', aliases: ['Is Primary', 'Primary Vendor'] },
  { key: 'leadTimeDays', header: 'Lead Time Days', aliases: ['Lead Time'] },
] as const;

/**
 * Vendor–product mapping import (MST-007): adds or updates (vendor, product) pairs with priority,
 * primary flag and lead time. Pairs missing from the file are left alone. The vendor is found by
 * code, or by exact name when the code is blank; the product by its code.
 */
export const vendorProductImport: ImportKindHandler = {
  kind: 'VENDOR_PRODUCT',
  permission: 'vendor:map_products',
  title: 'Vendor products',
  columns: COLUMNS,

  async plan(client, rows) {
    const { rows: vendors } = await client.query<{ id: string; code: string; name: string }>(
      'SELECT id, code, name FROM catalog.vendor',
    );
    const vendorByCode = new Map(vendors.map((v) => [v.code.toUpperCase(), v]));
    const vendorByName = new Map(vendors.map((v) => [nameKey(v.name), v]));
    const { rows: products } = await client.query<{ id: string; code: string; status: string }>(
      'SELECT id, code, status FROM catalog.product WHERE deleted_at IS NULL',
    );
    const productByCode = new Map(products.map((p) => [p.code.toUpperCase(), p]));
    const { rows: existing } = await client.query<
      Mapping & { vendorId: string; productId: string }
    >(
      `SELECT vendor_id AS "vendorId", product_id AS "productId", priority,
              is_primary AS "isPrimary", lead_time_days AS "leadTimeDays"
       FROM catalog.vendor_product`,
    );
    const pairs = new Map(existing.map((e) => [`${e.vendorId}|${e.productId}`, e]));
    const seen = new Map<string, number>();

    return rows.map((row): PlannedRow => {
      const v = row.values;
      const issues = [];
      const vendorText = v['vendorCode'] ?? v['vendorName'] ?? null;
      const vendor = v['vendorCode']
        ? vendorByCode.get(v['vendorCode'].toUpperCase())
        : v['vendorName']
          ? vendorByName.get(nameKey(v['vendorName']))
          : undefined;
      if (!vendorText) {
        issues.push(critical('REQUIRED', 'Give the vendor code or name.', 'Vendor Code'));
      } else if (!vendor) {
        issues.push(
          critical(
            'UNKNOWN_VENDOR',
            'No vendor with this code or name.',
            v['vendorCode'] ? 'Vendor Code' : 'Vendor Name',
            vendorText,
            'Use the code shown in Masters › Vendors.',
          ),
        );
      }
      const productCode = codeOf(v['productCode'] ?? null);
      const product = productCode ? productByCode.get(productCode) : undefined;
      if (!productCode)
        issues.push(critical('REQUIRED', 'Product code is required.', 'Product Code'));
      else if (!product) {
        issues.push(
          critical(
            'UNKNOWN_PRODUCT',
            'No product with this code.',
            'Product Code',
            productCode,
            'Use the code shown in Masters › Products.',
          ),
        );
      } else if (product.status !== 'ACTIVE') {
        issues.push(
          critical('INACTIVE_PRODUCT', 'This product is inactive.', 'Product Code', productCode),
        );
      }
      const priority = parseWhole(v['priority'] ?? null, 1, 99);
      if (priority === INVALID)
        issues.push(
          critical(
            'OUT_OF_RANGE',
            'Priority is a whole number from 1 to 99.',
            'Priority',
            v['priority'],
          ),
        );
      const isPrimary = parseFlag(v['isPrimary'] ?? null, false);
      if (isPrimary === INVALID)
        issues.push(critical('FLAG', 'Primary must be Yes or No.', 'Primary', v['isPrimary']));
      const leadTime = parseWhole(v['leadTimeDays'] ?? null, 0, 365);
      if (leadTime === INVALID)
        issues.push(
          critical(
            'OUT_OF_RANGE',
            'Lead time is 0 to 365 days.',
            'Lead Time Days',
            v['leadTimeDays'],
          ),
        );

      const key = vendor && product ? `${vendor.id}|${product.id}` : null;
      if (key && seen.has(key)) {
        issues.push(
          critical(
            'DUPLICATE_IN_FILE',
            `The same vendor and product are on row ${seen.get(key)}.`,
            'Product Code',
            productCode,
          ),
        );
      }
      if (key && !seen.has(key)) seen.set(key, row.rowIndex);

      if (issues.length > 0 || !vendor || !product || !key) {
        return {
          rowIndex: row.rowIndex,
          action: 'REJECT',
          entityType: 'VendorProduct',
          entityId: vendor?.id ?? null,
          issues,
          change: null,
        };
      }
      const next: Mapping = {
        priority: priority === INVALID ? 1 : (priority ?? 1),
        isPrimary: isPrimary === true,
        leadTimeDays: leadTime === INVALID ? null : leadTime,
      };
      const current = pairs.get(key);
      const before = current
        ? {
            priority: current.priority,
            isPrimary: current.isPrimary,
            leadTimeDays: current.leadTimeDays,
          }
        : null;
      return {
        rowIndex: row.rowIndex,
        action: !before ? 'CREATE' : sameValues(before, next) ? 'SKIP' : 'UPDATE',
        entityType: 'VendorProduct',
        entityId: vendor.id,
        issues,
        change: { vendorId: vendor.id, productId: product.id, before, after: next },
      };
    });
  },

  async apply(client, row, context) {
    const change = row.change!;
    const after = change['after'] as Mapping;
    // last_price is learnt from purchase orders, so an existing row keeps it.
    await client.query(
      `INSERT INTO catalog.vendor_product
         (organization_id, vendor_id, product_id, priority, is_primary, lead_time_days)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (vendor_id, product_id) DO UPDATE
       SET priority = EXCLUDED.priority, is_primary = EXCLUDED.is_primary,
           lead_time_days = EXCLUDED.lead_time_days`,
      [
        context.organizationId,
        change['vendorId'],
        change['productId'],
        after.priority,
        after.isPrimary,
        after.leadTimeDays,
      ],
    );
    return change['vendorId'] as string;
  },

  async exportRows(client) {
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT v.code AS "vendorCode", v.name AS "vendorName", p.code AS "productCode",
              p.name AS "productName", vp.priority,
              CASE WHEN vp.is_primary THEN 'Yes' ELSE 'No' END AS "isPrimary",
              vp.lead_time_days AS "leadTimeDays"
       FROM catalog.vendor_product vp
       JOIN catalog.vendor v ON v.id = vp.vendor_id
       JOIN catalog.product p ON p.id = vp.product_id
       ORDER BY v.code, vp.priority, p.code`,
    );
    return rows;
  },
};
