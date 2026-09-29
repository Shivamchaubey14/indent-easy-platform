import type { FeatureFlag, UserError } from '@ie/graphql';
import {
  setFeatureFlagInputSchema,
  toUserErrors,
  updateNumberSeriesInputSchema,
} from '@ie/validation';
import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../../graphql/context.js';
import { SETTINGS, type SettingDefinition, settingDefinition } from '../domain/settings.js';
import {
  type SeriesRecord,
  SeriesNotFound,
  type StoredSetting,
} from '../infrastructure/postgres-configuration.js';

const org = (ctx: GraphQLContext) => ctx.viewer().organizationId;
const store = (ctx: GraphQLContext) => ctx.services.configuration;

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function toSetting(definition: SettingDefinition, stored: StoredSetting | undefined) {
  return {
    key: definition.key,
    value: stored ? stored.value : definition.defaultValue,
    scope: 'ORGANIZATION',
    description: definition.description,
    updatedAt: stored?.updatedAt ?? null,
    updatedBy: stored?.updatedBy ?? null,
    defaultValue: definition.defaultValue,
    isDefault: !stored,
    source: definition.source,
    input: definition.input,
  };
}

const fieldError = (
  field: string,
  message: string,
  code: UserError['code'] = 'VALIDATION_FAILED',
): UserError => ({
  code,
  message,
  field: ['input', field],
  details: null,
});

/** Settings, number series and feature flags (SRS §11.19 ADM-001/003, MST-010, §55.3). */
export const configurationResolvers = {
  Query: {
    featureFlags: async (
      _parent: unknown,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<FeatureFlag[]> => {
      const organizationId = await ctx.organizationId();
      return organizationId ? ctx.services.featureFlags.list(organizationId) : [];
    },
    settings: async (_p: unknown, args: { keys?: string[] | null }, ctx: GraphQLContext) => {
      const stored = new Map((await store(ctx).settings(org(ctx))).map((s) => [s.key, s]));
      return SETTINGS.filter((d) => !args.keys?.length || args.keys.includes(d.key)).map((d) =>
        toSetting(d, stored.get(d.key)),
      );
    },
    numberSeries: async (_p: unknown, _a: unknown, ctx: GraphQLContext) =>
      store(ctx).series(org(ctx)),
  },
  Mutation: {
    updateSetting: async (
      _p: unknown,
      args: { input: { key: string; value: unknown; scope?: string | null } },
      ctx: GraphQLContext,
    ) => {
      const definition = settingDefinition(args.input.key);
      if (!definition) {
        return {
          setting: null,
          userErrors: [fieldError('key', 'validation.notFound', 'NOT_FOUND')],
        };
      }
      if ((args.input.scope ?? 'ORGANIZATION') !== 'ORGANIZATION') {
        return { setting: null, userErrors: [fieldError('scope', 'validation.notSupported')] };
      }
      const parsed = definition.schema.safeParse(args.input.value);
      if (!parsed.success) {
        return {
          setting: null,
          userErrors: toUserErrors(parsed.error, 'input').map((e) => ({
            ...e,
            field: ['input', 'value'],
          })),
        };
      }
      // Back at the default: no stored row, so a later change of the default applies again.
      const value = sameJson(parsed.data, definition.defaultValue) ? null : parsed.data;
      await store(ctx).setSetting(org(ctx), definition.key, value, definition.defaultValue);
      const stored = (await store(ctx).settings(org(ctx))).find((s) => s.key === definition.key);
      return { setting: toSetting(definition, stored), userErrors: [] };
    },
    updateNumberSeries: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) => {
      const parsed = updateNumberSeriesInputSchema.safeParse(args.input);
      if (!parsed.success) return { series: null, userErrors: toUserErrors(parsed.error, 'input') };
      const { id, ...change } = parsed.data;
      try {
        const result = await store(ctx).updateSeries(
          org(ctx),
          id,
          Object.fromEntries(Object.entries(change).filter(([, v]) => v !== undefined)),
        );
        return result.ok
          ? { series: result.series, userErrors: [] }
          : { series: null, userErrors: [fieldError(result.field, result.message)] };
      } catch (err) {
        if (err instanceof SeriesNotFound) {
          return {
            series: null,
            userErrors: [fieldError('id', 'validation.notFound', 'NOT_FOUND')],
          };
        }
        throw err;
      }
    },
    setFeatureFlag: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) => {
      const parsed = setFeatureFlagInputSchema.safeParse(args.input);
      if (!parsed.success) {
        throw new GraphQLError('The flag or its rules are not valid.', {
          extensions: { code: 'VALIDATION_FAILED', issues: toUserErrors(parsed.error, 'input') },
        });
      }
      const { key, enabled, rules } = parsed.data;
      const saved = await store(ctx).setFlag(org(ctx), key, enabled, rules ?? null);
      if (!saved) {
        throw new GraphQLError('No such feature flag.', { extensions: { code: 'NOT_FOUND' } });
      }
      return saved;
    },
  },
  NumberSeries: {
    location: async (series: SeriesRecord, _a: unknown, ctx: GraphQLContext) =>
      series.locationId ? (await ctx.directory()).location(series.locationId) : null,
    preview: (series: SeriesRecord) =>
      `${series.prefix}${String(series.nextValue).padStart(series.padding, '0')}`,
  },
};
