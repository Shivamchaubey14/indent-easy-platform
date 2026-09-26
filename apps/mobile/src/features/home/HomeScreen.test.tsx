import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import i18n from '../../i18n';
import { HomeScreen } from './HomeScreen';

function respond(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-1' },
    }),
  );
}

const urlOf = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

function renderHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(() => jest.restoreAllMocks());

describe('HomeScreen', () => {
  it('shows the API as ready, with its version', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) =>
        urlOf(input).endsWith('/api/v1/version')
          ? respond({ version: '0.1.0', commit: '7eb6d90abcdef1234', builtAt: '' })
          : respond({ status: 'ok', checks: { database: { status: 'ok' } } }),
      );
    renderHome();
    expect(await screen.findByText('Ready')).toBeOnTheScreen();
    expect(screen.getByText('0.1.0')).toBeOnTheScreen();
    expect(screen.getByText('7eb6d90abcde')).toBeOnTheScreen();
  });

  it('reports failing checks as not ready', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) =>
        urlOf(input).endsWith('/api/v1/version')
          ? respond({ version: '0.1.0', commit: 'abc', builtAt: '' })
          : respond({ status: 'fail', checks: { redis: { status: 'fail' } } }, 503),
      );
    renderHome();
    expect(await screen.findByText('Not ready')).toBeOnTheScreen();
  });

  it('explains an unreachable server in the user’s language, with a retry', async () => {
    await i18n.changeLanguage('hi');
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    renderHome();
    expect(await screen.findByText(/सर्वर तक नहीं पहुँच सके/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'फिर से कोशिश करें' })).toBeOnTheScreen();
  });
});
