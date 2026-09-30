import { recordAudit } from '../../../shared/audit.js';
import { currentContext } from '../../../shared/context.js';
import { type Pool, withOrgContext } from '../../../shared/database.js';

export interface StoredSetting {
  key: string;
  value: unknown;
  updatedAt: string;
  updatedBy: { id: string; displayName: string; employeeCode: string | null } | null;
}

export interface SeriesRecord {
  id: string;
  docType: string;
  locationId: string | null;
  fiscalYear: string | null;
  prefix: string;
  padding: number;
  nextValue: number;
  resetPolicy: string;
}

export interface FlagRecord {
  key: string;
  enabled: boolean;
  rules: unknown;
  description: string | null;
}

export class SeriesNotFound extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERIES_SELECT = `id, doc_type AS "docType", location_id AS "locationId", fiscal_year AS "fiscalYear",
  prefix, padding, next_value::float8 AS "nextValue", reset_policy AS "resetPolicy"`;
const actorId = () => currentContext()?.principal?.userId ?? null;

/** Settings, number series and feature flags of one organisation; every change is audited. */
export class PostgresConfiguration {
  constructor(private readonly pool: Pool) {}

  // ---- Settings (organisation scope; location overrides come with the first setting needing them)

  settings(organizationId: string): Promise<StoredSetting[]> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<StoredSetting>(
        `SELECT s.key, s.value, s.updated_at AS "updatedAt",
                CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object(
                  'id', u.id, 'displayName', u.display_name, 'employeeCode', u.employee_code) END
                  AS "updatedBy"
         FROM config.setting s LEFT JOIN identity.app_user u ON u.id = s.updated_by
         WHERE s.scope_type = 'ORGANIZATION'`,
      );
      return rows;
    });
  }

  /** Stores a value; `null` (back to the default) removes the row. */
  setSetting(
    organizationId: string,
    key: string,
    value: unknown,
    defaultValue: unknown,
  ): Promise<void> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<{ value: unknown }>(
        `SELECT value FROM config.setting WHERE key = $1 AND scope_type = 'ORGANIZATION' FOR UPDATE`,
        [key],
      );
      const before = rows[0] ? rows[0].value : defaultValue;
      if (value === null) {
        await client.query(
          `DELETE FROM config.setting WHERE key = $1 AND scope_type = 'ORGANIZATION'`,
          [key],
        );
      } else {
        await client.query(
          `INSERT INTO config.setting (organization_id, key, value, updated_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (organization_id, key, scope_type, scope_id)
           DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [organizationId, key, JSON.stringify(value), actorId()],
        );
      }
      await recordAudit(client, {
        organizationId,
        action: 'SETTING_CHANGED',
        entityType: 'Setting',
        entityId: organizationId,
        entityNumber: key,
        before: { key, value: before },
        after: { key, value: value ?? defaultValue },
      });
    });
  }

  // ---- Number series (MST-010) -------------------------------------------------------------

  series(organizationId: string): Promise<SeriesRecord[]> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<SeriesRecord>(
        `SELECT ${SERIES_SELECT} FROM config.number_series ORDER BY doc_type, fiscal_year NULLS FIRST`,
      );
      return rows;
    });
  }

  /**
   * Changes a series. `nextValue` may only move forward, so a number is never issued twice; the
   * row lock serialises this with config.next_document_number.
   */
  updateSeries(
    organizationId: string,
    id: string,
    change: Partial<Pick<SeriesRecord, 'prefix' | 'padding' | 'nextValue' | 'resetPolicy'>>,
  ): Promise<{ ok: true; series: SeriesRecord } | { ok: false; field: string; message: string }> {
    if (!UUID.test(id)) return Promise.reject(new SeriesNotFound());
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<SeriesRecord>(
        `SELECT ${SERIES_SELECT} FROM config.number_series WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const before = rows[0];
      if (!before) throw new SeriesNotFound();
      if (change.nextValue !== undefined && change.nextValue < before.nextValue) {
        return { ok: false, field: 'nextValue', message: 'validation.seriesBackwards' };
      }
      const after = { ...before, ...change };
      const { rows: saved } = await client.query<SeriesRecord>(
        `UPDATE config.number_series
            SET prefix = $2, padding = $3, next_value = $4, reset_policy = $5, updated_at = now()
          WHERE id = $1 RETURNING ${SERIES_SELECT}`,
        [id, after.prefix, after.padding, after.nextValue, after.resetPolicy],
      );
      await recordAudit(client, {
        organizationId,
        action: 'NUMBER_SERIES_CHANGED',
        entityType: 'NumberSeries',
        entityId: id,
        entityNumber: before.docType,
        before,
        after: saved[0],
      });
      return { ok: true, series: saved[0]! };
    });
  }

  // ---- Feature flags (§55.3) ---------------------------------------------------------------

  flags(organizationId: string): Promise<FlagRecord[]> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<FlagRecord>(
        'SELECT key, enabled, rules, description FROM config.feature_flag ORDER BY key',
      );
      return rows;
    });
  }

  /** Switches a known flag; unknown keys are refused (flags are created by migrations). */
  setFlag(
    organizationId: string,
    key: string,
    enabled: boolean,
    rules: unknown,
  ): Promise<FlagRecord | null> {
    return withOrgContext(this.pool, organizationId, async (client) => {
      const { rows } = await client.query<FlagRecord>(
        'SELECT key, enabled, rules, description FROM config.feature_flag WHERE key = $1 FOR UPDATE',
        [key],
      );
      const before = rows[0];
      if (!before) return null;
      const { rows: saved } = await client.query<FlagRecord>(
        `UPDATE config.feature_flag SET enabled = $2, rules = $3, updated_by = $4, updated_at = now()
         WHERE key = $1 RETURNING key, enabled, rules, description`,
        [
          key,
          enabled,
          rules === null || rules === undefined ? null : JSON.stringify(rules),
          actorId(),
        ],
      );
      await recordAudit(client, {
        organizationId,
        action: 'FEATURE_FLAG_CHANGED',
        entityType: 'FeatureFlag',
        entityId: organizationId,
        entityNumber: key,
        before: { enabled: before.enabled, rules: before.rules },
        after: { enabled, rules: rules ?? null },
      });
      return saved[0] ?? null;
    });
  }
}
