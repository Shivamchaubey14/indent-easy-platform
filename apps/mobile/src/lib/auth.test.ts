import * as SecureStore from 'expo-secure-store';
import { useSessionStore } from '../stores/session';
import { gql } from './api';
import { onSignedOut, refreshSession, restoreSession, signIn, signOut } from './auth';

jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    setItemAsync: jest.fn(
      (key: string, value: string) => (values.set(key, value), Promise.resolve()),
    ),
    getItemAsync: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    deleteItemAsync: jest.fn((key: string) => (values.delete(key), Promise.resolve())),
  };
});
jest.mock('expo-device', () => ({ manufacturer: 'Samsung', modelName: 'Galaxy A15' }));

const KEY = 'ie.refresh-token';
const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
const tokens = (access: string, refresh: string) =>
  json({ accessToken: access, expiresIn: 600, refreshToken: refresh });
const refused = () => json({ code: 'AUTH_TOKEN_EXPIRED' }, 401);

type Call = { url: string; init: RequestInit };
let calls: Call[];

function serve(handler: (url: string, init: RequestInit) => Promise<Response>) {
  calls = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return handler(url, init);
  });
}

const header = (init: RequestInit, name: string) =>
  (init.headers as Record<string, string> | undefined)?.[name];
const bodyOf = (init: RequestInit) => JSON.parse(init.body as string) as Record<string, unknown>;

beforeEach(async () => {
  await SecureStore.deleteItemAsync(KEY);
  useSessionStore.setState({ status: 'unknown', accessToken: null, mustChangePassword: false });
});

afterEach(() => jest.restoreAllMocks());

describe('sign-in', () => {
  it('keeps the refresh token in secure storage and the access token in memory', async () => {
    serve(() => tokens('a1', 'r1'));
    await signIn({ identifier: 'store@shwetdhara.in', password: 'x' });
    expect(await SecureStore.getItemAsync(KEY)).toBe('r1');
    expect(useSessionStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'a1' });
    const [login] = calls;
    expect(header(login!.init, 'X-Client-Name')).toBe('mobile');
    expect(bodyOf(login!.init)).toMatchObject({ deviceName: 'Samsung Galaxy A15' });
  });
});

describe('refresh', () => {
  it('rotates the stored token', async () => {
    await SecureStore.setItemAsync(KEY, 'r1');
    serve(() => tokens('a2', 'r2'));
    expect(await refreshSession()).toBe(true);
    expect(bodyOf(calls[0]!.init)).toEqual({ refreshToken: 'r1' });
    expect(await SecureStore.getItemAsync(KEY)).toBe('r2');
  });

  it('forgets the session when the server refuses the token', async () => {
    const ended = jest.fn();
    const stop = onSignedOut(ended);
    await SecureStore.setItemAsync(KEY, 'r1');
    useSessionStore.setState({ status: 'signedIn', accessToken: 'a1' });
    serve(refused);
    expect(await refreshSession()).toBe(false);
    expect(await SecureStore.getItemAsync(KEY)).toBeNull();
    expect(useSessionStore.getState().status).toBe('signedOut');
    expect(ended).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stays signed in when the phone is offline at launch', async () => {
    await SecureStore.setItemAsync(KEY, 'r1');
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    await restoreSession();
    expect(useSessionStore.getState().status).toBe('signedIn');
    expect(await SecureStore.getItemAsync(KEY)).toBe('r1');
  });

  it('starts signed out when nothing is stored', async () => {
    await restoreSession();
    expect(useSessionStore.getState().status).toBe('signedOut');
  });
});

describe('API calls', () => {
  it('refresh a refused token once and repeat the request', async () => {
    await SecureStore.setItemAsync(KEY, 'r1');
    useSessionStore.setState({ status: 'signedIn', accessToken: 'stale' });
    serve((url, init) => {
      if (url.endsWith('/auth/refresh')) return tokens('fresh', 'r2');
      return header(init, 'Authorization') === 'Bearer fresh'
        ? json({ data: { me: { id: 'u1' } } })
        : refused();
    });
    await expect(gql('{ me { id } }')).resolves.toEqual({ me: { id: 'u1' } });
  });
});

describe('sign-out', () => {
  it('forgets the session on the phone even when the server is unreachable', async () => {
    await SecureStore.setItemAsync(KEY, 'r1');
    useSessionStore.setState({ status: 'signedIn', accessToken: 'a1' });
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    await signOut();
    expect(await SecureStore.getItemAsync(KEY)).toBeNull();
    expect(useSessionStore.getState().status).toBe('signedOut');
  });
});
