import type { ImportIssue } from '../../imports/index.js';

/*
 * Parsing helpers shared by the catalogue imports. Cell text arrives already normalised (NFKC,
 * whitespace collapsed, blank → null).
 */

export const critical = (
  rule: string,
  message: string,
  field?: string,
  value?: string | null,
  suggestion?: string,
): ImportIssue => ({
  rule,
  message,
  field: field ?? null,
  value: value ?? null,
  suggestion,
  critical: true,
});

export const warning = (
  rule: string,
  message: string,
  field?: string,
  value?: string | null,
  suggestion?: string,
): ImportIssue => ({
  rule,
  message,
  field: field ?? null,
  value: value ?? null,
  suggestion,
  critical: false,
});

/** A cell that could not be read as the value it should hold. */
export const INVALID = Symbol('invalid');
export type Invalid = typeof INVALID;

/** Codes as the masters store them: upper case, no inner spaces. */
export const codeOf = (value: string | null) =>
  value === null ? null : value.toUpperCase().replace(/\s+/g, '');

/** Case-insensitive key for matching names. */
export const nameKey = (value: string) => value.toLowerCase();

/** Yes/no cells: Y, Yes, True, 1, हाँ … → true; N, No, False, 0 → false; blank → fallback. */
export function parseFlag(value: string | null, fallback: boolean): boolean | Invalid {
  if (value === null) return fallback;
  const v = value.toLowerCase();
  if (['y', 'yes', 'true', '1', 'primary', 'हाँ', 'हां'].includes(v)) return true;
  if (['n', 'no', 'false', '0', 'नहीं'].includes(v)) return false;
  return INVALID;
}

/** A whole number in a range; blank → null. */
export function parseWhole(
  value: string | null,
  min: number,
  max: number,
): number | null | Invalid {
  if (value === null) return null;
  if (!/^-?\d+(\.0+)?$/.test(value)) return INVALID;
  const n = Number(value);
  return n >= min && n <= max ? n : INVALID;
}

/**
 * Indian mobile numbers as E.164: 10 digits get +91; "91" + 10 digits and "0" + 10 digits are
 * recognised; anything with a + is kept as typed. Null when it cannot be a phone number.
 */
export function mobileE164(value: string | null): string | null | Invalid {
  if (value === null) return null;
  const digits = value.replace(/[\s\-().]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return INVALID;
}

/** Cycle bands as written in the legacy sheet ("1-10", "11 - 20", "21–31") or as stored. */
export function cycleBandOf(value: string | null): string | null | Invalid {
  if (value === null) return null;
  const v = value.toUpperCase().replace(/\s+/g, '').replace(/[–—]/g, '-');
  if (['1-10', 'DAYS_1_10', '1TO10'].includes(v)) return 'DAYS_1_10';
  if (['11-20', 'DAYS_11_20', '11TO20'].includes(v)) return 'DAYS_11_20';
  if (['21-31', '21-30', 'DAYS_21_31', '21TO31'].includes(v)) return 'DAYS_21_31';
  return INVALID;
}

export const CYCLE_BAND_TEXT: Record<string, string> = {
  DAYS_1_10: '1-10',
  DAYS_11_20: '11-20',
  DAYS_21_31: '21-31',
};

/** Status cells: Active/Inactive (and legacy Y/N); blank → fallback. */
export function statusOf(value: string | null, fallback: string): string | Invalid {
  if (value === null) return fallback;
  const v = value.toUpperCase();
  if (['ACTIVE', 'Y', 'YES', 'TRUE', '1'].includes(v)) return 'ACTIVE';
  if (['INACTIVE', 'N', 'NO', 'FALSE', '0'].includes(v)) return 'INACTIVE';
  return INVALID;
}

/** Same values, ignoring key order and undefined. */
export function sameValues(a: object, b: object): boolean {
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  return Object.keys({ ...left, ...right }).every((k) => (left[k] ?? null) === (right[k] ?? null));
}
