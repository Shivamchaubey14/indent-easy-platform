import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  Field,
  Loading,
  SelectInput,
  StatusBadge,
  TextInput,
  useToast,
} from '@ie/ui';
import { type SaveMppFormInput, saveMppInputSchema } from '@ie/validation';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { MppStatus, MasterMppsQuery } from '../../generated/graphql/graphql';
import { gql } from '../../lib/api';
import { applyUserErrors } from '../../lib/forms';
import { mppsQuery, SaveMppMutation } from './api';
import {
  activeTone,
  Pager,
  QueryError,
  Th,
  useCatalogReference,
  useCursorPages,
  usePermissions,
} from './shared';

const CYCLE_BANDS = ['DAYS_1_10', 'DAYS_11_20', 'DAYS_21_31'] as const;
const FIELDS = Object.keys(saveMppInputSchema.shape);
type MppRow = MasterMppsQuery['mpps']['edges'][number]['node'];

/** MPPs (MST-008): village milk pooling points, each served by a BMC or MCC. */
export function MppsPage() {
  const { t } = useTranslation();
  const can = usePermissions();
  const reference = useCatalogReference();
  const [search, setSearch] = useState('');
  const [bmc, setBmc] = useState('');
  const [status, setStatus] = useState<MppStatus | ''>('ACTIVE');
  const [editing, setEditing] = useState<MppRow | 'new' | null>(null);
  const pages = useCursorPages();
  const term = useDeferredValue(search.trim());
  const filter = {
    ...(term && { search: term }),
    ...(bmc && { bmcLocationIds: [bmc] }),
    ...(status && { status: [status] }),
  };
  const mpps = useQuery({ ...mppsQuery(filter, pages.after), placeholderData: keepPreviousData });
  const centres = (reference.data?.locations ?? []).filter(
    (l) => l.type === 'BMC' || l.type === 'MCC',
  );
  const mayManage = can('mpp:manage');

  return (
    <section aria-labelledby="mpps-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="mpps-title" className="text-h2 font-semibold">
          {t('masters.mpps')}
        </h2>
        {mayManage && <Button onClick={() => setEditing('new')}>{t('masters.newMpp')}</Button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <TextInput
          type="search"
          aria-label={t('admin.search')}
          placeholder={t('masters.searchMpps')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            pages.reset();
          }}
        />
        <SelectInput
          aria-label={t('masters.bmc')}
          value={bmc}
          onChange={(e) => {
            setBmc(e.target.value);
            pages.reset();
          }}
        >
          <option value="">{t('masters.allCentres')}</option>
          {centres.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.code})
            </option>
          ))}
        </SelectInput>
        <SelectInput
          aria-label={t('admin.status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as MppStatus | '');
            pages.reset();
          }}
        >
          <option value="">{t('admin.allStatuses')}</option>
          <option value="ACTIVE">{t('masterStatus.ACTIVE')}</option>
          <option value="INACTIVE">{t('masterStatus.INACTIVE')}</option>
        </SelectInput>
      </div>

      {mpps.isPending ? (
        <Loading />
      ) : mpps.isError ? (
        <QueryError error={mpps.error} onRetry={() => void mpps.refetch()} />
      ) : mpps.data.mpps.edges.length === 0 ? (
        <p className="text-text-secondary">{t('masters.noMpps')}</p>
      ) : (
        <>
          <p className="text-body-sm text-text-secondary" aria-live="polite">
            {t('masters.mppCount', { count: mpps.data.mpps.totalCount ?? 0 })}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-border text-body-sm text-text-secondary">
                <tr>
                  <Th>{t('admin.code')}</Th>
                  <Th>{t('admin.name')}</Th>
                  <Th>{t('masters.bmc')}</Th>
                  <Th>{t('masters.sahayak')}</Th>
                  <Th>{t('masters.cycleBand')}</Th>
                  <Th>{t('admin.status')}</Th>
                  <Th>
                    <span className="sr-only">{t('admin.edit')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mpps.data.mpps.edges.map(({ node }) => (
                  <tr key={node.id} className="align-top">
                    <td className="px-4 py-3 tabular">{node.code}</td>
                    <td className="px-4 py-3">
                      {node.name}
                      {node.village && (
                        <span className="block text-body-sm text-text-secondary">
                          {node.village}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{node.bmc.name}</td>
                    <td className="px-4 py-3">
                      {node.sahayakName}
                      {node.sahayakMobile && (
                        <span className="block text-body-sm text-text-secondary tabular">
                          {node.sahayakMobile}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {node.cycleBand && t(`cycleBand.${node.cycleBand}`)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={activeTone(node.status)}>
                        {t(`masterStatus.${node.status}`)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {mayManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`${t('admin.edit')}: ${node.name}`}
                          onClick={() => setEditing(node)}
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
          <Pager pages={pages} pageInfo={mpps.data.mpps.pageInfo} />
        </>
      )}
      {editing && (
        <MppDialog
          mpp={editing === 'new' ? null : editing}
          centres={centres.filter((l) => l.active)}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function MppDialog({
  mpp,
  centres,
  onClose,
}: {
  mpp: MppRow | null;
  centres: readonly { id: string; code: string; name: string }[];
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
  } = useForm<SaveMppFormInput>({
    resolver: zodResolver(saveMppInputSchema),
    defaultValues: {
      code: mpp?.code ?? '',
      name: mpp?.name ?? '',
      bmcLocationId: mpp?.bmc.id ?? '',
      sahayakName: mpp?.sahayakName ?? '',
      sahayakMobile: mpp?.sahayakMobile ?? '',
      cycleBand: mpp?.cycleBand ?? null,
      village: mpp?.village ?? '',
      status: mpp?.status ?? 'ACTIVE',
    },
  });
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const save = handleSubmit(async (input) => {
    const result = await gql(SaveMppMutation, {
      input: { ...input, ...(mpp && { id: mpp.id }) },
    });
    setProblems(applyUserErrors(t, result.saveMpp.userErrors, setError, FIELDS));
    if (result.saveMpp.mpp) {
      toast({ title: t('admin.saved') });
      await queryClient.invalidateQueries({ queryKey: ['masters'] });
      onClose();
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={mpp ? t('masters.editMpp') : t('masters.newMpp')}
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
          <Field label={t('masters.mppCode')} error={fieldError(errors.code?.message)} required>
            {(c) => <TextInput {...c} {...register('code')} />}
          </Field>
          <Field label={t('admin.name')} error={fieldError(errors.name?.message)} required>
            {(c) => <TextInput {...c} {...register('name')} />}
          </Field>
          <Field
            label={t('masters.bmc')}
            error={fieldError(errors.bmcLocationId?.message)}
            required
          >
            {(c) => (
              <SelectInput {...c} {...register('bmcLocationId')}>
                <option value="">{t('admin.choose')}</option>
                {centres.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t('masters.cycleBand')} error={fieldError(errors.cycleBand?.message)}>
            {(c) => (
              <SelectInput
                {...c}
                {...register('cycleBand', { setValueAs: (v: string) => v || null })}
              >
                <option value="">{t('admin.none')}</option>
                {CYCLE_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {t(`cycleBand.${band}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t('masters.sahayakName')} error={fieldError(errors.sahayakName?.message)}>
            {(c) => <TextInput {...c} {...register('sahayakName')} />}
          </Field>
          <Field
            label={t('masters.sahayakMobile')}
            hint={t('admin.mobileHint')}
            error={fieldError(errors.sahayakMobile?.message)}
          >
            {(c) => <TextInput {...c} type="tel" {...register('sahayakMobile')} />}
          </Field>
          <Field label={t('masters.village')} error={fieldError(errors.village?.message)}>
            {(c) => <TextInput {...c} {...register('village')} />}
          </Field>
          <Field label={t('admin.status')}>
            {(c) => (
              <SelectInput {...c} {...register('status')}>
                <option value="ACTIVE">{t('masterStatus.ACTIVE')}</option>
                <option value="INACTIVE">{t('masterStatus.INACTIVE')}</option>
              </SelectInput>
            )}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
