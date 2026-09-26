import type { QueryClient } from '@tanstack/react-query';
import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: NotFound,
});

function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-screen place-items-center bg-background p-4 text-center">
      <div>
        <h1 className="text-h1 font-semibold">{t('notFound.title')}</h1>
        <p className="mt-2 text-text-secondary">{t('notFound.body')}</p>
        <Link to="/" className="mt-4 inline-block text-link underline">
          {t('notFound.home')}
        </Link>
      </div>
    </main>
  );
}
