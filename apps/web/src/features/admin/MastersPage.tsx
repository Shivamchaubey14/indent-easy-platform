import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Dialog, ErrorState, Field, Loading, TextInput, useToast } from '@ie/ui';
import { type SaveMasterFormInput, saveMasterInputSchema } from '@ie/validation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiRequestError, gql } from '../../lib/api';
import { SaveDepartmentMutation, SaveDesignationMutation } from './api';
import { applyUserErrors, useReferenceData } from './shared';

type Kind = 'department' | 'designation';
interface Row {
  id: string;
  code: string;
  name: string;
}

/** Departments and designations (USR-005): short lists, edited in place. */
export function MastersPage() {
  const { t } = useTranslation();
  const reference = useReferenceData();
  const [editing, setEditing] = useState<{ kind: Kind; row: Row | null } | null>(null);

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

  const list = (kind: Kind, rows: readonly Row[]) => (
    <section aria-labelledby={`${kind}-title`} className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id={`${kind}-title`} className="text-h2 font-semibold">
          {t(kind === 'department' ? 'admin.departments' : 'admin.designations')}
        </h2>
        <Button size="sm" onClick={() => setEditing({ kind, row: null })}>
          {t(kind === 'department' ? 'admin.newDepartment' : 'admin.newDesignation')}
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2">
            <span>
              {row.name}{' '}
              <span className="tabular text-body-sm text-text-secondary">{row.code}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${t('admin.edit')}: ${row.name}`}
              onClick={() => setEditing({ kind, row })}
            >
              {t('admin.edit')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {list('department', reference.data.departments)}
      {list('designation', reference.data.designations)}
      {editing && (
        <MasterDialog kind={editing.kind} row={editing.row} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function MasterDialog({
  kind,
  row,
  onClose,
}: {
  kind: Kind;
  row: Row | null;
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
  } = useForm<SaveMasterFormInput>({
    resolver: zodResolver(saveMasterInputSchema),
    defaultValues: { code: row?.code ?? '', name: row?.name ?? '' },
  });
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const save = handleSubmit(async (input) => {
    const variables = { input: { ...input, ...(row && { id: row.id }) } };
    const userErrors =
      kind === 'department'
        ? (await gql(SaveDepartmentMutation, variables)).saveDepartment.userErrors
        : (await gql(SaveDesignationMutation, variables)).saveDesignation.userErrors;
    setProblems(applyUserErrors(t, userErrors, setError, ['code', 'name']));
    if (userErrors.length === 0) {
      toast({ title: t('admin.saved') });
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    }
  });

  const title =
    kind === 'department'
      ? t(row ? 'admin.editDepartment' : 'admin.newDepartment')
      : t(row ? 'admin.editDesignation' : 'admin.newDesignation');

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
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
          {(control) => <TextInput {...control} {...register('code')} />}
        </Field>
        <Field label={t('admin.name')} error={fieldError(errors.name?.message)} required>
          {(control) => <TextInput {...control} {...register('name')} />}
        </Field>
      </form>
    </Dialog>
  );
}
