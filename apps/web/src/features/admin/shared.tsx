import type { Tone } from '@ie/ui';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { referenceDataQuery } from './api';

/** Roles, permissions and masters for pick lists (one cached query). */
export function useReferenceData() {
  return useQuery(referenceDataQuery);
}

/** A role's name in the user's language; custom roles keep the name they were given. */
export function roleName(t: TFunction, role: { code: string; name: string }): string {
  return t(`roleName.${role.code}`, { defaultValue: role.name });
}

/**
 * Puts user errors from a mutation on the form fields they name (`["input", "email"]` → `email`)
 * and returns the translated messages that belong to no single field.
 */
export function applyUserErrors<T extends FieldValues>(
  t: TFunction,
  errors: readonly { message: string; field?: readonly string[] | null }[],
  setError?: UseFormSetError<T>,
  fields: readonly string[] = [],
): string[] {
  const general: string[] = [];
  for (const error of errors) {
    const field = error.field?.[1];
    if (setError && field && fields.includes(field) && (error.field?.length ?? 0) === 2) {
      setError(field as Path<T>, { type: 'server', message: error.message });
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

export const USER_STATUSES = ['INVITED', 'ACTIVE', 'LOCKED', 'DISABLED'] as const;

export function statusTone(status: string): Tone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'INVITED') return 'info';
  return status === 'LOCKED' ? 'warning' : 'danger';
}
