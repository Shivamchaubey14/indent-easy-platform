import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import { useUiStore } from '../stores/ui';

const CLIENT_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const TIMEOUT_MS = 15_000;

/**
 * Where the API lives. EXPO_PUBLIC_API_URL wins (set per environment). In development the API is
 * taken to run on the computer serving the app bundle, on port 4000, so a phone on the same
 * network finds it without configuration.
 */
export function apiBaseUrl(): string {
  const configured = process.env['EXPO_PUBLIC_API_URL'];
  if (configured) return configured.replace(/\/+$/, '');
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${devHost ?? 'localhost'}:4000`;
}

/** An API failure a screen can show: stable code, safe message and the request ID for support. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly requestId: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Standard request headers (SRS §26.1): request ID, client identity and language. */
function headers(requestId: string): Record<string, string> {
  const locale = useUiStore.getState().locale;
  return {
    Accept: 'application/json',
    'X-Request-ID': requestId,
    'X-Client-Name': 'mobile',
    'X-Client-Version': CLIENT_VERSION,
    'Accept-Language': locale === 'hi' ? 'hi-IN' : 'en-IN',
  };
}

/** JSON REST call. 503 is returned as data: the readiness probe uses it to report failing checks. */
export async function rest<T>(path: string): Promise<T> {
  const requestId = randomUUID();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      headers: headers(requestId),
      signal: abort.signal,
    });
  } catch {
    throw new ApiRequestError('The server could not be reached.', 'NETWORK_ERROR', requestId);
  } finally {
    clearTimeout(timer);
  }
  const body = (await response.json().catch(() => null)) as
    (T & { code?: string; detail?: string }) | null;
  if ((!response.ok && response.status !== 503) || body === null) {
    throw new ApiRequestError(
      body?.detail ?? `HTTP ${response.status}`,
      body?.code ?? 'INTERNAL_ERROR',
      response.headers.get('x-request-id') ?? requestId,
      response.status,
    );
  }
  return body;
}
