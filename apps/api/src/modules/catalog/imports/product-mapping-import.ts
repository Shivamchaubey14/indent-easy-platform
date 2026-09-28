import type { ImportIssue, ImportKindHandler, PlannedRow } from '../../imports/index.js';
import { codeOf, critical, nameKey, warning } from './common.js';

/*
 * Product mapping import (MST-003/004): SAP and NDDB codes and names per product, with the legacy
 * reconciliation engine's checks (`reconciliation_engine.py`):
 *  - critical: product not found, a code or name already mapped to another product
 *    (CONFLICTING_MAPPINGS), the same code twice in the file, a primary system without data
 *  - warnings with suggestions: code format per system (PRODUCT_CODE_FORMAT), name format,
 *    a code inside the name (NO_CODE_IN_NAME), name words inside the code (NO_NAME_IN_CODE),
 *    an unknown UOM (VALID_UOM)
 * Legacy "groups" are products here; the group name is kept on the codes (legacy_group_name).
 * Unlike the legacy engine, names are not title-cased: that changed acronyms such as "NDDB".
 */

const SYSTEMS = ['SAP', 'NDDB'] as const;
type System = (typeof SYSTEMS)[number];

/** Legacy PRODUCT_CODE_PATTERNS and their suggestions. */
const CODE_FORMAT: Record<System, { pattern: RegExp; suggestion: string }> = {
  SAP: { pattern: /^\d{7,10}$/, suggestion: 'Format: 3600006 (7-10 digits)' },
  NDDB: {
    pattern: /^[A-Z]{2,3}\d{3,6}$/,
    suggestion: 'Format: ND12345 (2-3 letters followed by 3-6 digits)',
  },
};
/** Legacy PRODUCT_NAME_PATTERNS. */
const NAME_FORMAT: Record<System, RegExp> = {
  SAP: /^[A-Z][A-Za-z0-9\s\-/]+$/,
  NDDB: /^[A-Z][A-Za-z0-9\s-]+$/,
};

const COLUMNS = [
  { key: 'productCode', header: 'Product Code', aliases: ['INDENT_EASY_Product_Code', 'IE Code'] },
  { key: 'productName', header: 'Product Name', aliases: ['INDENT_EASY_Product_Name'] },
  { key: 'groupName', header: 'Group Name', aliases: ['Group'] },
  { key: 'sapCode', header: 'SAP Product Code', aliases: ['SAP_Product_Code', 'SAP Code'] },
  { key: 'sapName', header: 'SAP Product Name', aliases: ['SAP_Product_Name', 'SAP Name'] },
  { key: 'nddbCode', header: 'NDDB Product Code', aliases: ['NDDB_Product_Code', 'NDDB Code'] },
  { key: 'nddbName', header: 'NDDB Product Name', aliases: ['NDDB_Product_Name', 'NDDB Name'] },
  { key: 'uom', header: 'UOM', aliases: ['Unit'] },
  { key: 'primarySystem', header: 'Primary System', aliases: ['Is_Primary'] },
] as const;

interface Existing {
  id: string;
  productId: string;
  system: System;
  code: string | null;
  name: string;
  isPrimary: boolean;
  uom: string | null;
  group: string | null;
}

interface Desired {
  system: System;
  systemId: string;
  code: string | null;
  name: string;
}

/** Legacy `_validate_product_code`: prefixes such as "SAP-" are ignored before the check. */
const formatOk = (system: System, code: string) =>
  CODE_FORMAT[system].pattern.test(code.replace(/^(IE|SAP|NDDB)[_\-\s]*/i, ''));

/** Legacy `_is_code_in_name`: the code (without prefix, 3+ characters) appears in the name. */
function codeInName(name: string, code: string): boolean {
  const clean = code.toLowerCase().replace(/^(ie|sap|nddb)[_\-\s]*/, '');
  return clean.length >= 3 && name.toLowerCase().includes(clean);
}

/** Legacy `_is_name_in_code`: a word of the name (3+ characters) appears in the code. */
function nameInCode(name: string, code: string): boolean {
  const lower = code.toLowerCase();
  return name
    .toLowerCase()
    .split(' ')
    .some((word) => word.length >= 3 && lower.includes(word));
}

export const productMappingImport: ImportKindHandler = {
  kind: 'PRODUCT_MAPPING',
  permission: 'product:map_external',
  title: 'Product mapping',
  columns: COLUMNS,

  async plan(client, rows) {
    const { rows: systems } = await client.query<{ id: string; code: string }>(
      `SELECT id, code FROM catalog.external_system WHERE code = ANY($1)`,
      [SYSTEMS],
    );
    const systemId = new Map(systems.map((s) => [s.code, s.id]));
    const { rows: products } = await client.query<{ id: string; code: string; name: string }>(
      'SELECT id, code, name FROM catalog.product WHERE deleted_at IS NULL',
    );
    const productByCode = new Map(products.map((p) => [p.code.toUpperCase(), p]));
    const productsByName = new Map<string, typeof products>();
    for (const p of products) {
      const list = productsByName.get(nameKey(p.name)) ?? [];
      list.push(p);
      productsByName.set(nameKey(p.name), list);
    }
    const productCodeOf = new Map(products.map((p) => [p.id, p.code]));
    const { rows: existing } = await client.query<Existing>(
      `SELECT x.id, x.product_id AS "productId", s.code AS system, x.external_code AS code,
              x.external_name AS name, x.is_primary AS "isPrimary", x.uom_text AS uom,
              x.legacy_group_name AS "group"
       FROM catalog.product_external_code x
       JOIN catalog.external_system s ON s.id = x.external_system_id
       WHERE x.status = 'ACTIVE' AND s.code = ANY($1)`,
      [SYSTEMS],
    );
    const byCode = new Map(existing.filter((e) => e.code).map((e) => [`${e.system}|${e.code}`, e]));
    const byName = new Map<string, Existing[]>();
    for (const e of existing) {
      const key = `${e.system}|${nameKey(e.name)}`;
      byName.set(key, [...(byName.get(key) ?? []), e]);
    }
    const { rows: uoms } = await client.query<{ code: string; legacy: string[] | null }>(
      'SELECT code, legacy_codes AS legacy FROM catalog.uom',
    );
    const knownUoms = new Set(
      uoms.flatMap((u) => [u.code, ...(u.legacy ?? [])].map((c) => c.toUpperCase())),
    );
    const inFile = new Map<string, { rowIndex: number; productId: string }>();

    return rows.map((row): PlannedRow => {
      const v = row.values;
      const issues: ImportIssue[] = [];

      // Which product: by code, else by a unique exact name, else by the group name.
      const code = codeOf(v['productCode'] ?? null);
      let product = code ? productByCode.get(code) : undefined;
      const lookupName = v['productName'] ?? v['groupName'] ?? null;
      if (!product && !code && lookupName) {
        const matches = productsByName.get(nameKey(lookupName)) ?? [];
        if (matches.length === 1) product = matches[0];
        else if (matches.length > 1) {
          issues.push(
            critical(
              'AMBIGUOUS_PRODUCT',
              'Several products have this name.',
              'Product Name',
              lookupName,
              'Give the product code.',
            ),
          );
        }
      }
      if (!code && !lookupName) {
        issues.push(
          critical(
            'GROUP_NAME_REQUIRED',
            'Product code or name is required.',
            'Product Code',
            null,
            'Provide the product code.',
          ),
        );
      } else if (!product && !issues.length) {
        issues.push(
          critical(
            'PRODUCT_NOT_FOUND',
            'No such product.',
            code ? 'Product Code' : 'Product Name',
            code ?? lookupName,
            'Create the product first in Masters › Products.',
          ),
        );
      }

      const desired: Desired[] = [];
      for (const system of SYSTEMS) {
        const prefix = system === 'SAP' ? 'sap' : 'nddb';
        const header = (part: 'Code' | 'Name') => `${system} Product ${part}`;
        const name = v[`${prefix}Name`] ?? null;
        const systemCode = codeOf(v[`${prefix}Code`] ?? null);
        if (!name) {
          if (systemCode) {
            issues.push(
              warning(
                'PRODUCT_NAME_REQUIRED',
                `The ${system} code has no name, so ${system} was skipped.`,
                header('Name'),
                null,
                `Give the product's name in ${system}.`,
              ),
            );
          }
          continue; // legacy: a system without a name is skipped
        }
        if (!NAME_FORMAT[system].test(name)) {
          issues.push(
            warning(
              'PRODUCT_NAME_FORMAT',
              `Unusual product name format for ${system}.`,
              header('Name'),
              name,
              'Product names should start with capital letter and contain only alphanumeric characters, spaces, hyphens',
            ),
          );
        }
        if (systemCode) {
          if (!formatOk(system, systemCode)) {
            issues.push(
              warning(
                'PRODUCT_CODE_FORMAT',
                `Unusual product code format for ${system}.`,
                header('Code'),
                systemCode,
                CODE_FORMAT[system].suggestion,
              ),
            );
          }
          if (codeInName(name, systemCode)) {
            issues.push(
              warning(
                'NO_CODE_IN_NAME',
                `The ${system} name seems to contain the code.`,
                header('Name'),
                name,
                'Product name should not contain product codes. Use separate fields.',
              ),
            );
          }
          if (nameInCode(name, systemCode)) {
            issues.push(
              warning(
                'NO_NAME_IN_CODE',
                `The ${system} code seems to contain words of the name.`,
                header('Code'),
                systemCode,
                'Product code should be a numeric/alphanumeric identifier, not a name.',
              ),
            );
          }
        }
        // Conflicts with other products (legacy CONFLICTING_MAPPINGS) and with earlier rows.
        const other = systemCode
          ? byCode.get(`${system}|${systemCode}`)
          : (byName.get(`${system}|${nameKey(name)}`) ?? []).find(
              (e) => e.productId !== product?.id,
            );
        if (other && product && other.productId !== product.id) {
          issues.push(
            critical(
              'CONFLICTING_MAPPINGS',
              `${system} ${systemCode ? 'code' : 'name'} already belongs to product ${productCodeOf.get(other.productId)}.`,
              header(systemCode ? 'Code' : 'Name'),
              systemCode ?? name,
              `Use product ${productCodeOf.get(other.productId)} or correct the ${system} ${systemCode ? 'code' : 'name'}.`,
            ),
          );
        }
        const fileKey = `${system}|${systemCode ?? nameKey(name)}`;
        const earlier = inFile.get(fileKey);
        if (earlier && product && earlier.productId !== product.id) {
          issues.push(
            critical(
              'CONFLICTING_MAPPINGS',
              `Same ${system} ${systemCode ? 'code' : 'name'} as row ${earlier.rowIndex}, for another product.`,
              header(systemCode ? 'Code' : 'Name'),
              systemCode ?? name,
            ),
          );
        }
        if (product && !earlier)
          inFile.set(fileKey, { rowIndex: row.rowIndex, productId: product.id });
        const id = systemId.get(system);
        if (!id) {
          issues.push(
            critical(
              'VALID_SYSTEM',
              `The ${system} code system is not set up.`,
              header('Code'),
              null,
              'Add it in Masters › Code systems.',
            ),
          );
        } else {
          desired.push({ system, systemId: id, code: systemCode, name });
        }
      }

      const uom = v['uom'] ? v['uom'].toUpperCase() : null;
      if (uom && !knownUoms.has(uom)) {
        issues.push(
          warning(
            'VALID_UOM',
            `Unknown unit of measure: ${v['uom']}.`,
            'UOM',
            v['uom'],
            'Use a unit from Masters › Units.',
          ),
        );
      }
      const primary = v['primarySystem']?.toUpperCase() ?? null;
      if (primary) {
        if (!['INDENT_EASY', 'SAP', 'NDDB'].includes(primary)) {
          issues.push(
            warning(
              'PRIMARY_SYSTEM_VALIDATION',
              `Invalid primary system: ${v['primarySystem']}.`,
              'Primary System',
              v['primarySystem'],
              'Primary system must be one of: INDENT_EASY, SAP, NDDB',
            ),
          );
        } else if (primary !== 'INDENT_EASY' && !desired.some((d) => d.system === primary)) {
          issues.push(
            critical(
              'PRIMARY_SYSTEM_VALIDATION',
              `Primary system ${primary} has no product data.`,
              'Primary System',
              primary,
              'Provide product name for primary system or change primary system',
            ),
          );
        }
      }
      if (desired.length === 0 && !issues.some((i) => i.critical)) {
        issues.push(
          critical(
            'NO_MAPPINGS',
            'Give a SAP or NDDB name (and code) for the product.',
            'SAP Product Name',
          ),
        );
      }

      if (!product || issues.some((i) => i.critical)) {
        return {
          rowIndex: row.rowIndex,
          action: 'REJECT',
          entityType: 'Product',
          entityId: product?.id ?? null,
          issues,
          change: null,
        };
      }
      // Compare with the product's current primary code per system.
      const group = v['groupName'] ?? null;
      const changes = desired.filter((d) => {
        const current = existing.find(
          (e) => e.productId === product.id && e.system === d.system && e.isPrimary,
        );
        return (
          !current ||
          current.code !== d.code ||
          current.name !== d.name ||
          (uom !== null && current.uom !== uom) ||
          (group !== null && current.group !== group)
        );
      });
      const hadAny = existing.some((e) => e.productId === product.id);
      return {
        rowIndex: row.rowIndex,
        action: changes.length === 0 ? 'SKIP' : hadAny ? 'UPDATE' : 'CREATE',
        entityType: 'Product',
        entityId: product.id,
        issues,
        change: { productId: product.id, set: changes, uom, group },
      };
    });
  },

  async apply(client, row, context) {
    const change = row.change!;
    const productId = change['productId'] as string;
    for (const d of change['set'] as Desired[]) {
      // The code this row names becomes the product's primary for the system; an earlier primary
      // stays as an alternative (still found by search), so history is not lost.
      const { rows: same } = await client.query<{ id: string }>(
        `SELECT id FROM catalog.product_external_code
          WHERE product_id = $1 AND external_system_id = $2 AND status = 'ACTIVE'
            AND external_code IS NOT DISTINCT FROM $3
            AND ($3::text IS NOT NULL OR lower(external_name) = lower($4))`,
        [productId, d.systemId, d.code, d.name],
      );
      await client.query(
        `UPDATE catalog.product_external_code SET is_primary = false
          WHERE product_id = $1 AND external_system_id = $2 AND is_primary AND status = 'ACTIVE'
            AND id IS DISTINCT FROM $3`,
        [productId, d.systemId, same[0]?.id ?? null],
      );
      if (same[0]) {
        await client.query(
          `UPDATE catalog.product_external_code
              SET external_name = $2, is_primary = true, uom_text = coalesce($3, uom_text),
                  legacy_group_name = coalesce($4, legacy_group_name)
            WHERE id = $1`,
          [same[0].id, d.name, change['uom'], change['group']],
        );
      } else {
        await client.query(
          `INSERT INTO catalog.product_external_code (organization_id, product_id,
             external_system_id, external_code, external_name, uom_text, is_primary, legacy_group_name)
           VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
          [
            context.organizationId,
            productId,
            d.systemId,
            d.code,
            d.name,
            change['uom'],
            change['group'],
          ],
        );
      }
    }
    await client.query(
      'UPDATE catalog.product SET updated_at = now(), version = version + 1 WHERE id = $1',
      [productId],
    );
    return productId;
  },

  async exportRows(client) {
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT p.code AS "productCode", p.name AS "productName",
              coalesce(sap.legacy_group_name, nddb.legacy_group_name) AS "groupName",
              sap.external_code AS "sapCode", sap.external_name AS "sapName",
              nddb.external_code AS "nddbCode", nddb.external_name AS "nddbName",
              coalesce(sap.uom_text, nddb.uom_text, u.code) AS uom
       FROM catalog.product p
       JOIN catalog.uom u ON u.id = p.base_uom_id
       LEFT JOIN LATERAL (
         SELECT x.* FROM catalog.product_external_code x JOIN catalog.external_system s
           ON s.id = x.external_system_id AND s.code = 'SAP'
         WHERE x.product_id = p.id AND x.is_primary AND x.status = 'ACTIVE') sap ON true
       LEFT JOIN LATERAL (
         SELECT x.* FROM catalog.product_external_code x JOIN catalog.external_system s
           ON s.id = x.external_system_id AND s.code = 'NDDB'
         WHERE x.product_id = p.id AND x.is_primary AND x.status = 'ACTIVE') nddb ON true
       WHERE p.deleted_at IS NULL AND p.status = 'ACTIVE'
       ORDER BY p.code`,
    );
    return rows;
  },
};
