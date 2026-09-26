import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Locale } from '../i18n';

export type ThemePreference = 'system' | 'light' | 'dark';

interface UiState {
  theme: ThemePreference;
  locale: Locale;
  navCollapsed: boolean;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
  toggleNav: () => void;
}

/** First visit: follow the browser's language; afterwards the user's own choice is remembered. */
const browserLocale = (): Locale =>
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('hi')
    ? 'hi'
    : 'en';

/** UI preferences. Persisted locally because they are not sensitive (SRS §17.1, DEC-002). */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      locale: browserLocale(),
      navCollapsed: false,
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
    }),
    {
      name: 'ie-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ theme, locale, navCollapsed }) => ({ theme, locale, navCollapsed }),
    },
  ),
);

/** `system` follows the OS; light/dark pin the tokens' theme via <html data-theme>. */
export function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset['theme'];
  else root.dataset['theme'] = theme;
}
