import { getLocales } from 'expo-localization';
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Locale } from '../i18n';

export type ThemePreference = 'system' | 'light' | 'dark';

interface UiState {
  theme: ThemePreference;
  locale: Locale;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
}

/** First launch: follow the phone's language; afterwards the user's own choice is remembered. */
const deviceLocale = (): Locale => (getLocales()[0]?.languageCode === 'hi' ? 'hi' : 'en');

/*
 * UI preferences only (SRS §18.1, DEC-002): server data stays in TanStack Query, tokens will live
 * in SecureStore and queued changes in SQLite. Stored in SQLite's key-value store, read
 * synchronously so the first frame already uses the saved theme and language. (MMKV, which the
 * SRS names, needs a development build; this store is the Expo Go equivalent.)
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      locale: deviceLocale(),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'ie-ui',
      storage: createJSONStorage(() => ({
        getItem: (key) => Storage.getItemSync(key),
        setItem: (key, value) => Storage.setItemSync(key, value),
        removeItem: (key) => {
          Storage.removeItemSync(key);
        },
      })),
      partialize: ({ theme, locale }) => ({ theme, locale }),
    },
  ),
);
