import {
  Alert,
  Button,
  Card,
  Checkbox,
  Loading,
  SelectInput,
  StatusBadge,
  toneOf,
  useToast,
} from '@ie/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImportKind } from '../../generated/graphql/graphql';
import {
  ApiRequestError,
  type DocumentMeta,
  downloadFile,
  gql,
  rest,
  uploadDocument,
} from '../../lib/api';
import { formatDateTime } from '../../lib/forms';
import {
  CommitImportMutation,
  DiscardImportMutation,
  IMPORT_WORKING,
  importBatchQuery,
  ImportBatchesQuery,
  StartImportMutation,
} from './api';
import { QueryError, Th, usePermissions } from './shared';

/** The master imports and who may run them (the API checks the same permissions). */
const KINDS: readonly { kind: ImportKind; permission: string }[] = [
  { kind: 'PRODUCT_MAPPING', permission: 'product:map_external' },
  { kind: 'VENDOR_PRODUCT', permission: 'vendor:map_products' },
  { kind: 'MPP_MASTER', permission: 'mpp:import' },
];

const ACCEPT =
  '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until the server has checked the uploaded file (checksum, type, malware). */
async function whenAvailable(documentId: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const meta = await rest<DocumentMeta>(`/api/v1/files/${documentId}`);
    if (meta.status === 'AVAILABLE') return;
    if (meta.status === 'QUARANTINED') throw new Error('imports.fileRejected');
    await pause(1000);
  }
  throw new Error('imports.fileCheckSlow');
}

/**
 * Spreadsheet imports of master data (MST-004, MST-007, MST-009): download the template with the
 * current data, fill it in, upload it, check the preview, then apply or discard.
 */
export function ImportsPage() {
  const { t } = useTranslation();
  const can = usePermissions();
  const kinds = KINDS.filter((k) => can(k.permission));
  const [kind, setKind] = useState<ImportKind>(kinds[0]?.kind ?? 'MPP_MASTER');
  const [batchId, setBatchId] = useState<string | null>(null);
  const recent = useQuery({
    queryKey: ['masters', 'imports', kinds.map((k) => k.kind)],
    queryFn: async () =>
      (await gql(ImportBatchesQuery, { kinds: kinds.map((k) => k.kind) })).importBatches,
    enabled: kinds.length > 0,
  });

  return (
    <div className="space-y-6">
      <section aria-labelledby="imports-title" className="space-y-4">
        <div>
          <h2 id="imports-title" className="text-h2 font-semibold">
            {t('imports.title')}
          </h2>
          <p className="text-body-sm text-text-secondary">{t('imports.intro')}</p>
        </div>
        <div className="max-w-sm">
          <SelectInput
            aria-label={t('imports.kind')}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ImportKind);
              setBatchId(null);
            }}
          >
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {t(`importKind.${k.kind}`)}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TemplateCard kind={kind} />
          <UploadCard key={kind} kind={kind} onStarted={setBatchId} />
        </div>
      </section>

      {batchId && <BatchPanel key={batchId} batchId={batchId} onClose={() => setBatchId(null)} />}

      <section aria-labelledby="recent-imports" className="space-y-3">
        <h2 id="recent-imports" className="text-h3 font-semibold">
          {t('imports.recent')}
        </h2>
        {recent.isPending ? (
          <Loading />
        ) : recent.isError ? (
          <QueryError error={recent.error} onRetry={() => void recent.refetch()} />
        ) : recent.data.length === 0 ? (
          <p className="text-text-secondary">{t('imports.noneYet')}</p>
        ) : (
          <RecentImports batches={recent.data} onOpen={setBatchId} />
        )}
      </section>
    </div>
  );
}

function TemplateCard({ kind }: { kind: ImportKind }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await downloadFile(`/api/v1/imports/templates/${kind}`);
    } catch {
      setProblem(t('imports.downloadFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="space-y-3">
      <h3 className="text-h3 font-semibold">{t('imports.step1')}</h3>
      <p className="text-body-sm text-text-secondary">{t(`importKindHint.${kind}`)}</p>
      {problem && <Alert tone="danger">{problem}</Alert>}
      <Button variant="secondary" loading={busy} onClick={() => void download()}>
        {t('imports.downloadTemplate')}
      </Button>
    </Card>
  );
}

function UploadCard({ kind, onStarted }: { kind: ImportKind; onStarted: (id: string) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [step, setStep] = useState<'idle' | 'uploading' | 'checking' | 'starting'>('idle');
  const [problem, setProblem] = useState<string | null>(null);
  // A file already imported: kept so it can be checked again without uploading it again.
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);

  const start = async (documentId: string, force: boolean) => {
    setStep('starting');
    const result = await gql(StartImportMutation, {
      input: {
        kind,
        documentId,
        previewOnly: true,
        force,
        ...(kind === 'MPP_MASTER' && { options: { deactivateMissing } }),
      },
    });
    const error = result.startImport.userErrors[0];
    if (error?.code === 'RECONCILIATION_DUPLICATE_FILE') {
      setDuplicateOf(documentId);
      return;
    }
    if (error) {
      setProblem(t(error.message));
      return;
    }
    setDuplicateOf(null);
    setFile(null);
    if (input.current) input.current.value = '';
    await queryClient.invalidateQueries({ queryKey: ['masters', 'imports'] });
    onStarted(result.startImport.batch!.id);
  };

  const submit = async (force = false) => {
    setProblem(null);
    try {
      if (force && duplicateOf) {
        await start(duplicateOf, true);
        return;
      }
      if (!file) return;
      setStep('uploading');
      const document = await uploadDocument(file, 'IMPORT_FILE');
      setStep('checking');
      await whenAvailable(document.documentId);
      await start(document.documentId, false);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setProblem(
          err.code === 'DOCUMENT_TYPE_NOT_ALLOWED'
            ? t('imports.wrongFileType')
            : err.code === 'DOCUMENT_TOO_LARGE'
              ? t('imports.fileTooLarge')
              : t('imports.uploadFailed'),
        );
      } else {
        setProblem(
          t(
            err instanceof Error && err.message.startsWith('imports.')
              ? err.message
              : 'imports.uploadFailed',
          ),
        );
      }
    } finally {
      setStep('idle');
    }
  };

  return (
    <Card className="space-y-3">
      <h3 className="text-h3 font-semibold">{t('imports.step2')}</h3>
      <p className="text-body-sm text-text-secondary">{t('imports.step2Hint')}</p>
      <label className="block">
        <span className="sr-only">{t('imports.chooseFile')}</span>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="block w-full text-body-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:font-semibold file:text-secondary-foreground"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setDuplicateOf(null);
            setProblem(null);
          }}
        />
      </label>
      {kind === 'MPP_MASTER' && (
        <Checkbox
          label={t('imports.deactivateMissing')}
          description={t('imports.deactivateMissingHint')}
          checked={deactivateMissing}
          onChange={(e) => setDeactivateMissing(e.target.checked)}
        />
      )}
      {problem && <Alert tone="danger">{problem}</Alert>}
      {duplicateOf && (
        <Alert tone="warning">
          <p>{t('validation.importDuplicateFile')}</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => void submit(true)}>
            {t('imports.checkAgainAnyway')}
          </Button>
        </Alert>
      )}
      <div className="flex items-center gap-3">
        <Button
          disabled={!file || step !== 'idle'}
          loading={step !== 'idle'}
          onClick={() => void submit()}
        >
          {t('imports.check')}
        </Button>
        {step !== 'idle' && (
          <span className="text-body-sm text-text-secondary" aria-live="polite">
            {t(`imports.step_${step}`)}
          </span>
        )}
      </div>
    </Card>
  );
}

function Summary({ summary }: { summary: Record<string, number> }) {
  const { t } = useTranslation();
  const keys = ['created', 'updated', 'unchanged', 'deactivated', 'rejected', 'warnings'] as const;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {keys.map((key) => (
        <div key={key} className="rounded-md border border-border px-3 py-2">
          <dt className="text-caption text-text-secondary">{t(`imports.count_${key}`)}</dt>
          <dd className="text-h3 font-semibold tabular">{summary[key] ?? 0}</dd>
        </div>
      ))}
    </dl>
  );
}

function BatchPanel({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const batch = useQuery(importBatchQuery(batchId));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (batch.isPending) return <Loading />;
  if (batch.isError) {
    return <QueryError error={batch.error} onRetry={() => void batch.refetch()} />;
  }
  const data = batch.data;
  if (!data) return null;
  const working = IMPORT_WORKING.includes(data.status);

  const act = async (action: 'commit' | 'discard') => {
    setBusy(true);
    setProblem(null);
    try {
      const errors =
        action === 'commit'
          ? (await gql(CommitImportMutation, { batchId })).commitImport.userErrors
          : (await gql(DiscardImportMutation, { batchId })).discardImport.userErrors;
      if (errors[0]) setProblem(t(errors[0].message));
      else {
        toast({ title: t(action === 'commit' ? 'imports.applying' : 'imports.discarded') });
        if (action === 'discard') onClose();
      }
      await queryClient.invalidateQueries({ queryKey: ['masters'] });
    } finally {
      setBusy(false);
    }
  };

  const errors = data.errors.edges.map((e) => e.node);
  const hindi = i18n.language.startsWith('hi');
  return (
    <Card aria-labelledby="batch-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="batch-title" className="text-h3 font-semibold">
            {data.fileName}
          </h2>
          <p className="text-body-sm text-text-secondary">
            {t(`importKind.${data.kind}`)} · {formatDateTime(t, i18n.language, data.createdAt)}
          </p>
        </div>
        <StatusBadge tone={toneOf(data.status)}>{t(`importStatus.${data.status}`)}</StatusBadge>
      </div>

      {working && (
        <div aria-live="polite" className="space-y-2">
          <p>
            {t(data.status === 'PROCESSING' ? 'imports.applyingProgress' : 'imports.checking', {
              pct: data.progressPct,
            })}
          </p>
          <progress
            className="h-2 w-full accent-primary"
            max={100}
            value={data.status === 'PROCESSING' ? data.progressPct : undefined}
            aria-label={t(`importStatus.${data.status}`)}
          />
        </div>
      )}

      {data.summary && <Summary summary={data.summary} />}
      {data.status === 'PREVIEW_READY' && <Alert tone="info">{t('imports.previewNote')}</Alert>}
      {problem && <Alert tone="danger">{problem}</Alert>}

      {errors.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">
            {t('imports.problems', { count: data.errors.totalCount ?? errors.length })}
          </h3>
          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-left text-body-sm">
              <thead className="sticky top-0 border-b border-border bg-surface text-text-secondary">
                <tr>
                  <Th>{t('imports.row')}</Th>
                  <Th>{t('imports.column')}</Th>
                  <Th>{t('imports.value')}</Th>
                  <Th>{t('imports.problem')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {errors.map((e, i) => (
                  <tr key={i} className="align-top">
                    <td className="px-4 py-2 tabular">{e.rowIndex || '—'}</td>
                    <td className="px-4 py-2">{e.field}</td>
                    <td className="px-4 py-2 tabular">{e.value}</td>
                    <td className="px-4 py-2">
                      <StatusBadge tone={e.critical ? 'danger' : 'warning'}>
                        {t(e.critical ? 'imports.rejected' : 'imports.warning')}
                      </StatusBadge>{' '}
                      {/* The server's text names the specifics (which product, which row); in Hindi the
                          rule's translation, which also says what to do, stands in for it. */}
                      {hindi ? t(`importRule.${e.rule}`, { defaultValue: e.message }) : e.message}
                      {e.suggestion && !hindi && (
                        <span className="block text-caption text-text-secondary">
                          {e.suggestion}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(data.errors.totalCount ?? 0) > errors.length && (
            <p className="text-caption text-text-secondary">{t('imports.moreInReport')}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {data.status === 'PREVIEW_READY' && (
          <>
            <Button loading={busy} onClick={() => void act('commit')}>
              {t('imports.apply')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void act('discard')}>
              {t('imports.discard')}
            </Button>
          </>
        )}
        {data.resultDocument?.downloadUrl && (
          <a
            href={data.resultDocument.downloadUrl}
            className="inline-flex h-10 items-center rounded-md border border-border px-4 font-semibold text-link hover:bg-surface-muted"
          >
            {t('imports.downloadReport')}
          </a>
        )}
      </div>
    </Card>
  );
}

function RecentImports({
  batches,
  onOpen,
}: {
  batches: readonly {
    id: string;
    kind: string;
    fileName: string;
    status: string;
    createdAt: string;
  }[];
  onOpen: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[560px] text-left">
        <thead className="border-b border-border text-body-sm text-text-secondary">
          <tr>
            <Th>{t('imports.file')}</Th>
            <Th>{t('imports.kind')}</Th>
            <Th>{t('imports.when')}</Th>
            <Th>{t('admin.status')}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {batches.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-3">
                <button
                  type="button"
                  className="font-medium text-link underline-offset-2 hover:underline"
                  onClick={() => onOpen(b.id)}
                >
                  {b.fileName}
                </button>
              </td>
              <td className="px-4 py-3">{t(`importKind.${b.kind}`)}</td>
              <td className="px-4 py-3 text-body-sm text-text-secondary">
                {formatDateTime(t, i18n.language, b.createdAt)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={toneOf(b.status)}>{t(`importStatus.${b.status}`)}</StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
