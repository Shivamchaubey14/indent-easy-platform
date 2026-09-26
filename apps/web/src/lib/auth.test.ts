import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '../stores/session';
import { rest } from './api';
import { onSignedOut, refreshSession, signIn, signOut } from './auth';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const tokens = (accessToken: string) => json({ accessToken, expiresIn: 600 });
const refused = () => json({ code: 'AUTH_TOKEN_EXPIRED' }, 401);

let calls: { url: string; init: RequestInit }[];

function serve(handler: Handler) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      calls.push({ url, init });
      return Promise.resolve(handler(url, init));
    }),
  );
}

const header = (init: RequestInit, name: string) =>
  (init.headers as Record<string, string> | undefined)?.[name];

beforeEach(() => {
  useSessionStore.setState({ status: 'unknown', accessToken: null, expiresAt: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('refresh', () => {
  it('shares one refresh between concurrent callers and sends the CSRF token', async () => {
    serve((url) => (url.endsWith('/csrf') ? json({ csrfToken: 'c1' }) : tokens('t1')));
    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(results).toEqual([true, true, true]);
    expect(calls.map((c) => c.url)).toEqual(['/api/v1/auth/csrf', '/api/v1/auth/refresh']);
    expect(header(calls[1]!.init, 'X-CSRF-Token')).toBe('c1');
    expect(useSessionStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 't1' });
  });

  it('ends the session when the server refuses the refresh', async () => {
    const ended = vi.fn();
    const stop = onSignedOut(ended);
    useSessionStore.setState({ status: 'signedIn', accessToken: 'old' });
    serve((url) => (url.endsWith('/csrf') ? json({ csrfToken: 'c' }) : refused()));
    expect(await refreshSession()).toBe(false);
    expect(useSessionStore.getState().status).toBe('signedOut');
    expect(ended).toHaveBeenCalledOnce();
    stop();
  });

  it('keeps the session through a network failure', async () => {
    useSessionStore.setState({ status: 'signedIn', accessToken: 'old' });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );
    await expect(refreshSession()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(useSessionStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'old' });
  });
});

describe('API calls', () => {
  it('refresh a refused access token once and repeat the request', async () => {
    useSessionStore.setState({ status: 'signedIn', accessToken: 'stale' });
    serve((url, init) => {
      if (url.endsWith('/csrf')) return json({ csrfToken: 'c' });
      if (url.endsWith('/refresh')) return tokens('fresh');
      return header(init, 'Authorization') === 'Bearer fresh' ? json({ ok: true }) : refused();
    });
    await expect(rest('/api/v1/version')).resolves.toEqual({ ok: true });
    expect(calls.map((c) => c.url)).toEqual([
      '/api/v1/version',
      '/api/v1/auth/csrf',
      '/api/v1/auth/refresh',
      '/api/v1/version',
    ]);
  });
});

describe('sign-in and sign-out', () => {
  it('keeps the access token in memory and remembers a temporary password', async () => {
    serve(() => json({ accessToken: 'a', expiresIn: 600, mustChangePassword: true }));
    await expect(signIn({ identifier: 'x', password: 'y' })).resolves.toEqual({
      mustChangePassword: true,
    });
    expect(useSessionStore.getState()).toMatchObject({
      accessToken: 'a',
      mustChangePassword: true,
    });
    expect(localStorage.length).toBe(0);
  });

  it('renews an expired token so the server really ends the session', async () => {
    useSessionStore.setState({ status: 'signedIn', accessToken: 'expired' });
    serve((url, init) => {
      if (url.endsWith('/csrf')) return json({ csrfToken: 'c' });
      if (url.endsWith('/refresh')) return tokens('renewed');
      return header(init, 'Authorization') === 'Bearer renewed'
        ? new Response(null, { status: 204 })
        : refused();
    });
    await signOut();
    expect(calls.filter((c) => c.url.endsWith('/logout'))).toHaveLength(2);
    expect(useSessionStore.getState().status).toBe('signedOut');
  });
});
