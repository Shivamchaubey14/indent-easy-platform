import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Dialog, Field, Loading, SelectInput, TextInput, useToast } from '@ie/ui';
import {
  type SaveUomConversionFormInput,
  type SaveUomFormInput,
  saveUomConversionInputSchema,
  saveUomInputSchema,
} from '@ie/validation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CatalogReferenceQuery } from '../../generated/graphql/graphql';
import { gql } from '../../lib/api';
import { applyUserErrors } from '../../lib/forms';
import { DeleteUomConversionMutation, SaveUomConversionMutation, SaveUomMutation } from './api';
import { QueryError, Th, useCatalogReference, usePermissions } from './shared';

type UomRow = CatalogReferenceQuery['uoms'][number];
type ConversionRow = CatalogReferenceQuery['uomConversions'][number];

/**
 * Units of measure and the conversions between them (MST-005). Stock is always held in a product's
 * base unit; conversions are for entry and display. Product-specific conversions are kept with
 * the product.
 */
export function UnitsPage() {
  const { t, i18n } = useTranslation();
  const can = usePermissions();
  const reference = useCatalogReference();
  const [editingUom, setEditingUom] = useState<UomRow | 'new' | null>(null);
  const [addingConversion, setAddingConversion] = useState(false);
  const [removing, setRemoving] = useState<ConversionRow | null>(null);
  const mayManage = can('admin:master_manage');

  if (reference.isPending) return <Loading />;
  if (reference.isError) {
    return <QueryError error={reference.error} onRetry={() => void reference.refetch()} />;
  }
  const { uoms, uomConversions } = reference.data;
  const number = new Intl.NumberFormat(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
    maximumFractionDigits: 6,
  });

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <section aria-labelledby="uoms-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 id="uoms-title" className="text-h2 font-semibold">
            {t('masters.units')}
          </h2>
          {mayManage && (
            <Button size="sm" onClick={() => setEditingUom('new')}>
              {t('masters.newUnit')}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left">
            <thead className="border-b border-border text-body-sm text-text-secondary">
              <tr>
                <Th>{t('admin.code')}</Th>
                <Th>{t('admin.name')}</Th>
                <Th>{t('masters.decimals')}</Th>
                <Th>
                  <span className="sr-only">{t('admin.edit')}</span>
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {uoms.map((uom) => (
                <tr key={uom.id}>
                  <td className="px-4 py-2 tabular">{uom.code}</td>
                  <td className="px-4 py-2">
                    {uom.name}
                    {uom.nameHi && (
                      <span lang="hi" className="block text-body-sm text-text-secondary">
                        {uom.nameHi}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 tabular">{uom.decimalsAllowed}</td>
                  <td className="px-4 py-2 text-right">
                    {mayManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${t('admin.edit')}: ${uom.code}`}
                        onClick={() => setEditingUom(uom)}
                      >
                        {t('admin.edit')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="conversions-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 id="conversions-title" className="text-h2 font-semibold">
            {t('masters.conversions')}
          </h2>
          {mayManage && (
            <Button size="sm" onClick={() => setAddingConversion(true)}>
              {t('masters.newConversion')}
            </Button>
          )}
        </div>
        <p className="text-body-sm text-text-secondary">{t('masters.conversionsHint')}</p>
        {uomConversions.length === 0 ? (
          <p className="text-text-secondary">{t('masters.noConversions')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {uomConversions.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="tabular">
                  1 {c.from.code} = {number.format(Number(c.factor))} {c.to.code}
                </span>
                {mayManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${t('masters.remove')}: ${c.from.code} → ${c.to.code}`}
                    onClick={() => setRemoving(c)}
                  >
                    {t('masters.remove')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editingUom && (
        <UomDialog
          uom={editingUom === 'new' ? null : editingUom}
          onClose={() => setEditingUom(null)}
        />
      )}
      {addingConversion && (
        <ConversionDialog uoms={uoms} onClose={() => setAddingConversion(false)} />
      )}
      {removing && (
        <RemoveConversionDialog conversion={removing} onClose={() => setRemoving(null)} />
      )}
    </div>
  );
}

function UomDialog({ uom, onClose }: { uom: UomRow | null; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [problems, setProblems] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SaveUomFormInput>({
    resolver: zodResolver(saveUomInputSchema),
    defaultValues: {
      code: uom?.code ?? '',
      name: uom?.name ?? '',
      nameHi: uom?.nameHi ?? '',
      decimalsAllowed: uom?.decimalsAllowed ?? 0,
    },
  });
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const save = handleSubmit(async (input) => {
    const result = await gql(SaveUomMutation, { input: { ...input, ...(uom && { id: uom.id }) } });
    setProblems(
      applyUserErrors(
        t,
        result.saveUom.userErrors,
        setError,
        Object.keys(saveUomInputSchema.shape),
      ),
    );
    if (result.saveUom.uom) {
      toast({ title: t('admin.saved') });
      await queryClient.invalidateQueries({ queryKey: ['masters'] });
      onClose();
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={uom ? t('masters.editUnit') : t('masters.newUnit')}
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
        {problems.length > 0 && <Alert tone="danger">{problems.join(' ')}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('admin.code')} error={fieldError(errors.code?.message)} required>
            {(c) => <TextInput {...c} {...register('code')} />}
          </Field>
          <Field
            label={t('masters.decimals')}
            hint={t('masters.decimalsHint')}
            error={fieldError(errors.decimalsAllowed?.message)}
            required
          >
            {(c) => (
              <TextInput
                {...c}
                type="number"
                min={0}
                max={3}
                {...register('decimalsAllowed', { valueAsNumber: true })}
              />
            )}
          </Field>
          <Field label={t('admin.name')} error={fieldError(errors.name?.message)} required>
            {(c) => <TextInput {...c} {...register('name')} />}
          </Field>
          <Field label={t('admin.nameHi')} error={fieldError(errors.nameHi?.message)}>
            {(c) => <TextInput {...c} lang="hi" {...register('nameHi')} />}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

function ConversionDialog({ uoms, onClose }: { uoms: readonly UomRow[]; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [problems, setProblems] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SaveUomConversionFormInput>({
    resolver: zodResolver(saveUomConversionInputSchema),
    defaultValues: { fromUomId: '', toUomId: '', factor: '' },
  });
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const save = handleSubmit(async (input) => {
    const result = await gql(SaveUomConversionMutation, { input });
    setProblems(
      applyUserErrors(t, result.saveUomConversion.userErrors, setError, [
        'fromUomId',
        'toUomId',
        'factor',
      ]),
    );
    if (result.saveUomConversion.conversion) {
      toast({ title: t('admin.saved') });
      await queryClient.invalidateQueries({ queryKey: ['masters'] });
      onClose();
    }
  });

  const unitSelect = (name: 'fromUomId' | 'toUomId', label: string, error?: string) => (
    <Field label={label} error={fieldError(error)} required>
      {(c) => (
        <SelectInput {...c} {...register(name)}>
          <option value="">{t('admin.choose')}</option>
          {uoms.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code}
            </option>
          ))}
        </SelectInput>
      )}
    </Field>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('masters.newConversion')}
      description={t('masters.conversionExample')}
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
        {problems.length > 0 && <Alert tone="danger">{problems.join(' ')}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          {unitSelect('fromUomId', t('masters.fromUnit'), errors.fromUomId?.message)}
          <Field label={t('masters.factor')} error={fieldError(errors.factor?.message)} required>
            {(c) => <TextInput {...c} inputMode="decimal" {...register('factor')} />}
          </Field>
          {unitSelect('toUomId', t('masters.toUnit'), errors.toUomId?.message)}
        </div>
      </form>
    </Dialog>
  );
}

function RemoveConversionDialog({
  conversion,
  onClose,
}: {
  conversion: ConversionRow;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const remove = async () => {
    setBusy(true);
    try {
      const result = await gql(DeleteUomConversionMutation, { id: conversion.id });
      setProblems(applyUserErrors(t, result.deleteUomConversion.userErrors));
      if (result.deleteUomConversion.deletedId) {
        toast({ title: t('masters.removed') });
        await queryClient.invalidateQueries({ queryKey: ['masters'] });
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('masters.removeConversion', {
        from: conversion.from.code,
        to: conversion.to.code,
      })}
      description={t('masters.removeConversionBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('admin.cancel')}
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void remove()}>
            {t('masters.remove')}
          </Button>
        </>
      }
    >
      {problems.length > 0 && <Alert tone="danger">{problems.join(' ')}</Alert>}
    </Dialog>
  );
}
