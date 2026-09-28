import { Alert, Button, Card, Checkbox, TextInput, useToast } from '@ie/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gql } from '../../lib/api';
import { applyUserErrors } from '../../lib/forms';
import { productsQuery, SetVendorProductsMutation } from './api';
import { Th, usePermissions } from './shared';
import type { VendorData } from './VendorPage';

interface Item {
  productId: string;
  code: string;
  displayName: string;
  priority: string;
  isPrimary: boolean;
  leadTimeDays: string;
}

/**
 * The products a vendor supplies (MST-007), saved as one list: priority 1 is tried first, and the
 * primary vendor is the default on a purchase order.
 */
export function VendorProductsEditor({ vendor }: { vendor: VendorData }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const can = usePermissions();
  const mayMap = can('vendor:map_products');
  const [items, setItems] = useState<Item[]>(
    vendor.products.map((p) => ({
      productId: p.product.id,
      code: p.product.code,
      displayName: p.product.displayName,
      priority: String(p.priority),
      isPrimary: p.isPrimary,
      leadTimeDays: String(p.leadTimeDays ?? ''),
    })),
  );
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [general, setGeneral] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const term = useDeferredValue(search.trim());
  const found = useQuery({
    ...productsQuery({ search: term, status: ['ACTIVE'] }, null, 8),
    enabled: mayMap && term.length >= 2,
  });

  const update = (index: number, patch: Partial<Item>) =>
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const save = async () => {
    setSaving(true);
    setGeneral([]);
    setRowErrors({});
    try {
      const result = await gql(SetVendorProductsMutation, {
        input: {
          vendorId: vendor.id,
          items: items.map((item) => ({
            productId: item.productId,
            priority: Number(item.priority),
            isPrimary: item.isPrimary,
            leadTimeDays: item.leadTimeDays === '' ? null : Number(item.leadTimeDays),
          })),
        },
      });
      // ["input", "items", "2", "priority"] belongs to the third row.
      const byRow: Record<number, string> = {};
      const rest = result.setVendorProducts.userErrors.filter((e) => {
        const row = e.field?.[1] === 'items' ? Number(e.field[2]) : NaN;
        if (Number.isInteger(row)) byRow[row] = t(e.message);
        return !Number.isInteger(row);
      });
      setRowErrors(byRow);
      setGeneral(applyUserErrors(t, rest));
      if (result.setVendorProducts.userErrors.length === 0) {
        toast({ title: t('admin.saved') });
        await queryClient.invalidateQueries({ queryKey: ['masters'] });
      }
    } finally {
      setSaving(false);
    }
  };

  const matches = (found.data?.products.edges ?? [])
    .map((e) => e.node)
    .filter((p) => !items.some((item) => item.productId === p.id));

  return (
    <Card aria-labelledby="vendor-products" className="space-y-4">
      <div>
        <h3 id="vendor-products" className="text-h3 font-semibold">
          {t('masters.vendorProducts')}
        </h3>
        <p className="text-body-sm text-text-secondary">{t('masters.vendorProductsHint')}</p>
      </div>
      {general.length > 0 && (
        <Alert tone="danger">
          {general.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </Alert>
      )}
      {items.length === 0 ? (
        <p className="text-text-secondary">{t('masters.noProductsMapped')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-border text-body-sm text-text-secondary">
              <tr>
                <Th>{t('masters.product')}</Th>
                <Th>{t('masters.priority')}</Th>
                <Th>{t('masters.primary')}</Th>
                <Th>{t('masters.leadTimeDays')}</Th>
                <Th>
                  <span className="sr-only">{t('masters.remove')}</span>
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item, index) => (
                <tr key={item.productId} className="align-top">
                  <td className="px-4 py-2">
                    {item.displayName}
                    <span className="block text-caption text-text-secondary tabular">
                      {item.code}
                    </span>
                    {rowErrors[index] && (
                      <span role="alert" className="block text-body-sm text-danger-text">
                        {rowErrors[index]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <TextInput
                      type="number"
                      min={1}
                      max={99}
                      className="w-20"
                      aria-label={`${t('masters.priority')}: ${item.displayName}`}
                      disabled={!mayMap}
                      value={item.priority}
                      onChange={(e) => update(index, { priority: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Checkbox
                      label={
                        <span className="sr-only">{`${t('masters.primary')}: ${item.displayName}`}</span>
                      }
                      disabled={!mayMap}
                      checked={item.isPrimary}
                      onChange={(e) => update(index, { isPrimary: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <TextInput
                      type="number"
                      min={0}
                      max={365}
                      className="w-24"
                      aria-label={`${t('masters.leadTimeDays')}: ${item.displayName}`}
                      disabled={!mayMap}
                      value={item.leadTimeDays}
                      onChange={(e) => update(index, { leadTimeDays: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {mayMap && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${t('masters.remove')}: ${item.displayName}`}
                        onClick={() => setItems((list) => list.filter((_, i) => i !== index))}
                      >
                        {t('masters.remove')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mayMap && (
        <>
          <div className="space-y-2">
            <TextInput
              type="search"
              autoComplete="off"
              aria-label={t('masters.addProduct')}
              placeholder={t('masters.addProductPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {term.length >= 2 && found.isSuccess && (
              <ul
                aria-live="polite"
                className="divide-y divide-border rounded-md border border-border"
              >
                {matches.length === 0 ? (
                  <li className="px-3 py-2 text-text-secondary">{t('picker.noMatches')}</li>
                ) : (
                  matches.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-surface-muted focus-visible:bg-surface-muted"
                        onClick={() => {
                          setItems((list) => [
                            ...list,
                            {
                              productId: p.id,
                              code: p.code,
                              displayName: p.displayName,
                              priority: '1',
                              isPrimary: false,
                              leadTimeDays: '',
                            },
                          ]);
                          setSearch('');
                        }}
                      >
                        {p.displayName}
                        <span className="ml-2 text-caption text-text-secondary tabular">
                          {p.code}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          <Button onClick={() => void save()} loading={saving}>
            {t('masters.saveProducts')}
          </Button>
        </>
      )}
    </Card>
  );
}
