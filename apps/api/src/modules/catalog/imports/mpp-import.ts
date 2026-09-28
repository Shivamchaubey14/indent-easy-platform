import type { ImportKindHandler, PlannedRow } from '../../imports/index.js';
import {
  INVALID,
  CYCLE_BAND_TEXT,
  codeOf,
  critical,
  cycleBandOf,
  mobileE164,
  nameKey,
  sameValues,
  statusOf,
} from './common.js';

interface MppState {
  code: string;
  name: string;
  bmcLocationId: string;
  sahayakName: string | null;
  sahayakMobile: string | null;
  cycleBand: string | null;
  village: string | null;
  status: string;
}

const COLUMNS = [
  {
    key: 'code',
    header: 'MPP Code',
    aliases: ['MPP Transaction Code', 'Transaction Code', 'mpp_code'],
    required: true,
  },
  { key: 'name', header: 'MPP Name', aliases: ['Name', 'mpp_name'], required: true },
  {
    key: 'bmc',
    header: 'BMC/MCC Code',
    aliases: ['BMC Code', 'MCC Code', 'BMC', 'MCC', 'BMC/MCC'],
    required: true,
  },
  { key: 'sahayakName', header: 'Sahayak Name', aliases: ['Sahayak'] },
  { key: 'sahayakMobile', header: 'Sahayak Mobile', aliases: ['Mobile', 'Sahayak Mobile Number'] },
  { key: 'cycleBand', header: 'Cycle Band', aliases: ['Cycle'] },
  { key: 'village', header: 'Village', aliases: ['Location'] },
  { key: 'status', header: 'Status' },
] as const;

const CODE = /^[A-Z0-9][A-Z0-9_-]{0,19}$/;

/**
 * MPP master import (MST-008/009): upsert by MPP code. With `deactivateMissing`, active MPPs of
 * the BMCs/MCCs named in the file that the file no longer lists are deactivated (only those BMCs,
 * so a file for one centre never touches another). Nothing is ever deleted — the legacy
 * replace-all is the defect this replaces.
 */
export const mppImport: ImportKindHandler = {
  kind: 'MPP_MASTER',
  permission: 'mpp:import',
  title: 'MPPs',
  columns: COLUMNS,

  async plan(client, rows, context) {
    const scope = (locationId: string) => context.grants.canAccess('mpp:import', { locationId });
    const { rows: centres } = await client.query<{
      id: string;
      code: string;
      name: string;
      active: boolean;
    }>(
      `SELECT id, code, name, status = 'ACTIVE' AS active FROM org.location WHERE type IN ('BMC', 'MCC')`,
    );
    const centreByCode = new Map(centres.map((c) => [c.code.toUpperCase(), c]));
    const centreByName = new Map(centres.map((c) => [nameKey(c.name), c]));
    const { rows: existing } = await client.query<MppState & { id: string }>(
      `SELECT id, code, name, bmc_location_id AS "bmcLocationId", sahayak_name AS "sahayakName",
              sahayak_mobile_e164 AS "sahayakMobile", cycle_band AS "cycleBand", village, status
       FROM catalog.mpp`,
    );
    const byCode = new Map(existing.map((m) => [m.code, m]));

    const plan: PlannedRow[] = [];
    const seen = new Map<string, number>();
    const centresInFile = new Set<string>();

    for (const row of rows) {
      const v = row.values;
      const issues = [];
      const code = codeOf(v['code'] ?? null);
      if (!code) issues.push(critical('REQUIRED', 'MPP code is required.', 'MPP Code'));
      else if (!CODE.test(code)) {
        issues.push(
          critical(
            'CODE_FORMAT',
            'Use capital letters, digits, - or _ (at most 20).',
            'MPP Code',
            v['code'],
          ),
        );
      } else if (seen.has(code)) {
        issues.push(
          critical(
            'DUPLICATE_IN_FILE',
            `MPP code also on row ${seen.get(code)}.`,
            'MPP Code',
            code,
          ),
        );
      }
      if (code) seen.set(code, seen.get(code) ?? row.rowIndex);
      const name = v['name'];
      if (!name) issues.push(critical('REQUIRED', 'MPP name is required.', 'MPP Name'));
      else if (name.length > 120)
        issues.push(critical('TOO_LONG', 'At most 120 characters.', 'MPP Name', name));

      const centreText = v['bmc'];
      const centre = centreText
        ? (centreByCode.get(centreText.toUpperCase()) ?? centreByName.get(nameKey(centreText)))
        : undefined;
      if (!centreText) issues.push(critical('REQUIRED', 'BMC/MCC is required.', 'BMC/MCC Code'));
      else if (!centre) {
        issues.push(
          critical(
            'UNKNOWN_BMC',
            'No BMC or MCC with this code.',
            'BMC/MCC Code',
            centreText,
            'Use the location code shown in Administration › Locations.',
          ),
        );
      } else if (!scope(centre.id)) {
        issues.push(
          critical(
            'OUT_OF_SCOPE',
            'This BMC/MCC is outside the locations you may import for.',
            'BMC/MCC Code',
            centreText,
          ),
        );
      } else if (!centre.active) {
        issues.push(
          critical('INACTIVE_BMC', 'This BMC/MCC is inactive.', 'BMC/MCC Code', centreText),
        );
      }

      const mobile = mobileE164(v['sahayakMobile'] ?? null);
      if (mobile === INVALID) {
        issues.push(
          critical(
            'MOBILE_FORMAT',
            'Not a mobile number.',
            'Sahayak Mobile',
            v['sahayakMobile'],
            '10 digits, or with country code, e.g. +919876543210.',
          ),
        );
      }
      const band = cycleBandOf(v['cycleBand'] ?? null);
      if (band === INVALID) {
        issues.push(
          critical(
            'CYCLE_BAND',
            'Unknown cycle band.',
            'Cycle Band',
            v['cycleBand'],
            'One of 1-10, 11-20, 21-31.',
          ),
        );
      }
      const current = code ? byCode.get(code) : undefined;
      const status = statusOf(v['status'] ?? null, current?.status ?? 'ACTIVE');
      if (status === INVALID) {
        issues.push(
          critical('STATUS', 'Status must be Active or Inactive.', 'Status', v['status']),
        );
      }
      if (current && !scope(current.bmcLocationId)) {
        issues.push(
          critical(
            'OUT_OF_SCOPE',
            'This MPP belongs to a BMC/MCC outside your locations.',
            'MPP Code',
            code,
          ),
        );
      }
      for (const [key, max, header] of [
        ['sahayakName', 120, 'Sahayak Name'],
        ['village', 120, 'Village'],
      ] as const) {
        if ((v[key]?.length ?? 0) > max)
          issues.push(critical('TOO_LONG', `At most ${max} characters.`, header, v[key]));
      }

      if (issues.some((i) => i.critical) || !code || !name || !centre) {
        plan.push({
          rowIndex: row.rowIndex,
          action: 'REJECT',
          entityType: 'Mpp',
          entityId: current?.id ?? null,
          issues,
          change: null,
        });
        continue;
      }
      centresInFile.add(centre.id);
      const next: MppState = {
        code,
        name,
        bmcLocationId: centre.id,
        sahayakName: v['sahayakName'] ?? null,
        sahayakMobile: mobile === INVALID ? null : mobile,
        cycleBand: band === INVALID ? null : band,
        village: v['village'] ?? null,
        status: status === INVALID ? 'ACTIVE' : status,
      };
      if (!current) {
        plan.push({
          rowIndex: row.rowIndex,
          action: 'CREATE',
          entityType: 'Mpp',
          entityId: null,
          issues,
          change: { after: next },
        });
      } else {
        const { id, ...before } = current;
        plan.push({
          rowIndex: row.rowIndex,
          action: sameValues(before, next) ? 'SKIP' : 'UPDATE',
          entityType: 'Mpp',
          entityId: id,
          issues,
          change: { before, after: next },
        });
      }
    }

    if (context.options['deactivateMissing'] === true) {
      const listed = new Set(seen.keys());
      const centreCode = new Map(centres.map((c) => [c.id, c.code]));
      for (const mpp of existing) {
        if (mpp.status !== 'ACTIVE' || listed.has(mpp.code)) continue;
        if (!centresInFile.has(mpp.bmcLocationId) || !scope(mpp.bmcLocationId)) continue;
        const { id, ...before } = mpp;
        plan.push({
          rowIndex: 0,
          action: 'DEACTIVATE',
          entityType: 'Mpp',
          entityId: id,
          issues: [],
          change: {
            before,
            after: { ...before, status: 'INACTIVE' },
            values: {
              code: mpp.code,
              name: mpp.name,
              bmc: centreCode.get(mpp.bmcLocationId) ?? null,
              status: 'INACTIVE',
            },
          },
        });
      }
    }
    return plan;
  },

  async apply(client, row, context) {
    const after = row.change?.['after'] as MppState;
    const values = [
      after.code,
      after.name,
      after.bmcLocationId,
      after.sahayakName,
      after.sahayakMobile,
      after.cycleBand,
      after.village,
      after.status,
    ];
    if (row.action === 'CREATE') {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO catalog.mpp (organization_id, code, name, bmc_location_id, sahayak_name,
           sahayak_mobile_e164, cycle_band, village, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [context.organizationId, ...values],
      );
      return rows[0]!.id;
    }
    if (row.action === 'DEACTIVATE') {
      await client.query(
        `UPDATE catalog.mpp SET status = 'INACTIVE', updated_at = now(), version = version + 1
         WHERE id = $1 AND status = 'ACTIVE'`,
        [row.entityId],
      );
      return row.entityId;
    }
    await client.query(
      `UPDATE catalog.mpp SET code = $2, name = $3, bmc_location_id = $4, sahayak_name = $5,
         sahayak_mobile_e164 = $6, cycle_band = $7, village = $8, status = $9,
         updated_at = now(), version = version + 1
       WHERE id = $1`,
      [row.entityId, ...values],
    );
    return row.entityId;
  },

  async exportRows(client, context) {
    const { rows } = await client.query<{
      code: string;
      name: string;
      bmcId: string;
      bmc: string;
      sahayakName: string | null;
      sahayakMobile: string | null;
      cycleBand: string | null;
      village: string | null;
      status: string;
    }>(
      `SELECT m.code, m.name, l.id AS "bmcId", l.code AS bmc, m.sahayak_name AS "sahayakName",
              m.sahayak_mobile_e164 AS "sahayakMobile", m.cycle_band AS "cycleBand", m.village, m.status
       FROM catalog.mpp m JOIN org.location l ON l.id = m.bmc_location_id
       ORDER BY l.code, m.code`,
    );
    return rows
      .filter((r) => context.grants.canAccess('mpp:import', { locationId: r.bmcId }))
      .map(({ bmcId: _bmcId, cycleBand, status, ...r }) => ({
        ...r,
        cycleBand: cycleBand ? CYCLE_BAND_TEXT[cycleBand] : null,
        status: status === 'ACTIVE' ? 'Active' : 'Inactive',
      }));
  },
};
