import { create } from 'zustand';

export interface SessionUser {
  id: string;
  displayName: string;
  email: string;
}

interface SessionState {
  user: SessionUser | null;
  /** Access token lives in memory only, never in storage (SRS §30.1). */
  accessToken: string | null;
  signIn: (user: SessionUser, accessToken: string) => void;
  signOut: () => void;
}

/** Client session. Filled by the login flow in Phase 1; server data stays in TanStack Query. */
export const useSessionStore = create<SessionState>()((set) => ({
  user: null,
  accessToken: null,
  signIn: (user, accessToken) => set({ user, accessToken }),
  signOut: () => set({ user: null, accessToken: null }),
}));
