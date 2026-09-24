import { useTranslation } from 'react-i18next';
import { applyLocale, type Locale } from '../i18n';
import { applyTheme, useUiStore, type ThemePreference } from '../stores/ui';

export function LanguageToggle() {
  const { t } = useTranslation();
  const locale = useUiStore((s) => s.locale);
  const setLocale = useUiStore((s) => s.setLocale);
  const choose = (next: Locale) => {
    setLocale(next);
    applyLocale(next);
  };
  return (
    <div
      role="group"
      aria-label={t('topbar.language')}
      className="inline-flex rounded-md border border-border-control"
    >
      {(
        [
          ['en', 'EN'],
          ['hi', 'हिं'],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          lang={value}
          aria-pressed={locale === value}
          onClick={() => choose(value)}
          className={`h-8 px-3 text-body-sm first:rounded-l-md last:rounded-r-md ${
            locale === value
              ? 'bg-primary text-primary-foreground'
              : 'text-text-secondary hover:bg-surface-muted'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ThemeSelect() {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <label className="inline-flex items-center gap-2 text-body-sm text-text-secondary">
      <span>{t('topbar.theme')}</span>
      <select
        value={theme}
        onChange={(e) => {
          const next = e.target.value as ThemePreference;
          setTheme(next);
          applyTheme(next);
        }}
        className="h-8 rounded-md border border-border-control bg-surface-input px-2 text-text-primary"
      >
        <option value="system">{t('topbar.themeSystem')}</option>
        <option value="light">{t('topbar.themeLight')}</option>
        <option value="dark">{t('topbar.themeDark')}</option>
      </select>
    </label>
  );
}
