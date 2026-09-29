import { Button, Card, ErrorState, Field, Loading, TextInput, useToast } from '@ie/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminSettingsQuery } from '../../generated/graphql/graphql';
import { ApiRequestError, gql } from '../../lib/api';
import { SettingsQuery, UpdateSettingMutation } from './api';
import { formatDateTime } from './shared';

type Setting = AdminSettingsQuery['settings'][number];

/**
 * System settings (ADM-003): typed values with their defaults. Each is added with the feature
 * that uses it; the server validates every value.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => (await gql(SettingsQuery)).settings,
  });

  if (settings.isPending) return <Loading />;
  if (settings.isError) {
    return (
      <ErrorState
        requestId={settings.error instanceof ApiRequestError ? settings.error.requestId : undefined}
        onRetry={() => void settings.refetch()}
      />
    );
  }
  return (
    <section aria-labelledby="settings-title" className="space-y-4">
      <div>
        <h2 id="settings-title" className="text-h2 font-semibold">
          {t('admin.settings')}
        </h2>
        <p className="text-body-sm text-text-secondary">{t('admin.settingsHint')}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {settings.data.map((setting) => (
          <SettingCard key={`${setting.key}:${JSON.stringify(setting.value)}`} setting={setting} />
        ))}
      </div>
    </section>
  );
}

function SettingCard({ setting }: { setting: Setting }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState(String(setting.value));
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const input = setting.input;

  const save = async (value: unknown) => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await gql(UpdateSettingMutation, { key: setting.key, value });
      const problem = result.updateSetting.userErrors[0];
      if (problem) setError(t(problem.message));
      else {
        toast({ title: t('admin.saved') });
        await queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      }
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    const number = Number(text.trim());
    if (text.trim() === '' || Number.isNaN(number)) {
      setError(t('validation.decimal'));
      return;
    }
    void save(number);
  };

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-semibold">
          {t(`setting.${setting.key}.label`, { defaultValue: setting.key })}
        </h3>
        <p className="text-body-sm text-text-secondary">
          {t(`setting.${setting.key}.hint`, { defaultValue: '' })}
        </p>
      </div>
      <Field
        label={t('admin.value')}
        hint={t('admin.settingRange', {
          min: input.min,
          max: input.max,
          unit: input.unit ?? '',
          value: String(setting.defaultValue),
        })}
        error={error}
      >
        {(c) => (
          <div className="flex items-center gap-2">
            <TextInput
              {...c}
              className="w-32"
              inputMode="decimal"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {input.unit && <span aria-hidden="true">{input.unit}</span>}
          </div>
        )}
      </Field>
      <p className="text-caption text-text-secondary">
        {setting.isDefault
          ? t('admin.settingIsDefault')
          : t('admin.settingChanged', {
              who: setting.updatedBy?.displayName ?? '—',
              when: formatDateTime(t, i18n.language, setting.updatedAt),
            })}
        {setting.source && ` · ${t('admin.settingSource', { source: setting.source })}`}
      </p>
      <div className="flex gap-2">
        <Button size="sm" loading={busy} onClick={submit}>
          {t('admin.save')}
        </Button>
        {!setting.isDefault && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void save(setting.defaultValue)}
          >
            {t('admin.useDefault')}
          </Button>
        )}
      </div>
    </Card>
  );
}
