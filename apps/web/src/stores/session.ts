import { create } from 'zustand';

export type SessionStatus = 'unknown' | 'signedIn' | 'signedOut';

interface SessionState {
  /** `unknown` until the first refresh attempt tells us whether a session cookie exists. */
  status: SessionStatus;
  /** Access token lives in memory only, never in storage (SRS §30.1, AUTH-007). */
  accessToken: string | null;
  /** Epoch milliseconds when the access token expires. */
  expiresAt: number;
  /** A temporary password must be replaced before anything else (AUTH-013). */
  mustChangePassword: boolean;
  setSession: (session: {
    accessToken: string;
    expiresIn: number;
    mustChangePassword: boolean;
  }) => void;
  clear: () => void;
}

/**
 * Client session state (DEC-002: client state in Zustand). Who the user is and what they may do
 * comes from the `me` query in TanStack Query; this only holds the credentials to ask.
 */
export const useSessionStore = create<SessionState>()((set) => ({
  status: 'unknown',
  accessToken: null,
  expiresAt: 0,
  mustChangePassword: false,
  setSession: ({ accessToken, expiresIn, mustChangePassword }) =>
    set({
      status: 'signedIn',
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
      mustChangePassword,
    }),
  clear: () =>
    set({ status: 'signedOut', accessToken: null, expiresAt: 0, mustChangePassword: false }),
}));
