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
import {
  type SaveVendorFormInput,
  saveVendorInputSchema,
  vendorContactPurposes,
} from '@ie/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { gql } from '../../lib/api';
import { applyUserErrors, intOrNull } from '../../lib/forms';
import { SaveVendorMutation, vendorQuery } from './api';
import { activeTone, QueryError, usePermissions } from './shared';
import { VendorProductsEditor } from './VendorProductsEditor';
import { VENDOR_STATUSES } from './VendorsPage';

// Errors on the whole contact list have no row; they go to the alert.
const FIELDS = [
  ...Object.keys(saveVendorInputSchema.shape).filter((f) => f !== 'contacts'),
  'contacts.*',
];

export type VendorData = NonNullable<
  Awaited<ReturnType<NonNullable<ReturnType<typeof vendorQuery>['queryFn']>>>
>;

/** Create (no vendorId) or edit a vendor with its contacts and products (MST-006, MST-007). */
export function VendorPage({ vendorId }: { vendorId?: string }) {
  const vendor = useQuery({ ...vendorQuery(vendorId ?? ''), enabled: !!vendorId });
  if (vendorId && vendor.isPending) return <Loading />;
  if (vendor.isError) {
    return <QueryError error={vendor.error} onRetry={() => void vendor.refetch()} />;
  }
  return (
    <div className="space-y-6">
      <VendorForm key={vendor.data?.version ?? 'new'} vendor={vendor.data ?? null} />
      {vendor.data && <VendorProductsEditor key={vendor.data.version} vendor={vendor.data} />}
    </div>
  );
}

const emptyContact = () => ({
  name: '',
  email: '',
  phone: '',
  purposes: ['PO' as const],
});

function VendorForm({ vendor }: { vendor: VendorData | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const can = usePermissions();
  const [general, setGeneral] = useState<string[]>([]);
  const mayEdit = vendor ? can('vendor:update') : can('vendor:create');

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SaveVendorFormInput>({
    resolver: zodResolver(saveVendorInputSchema),
    mode: 'onBlur',
    defaultValues: {
      code: vendor?.code ?? '',
      name: vendor?.name ?? '',
      legalName: vendor?.legalName ?? '',
      gstin: vendor?.gstin ?? '',
      pan: vendor?.pan ?? '',
      sapVendorCode: vendor?.sapVendorCode ?? '',
      paymentTermsDays: vendor?.paymentTermsDays ?? null,
      address: vendor?.address ?? '',
      status: vendor?.status ?? 'ACTIVE',
      contacts: vendor?.contacts.map((c) => ({
        id: c.id,
        name: c.name ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        purposes: c.purposes.filter((p): p is (typeof vendorContactPurposes)[number] =>
          (vendorContactPurposes as readonly string[]).includes(p),
        ),
      })) ?? [emptyContact()],
    },
  });
  const contacts = useFieldArray({ control, name: 'contacts' });
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const save = handleSubmit(async (values) => {
    setGeneral([]);
    const input = { ...values, ...(vendor && { id: vendor.id, expectedVersion: vendor.version }) };
    const result = await gql(SaveVendorMutation, { input });
    setGeneral(applyUserErrors(t, result.saveVendor.userErrors, setError, FIELDS));
    const saved = result.saveVendor.vendor;
    if (saved) {
      toast({ title: t('admin.saved') });
      await queryClient.invalidateQueries({ queryKey: ['masters'] });
      if (!vendor) {
        await navigate({ to: '/masters/vendors/$vendorId', params: { vendorId: saved.id } });
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/masters/vendors" className="text-link underline-offset-2 hover:underline">
          {t('masters.vendors')}
        </Link>
        <span aria-hidden="true" className="text-text-secondary">
          /
        </span>
        <h2 className="text-h2 font-semibold">{vendor ? vendor.name : t('masters.newVendor')}</h2>
        {vendor && (
          <StatusBadge tone={activeTone(vendor.status)}>
            {t(`masterStatus.${vendor.status}`)}
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

      <form noValidate onSubmit={(e) => void save(e)}>
        <fieldset disabled={!mayEdit} className="space-y-6">
          <Card aria-labelledby="vendor-details" className="space-y-4">
            <h3 id="vendor-details" className="text-h3 font-semibold">
              {t('masters.details')}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label={t('admin.code')}
                hint={vendor ? undefined : t('masters.vendorCodeHint')}
                error={fieldError(errors.code?.message)}
              >
                {(c) => <TextInput {...c} {...register('code')} />}
              </Field>
              <Field label={t('admin.status')}>
                {(c) => (
                  <SelectInput {...c} {...register('status')}>
                    {VENDOR_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`masterStatus.${s}`)}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
              <Field label={t('admin.name')} error={fieldError(errors.name?.message)} required>
                {(c) => <TextInput {...c} {...register('name')} />}
              </Field>
              <Field label={t('masters.legalName')} error={fieldError(errors.legalName?.message)}>
                {(c) => <TextInput {...c} {...register('legalName')} />}
              </Field>
              <Field label={t('masters.gstin')} error={fieldError(errors.gstin?.message)}>
                {(c) => <TextInput {...c} autoCapitalize="characters" {...register('gstin')} />}
              </Field>
              <Field label={t('masters.pan')} error={fieldError(errors.pan?.message)}>
                {(c) => <TextInput {...c} autoCapitalize="characters" {...register('pan')} />}
              </Field>
              <Field
                label={t('masters.sapVendorCode')}
                error={fieldError(errors.sapVendorCode?.message)}
              >
                {(c) => <TextInput {...c} {...register('sapVendorCode')} />}
              </Field>
              <Field
                label={t('masters.paymentTermsDays')}
                error={fieldError(errors.paymentTermsDays?.message)}
              >
                {(c) => (
                  <TextInput
                    {...c}
                    type="number"
                    min={0}
                    max={365}
                    {...register('paymentTermsDays', intOrNull)}
                  />
                )}
              </Field>
            </div>
            <Field label={t('admin.address')} error={fieldError(errors.address?.message)}>
              {(c) => <TextInput {...c} {...register('address')} />}
            </Field>
          </Card>

          <Card aria-labelledby="vendor-contacts" className="space-y-4">
            <div>
              <h3 id="vendor-contacts" className="text-h3 font-semibold">
                {t('masters.contacts')}
              </h3>
              <p className="text-body-sm text-text-secondary">{t('masters.contactsHint')}</p>
            </div>
            {contacts.fields.map((field, index) => {
              const rowErrors = errors.contacts?.[index];
              return (
                <div key={field.id} className="space-y-3 rounded-md border border-border p-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field
                      label={t('masters.contactName')}
                      error={fieldError(rowErrors?.name?.message)}
                    >
                      {(c) => <TextInput {...c} {...register(`contacts.${index}.name`)} />}
                    </Field>
                    <Field label={t('admin.email')} error={fieldError(rowErrors?.email?.message)}>
                      {(c) => (
                        <TextInput {...c} type="email" {...register(`contacts.${index}.email`)} />
                      )}
                    </Field>
                    <Field
                      label={t('masters.phone')}
                      hint={t('admin.mobileHint')}
                      error={fieldError(rowErrors?.phone?.message)}
                    >
                      {(c) => (
                        <TextInput {...c} type="tel" {...register(`contacts.${index}.phone`)} />
                      )}
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <fieldset className="flex flex-wrap gap-4">
                      <legend className="mb-1 text-body-sm font-medium">
                        {t('masters.purposes')}
                      </legend>
                      {vendorContactPurposes.map((purpose) => (
                        <Checkbox
                          key={purpose}
                          label={t(`contactPurpose.${purpose}`)}
                          value={purpose}
                          {...register(`contacts.${index}.purposes`)}
                        />
                      ))}
                      {rowErrors?.purposes?.message && (
                        <p className="w-full text-body-sm text-danger-text">
                          {t(rowErrors.purposes.message)}
                        </p>
                      )}
                    </fieldset>
                    <Button variant="ghost" size="sm" onClick={() => contacts.remove(index)}>
                      {t('masters.remove')}
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button variant="secondary" size="sm" onClick={() => contacts.append(emptyContact())}>
              {t('masters.addContact')}
            </Button>
          </Card>

          {mayEdit && (
            <Button type="submit" loading={isSubmitting}>
              {vendor ? t('admin.save') : t('masters.createVendor')}
            </Button>
          )}
        </fieldset>
      </form>
    </div>
  );
}
