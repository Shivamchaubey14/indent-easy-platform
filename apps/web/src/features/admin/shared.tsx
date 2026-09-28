import type { Tone } from '@ie/ui';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { referenceDataQuery } from './api';

export { applyUserErrors, formatDateTime } from '../../lib/forms';

/** Roles, permissions and masters for pick lists (one cached query). */
export function useReferenceData() {
  return useQuery(referenceDataQuery);
}

/** A role's name in the user's language; custom roles keep the name they were given. */
export function roleName(t: TFunction, role: { code: string; name: string }): string {
  return t(`roleName.${role.code}`, { defaultValue: role.name });
}

export const USER_STATUSES = ['INVITED', 'ACTIVE', 'LOCKED', 'DISABLED'] as const;

export function statusTone(status: string): Tone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'INVITED') return 'info';
  return status === 'LOCKED' ? 'warning' : 'danger';
}
