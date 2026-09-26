import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { useSessionStore } from '../stores/session';
import { ApiRequestError, http } from './http';

/*
 * Sign-in and sessions on the phone (SRS §18.1, §30). The refresh token is kept in the
 * platform's secure storage (Keystore / Keychain) and rotated on every refresh; the access token
 * only ever lives in memory. There is one JavaScript context, so a single in-flight promise is
 * enough to keep two refreshes from replaying the same token.
 */

const REFRESH_KEY = 'ie.refresh-token';
const REFRESH_AHEAD_MS = 60_000;

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  mustChangePassword?: boolean;
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
const signedOutListeners = new Set<() => void>();

/** Runs when the session ends (sign-out, or the server refused the refresh token). */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

async function startSession(tokens: TokenResponse): Promise<void> {
  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  }
  useSessionStore.getState().setSession({
    accessToken: tokens.accessToken,
    mustChangePassword: tokens.mustChangePassword ?? false,
  });
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(
    () => void refreshSession().catch(() => undefined),
    Math.max(tokens.expiresIn * 1000 - REFRESH_AHEAD_MS, 5_000),
  );
}

async function endSession(): Promise<void> {
  clearTimeout(refreshTimer);
  await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => undefined);
  useSessionStore.getState().clear();
  for (const listener of signedOutListeners) listener();
}

let inFlight: Promise<boolean> | null = null;

/**
 * Swaps the stored refresh token for new tokens. Resolves true when signed in, false when there
 * is no session any more. A network failure rejects and keeps the session: the phone may simply
 * be offline, and the stored token still works later.
 */
export function refreshSession(): Promise<boolean> {
  inFlight ??= (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) {
      if (useSessionStore.getState().status !== 'signedOut') await endSession();
      return false;
    }
    try {
      await startSession(
        await http<TokenResponse>('/api/v1/auth/refresh', {
          method: 'POST',
          body: { refreshToken },
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'NETWORK_ERROR') throw err;
      await endSession();
      return false;
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * On launch: signed in if the stored refresh token still works. Offline launches keep the user
 * signed in (status stays as restored) so cached data and queued work remain reachable.
 */
export async function restoreSession(): Promise<void> {
  try {
    await refreshSession();
  } catch {
    const stored = await SecureStore.getItemAsync(REFRESH_KEY);
    if (stored) useSessionStore.setState({ status: 'signedIn' });
    else useSessionStore.getState().clear();
  }
}

export async function signIn(input: { identifier: string; password: string }): Promise<void> {
  const deviceName = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ');
  await startSession(
    await http<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { ...input, ...(deviceName && { deviceName: deviceName.slice(0, 100) }) },
    }),
  );
}

export async function signOut(): Promise<void> {
  const { accessToken } = useSessionStore.getState();
  try {
    if (accessToken) await http('/api/v1/auth/logout', { method: 'POST', accessToken });
  } catch {
    // Signing out on the phone must work even offline; the session then simply expires.
  } finally {
    await endSession();
  }
}

export function requestPasswordReset(email: string): Promise<void> {
  return http('/api/v1/auth/password/forgot', { method: 'POST', body: { email } });
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions: boolean;
}): Promise<void> {
  await http('/api/v1/auth/password/change', {
    method: 'POST',
    body: input,
    accessToken: useSessionStore.getState().accessToken,
  });
  // The next access token no longer carries the "must change password" mark.
  await refreshSession();
}
