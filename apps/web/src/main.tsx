import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { UiProviders } from './components/UiProviders';
import { routeTree } from './generated/routeTree.gen';
import { applyLocale } from './i18n';
import { onSignedOut } from './lib/auth';
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

// When the session ends (sign-out here or in another tab, or a refused refresh), forget every
// cached server answer and go to sign-in.
onSignedOut(() => {
  queryClient.clear();
  void router.navigate({ to: '/login' });
});

// Restore persisted preferences before the first paint.
const { theme, locale } = useUiStore.getState();
applyTheme(theme);
applyLocale(locale);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UiProviders>
        <RouterProvider router={router} />
      </UiProviders>
    </QueryClientProvider>
  </StrictMode>,
);
