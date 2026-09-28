import { Button, type ControlProps, TextInput } from '@ie/ui';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { userSearchQuery } from '../lib/users';

export interface PickedUser {
  id: string;
  displayName: string;
  employeeCode?: string | null;
}

/**
 * Chooses one person by name, e-mail or employee code. Searching needs `admin:user_manage`; without
 * it (`canSearch` false) the current choice is only shown.
 */
export function UserPicker({
  control,
  value,
  onChange,
  canSearch,
  excludeId,
}: {
  control: ControlProps;
  value: PickedUser | null;
  onChange: (user: PickedUser | null) => void;
  canSearch: boolean;
  /** Left out of the results, e.g. the user being edited as their own manager. */
  excludeId?: string;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const term = useDeferredValue(search.trim());
  const results = useQuery({ ...userSearchQuery(term), enabled: canSearch && term.length >= 2 });
  const label = (u: PickedUser) =>
    u.employeeCode ? `${u.displayName} (${u.employeeCode})` : u.displayName;

  if (!canSearch) {
    return (
      <p id={control.id} className="py-2">
        {value ? label(value) : t('admin.none')}
      </p>
    );
  }

  const matches = (results.data ?? []).filter((u) => u.id !== excludeId);
  return (
    <div className="space-y-2">
      {value && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
          <span>{label(value)}</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`${t('picker.clear')}: ${value.displayName}`}
            onClick={() => onChange(null)}
          >
            {t('picker.clear')}
          </Button>
        </div>
      )}
      <TextInput
        {...control}
        type="search"
        autoComplete="off"
        placeholder={t('picker.searchUsers')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {term.length >= 2 && results.isSuccess && (
        <ul aria-live="polite" className="divide-y divide-border rounded-md border border-border">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-text-secondary">{t('picker.noMatches')}</li>
          ) : (
            matches.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-surface-muted focus-visible:bg-surface-muted"
                  onClick={() => {
                    onChange({
                      id: u.id,
                      displayName: u.displayName,
                      employeeCode: u.employeeCode,
                    });
                    setSearch('');
                  }}
                >
                  {label(u)}
                  <span className="block text-caption text-text-secondary">{u.email}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
