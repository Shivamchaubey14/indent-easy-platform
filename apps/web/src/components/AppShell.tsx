import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../stores/ui';
import { LanguageToggle, ThemeSelect } from './Preferences';

// Workspaces from SRS §38.1; each is enabled as its phase is built.
const NAV = [
  { key: 'dashboard', to: '/', enabled: true },
  { key: 'indents', enabled: false },
  { key: 'approvals', enabled: false },
  { key: 'purchase', enabled: false },
  { key: 'inventory', enabled: false },
  { key: 'logistics', enabled: false },
  { key: 'mppSales', enabled: false },
  { key: 'finance', enabled: false },
  { key: 'reports', enabled: false },
  { key: 'admin', enabled: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const collapsed = useUiStore((s) => s.navCollapsed);
  const toggleNav = useUiStore((s) => s.toggleNav);

  return (
    <div className="flex min-h-screen bg-background text-text-primary">
      <nav
        aria-label={t('nav.main')}
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface md:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-md bg-primary text-caption font-bold text-primary-foreground"
          >
            IE
          </span>
          {!collapsed && <span className="font-semibold">{t('app.name')}</span>}
        </div>
        <ul className="flex-1 space-y-1 p-2">
          {NAV.map((item) => (
            <li key={item.key}>
              {item.enabled ? (
                <Link
                  to={item.to}
                  className="flex h-10 items-center rounded-md px-3 text-text-secondary hover:bg-surface-muted [&.active]:bg-secondary [&.active]:font-semibold [&.active]:text-secondary-foreground"
                  activeOptions={{ exact: true }}
                >
                  {collapsed ? t(`nav.${item.key}`).slice(0, 1) : t(`nav.${item.key}`)}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="flex h-10 cursor-not-allowed items-center justify-between rounded-md px-3 text-disabled-text"
                >
                  {collapsed ? t(`nav.${item.key}`).slice(0, 1) : t(`nav.${item.key}`)}
                  {!collapsed && <span className="text-caption">{t('nav.soon')}</span>}
                </span>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={toggleNav}
          aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
          className="m-2 h-9 rounded-md text-text-secondary hover:bg-surface-muted"
        >
          {collapsed ? '»' : '«'}
        </button>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-end gap-3 border-b border-border bg-surface px-4">
          <ThemeSelect />
          <LanguageToggle />
          <Link to="/login" className="text-body-sm text-link underline-offset-2 hover:underline">
            {t('login.title')}
          </Link>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
