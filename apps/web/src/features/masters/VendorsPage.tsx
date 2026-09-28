import { Loading, SelectInput, StatusBadge, TextInput } from '@ie/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VendorStatus } from '../../generated/graphql/graphql';
import { vendorsQuery } from './api';
import { activeTone, Pager, QueryError, Th, useCursorPages, usePermissions } from './shared';

export const VENDOR_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const;

/** Vendor list (MST-006): search by name, code, GSTIN or SAP code; status filter. */
export function VendorsPage() {
  const { t } = useTranslation();
  const mayCreate = usePermissions()('vendor:create');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VendorStatus | ''>('ACTIVE');
  const pages = useCursorPages();
  const term = useDeferredValue(search.trim());
  const filter = { ...(term && { search: term }), ...(status && { status: [status] }) };
  const vendors = useQuery({
    ...vendorsQuery(filter, pages.after),
    placeholderData: keepPreviousData,
  });

  return (
    <section aria-labelledby="vendors-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="vendors-title" className="text-h2 font-semibold">
          {t('masters.vendors')}
        </h2>
        {mayCreate && (
          <Link
            to="/masters/vendors/new"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:opacity-90"
          >
            {t('masters.newVendor')}
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <TextInput
          type="search"
          aria-label={t('admin.search')}
          placeholder={t('masters.searchVendors')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            pages.reset();
          }}
        />
        <SelectInput
          aria-label={t('admin.status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as VendorStatus | '');
            pages.reset();
          }}
        >
          <option value="">{t('admin.allStatuses')}</option>
          {VENDOR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`masterStatus.${s}`)}
            </option>
          ))}
        </SelectInput>
      </div>

      {vendors.isPending ? (
        <Loading />
      ) : vendors.isError ? (
        <QueryError error={vendors.error} onRetry={() => void vendors.refetch()} />
      ) : vendors.data.vendors.edges.length === 0 ? (
        <p className="text-text-secondary">{t('masters.noVendors')}</p>
      ) : (
        <>
          <p className="text-body-sm text-text-secondary" aria-live="polite">
            {t('masters.vendorCount', { count: vendors.data.vendors.totalCount ?? 0 })}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-border text-body-sm text-text-secondary">
                <tr>
                  <Th>{t('admin.code')}</Th>
                  <Th>{t('admin.name')}</Th>
                  <Th>{t('masters.gstin')}</Th>
                  <Th>{t('masters.sapVendorCode')}</Th>
                  <Th>{t('masters.contact')}</Th>
                  <Th>{t('admin.status')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vendors.data.vendors.edges.map(({ node }) => {
                  const contact = node.contacts[0];
                  return (
                    <tr key={node.id} className="align-top">
                      <td className="px-4 py-3 tabular">{node.code}</td>
                      <td className="px-4 py-3">
                        <Link
                          to="/masters/vendors/$vendorId"
                          params={{ vendorId: node.id }}
                          className="font-medium text-link underline-offset-2 hover:underline"
                        >
                          {node.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular">{node.gstin}</td>
                      <td className="px-4 py-3 tabular">{node.sapVendorCode}</td>
                      <td className="px-4 py-3 text-body-sm">{contact?.email ?? contact?.phone}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={activeTone(node.status)}>
                          {t(`masterStatus.${node.status}`)}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager pages={pages} pageInfo={vendors.data.vendors.pageInfo} />
        </>
      )}
    </section>
  );
}
