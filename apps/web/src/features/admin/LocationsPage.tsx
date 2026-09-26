import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  ErrorState,
  Field,
  Loading,
  SelectInput,
  StatusBadge,
  TextInput,
  useToast,
} from '@ie/ui';
import { type SaveLocationFormInput, saveLocationInputSchema } from '@ie/validation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiRequestError, gql } from '../../lib/api';
import { SaveLocationMutation } from './api';
import { applyUserErrors, useReferenceData } from './shared';

const TYPES = ['HEAD_OFFICE', 'BMC', 'MCC', 'PLANT', 'WAREHOUSE', 'OTHER'] as const;
const FIELDS = Object.keys(saveLocationInputSchema.shape);

type LocationRow = NonNullable<ReturnType<typeof useReferenceData>['data']>['locations'][number];

/** Locations (USR-004): head office, BMCs, MCCs, plants and warehouses. */
export function LocationsPage() {
  const { t } = useTranslation();
  const reference = useReferenceData();
  const [editing, setEditing] = useState<LocationRow | 'new' | null>(null);

  if (reference.isPending) return <Loading />;
  if (reference.isError) {
    return (
      <ErrorState
        requestId={
          reference.error instanceof ApiRequestError ? reference.error.requestId : undefined
        }
        onRetry={() => void reference.refetch()}
      />
    );
  }

  return (
    <section aria-labelledby="locations-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="locations-title" className="text-h2 font-semibold">
          {t('admin.locations')}
        </h2>
        <Button onClick={() => setEditing('new')}>{t('admin.newLocation')}</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left">
          <thead className="border-b border-border text-body-sm text-text-secondary">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.code')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.name')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.type')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.sapPlantCode')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.status')}
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">{t('admin.edit')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {reference.data.locations.map((location) => (
              <tr key={location.id}>
                <td className="px-4 py-3 tabular">{location.code}</td>
                <td className="px-4 py-3">
                  {location.name}
                  {location.nameHi && (
                    <span lang="hi" className="block text-body-sm text-text-secondary">
                      {location.nameHi}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{t(`locationType.${location.type}`)}</td>
                <td className="px-4 py-3 tabular">{location.sapPlantCode}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={location.active ? 'success' : 'neutral'}>
                    {location.active ? t('admin.active') : t('admin.inactive')}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${t('admin.edit')}: ${location.name}`}
                    onClick={() => setEditing(location)}
                  >
                    {t('admin.edit')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <LocationDialog
          location={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function LocationDialog({
  location,
  onClose,
}: {
  location: LocationRow | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [problems, setProblems] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SaveLocationFormInput>({
    resolver: zodResolver(saveLocationInputSchema),
    defaultValues: {
      code: location?.code ?? '',
      name: location?.name ?? '',
      nameHi: location?.nameHi ?? '',
      type: location?.type ?? 'BMC',
      sapPlantCode: location?.sapPlantCode ?? '',
      address: location?.address ?? '',
      excludedFromCrossView: location?.excludedFromCrossView ?? false,
      active: location?.active ?? true,
    },
  });
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const save = handleSubmit(async (input) => {
    const result = await gql(SaveLocationMutation, {
      input: { ...input, ...(location && { id: location.id }) },
    });
    setProblems(applyUserErrors(t, result.saveLocation.userErrors, setError, FIELDS));
    if (result.saveLocation.location) {
      toast({ title: t('admin.saved') });
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={location ? t('admin.editLocation') : t('admin.newLocation')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('admin.cancel')}
          </Button>
          <Button loading={isSubmitting} onClick={() => void save()}>
            {t('admin.save')}
          </Button>
        </>
      }
    >
      <form noValidate onSubmit={(e) => void save(e)} className="space-y-4">
        {problems.length > 0 && (
          <Alert tone="danger">
            {problems.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('admin.code')} error={fieldError(errors.code?.message)} required>
            {(control) => <TextInput {...control} {...register('code')} />}
          </Field>
          <Field label={t('admin.type')} required>
            {(control) => (
              <SelectInput {...control} {...register('type')}>
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`locationType.${type}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t('admin.name')} error={fieldError(errors.name?.message)} required>
            {(control) => <TextInput {...control} {...register('name')} />}
          </Field>
          <Field label={t('admin.nameHi')} error={fieldError(errors.nameHi?.message)}>
            {(control) => <TextInput {...control} lang="hi" {...register('nameHi')} />}
          </Field>
          <Field label={t('admin.sapPlantCode')} error={fieldError(errors.sapPlantCode?.message)}>
            {(control) => <TextInput {...control} {...register('sapPlantCode')} />}
          </Field>
        </div>
        <Field label={t('admin.address')} error={fieldError(errors.address?.message)}>
          {(control) => <TextInput {...control} {...register('address')} />}
        </Field>
        <Checkbox label={t('admin.excludedFromCrossView')} {...register('excludedFromCrossView')} />
        <Checkbox label={t('admin.active')} {...register('active')} />
      </form>
    </Dialog>
  );
}
