import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  ErrorState,
  Field,
  Loading,
  SelectInput,
  TextInput,
  useToast,
} from '@ie/ui';
import {
  RESET_POLICIES,
  type UpdateNumberSeriesFormInput,
  updateNumberSeriesInputSchema,
} from '@ie/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { AdminNumberSeriesQuery } from '../../generated/graphql/graphql';
import { ApiRequestError, gql } from '../../lib/api';
import { NumberSeriesQuery, UpdateNumberSeriesMutation } from './api';
import { applyUserErrors } from './shared';

type Series = AdminNumberSeriesQuery['numberSeries'][number];
const FIELDS = ['prefix', 'padding', 'nextValue', 'resetPolicy'];

/** Document numbering (MST-010): prefix, padding, next number (forward only) and yearly reset. */
export function NumberSeriesPage() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Series | null>(null);
  const series = useQuery({
    queryKey: ['admin', 'numberSeries'],
    queryFn: async () => (await gql(NumberSeriesQuery)).numberSeries,
  });

  if (series.isPending) return <Loading />;
  if (series.isError) {
    return (
      <ErrorState
        requestId={series.error instanceof ApiRequestError ? series.error.requestId : undefined}
        onRetry={() => void series.refetch()}
      />
    );
  }

  return (
    <section aria-labelledby="series-title" className="space-y-4">
      <div>
        <h2 id="series-title" className="text-h2 font-semibold">
          {t('admin.numberSeries')}
        </h2>
        <p className="text-body-sm text-text-secondary">{t('admin.numberSeriesHint')}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left">
          <thead className="border-b border-border text-body-sm text-text-secondary">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.document')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.nextNumber')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.resetPolicy')}
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">{t('admin.edit')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {series.data.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  {t(`docType.${s.docType}`, { defaultValue: s.docType })}
                  {(s.location || s.fiscalYear) && (
                    <span className="block text-body-sm text-text-secondary">
                      {[s.location?.name, s.fiscalYear].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold tabular">{s.preview}</td>
                <td className="px-4 py-3">{t(`resetPolicy.${s.resetPolicy}`)}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${t('admin.edit')}: ${t(`docType.${s.docType}`, { defaultValue: s.docType })}`}
                    onClick={() => setEditing(s)}
                  >
                    {t('admin.edit')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <SeriesDialog series={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function SeriesDialog({ series, onClose }: { series: Series; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [problems, setProblems] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateNumberSeriesFormInput>({
    resolver: zodResolver(updateNumberSeriesInputSchema),
    defaultValues: {
      id: series.id,
      prefix: series.prefix,
      padding: series.padding,
      nextValue: series.nextValue,
      resetPolicy: series.resetPolicy as (typeof RESET_POLICIES)[number],
    },
  });
  const [prefix, padding, nextValue] = useWatch({
    control,
    name: ['prefix', 'padding', 'nextValue'],
  });
  const preview =
    Number.isInteger(padding) && Number.isInteger(nextValue)
      ? `${(prefix ?? '').toUpperCase()}${String(nextValue).padStart(padding ?? 1, '0')}`
      : '';
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const save = handleSubmit(async (input) => {
    if (input.nextValue !== undefined && input.nextValue < series.nextValue) {
      setError('nextValue', { message: 'validation.seriesBackwards' });
      return;
    }
    const result = await gql(UpdateNumberSeriesMutation, { input });
    setProblems(applyUserErrors(t, result.updateNumberSeries.userErrors, setError, FIELDS));
    if (result.updateNumberSeries.series) {
      toast({ title: t('admin.saved') });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'numberSeries'] });
      onClose();
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('admin.editSeries', {
        name: t(`docType.${series.docType}`, { defaultValue: series.docType }),
      })}
      description={t('admin.nextNumberHint')}
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
          <Field label={t('admin.prefix')} error={fieldError(errors.prefix?.message)} required>
            {(c) => <TextInput {...c} {...register('prefix')} />}
          </Field>
          <Field label={t('admin.digits')} error={fieldError(errors.padding?.message)} required>
            {(c) => (
              <TextInput
                {...c}
                type="number"
                min={1}
                max={12}
                {...register('padding', { valueAsNumber: true })}
              />
            )}
          </Field>
          <Field
            label={t('admin.nextNumber')}
            error={fieldError(errors.nextValue?.message)}
            required
          >
            {(c) => (
              <TextInput
                {...c}
                type="number"
                min={series.nextValue}
                {...register('nextValue', { valueAsNumber: true })}
              />
            )}
          </Field>
        </div>
        <Field label={t('admin.resetPolicy')}>
          {(c) => (
            <SelectInput {...c} {...register('resetPolicy')}>
              {RESET_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {t(`resetPolicy.${p}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <p className="text-body-sm" aria-live="polite">
          {t('admin.nextIssued')} <span className="font-semibold tabular">{preview}</span>
        </p>
      </form>
    </Dialog>
  );
}
