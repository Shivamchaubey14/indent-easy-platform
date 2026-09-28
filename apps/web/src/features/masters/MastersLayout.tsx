import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { MASTER_SECTIONS } from '../../lib/access';
import { meQuery } from '../../lib/me';

export function MastersLayout() {
  const { t } = useTranslation();
  const me = useQuery(meQuery);
  const permissions = me.data?.permissions ?? [];
  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <h1 className="text-h1 font-semibold">{t('masters.title')}</h1>
        <nav
          aria-label={t('masters.title')}
          className="flex flex-wrap gap-2 border-b border-border"
        >
          {MASTER_SECTIONS.filter((s) => s.permissions.some((p) => permissions.includes(p))).map(
            (section) => (
              <Link
                key={section.to}
                to={section.to}
                className="-mb-px border-b-2 border-transparent px-3 py-2 text-text-secondary hover:text-text-primary [&.active]:border-primary [&.active]:font-semibold [&.active]:text-text-primary"
              >
                {t(section.label)}
              </Link>
            ),
          )}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
