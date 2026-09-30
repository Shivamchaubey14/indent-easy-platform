import { Alert, Button, Loading, StatusBadge, TextInput } from '@ie/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Fragment, useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminAuditLogQuery } from '../../generated/graphql/graphql';
import { ApiRequestError, gql } from '../../lib/api';
import { AuditChainCheckQuery, AuditLogQuery } from './api';
import { formatDateTime } from './shared';

type Entry = AdminAuditLogQuery['auditLog']['edges'][number]['node'];
const PAGE = 25;

/** Fields whose value differs between the before and after snapshots. */
function changes(before: unknown, after: unknown) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(b), ...Object.keys(a)])]
    .filter((key) => JSON.stringify(b[key] ?? null) !== JSON.stringify(a[key] ?? null))
    .map((key) => ({ key, before: b[key] ?? null, after: a[key] ?? null }));
}

const show = (value: unknown) =>
  value === null ? '—' : typeof value === 'string' ? value : JSON.stringify(value);

/** Audit viewer (AUD-003): who changed what and when, with the fields that changed. */
export function AuditPage() {
  const { t, i18n } = useTranslation();
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [requestId, setRequestId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [open, setOpen] = useState<string | null>(null);
  const deferredAction = useDeferredValue(action.trim().toUpperCase());
  const deferredEntity = useDeferredValue(entityType.trim());
  const filter = {
    ...(deferredAction && { action: deferredAction }),
    ...(deferredEntity && { entityType: deferredEntity }),
    ...(requestId.trim() && { requestId: requestId.trim() }),
    ...((from || to) && {
      occurredAt: {
        ...(from && { from: new Date(`${from}T00:00:00`).toISOString() }),
        ...(to && { to: new Date(`${to}T23:59:59.999`).toISOString() }),
      },
    }),
  };
  const after = cursors.at(-1) ?? null;
  const log = useQuery({
    queryKey: ['admin', 'audit', filter, after],
    queryFn: async () =>
      (await gql(AuditLogQuery, { filter, pagination: { first: PAGE, after } })).auditLog,
    placeholderData: keepPreviousData,
  });
  const reset = () => setCursors([null]);

  const input = (label: string, value: string, set: (v: string) => void, isDate = false) => (
    <TextInput
      type={isDate ? 'date' : 'text'}
      aria-label={label}
      placeholder={isDate ? undefined : label}
      value={value}
      onChange={(e) => {
        set(e.target.value);
        reset();
      }}
    />
  );

  return (
    <div className="space-y-6">
      <section aria-labelledby="audit-title" className="space-y-4">
        <h2 id="audit-title" className="text-h2 font-semibold">
          {t('admin.audit')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {input(t('admin.auditAction'), action, setAction)}
          {input(t('admin.auditEntity'), entityType, setEntityType)}
          {input(t('admin.requestId'), requestId, setRequestId)}
          {input(t('admin.from'), from, setFrom, true)}
          {input(t('admin.to'), to, setTo, true)}
        </div>
        {log.isPending ? (
          <Loading />
        ) : log.isError ? (
          <Alert tone="danger">
            {t('state.error')}{' '}
            {log.error instanceof ApiRequestError && (
              <span className="text-caption">({log.error.requestId})</span>
            )}
          </Alert>
        ) : log.data.edges.length === 0 ? (
          <p className="text-text-secondary">{t('admin.noAudit')}</p>
        ) : (
          <>
            <p className="text-body-sm text-text-secondary" aria-live="polite">
              {t('admin.auditCount', { count: log.data.totalCount ?? 0 })}
            </p>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full min-w-[720px] text-left text-body-sm">
                <thead className="border-b border-border text-text-secondary">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('admin.when')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('admin.who')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('admin.auditAction')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('admin.auditEntity')}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">{t('admin.details')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {log.data.edges.map(({ node }) => (
                    <Fragment key={node.id}>
                      <tr className="align-top">
                        <td className="px-4 py-2 whitespace-nowrap">
                          {formatDateTime(t, i18n.language, node.occurredAt)}
                        </td>
                        <td className="px-4 py-2">
                          {node.actor?.displayName ?? t('admin.system')}
                        </td>
                        <td className="px-4 py-2">
                          <code>{node.action}</code>
                        </td>
                        <td className="px-4 py-2">
                          {node.entityType}
                          {node.entityNumber && (
                            <span className="block text-caption text-text-secondary">
                              {node.entityNumber}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-expanded={open === node.id}
                            onClick={() => setOpen(open === node.id ? null : node.id)}
                          >
                            {t('admin.details')}
                          </Button>
                        </td>
                      </tr>
                      {open === node.id && (
                        <tr>
                          <td colSpan={5} className="bg-surface-muted px-4 py-3">
                            <Details entry={node} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button
                variant="secondary"
                size="sm"
                disabled={cursors.length === 1}
                onClick={() => setCursors((c) => c.slice(0, -1))}
              >
                {t('admin.previous')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!log.data.pageInfo.hasNextPage}
                onClick={() => setCursors((c) => [...c, log.data.pageInfo.endCursor ?? null])}
              >
                {t('admin.next')}
              </Button>
            </div>
          </>
        )}
      </section>
      <ChainCheck />
    </div>
  );
}

function Details({ entry }: { entry: Entry }) {
  const { t } = useTranslation();
  const changed = changes(entry.before, entry.after);
  return (
    <div className="space-y-2">
      {changed.length === 0 ? (
        <p className="text-text-secondary">{t('admin.noFieldChanges')}</p>
      ) : (
        <table className="w-full text-left">
          <thead className="text-caption text-text-secondary">
            <tr>
              <th scope="col" className="py-1 pr-4 font-medium">
                {t('admin.field')}
              </th>
              <th scope="col" className="py-1 pr-4 font-medium">
                {t('admin.before')}
              </th>
              <th scope="col" className="py-1 font-medium">
                {t('admin.after')}
              </th>
            </tr>
          </thead>
          <tbody>
            {changed.map((c) => (
              <tr key={c.key} className="align-top">
                <td className="py-1 pr-4 font-medium">{c.key}</td>
                <td className="py-1 pr-4 break-all text-text-secondary">{show(c.before)}</td>
                <td className="py-1 break-all">{show(c.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-caption text-text-secondary">
        {entry.channel && `${entry.channel} · `}
        {entry.requestId && `${t('admin.requestId')}: ${entry.requestId}`}
      </p>
    </div>
  );
}

function ChainCheck() {
  const { t } = useTranslation();
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [asked, setAsked] = useState<string | null>(null);
  const result = useQuery({
    queryKey: ['admin', 'auditChain', asked],
    queryFn: async () => (await gql(AuditChainCheckQuery, { day: asked! })).auditChainCheck,
    enabled: asked !== null,
  });
  return (
    <section aria-labelledby="chain-title" className="space-y-3">
      <h2 id="chain-title" className="text-h3 font-semibold">
        {t('admin.chainCheck')}
      </h2>
      <p className="text-body-sm text-text-secondary">{t('admin.chainCheckHint')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <TextInput
          type="date"
          aria-label={t('admin.day')}
          className="w-44"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={!day}
          loading={result.isFetching}
          onClick={() => {
            setAsked(day);
            if (asked === day) void result.refetch();
          }}
        >
          {t('admin.checkChain')}
        </Button>
        {result.data && (
          <span aria-live="polite" className="flex items-center gap-2">
            <StatusBadge tone={result.data.intact ? 'success' : 'danger'}>
              {result.data.intact ? t('admin.chainIntact') : t('admin.chainBroken')}
            </StatusBadge>
            <span className="text-body-sm text-text-secondary">
              {t('admin.chainRecords', { count: result.data.records })}
              {result.data.brokenAt &&
                ` · ${t('admin.chainBrokenAt', { id: result.data.brokenAt })}`}
            </span>
          </span>
        )}
      </div>
    </section>
  );
}
