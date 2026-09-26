import { Button, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@ie/ui';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { signOut } from '../lib/auth';
import { meQuery } from '../lib/me';
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
          <AccountMenu />
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

/** Who is signed in, with password change and sign-out. */
function AccountMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useQuery(meQuery);
  const name = me.data?.displayName ?? t('auth.account');
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('auth.signedInAs', { name })}>
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-full bg-secondary text-caption font-semibold text-secondary-foreground"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden max-w-40 truncate sm:inline">{name}</span>
        </Button>
      </MenuTrigger>
      <MenuContent>
        {me.data && (
          <div className="px-3 py-2 text-body-sm text-text-secondary">
            <div className="truncate font-medium text-text-primary">{me.data.displayName}</div>
            <div className="truncate">{me.data.email}</div>
          </div>
        )}
        <MenuSeparator />
        <MenuItem onSelect={() => void navigate({ to: '/change-password' })}>
          {t('auth.changePassword')}
        </MenuItem>
        <MenuItem onSelect={() => void signOut()}>{t('auth.signOut')}</MenuItem>
      </MenuContent>
    </Menu>
  );
}
