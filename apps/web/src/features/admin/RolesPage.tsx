import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  ErrorState,
  Field,
  Loading,
  StatusBadge,
  TextInput,
  useToast,
} from '@ie/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError, gql } from '../../lib/api';
import { SaveRoleMutation } from './api';
import { applyUserErrors, roleName, useReferenceData } from './shared';

interface Draft {
  id: string | null;
  code: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

/** Permission codes grouped by resource (`indent:create` → indent), in catalogue order. */
function groupPermissions(codes: readonly string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const code of codes) {
    const [resource = code] = code.split(':');
    groups.set(resource, [...(groups.get(resource) ?? []), code]);
  }
  return [...groups];
}

/** Roles and what they allow (USR-003). System roles can be edited but not renamed by code. */
export function RolesPage() {
  const { t } = useTranslation();
  const reference = useReferenceData();
  const [draft, setDraft] = useState<Draft | null>(null);

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
  const { roles, permissionCatalogue } = reference.data;

  return (
    <section aria-labelledby="roles-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="roles-title" className="text-h2 font-semibold">
          {t('admin.roles')}
        </h2>
        <Button
          onClick={() =>
            setDraft({
              id: null,
              code: '',
              name: '',
              description: '',
              permissions: [],
              isSystem: false,
            })
          }
        >
          {t('admin.newRole')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left">
          <thead className="border-b border-border text-body-sm text-text-secondary">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.name')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.roleCode')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.permissions')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('admin.users')}
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">{t('admin.edit')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {roles.map((role) => (
              <tr key={role.id}>
                <td className="px-4 py-3">
                  <span className="font-medium">{roleName(t, role)}</span>{' '}
                  <StatusBadge tone={role.isSystem ? 'neutral' : 'info'}>
                    {role.isSystem ? t('admin.systemRole') : t('admin.customRole')}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 tabular text-body-sm">{role.code}</td>
                <td className="px-4 py-3 text-body-sm">
                  {t('admin.permissionCount', { count: role.permissions.length })}
                </td>
                <td className="px-4 py-3 tabular">{role.userCount}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${t('admin.edit')}: ${roleName(t, role)}`}
                    onClick={() =>
                      setDraft({
                        id: role.id,
                        code: role.code,
                        name: role.name,
                        description: role.description ?? '',
                        permissions: role.permissions,
                        isSystem: role.isSystem,
                      })
                    }
                  >
                    {t('admin.edit')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft && (
        <RoleDialog
          key={draft.id ?? 'new'}
          draft={draft}
          catalogue={permissionCatalogue}
          onClose={() => setDraft(null)}
        />
      )}
    </section>
  );
}

function RoleDialog({
  draft,
  catalogue,
  onClose,
}: {
  draft: Draft;
  catalogue: readonly string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(draft);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toggle = (code: string) =>
    setValue((v) => ({
      ...v,
      permissions: v.permissions.includes(code)
        ? v.permissions.filter((p) => p !== code)
        : [...v.permissions, code],
    }));

  const save = async () => {
    setBusy(true);
    try {
      const result = await gql(SaveRoleMutation, {
        input: {
          ...(value.id && { id: value.id }),
          code: value.code,
          name: value.name,
          description: value.description || null,
          permissions: value.permissions,
        },
      });
      setProblems(applyUserErrors(t, result.saveRole.userErrors));
      if (result.saveRole.role) {
        toast({ title: t('admin.saved') });
        await queryClient.invalidateQueries({ queryKey: ['admin'] });
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
      title={draft.id ? t('admin.editRole') : t('admin.newRole')}
      className="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('admin.cancel')}
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {t('admin.saveRole')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {problems.length > 0 && (
          <Alert tone="danger">
            {problems.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('admin.roleCode')} hint={t('admin.roleCodeHint')} required>
            {(control) => (
              <TextInput
                {...control}
                value={value.code}
                readOnly={value.isSystem}
                onChange={(e) => setValue((v) => ({ ...v, code: e.target.value }))}
              />
            )}
          </Field>
          <Field label={t('admin.name')} required>
            {(control) => (
              <TextInput
                {...control}
                value={value.name}
                onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))}
              />
            )}
          </Field>
        </div>
        <Field label={t('admin.description')}>
          {(control) => (
            <TextInput
              {...control}
              value={value.description}
              onChange={(e) => setValue((v) => ({ ...v, description: e.target.value }))}
            />
          )}
        </Field>
        <fieldset className="space-y-3">
          <legend className="text-body-sm font-medium">
            {t('admin.permissions')} ({value.permissions.length})
          </legend>
          <div className="grid max-h-[50vh] gap-4 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
            {groupPermissions(catalogue).map(([resource, codes]) => (
              <div key={resource} className="space-y-1">
                <p className="font-semibold">
                  {t(`permissionGroup.${resource}`, { defaultValue: resource })}
                </p>
                {codes.map((code) => (
                  <Checkbox
                    key={code}
                    label={<span className="tabular text-body-sm">{code}</span>}
                    checked={value.permissions.includes(code)}
                    onChange={() => toggle(code)}
                  />
                ))}
              </div>
            ))}
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}
