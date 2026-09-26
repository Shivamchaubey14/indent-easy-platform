import { Button, ErrorState, Loading, SelectInput, StatusBadge, TextInput } from '@ie/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserStatus } from '../../generated/graphql/graphql';
import { ApiRequestError } from '../../lib/api';
import { usersQuery } from './api';
import { formatDateTime, roleName, statusTone, USER_STATUSES, useReferenceData } from './shared';

/** User list with search, status and role filters (USR-001). Pages with server cursors. */
export function UsersPage() {
  const { t, i18n } = useTranslation();
  const reference = useReferenceData();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [role, setRole] = useState('');
  // Cursors of the pages before this one, so "previous" can step back.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const deferredSearch = useDeferredValue(search.trim());
  const filter = {
    ...(deferredSearch && { search: deferredSearch }),
    ...(status && { status: [status] }),
    ...(role && { roleCodes: [role] }),
  };
  const after = cursors.at(-1) ?? null;
  const users = useQuery({ ...usersQuery(filter, after), placeholderData: keepPreviousData });
  const resetPaging = () => setCursors([null]);

  return (
    <section aria-labelledby="users-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="users-title" className="text-h2 font-semibold">
          {t('admin.users')}
        </h2>
        <Link
          to="/admin/users/new"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:opacity-90"
        >
          {t('admin.newUser')}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <TextInput
          type="search"
          aria-label={t('admin.search')}
          placeholder={t('admin.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPaging();
          }}
        />
        <SelectInput
          aria-label={t('admin.status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as UserStatus | '');
            resetPaging();
          }}
        >
          <option value="">{t('admin.allStatuses')}</option>
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`userStatus.${s}`)}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          aria-label={t('admin.role')}
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            resetPaging();
          }}
        >
          <option value="">{t('admin.allRoles')}</option>
          {reference.data?.roles.map((r) => (
            <option key={r.id} value={r.code}>
              {roleName(t, r)}
            </option>
          ))}
        </SelectInput>
      </div>

      {users.isPending ? (
        <Loading />
      ) : users.isError ? (
        <ErrorState
          requestId={users.error instanceof ApiRequestError ? users.error.requestId : undefined}
          onRetry={() => void users.refetch()}
        />
      ) : users.data.users.edges.length === 0 ? (
        <p className="text-text-secondary">{t('admin.noUsers')}</p>
      ) : (
        <>
          <p className="text-body-sm text-text-secondary" aria-live="polite">
            {t('admin.userCount', { count: users.data.users.totalCount ?? 0 })}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-border text-body-sm text-text-secondary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.name')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.employeeCode')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.location')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.roles')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.status')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.lastSignIn')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.data.users.edges.map(({ node }) => (
                  <tr key={node.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/users/$userId"
                        params={{ userId: node.id }}
                        className="font-medium text-link underline-offset-2 hover:underline"
                      >
                        {node.displayName}
                      </Link>
                      <div className="text-body-sm text-text-secondary">{node.email}</div>
                    </td>
                    <td className="px-4 py-3 tabular">{node.employeeCode}</td>
                    <td className="px-4 py-3">{node.primaryLocation?.name}</td>
                    <td className="px-4 py-3 text-body-sm">
                      {node.roles.map((r) => roleName(t, r.role)).join(', ')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={statusTone(node.status)}>
                        {t(`userStatus.${node.status}`)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">
                      {formatDateTime(t, i18n.language, node.lastLoginAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <Button
              variant="secondary"
              size="sm"
              disabled={cursors.length === 1}
              onClick={() => setCursors((c) => c.slice(0, -1))}
            >
              {t('admin.previous')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!users.data.users.pageInfo.hasNextPage}
              onClick={() => setCursors((c) => [...c, users.data.users.pageInfo.endCursor ?? null])}
            >
              {t('admin.next')}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
