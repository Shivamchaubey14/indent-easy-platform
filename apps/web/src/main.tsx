import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { routeTree } from './generated/routeTree.gen';
import { applyLocale } from './i18n';
import { ApiRequestError } from './lib/api';
import { applyTheme, useUiStore } from './stores/ui';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't hammer the API on errors that won't fix themselves.
      retry: (count, error) =>
        count < 2 &&
        !(error instanceof ApiRequestError && error.status !== undefined && error.status < 500),
    },
  },
});

const router = createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Restore persisted preferences before the first paint.
const { theme, locale } = useUiStore.getState();
applyTheme(theme);
applyLocale(locale);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
