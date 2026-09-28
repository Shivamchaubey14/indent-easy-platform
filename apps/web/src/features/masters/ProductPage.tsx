import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  Loading,
  SelectInput,
  StatusBadge,
  TextInput,
  useToast,
} from '@ie/ui';
import { type SaveProductFormInput, saveProductInputSchema } from '@ie/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type PickedUser, UserPicker } from '../../components/UserPicker';
import { gql } from '../../lib/api';
import { applyUserErrors, nullIfBlank } from '../../lib/forms';
import { productQuery, SaveProductMutation } from './api';
import { activeTone, QueryError, useCatalogReference, usePermissions } from './shared';

// Errors on a whole list (e.g. a code taken by another product) have no row; they go to the alert.
const FIELDS = [
  ...Object.keys(saveProductInputSchema.shape).filter((f) => f !== 'externalCodes'),
  'externalCodes.*',
];

type ProductData = NonNullable<
  Awaited<ReturnType<NonNullable<ReturnType<typeof productQuery>['queryFn']>>>
>;

/** Create (no productId) or edit a product (MST-001…003). */
export function ProductPage({ productId }: { productId?: string }) {
  const product = useQuery({ ...productQuery(productId ?? ''), enabled: !!productId });
  const reference = useCatalogReference();
  if ((productId && product.isPending) || reference.isPending) return <Loading />;
  if (product.isError || reference.isError) {
    return (
      <QueryError
        error={product.error ?? reference.error}
        onRetry={() => void Promise.all([product.refetch(), reference.refetch()])}
      />
    );
  }
  return <ProductForm key={product.data?.version ?? 'new'} product={product.data ?? null} />;
}

function ProductForm({ product }: { product: ProductData | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const can = usePermissions();
  const reference = useCatalogReference().data!;
  const [general, setGeneral] = useState<string[]>([]);
  const [owner, setOwner] = useState<PickedUser | null>(product?.owner ?? null);
  const mayEdit = product ? can('product:update') : can('product:create');
  const mayMap = can('product:map_external');

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SaveProductFormInput>({
    resolver: zodResolver(saveProductInputSchema),
    mode: 'onBlur',
    defaultValues: {
      code: product?.code ?? '',
      name: product?.name ?? '',
      nameHi: product?.nameHi ?? '',
      sizeLabel: product?.sizeLabel ?? '',
      baseUomId: product?.baseUom.id ?? '',
      categoryId: product?.category?.id ?? '',
      materialType: product?.materialType ?? '',
      hsnCode: product?.hsnCode ?? '',
      standardPrice: product?.standardPrice?.amount ?? null,
      isStockItem: product?.isStockItem ?? true,
      isService: product?.isService ?? false,
      batchTracked: product?.batchTracked ?? false,
      serialTracked: product?.serialTracked ?? false,
      reorderLevel: product?.reorderLevel ?? null,
      status: product?.status ?? 'ACTIVE',
      externalCodes:
        product?.externalCodes.map((c) => ({
          system: c.system,
          code: c.code ?? '',
          name: c.name,
          isPrimary: c.isPrimary,
        })) ?? [],
    },
  });
  const codes = useFieldArray({ control, name: 'externalCodes' });
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const save = handleSubmit(async (values) => {
    setGeneral([]);
    const input = {
      ...values,
      ownerUserId: owner?.id ?? null,
      // Without `product:map_external` the codes are left as they are.
      externalCodes: mayMap ? (values.externalCodes ?? []) : null,
      ...(product && { id: product.id, expectedVersion: product.version }),
    };
    const result = await gql(SaveProductMutation, { input });
    setGeneral(applyUserErrors(t, result.saveProduct.userErrors, setError, FIELDS));
    const saved = result.saveProduct.product;
    if (saved) {
      toast({ title: t('admin.saved') });
      await queryClient.invalidateQueries({ queryKey: ['masters'] });
      if (!product) {
        await navigate({ to: '/masters/products/$productId', params: { productId: saved.id } });
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/masters/products" className="text-link underline-offset-2 hover:underline">
          {t('masters.products')}
        </Link>
        <span aria-hidden="true" className="text-text-secondary">
          /
        </span>
        <h2 className="text-h2 font-semibold">
          {product ? product.displayName : t('masters.newProduct')}
        </h2>
        {product && (
          <StatusBadge tone={activeTone(product.status)}>
            {t(`masterStatus.${product.status}`)}
          </StatusBadge>
        )}
      </div>
      {general.length > 0 && (
        <Alert tone="danger">
          {general.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </Alert>
      )}

      <form noValidate onSubmit={(e) => void save(e)} className="space-y-6">
        <fieldset disabled={!mayEdit} className="space-y-6">
          <Card aria-labelledby="product-details" className="space-y-4">
            <h3 id="product-details" className="text-h3 font-semibold">
              {t('masters.details')}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('admin.code')} error={fieldError(errors.code?.message)} required>
                {(c) => <TextInput {...c} {...register('code')} />}
              </Field>
              <Field label={t('admin.status')}>
                {(c) => (
                  <SelectInput {...c} {...register('status')}>
                    <option value="ACTIVE">{t('masterStatus.ACTIVE')}</option>
                    <option value="INACTIVE">{t('masterStatus.INACTIVE')}</option>
                  </SelectInput>
                )}
              </Field>
              <Field label={t('admin.name')} error={fieldError(errors.name?.message)} required>
                {(c) => <TextInput {...c} {...register('name')} />}
              </Field>
              <Field label={t('admin.nameHi')} error={fieldError(errors.nameHi?.message)}>
                {(c) => <TextInput {...c} lang="hi" {...register('nameHi')} />}
              </Field>
              <Field
                label={t('masters.sizeLabel')}
                hint={t('masters.sizeLabelHint')}
                error={fieldError(errors.sizeLabel?.message)}
              >
                {(c) => <TextInput {...c} {...register('sizeLabel')} />}
              </Field>
              <Field
                label={t('masters.baseUom')}
                hint={t('masters.baseUomHint')}
                error={fieldError(errors.baseUomId?.message)}
                required
              >
                {(c) => (
                  <SelectInput {...c} {...register('baseUomId')}>
                    <option value="">{t('admin.choose')}</option>
                    {reference.uoms.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} — {u.name}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
              <Field label={t('masters.category')} error={fieldError(errors.categoryId?.message)}>
                {(c) => (
                  <SelectInput {...c} {...register('categoryId')}>
                    <option value="">{t('admin.none')}</option>
                    {reference.productCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
              <Field
                label={t('masters.materialType')}
                error={fieldError(errors.materialType?.message)}
              >
                {(c) => <TextInput {...c} {...register('materialType')} />}
              </Field>
              <Field label={t('masters.hsnCode')} error={fieldError(errors.hsnCode?.message)}>
                {(c) => <TextInput {...c} inputMode="numeric" {...register('hsnCode')} />}
              </Field>
              <Field
                label={t('masters.standardPrice')}
                hint={t('masters.standardPriceHint')}
                error={fieldError(errors.standardPrice?.message)}
              >
                {(c) => (
                  <TextInput
                    {...c}
                    inputMode="decimal"
                    {...register('standardPrice', nullIfBlank)}
                  />
                )}
              </Field>
              <Field
                label={t('masters.reorderLevel')}
                error={fieldError(errors.reorderLevel?.message)}
              >
                {(c) => (
                  <TextInput
                    {...c}
                    inputMode="decimal"
                    {...register('reorderLevel', nullIfBlank)}
                  />
                )}
              </Field>
              <Field label={t('masters.owner')} hint={t('masters.ownerHint')}>
                {(c) => (
                  <UserPicker
                    control={c}
                    value={owner}
                    onChange={setOwner}
                    canSearch={mayEdit && can('admin:user_manage')}
                  />
                )}
              </Field>
            </div>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">{t('masters.kind')}</legend>
              <Checkbox label={t('masters.isStockItem')} {...register('isStockItem')} />
              <Checkbox
                label={t('masters.isService')}
                description={t('masters.isServiceHint')}
                {...register('isService')}
              />
              <Checkbox label={t('masters.batchTracked')} {...register('batchTracked')} />
              <Checkbox label={t('masters.serialTracked')} {...register('serialTracked')} />
            </fieldset>
            {errors.isStockItem?.message && (
              <p role="alert" className="text-body-sm text-danger-text">
                {t(errors.isStockItem.message)}
              </p>
            )}
          </Card>

          <Card aria-labelledby="product-codes" className="space-y-4">
            <div>
              <h3 id="product-codes" className="text-h3 font-semibold">
                {t('masters.externalCodes')}
              </h3>
              <p className="text-body-sm text-text-secondary">{t('masters.externalCodesHint')}</p>
            </div>
            <fieldset disabled={!mayMap} className="space-y-4">
              {codes.fields.map((field, index) => {
                const rowErrors = errors.externalCodes?.[index];
                return (
                  <div
                    key={field.id}
                    className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[1fr_1fr_2fr_auto_auto] md:items-end"
                  >
                    <Field
                      label={t('masters.codeSystem')}
                      error={fieldError(rowErrors?.system?.message)}
                      required
                    >
                      {(c) => (
                        <SelectInput {...c} {...register(`externalCodes.${index}.system`)}>
                          {reference.externalSystems.map((s) => (
                            <option key={s.id} value={s.code}>
                              {s.name}
                            </option>
                          ))}
                        </SelectInput>
                      )}
                    </Field>
                    <Field
                      label={t('masters.externalCode')}
                      error={fieldError(rowErrors?.code?.message)}
                    >
                      {(c) => <TextInput {...c} {...register(`externalCodes.${index}.code`)} />}
                    </Field>
                    <Field
                      label={t('masters.externalName')}
                      error={fieldError(rowErrors?.name?.message)}
                      required
                    >
                      {(c) => <TextInput {...c} {...register(`externalCodes.${index}.name`)} />}
                    </Field>
                    <div className="pb-2">
                      <Checkbox
                        label={t('masters.primary')}
                        {...register(`externalCodes.${index}.isPrimary`)}
                      />
                      {rowErrors?.isPrimary?.message && (
                        <p className="text-body-sm text-danger-text">
                          {t(rowErrors.isPrimary.message)}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => codes.remove(index)}>
                      {t('masters.remove')}
                    </Button>
                  </div>
                );
              })}
              {mayMap && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    codes.append({
                      system: reference.externalSystems[0]?.code ?? '',
                      code: '',
                      name: '',
                      isPrimary: true,
                    })
                  }
                >
                  {t('masters.addExternalCode')}
                </Button>
              )}
            </fieldset>
          </Card>

          {mayEdit && (
            <Button type="submit" loading={isSubmitting}>
              {product ? t('admin.save') : t('masters.createProduct')}
            </Button>
          )}
        </fieldset>
      </form>

      {product && (
        <Card aria-labelledby="product-vendors" className="space-y-3">
          <h3 id="product-vendors" className="text-h3 font-semibold">
            {t('masters.suppliedBy')}
          </h3>
          {product.vendors.length === 0 ? (
            <p className="text-text-secondary">{t('masters.noVendorsMapped')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {product.vendors.map((v) => (
                <li key={v.vendor.id} className="flex justify-between gap-3 py-2">
                  <Link
                    to="/masters/vendors/$vendorId"
                    params={{ vendorId: v.vendor.id }}
                    className="text-link underline-offset-2 hover:underline"
                  >
                    {v.vendor.name}
                  </Link>
                  <span className="text-body-sm text-text-secondary">
                    {v.isPrimary ? `${t('masters.primary')} · ` : ''}
                    {t('masters.priorityN', { n: v.priority })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
