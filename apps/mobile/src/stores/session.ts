import { create } from 'zustand';

export type SessionStatus = 'unknown' | 'signedIn' | 'signedOut';

interface SessionState {
  /** `unknown` until launch has checked secure storage for a session. */
  status: SessionStatus;
  /** In memory only; the refresh token lives in SecureStore (SRS §18.1, AUTH-008). */
  accessToken: string | null;
  mustChangePassword: boolean;
  /** Set when the app comes back from the background and must be unlocked first (§30.3). */
  locked: boolean;
  setSession: (session: { accessToken: string; mustChangePassword: boolean }) => void;
  clear: () => void;
  setLocked: (locked: boolean) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  status: 'unknown',
  accessToken: null,
  mustChangePassword: false,
  locked: false,
  setSession: ({ accessToken, mustChangePassword }) =>
    set({ status: 'signedIn', accessToken, mustChangePassword }),
  clear: () =>
    set({ status: 'signedOut', accessToken: null, mustChangePassword: false, locked: false }),
  setLocked: (locked) => set({ locked }),
}));
