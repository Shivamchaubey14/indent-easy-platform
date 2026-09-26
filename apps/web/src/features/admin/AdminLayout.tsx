import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { meQuery } from '../../lib/me';

export { canAdminister } from '../../lib/access';

/** Which admin sections a permission opens (the API enforces the same rules). */
export const ADMIN_SECTIONS = [
  { to: '/admin/users', label: 'admin.users', permission: 'admin:user_manage' },
  { to: '/admin/roles', label: 'admin.roles', permission: 'admin:role_manage' },
  { to: '/admin/locations', label: 'admin.locations', permission: 'admin:master_manage' },
  { to: '/admin/masters', label: 'admin.masters', permission: 'admin:master_manage' },
] as const;

export function AdminLayout() {
  const { t } = useTranslation();
  const me = useQuery(meQuery);
  const permissions = me.data?.permissions ?? [];
  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <h1 className="text-h1 font-semibold">{t('admin.title')}</h1>
        <nav aria-label={t('admin.title')} className="flex flex-wrap gap-2 border-b border-border">
          {ADMIN_SECTIONS.filter((s) => permissions.includes(s.permission)).map((section) => (
            <Link
              key={section.to}
              to={section.to}
              className="-mb-px border-b-2 border-transparent px-3 py-2 text-text-secondary hover:text-text-primary [&.active]:border-primary [&.active]:font-semibold [&.active]:text-text-primary"
            >
              {t(section.label)}
            </Link>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
