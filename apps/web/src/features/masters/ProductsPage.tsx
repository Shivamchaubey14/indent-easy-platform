import { Loading, SelectInput, StatusBadge, TextInput } from '@ie/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductStatus } from '../../generated/graphql/graphql';
import { formatMoney } from '../../lib/forms';
import { productsQuery } from './api';
import {
  activeTone,
  Pager,
  QueryError,
  Th,
  useCatalogReference,
  useCursorPages,
  usePermissions,
} from './shared';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

/** Product list (MST-001): search by code, name or external code; category and status filters. */
export function ProductsPage() {
  const { t, i18n } = useTranslation();
  const mayCreate = usePermissions()('product:create');
  const reference = useCatalogReference();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('ACTIVE');
  const pages = useCursorPages();
  const term = useDeferredValue(search.trim());
  const filter = {
    ...(term && { search: term }),
    ...(category && { categoryIds: [category] }),
    ...(status && { status: [status] }),
  };
  const products = useQuery({
    ...productsQuery(filter, pages.after),
    placeholderData: keepPreviousData,
  });

  return (
    <section aria-labelledby="products-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="products-title" className="text-h2 font-semibold">
          {t('masters.products')}
        </h2>
        {mayCreate && (
          <Link
            to="/masters/products/new"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:opacity-90"
          >
            {t('masters.newProduct')}
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <TextInput
          type="search"
          aria-label={t('admin.search')}
          placeholder={t('masters.searchProducts')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            pages.reset();
          }}
        />
        <SelectInput
          aria-label={t('masters.category')}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            pages.reset();
          }}
        >
          <option value="">{t('masters.allCategories')}</option>
          {reference.data?.productCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          aria-label={t('admin.status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ProductStatus | '');
            pages.reset();
          }}
        >
          <option value="">{t('admin.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`masterStatus.${s}`)}
            </option>
          ))}
        </SelectInput>
      </div>

      {products.isPending ? (
        <Loading />
      ) : products.isError ? (
        <QueryError error={products.error} onRetry={() => void products.refetch()} />
      ) : products.data.products.edges.length === 0 ? (
        <p className="text-text-secondary">{t('masters.noProducts')}</p>
      ) : (
        <>
          <p className="text-body-sm text-text-secondary" aria-live="polite">
            {t('masters.productCount', { count: products.data.products.totalCount ?? 0 })}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-border text-body-sm text-text-secondary">
                <tr>
                  <Th>{t('admin.code')}</Th>
                  <Th>{t('admin.name')}</Th>
                  <Th>{t('masters.baseUom')}</Th>
                  <Th>{t('masters.category')}</Th>
                  <Th className="text-right">{t('masters.standardPrice')}</Th>
                  <Th>{t('admin.status')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.data.products.edges.map(({ node }) => (
                  <tr key={node.id} className="align-top">
                    <td className="px-4 py-3 tabular">{node.code}</td>
                    <td className="px-4 py-3">
                      <Link
                        to="/masters/products/$productId"
                        params={{ productId: node.id }}
                        className="font-medium text-link underline-offset-2 hover:underline"
                      >
                        {node.displayName}
                      </Link>
                      {(node.displayName !== node.name || node.sizeLabel) && (
                        <div className="text-body-sm text-text-secondary">
                          {[node.displayName !== node.name && node.name, node.sizeLabel]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                      {node.isService && (
                        <div className="text-caption text-text-secondary">
                          {t('masters.service')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular">{node.baseUom.code}</td>
                    <td className="px-4 py-3">{node.category?.name}</td>
                    <td className="px-4 py-3 text-right tabular">
                      {formatMoney(i18n.language, node.standardPrice?.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={activeTone(node.status)}>
                        {t(`masterStatus.${node.status}`)}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager pages={pages} pageInfo={products.data.products.pageInfo} />
        </>
      )}
    </section>
  );
}
