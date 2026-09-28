import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { ClientError, GraphQLClient } from 'graphql-request';
import { useSessionStore } from '../stores/session';
import { refreshSession } from './auth';
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

/**
 * Runs a request; if the access token was refused (expired, or older than a role change), gets a
 * new one from the refresh cookie and tries once more.
 */
async function withFreshToken<T>(send: () => Promise<T>): Promise<T> {
  try {
    return await send();
  } catch (err) {
    const refusedToken = err instanceof ApiRequestError && err.code === 'AUTH_TOKEN_EXPIRED';
    if (
      refusedToken &&
      useSessionStore.getState().status === 'signedIn' &&
      (await refreshSession())
    ) {
      return send();
    }
    throw err;
  }
}

const graphqlClient = new GraphQLClient(`${location.origin}/graphql`);

export function gql<TResult, TVariables extends Record<string, unknown>>(
  document: TypedDocumentNode<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
): Promise<TResult> {
  return withFreshToken(() => sendGql(document, variables as TVariables | undefined));
}

async function sendGql<TResult, TVariables extends Record<string, unknown>>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables | undefined,
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
      // A refused token is answered before GraphQL runs, as a REST problem with a top-level code.
      const raw = first?.extensions?.['code'] ?? (err.response as { code?: unknown }).code;
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

/** JSON REST call (health, version, files). Sign-in calls live in ./auth. */
export function rest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  return withFreshToken(() => sendRest<T>(path, init));
}

async function sendRest<T>(path: string, init: { method?: string; body?: unknown }): Promise<T> {
  const requestId = crypto.randomUUID();
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? 'GET',
      headers: {
        ...headers(requestId),
        ...(init.body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    });
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

export interface DocumentMeta {
  documentId: string;
  status:
    'PENDING_UPLOAD' | 'PENDING_SCAN' | 'AVAILABLE' | 'QUARANTINED' | 'SUPERSEDED' | 'DELETED';
  fileName: string;
}

/** Hex SHA-256 of a file, as the upload intent needs it. */
async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Uploads a file as a document (SRS §35.2): asks for a signed URL, PUTs the file straight to
 * object storage (never through the API) and confirms. The document is then checked by the
 * server; wait for AVAILABLE before using it.
 */
export async function uploadDocument(file: File, documentType: string): Promise<DocumentMeta> {
  const intent = await rest<{
    documentId: string;
    upload: { url: string; headers?: Record<string, string> };
  }>('/api/v1/files/upload-intents', {
    method: 'POST',
    body: {
      documentType,
      fileName: file.name,
      mimeType: file.type || mimeFromName(file.name),
      sizeBytes: file.size,
      sha256: await sha256(file),
    },
  });
  const requestId = crypto.randomUUID();
  let stored: Response;
  try {
    stored = await fetch(intent.upload.url, {
      method: 'PUT',
      headers: intent.upload.headers ?? {},
      body: file,
    });
  } catch {
    throw new ApiRequestError('The file could not be uploaded.', 'NETWORK_ERROR', requestId);
  }
  if (!stored.ok) {
    throw new ApiRequestError(
      'The file could not be uploaded.',
      'UPLOAD_FAILED',
      requestId,
      stored.status,
    );
  }
  return rest<DocumentMeta>(`/api/v1/files/${intent.documentId}/complete`, { method: 'POST' });
}

/** Browsers leave the type empty for some files (CSV on Windows); fall back on the extension. */
function mimeFromName(name: string): string {
  const extension = name.toLowerCase().split('.').pop();
  if (extension === 'csv') return 'text/csv';
  if (extension === 'xlsx')
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (extension === 'xls') return 'application/vnd.ms-excel';
  return 'application/octet-stream';
}

/** Downloads a file the API streams (e.g. an import template) and saves it under its name. */
export function downloadFile(path: string): Promise<void> {
  return withFreshToken(async () => {
    const requestId = crypto.randomUUID();
    let response: Response;
    try {
      response = await fetch(path, { headers: headers(requestId) });
    } catch {
      throw new ApiRequestError('The server could not be reached.', 'NETWORK_ERROR', requestId);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { code?: string } | null;
      throw new ApiRequestError(
        response.statusText,
        body?.code ?? 'INTERNAL_ERROR',
        requestId,
        response.status,
      );
    }
    const disposition = response.headers.get('content-disposition') ?? '';
    const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1];
    const plain = /filename="([^"]+)"/.exec(disposition)?.[1];
    const name = encoded ? decodeURIComponent(encoded) : (plain ?? 'download');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  });
}
