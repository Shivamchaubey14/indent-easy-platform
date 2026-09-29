import { z } from 'zod';

/*
 * Administration of number series, feature flags and settings (SRS §11.19, MST-010, §55.3).
 * Shared by the API and the admin console. Messages are i18n keys.
 */

export const RESET_POLICIES = ['NEVER', 'FISCAL_YEAR', 'CALENDAR_YEAR'] as const;

export const updateNumberSeriesInputSchema = z.object({
  id: z.string().min(1, 'validation.required'),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'validation.required')
    .max(20, 'validation.tooLong')
    .regex(/^[A-Z0-9][A-Z0-9/_-]*$/, 'validation.seriesPrefix')
    .optional(),
  padding: z
    .number()
    .int('validation.outOfRange')
    .min(1, 'validation.outOfRange')
    .max(12, 'validation.outOfRange')
    .optional(),
  /** May only move forward (checked against the current value by the API). */
  nextValue: z
    .number()
    .int('validation.outOfRange')
    .min(1, 'validation.outOfRange')
    .max(999_999_999_999, 'validation.outOfRange')
    .optional(),
  resetPolicy: z.enum(RESET_POLICIES).optional(),
});

/** Targeting rules of a flag (§55.3). All present conditions must hold; none = everyone. */
export const featureFlagRulesSchema = z
  .object({
    environments: z
      .array(z.enum(['local', 'dev', 'qa', 'staging', 'prod']))
      .max(5)
      .optional(),
    roleCodes: z
      .array(z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/, 'validation.code'))
      .max(50)
      .optional(),
    locationIds: z.array(z.string().min(1)).max(500).optional(),
    percentage: z
      .number()
      .int()
      .min(0, 'validation.outOfRange')
      .max(100, 'validation.outOfRange')
      .optional(),
  })
  .strict();

export const setFeatureFlagInputSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/, 'validation.code'),
  enabled: z.boolean(),
  rules: featureFlagRulesSchema.nullish(),
});

export type UpdateNumberSeriesFormInput = z.input<typeof updateNumberSeriesInputSchema>;
export type FeatureFlagRules = z.output<typeof featureFlagRulesSchema>;
