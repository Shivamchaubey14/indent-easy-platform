import { useSessionStore } from '../stores/session';

/*
 * Sign-in, silent refresh and sign-out against /api/v1/auth (SRS §30.2).
 *
 * The refresh token is an HttpOnly cookie this code never sees. Every refresh rotates it, and a
 * rotated token that comes back again ends the whole session (reuse detection). Several tabs share
 * the cookie, so refreshes are serialised across tabs with the Web Locks API: a tab that waited
 * for the lock simply uses the cookie the previous tab received.
 */

const AUTH = '/api/v1/auth';
/** Refresh this long before the access token expires. */
const REFRESH_AHEAD_MS = 60_000;

export interface AuthProblem {
  code: string;
  detail?: string;
  retryAfter?: number;
  /** Field → i18n message keys, from VALIDATION_FAILED responses. */
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
}

/** A refused auth request. `code` comes from the API error catalogue, or NETWORK_ERROR. */
export class AuthError extends Error {
  constructor(readonly problem: AuthProblem) {
    super(problem.detail ?? problem.code);
    this.name = 'AuthError';
  }

  get code(): string {
    return this.problem.code;
  }
}

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  mustChangePassword?: boolean;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${AUTH}${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Name': 'web',
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new AuthError({ code: 'NETWORK_ERROR' });
  }
  if (response.status === 202 || response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as
    | (T & {
        code?: string;
        detail?: string;
        requestId?: string;
        details?: { retryAfter?: number; fieldErrors?: Record<string, string[]> };
      })
    | null;
  if (!response.ok || !body) {
    const retryAfter = Number(response.headers.get('retry-after')) || body?.details?.retryAfter;
    throw new AuthError({
      code: body?.code ?? 'INTERNAL_ERROR',
      ...(body?.detail && { detail: body.detail }),
      ...(retryAfter && { retryAfter }),
      ...(body?.details?.fieldErrors && { fieldErrors: body.details.fieldErrors }),
      ...(body?.requestId && { requestId: body.requestId }),
    });
  }
  return body;
}

// --- Tabs ---------------------------------------------------------------------------------------

const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('ie-auth');
const signedOutListeners = new Set<() => void>();

/** Runs when the session ends here or in another tab (clear caches, go to sign-in). */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

function endSession(tellOtherTabs: boolean): void {
  clearTimeout(refreshTimer);
  useSessionStore.getState().clear();
  if (tellOtherTabs) channel?.postMessage('signed-out');
  for (const listener of signedOutListeners) listener();
}

channel?.addEventListener('message', (event: MessageEvent) => {
  if (event.data === 'signed-out' && useSessionStore.getState().status === 'signedIn') {
    endSession(false);
  }
});

function startSession(tokens: TokenResponse): void {
  useSessionStore.getState().setSession({
    accessToken: tokens.accessToken,
    expiresIn: tokens.expiresIn,
    mustChangePassword: tokens.mustChangePassword ?? false,
  });
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(
    () => void refreshSession().catch(() => undefined),
    Math.max(tokens.expiresIn * 1000 - REFRESH_AHEAD_MS, 5_000),
  );
}

// --- Refresh ------------------------------------------------------------------------------------

async function withRefreshLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request('ie-auth-refresh', work);
  }
  return work();
}

let inFlight: Promise<boolean> | null = null;

/**
 * Gets a fresh access token from the refresh cookie. Resolves true when signed in, false when
 * there is no (longer a) session. Concurrent callers share one request.
 */
export function refreshSession(): Promise<boolean> {
  inFlight ??= withRefreshLock(async () => {
    try {
      const { csrfToken } = await call<{ csrfToken: string }>('/csrf', { method: 'GET' });
      const tokens = await call<TokenResponse>('/refresh', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      startSession(tokens);
      return true;
    } catch (err) {
      // A network failure is not a sign-out: keep what we have and let the caller retry.
      if (err instanceof AuthError && err.code === 'NETWORK_ERROR') throw err;
      if (useSessionStore.getState().status !== 'signedOut') endSession(false);
      return false;
    }
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

let restored: Promise<boolean> | null = null;

/** On page load: find out once whether the browser still holds a session. */
export function restoreSession(): Promise<boolean> {
  const { status } = useSessionStore.getState();
  if (status !== 'unknown') return Promise.resolve(status === 'signedIn');
  restored ??= refreshSession().catch(() => {
    useSessionStore.getState().clear();
    return false;
  });
  return restored;
}

// --- Sign-in, sign-out, passwords ------------------------------------------------------------

export async function signIn(input: { identifier: string; password: string }): Promise<{
  mustChangePassword: boolean;
}> {
  const tokens = await call<TokenResponse>('/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  startSession(tokens);
  return { mustChangePassword: tokens.mustChangePassword ?? false };
}

export async function signOut(): Promise<void> {
  const logout = () =>
    call('/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${useSessionStore.getState().accessToken ?? ''}` },
    });
  try {
    try {
      await logout();
    } catch (err) {
      // An expired access token: renew it once so the server really ends the session.
      if (!(err instanceof AuthError) || err.code !== 'AUTH_TOKEN_EXPIRED') throw err;
      if (await refreshSession()) await logout();
    }
  } catch {
    // Signing out locally must work even if the server can't be reached.
  } finally {
    endSession(true);
  }
}

export function requestPasswordReset(email: string): Promise<void> {
  return call('/password/forgot', { method: 'POST', body: JSON.stringify({ email }) });
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return call('/password/reset', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions: boolean;
}): Promise<void> {
  const { accessToken } = useSessionStore.getState();
  await call('/password/change', {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: JSON.stringify(input),
  });
  // The next token no longer carries the "must change password" mark.
  await refreshSession();
}
