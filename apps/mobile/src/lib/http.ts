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
    readonly details?: {
      retryAfter?: number;
      fieldErrors?: Record<string, string[]>;
      reason?: string;
    },
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export interface HttpOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string | null;
  /** Statuses that carry a normal answer despite not being 2xx (readiness uses 503). */
  acceptStatus?: number[];
}

type Problem = {
  code?: string;
  detail?: string;
  requestId?: string;
  details?: ApiRequestError['details'];
};

/**
 * One JSON request with the standard headers (SRS §26.1). Mobile identifies itself with
 * `X-Client-Name: mobile`, which makes the API return refresh tokens in the body.
 */
export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const requestId = randomUUID();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Client-Name': 'mobile',
        'X-Client-Version': CLIENT_VERSION,
        'Accept-Language': useUiStore.getState().locale === 'hi' ? 'hi-IN' : 'en-IN',
        ...(options.accessToken && { Authorization: `Bearer ${options.accessToken}` }),
      },
      ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
      signal: abort.signal,
    });
  } catch {
    throw new ApiRequestError('The server could not be reached.', 'NETWORK_ERROR', requestId);
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 202 || response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as (T & Problem) | null;
  if ((!response.ok && !options.acceptStatus?.includes(response.status)) || body === null) {
    const retryAfter = Number(response.headers.get('retry-after')) || undefined;
    throw new ApiRequestError(
      body?.detail ?? `HTTP ${response.status}`,
      body?.code ?? 'INTERNAL_ERROR',
      response.headers.get('x-request-id') ?? requestId,
      response.status,
      { ...body?.details, ...(retryAfter && { retryAfter }) },
    );
  }
  return body;
}
