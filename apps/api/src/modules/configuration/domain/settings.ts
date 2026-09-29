import { z } from 'zod';

/*
 * The settings an administrator may change (ADM-003), each with its type, its default and where
 * the requirement comes from. Values are stored in config.setting only when they differ from the
 * default; reading falls back to the default. A setting is added here together with the feature
 * that uses it, and only with a decided default: undecided values (OQ-nnn) are not guessed.
 */

export interface SettingDefinition<T = unknown> {
  key: string;
  /** Validates a new value; messages are i18n keys. */
  schema: z.ZodType<T>;
  defaultValue: T;
  /** Shown to administrators (English; the web app translates by key). */
  description: string;
  /** Where the rule comes from, e.g. GRN-005. */
  source: string;
  /** How the web app renders the input. */
  input:
    { kind: 'number'; min: number; max: number; step: number; unit?: string } | { kind: 'boolean' };
}

const percent = (max: number) =>
  z
    .number({ message: 'validation.decimal' })
    .min(0, 'validation.mustNotBeNegative')
    .max(max, 'validation.outOfRange')
    .refine((v) => Number.isInteger(v * 100), 'validation.decimal');

export const SETTINGS: readonly SettingDefinition[] = [
  {
    key: 'receiving.overReceiptTolerancePct',
    schema: percent(100),
    defaultValue: 10,
    description:
      'How much more than ordered may be received without approval, in percent of the ordered quantity.',
    source: 'GRN-005 (legacy 10%)',
    input: { kind: 'number', min: 0, max: 100, step: 0.5, unit: '%' },
  },
];

export const settingDefinition = (key: string) => SETTINGS.find((s) => s.key === key);
