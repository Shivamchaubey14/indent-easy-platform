import type { TFunction } from 'i18next';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/**
 * Puts user errors from a mutation on the form fields they name and returns the translated
 * messages that belong to no field on the form. `["input", "email"]` goes to `email` when `fields`
 * lists it; a nested path such as `["input", "contacts", "0", "email"]` goes to `contacts.0.email`
 * when `fields` lists `contacts.*` (the form shows errors inside that list).
 */
export function applyUserErrors<T extends FieldValues>(
  t: TFunction,
  errors: readonly { message: string; field?: readonly string[] | null }[],
  setError?: UseFormSetError<T>,
  fields: readonly string[] = [],
): string[] {
  const general: string[] = [];
  for (const error of errors) {
    const path = error.field?.slice(1) ?? [];
    const known = path.length === 1 ? fields.includes(path[0]!) : fields.includes(`${path[0]}.*`);
    if (setError && path.length > 0 && known) {
      setError(path.join('.') as Path<T>, { type: 'server', message: error.message });
    } else {
      general.push(t(error.message));
    }
  }
  return general;
}

/** Locale-aware date and time for tables, or "never". */
export function formatDateTime(t: TFunction, language: string, iso: string | null | undefined) {
  if (!iso) return t('admin.never');
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** An amount in rupees for tables and read-only fields. */
export function formatMoney(language: string, amount: string | null | undefined) {
  if (amount === null || amount === undefined) return '';
  return new Intl.NumberFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(Number(amount));
}

/** Register option: an empty decimal field is sent as null (not set) instead of "". */
export const nullIfBlank = {
  setValueAs: (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v),
};

/** Register option: a whole-number field as a number, or null when empty. */
export const intOrNull = {
  setValueAs: (v: unknown) =>
    v === null || v === undefined || (typeof v === 'string' && v.trim() === '') ? null : Number(v),
};
