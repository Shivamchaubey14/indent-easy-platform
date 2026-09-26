import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { ClientError, GraphQLClient } from 'graphql-request';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';

const CLIENT_VERSION = (import.meta.env['VITE_RELEASE'] as string | undefined) ?? '0.1.0';

/** Standard request headers (SRS §26.1): request ID, client identity, language, bearer token. */
function headers(requestId: string): Record<string, string> {
  const locale = useUiStore.getState().locale;
  const token = useSessionStore.getState().accessToken;
  return {
    'X-Request-ID': requestId,
    'X-Client-Name': 'web',
    'X-Client-Version': CLIENT_VERSION,
    'Accept-Language': locale === 'hi' ? 'hi-IN' : 'en-IN',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
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

const graphqlClient = new GraphQLClient(`${location.origin}/graphql`);

export async function gql<TResult, TVariables extends Record<string, unknown>>(
  document: TypedDocumentNode<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
): Promise<TResult> {
  const requestId = crypto.randomUUID();
  try {
    return await graphqlClient.request<TResult>({
      document,
      variables,
      requestHeaders: headers(requestId),
    });
  } catch (err) {
    if (err instanceof ClientError) {
      const first = err.response.errors?.[0];
      const raw = first?.extensions?.['code'];
      const code = typeof raw === 'string' ? raw : 'INTERNAL_ERROR';
      throw new ApiRequestError(
        first?.message ?? 'Request failed',
        code,
        requestId,
        err.response.status,
      );
    }
    throw new ApiRequestError('The server could not be reached.', 'NETWORK_ERROR', requestId);
  }
}

/** JSON REST call (health, version and, later, auth and files). */
export async function rest<T>(path: string): Promise<T> {
  const requestId = crypto.randomUUID();
  let response: Response;
  try {
    response = await fetch(path, { headers: headers(requestId) });
  } catch {
    throw new ApiRequestError('The server could not be reached.', 'NETWORK_ERROR', requestId);
  }
  const body = (await response.json().catch(() => null)) as
    (T & { code?: string; detail?: string }) | null;
  if (!response.ok && response.status !== 503) {
    throw new ApiRequestError(
      body?.detail ?? response.statusText,
      body?.code ?? 'INTERNAL_ERROR',
      requestId,
      response.status,
    );
  }
  return body as T;
}
