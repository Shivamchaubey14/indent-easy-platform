import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { UiProviders } from '../components/UiProviders';

/**
 * Renders a screen at `path` inside a real router (so Link and navigate work), TanStack Query and
 * the UI providers. Other paths render a marker, so tests can see where navigation went.
 */
export async function renderScreen(screen: () => ReactNode, path = '/screen') {
  const root = createRootRoute({ component: Outlet });
  const routes = [
    createRoute({ getParentRoute: () => root, path, component: screen }),
    createRoute({
      getParentRoute: () => root,
      path: '$',
      component: function Elsewhere() {
        return <p data-testid="navigated">{router.state.location.pathname}</p>;
      },
    }),
  ];
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <UiProviders>
        <RouterProvider router={router} />
      </UiProviders>
    </QueryClientProvider>,
  );
  await router.load();
  return { ...view, router };
}
