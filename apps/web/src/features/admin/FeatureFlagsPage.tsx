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
import type { FeatureFlagRules } from '@ie/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError, gql } from '../../lib/api';
import { FeatureFlagsQuery, SetFeatureFlagMutation } from './api';

const ENVIRONMENTS = ['local', 'dev', 'qa', 'staging', 'prod'] as const;

interface Flag {
  key: string;
  enabled: boolean;
  rules?: unknown;
  description?: string | null;
}

const rulesOf = (flag: Flag) => (flag.rules ?? {}) as FeatureFlagRules;

/** Feature flags (§55.3): on/off per organisation, optionally narrowed by environment or share. */
export function FeatureFlagsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Flag | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const flags = useQuery({
    queryKey: ['admin', 'featureFlags'],
    queryFn: async () => (await gql(FeatureFlagsQuery)).featureFlags,
  });

  const set = async (flag: Flag, enabled: boolean, rules: FeatureFlagRules | null) => {
    setBusy(flag.key);
    setProblem(null);
    try {
      await gql(SetFeatureFlagMutation, { input: { key: flag.key, enabled, rules } });
      toast({ title: t('admin.saved') });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'featureFlags'] });
      await queryClient.invalidateQueries({ queryKey: ['featureFlags'] });
      return true;
    } catch {
      setProblem(t('admin.flagNotSaved'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (flags.isPending) return <Loading />;
  if (flags.isError) {
    return (
      <ErrorState
        requestId={flags.error instanceof ApiRequestError ? flags.error.requestId : undefined}
        onRetry={() => void flags.refetch()}
      />
    );
  }

  return (
    <section aria-labelledby="flags-title" className="space-y-4">
      <div>
        <h2 id="flags-title" className="text-h2 font-semibold">
          {t('admin.featureFlags')}
        </h2>
        <p className="text-body-sm text-text-secondary">{t('admin.featureFlagsHint')}</p>
      </div>
      {problem && <Alert tone="danger">{problem}</Alert>}
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {flags.data.map((flag) => {
          const rules = rulesOf(flag);
          const narrowed =
            rules.environments?.length ||
            rules.percentage !== undefined ||
            rules.roleCodes?.length ||
            rules.locationIds?.length;
          return (
            <li
              key={flag.key}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {t(`flag.${flag.key}`, { defaultValue: flag.description ?? flag.key })}
                  </span>
                  <StatusBadge tone={flag.enabled ? 'success' : 'neutral'}>
                    {flag.enabled ? t('admin.on') : t('admin.off')}
                  </StatusBadge>
                </div>
                <p className="text-caption text-text-secondary">
                  <code>{flag.key}</code>
                  {narrowed ? ` · ${describeRules(t, rules)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  label={
                    <span className="sr-only">
                      {t(`flag.${flag.key}`, { defaultValue: flag.key })}
                    </span>
                  }
                  checked={flag.enabled}
                  disabled={busy === flag.key}
                  onChange={(e) => void set(flag, e.target.checked, flag.rules ? rules : null)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${t('admin.targeting')}: ${flag.key}`}
                  onClick={() => setEditing(flag)}
                >
                  {t('admin.targeting')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {editing && (
        <RulesDialog
          flag={editing}
          onClose={() => setEditing(null)}
          onSave={async (rules) => {
            if (await set(editing, editing.enabled, rules)) setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function describeRules(
  t: (key: string, options?: Record<string, unknown>) => string,
  rules: FeatureFlagRules,
): string {
  const parts: string[] = [];
  if (rules.environments?.length) parts.push(rules.environments.join(', '));
  if (rules.percentage !== undefined)
    parts.push(t('admin.percentOfUsers', { pct: rules.percentage }));
  if (rules.roleCodes?.length)
    parts.push(t('admin.limitedToRoles', { count: rules.roleCodes.length }));
  if (rules.locationIds?.length)
    parts.push(t('admin.limitedToLocations', { count: rules.locationIds.length }));
  return parts.join(' · ');
}

function RulesDialog({
  flag,
  onClose,
  onSave,
}: {
  flag: Flag;
  onClose: () => void;
  onSave: (rules: FeatureFlagRules | null) => Promise<void>;
}) {
  const { t } = useTranslation();
  const current = rulesOf(flag);
  const [environments, setEnvironments] = useState<string[]>(current.environments ?? []);
  const [percentage, setPercentage] = useState(
    current.percentage === undefined ? '' : String(current.percentage),
  );
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const pct = percentage.trim() === '' ? undefined : Number(percentage);
    if (pct !== undefined && (!Number.isInteger(pct) || pct < 0 || pct > 100)) {
      setError(t('validation.outOfRange'));
      return;
    }
    // Role and location rules are kept as they are; this dialog edits environment and share.
    const rules: FeatureFlagRules = {
      ...(current.roleCodes && { roleCodes: current.roleCodes }),
      ...(current.locationIds && { locationIds: current.locationIds }),
      ...(environments.length > 0 && {
        environments: environments as FeatureFlagRules['environments'],
      }),
      ...(pct !== undefined && { percentage: pct }),
    };
    setBusy(true);
    try {
      await onSave(Object.keys(rules).length > 0 ? rules : null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('admin.targetingFor', { name: t(`flag.${flag.key}`, { defaultValue: flag.key }) })}
      description={t('admin.targetingHint')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('admin.cancel')}
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {t('admin.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-body-sm font-medium">{t('admin.environments')}</legend>
          <p className="text-caption text-text-secondary">{t('admin.environmentsHint')}</p>
          <div className="flex flex-wrap gap-4">
            {ENVIRONMENTS.map((env) => (
              <Checkbox
                key={env}
                label={env.toUpperCase()}
                checked={environments.includes(env)}
                onChange={() =>
                  setEnvironments((list) =>
                    list.includes(env) ? list.filter((e) => e !== env) : [...list, env],
                  )
                }
              />
            ))}
          </div>
        </fieldset>
        <Field label={t('admin.rolloutPercentage')} hint={t('admin.rolloutHint')} error={error}>
          {(c) => (
            <TextInput
              {...c}
              className="w-24"
              type="number"
              min={0}
              max={100}
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
