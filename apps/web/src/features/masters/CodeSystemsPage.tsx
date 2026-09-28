import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Dialog, Field, Loading, TextInput, useToast } from '@ie/ui';
import { type SaveExternalSystemFormInput, saveExternalSystemInputSchema } from '@ie/validation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CatalogReferenceQuery } from '../../generated/graphql/graphql';
import { gql } from '../../lib/api';
import { applyUserErrors } from '../../lib/forms';
import { SaveExternalSystemMutation } from './api';
import { QueryError, Th, useCatalogReference } from './shared';

type SystemRow = CatalogReferenceQuery['externalSystems'][number];
const FIELDS = Object.keys(saveExternalSystemInputSchema.shape);

/**
 * Systems that know products by their own codes (MST-003). Display priority picks the name shown:
 * the lowest number with a code for the product wins, then the internal name; 0 never displays.
 */
export function CodeSystemsPage() {
  const { t } = useTranslation();
  const reference = useCatalogReference();
  const [editing, setEditing] = useState<SystemRow | 'new' | null>(null);

  if (reference.isPending) return <Loading />;
  if (reference.isError) {
    return <QueryError error={reference.error} onRetry={() => void reference.refetch()} />;
  }
  const systems = [...reference.data.externalSystems].sort(
    (a, b) => a.displayPriority - b.displayPriority,
  );

  return (
    <section aria-labelledby="systems-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="systems-title" className="text-h2 font-semibold">
            {t('masters.codeSystems')}
          </h2>
          <p className="text-body-sm text-text-secondary">{t('masters.codeSystemsHint')}</p>
        </div>
        <Button onClick={() => setEditing('new')}>{t('masters.newCodeSystem')}</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[480px] text-left">
          <thead className="border-b border-border text-body-sm text-text-secondary">
            <tr>
              <Th>{t('admin.code')}</Th>
              <Th>{t('admin.name')}</Th>
              <Th>{t('masters.displayPriority')}</Th>
              <Th>
                <span className="sr-only">{t('admin.edit')}</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {systems.map((system) => (
              <tr key={system.id}>
                <td className="px-4 py-3 tabular">{system.code}</td>
                <td className="px-4 py-3">{system.name}</td>
                <td className="px-4 py-3 tabular">
                  {system.displayPriority === 0
                    ? t('masters.neverDisplayed')
                    : system.displayPriority}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${t('admin.edit')}: ${system.name}`}
                    onClick={() => setEditing(system)}
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
        <SystemDialog
          system={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function SystemDialog({ system, onClose }: { system: SystemRow | null; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [problems, setProblems] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SaveExternalSystemFormInput>({
    resolver: zodResolver(saveExternalSystemInputSchema),
    defaultValues: {
      code: system?.code ?? '',
      name: system?.name ?? '',
      displayPriority: system?.displayPriority ?? 10,
    },
  });
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const save = handleSubmit(async (input) => {
    const result = await gql(SaveExternalSystemMutation, {
      input: { ...input, ...(system && { id: system.id }) },
    });
    setProblems(applyUserErrors(t, result.saveExternalSystem.userErrors, setError, FIELDS));
    if (result.saveExternalSystem.externalSystem) {
      toast({ title: t('admin.saved') });
      await queryClient.invalidateQueries({ queryKey: ['masters'] });
      onClose();
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={system ? t('masters.editCodeSystem') : t('masters.newCodeSystem')}
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
        <Field label={t('admin.code')} error={fieldError(errors.code?.message)} required>
          {(c) => <TextInput {...c} {...register('code')} />}
        </Field>
        <Field label={t('admin.name')} error={fieldError(errors.name?.message)} required>
          {(c) => <TextInput {...c} {...register('name')} />}
        </Field>
        <Field
          label={t('masters.displayPriority')}
          hint={t('masters.displayPriorityHint')}
          error={fieldError(errors.displayPriority?.message)}
          required
        >
          {(c) => (
            <TextInput
              {...c}
              type="number"
              min={0}
              max={1000}
              {...register('displayPriority', { valueAsNumber: true })}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
