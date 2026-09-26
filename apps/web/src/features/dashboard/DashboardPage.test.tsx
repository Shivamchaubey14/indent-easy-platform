import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLocale } from '../../i18n';
import { ApiRequestError, gql, rest } from '../../lib/api';
import type * as ApiModule from '../../lib/api';
import { UiProviders } from '../../components/UiProviders';
import { DashboardPage } from './DashboardPage';

vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  gql: vi.fn(),
  rest: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UiProviders>
        <DashboardPage />
      </UiProviders>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  applyLocale('en');
  vi.mocked(rest).mockImplementation(async (path: string) =>
    path === '/api/v1/version'
      ? { version: '0.1.0', commit: '7eb6d90abcdef', builtAt: '2026-09-25T00:00:00Z' }
      : {
          status: 'ok',
          checks: {
            database: { status: 'ok' },
            redis: { status: 'ok' },
            migrations: { status: 'ok' },
          },
        },
  );
  vi.mocked(gql).mockResolvedValue({
    featureFlags: [
      { key: 'hindi_ui', enabled: true, description: 'Hindi user interface' },
      { key: 'mfa', enabled: false, description: null },
    ],
  });
});

describe('DashboardPage', () => {
  it('shows live system status and feature flags', async () => {
    renderPage();
    expect(await screen.findByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('migrations')).toBeInTheDocument();
    expect(screen.getByText('7eb6d90abcde')).toBeInTheDocument();
    expect(await screen.findByText('hindi_ui')).toBeInTheDocument();
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('shows an error with the request ID instead of internals', async () => {
    vi.mocked(gql).mockRejectedValue(
      new ApiRequestError('boom', 'INTERNAL_ERROR', 'req-1234', 500),
    );
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong.');
    expect(alert).toHaveTextContent('Reference: req-1234');
    expect(alert).not.toHaveTextContent('boom');
  });

  it('explains an empty flag list', async () => {
    vi.mocked(gql).mockResolvedValue({ featureFlags: [] });
    renderPage();
    expect(
      await screen.findByText('No feature flags are set up for this organisation yet.'),
    ).toBeInTheDocument();
  });
});
