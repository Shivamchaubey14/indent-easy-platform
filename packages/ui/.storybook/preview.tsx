import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import { UiStringsProvider, type UiStrings } from '../src/strings';
import { ToastProvider } from '../src/Toast';
import './storybook.css';

// The words the components say themselves, in both app languages. The app passes its own from i18n.
const STRINGS: Record<'en' | 'hi', UiStrings> = {
  en: {
    close: 'Close',
    dismiss: 'Dismiss',
    loading: 'Loading…',
    required: 'required',
    errorTitle: 'Something went wrong.',
    retry: 'Try again',
    requestId: (id) => `Reference: ${id}`,
    notifications: 'Notifications',
  },
  hi: {
    close: 'बंद करें',
    dismiss: 'हटाएँ',
    loading: 'लोड हो रहा है…',
    required: 'आवश्यक',
    errorTitle: 'कुछ गलत हो गया।',
    retry: 'फिर से कोशिश करें',
    requestId: (id) => `संदर्भ: ${id}`,
    notifications: 'सूचनाएँ',
  },
};

const withAppSettings: Decorator = (Story, context) => {
  const locale = context.globals['locale'] === 'hi' ? 'hi' : 'en';
  const theme = String(context.globals['theme'] ?? 'light');
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset['theme'] = theme;
  }, [locale, theme]);
  return (
    <UiStringsProvider strings={STRINGS[locale]}>
      <ToastProvider>
        <Story />
      </ToastProvider>
    </UiStringsProvider>
  );
};

const preview: Preview = {
  decorators: [withAppSettings],
  globalTypes: {
    theme: {
      description: 'Colour theme',
      toolbar: { title: 'Theme', icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
    locale: {
      description: 'Language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'hi', title: 'हिन्दी' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light', locale: 'en' },
  parameters: {
    layout: 'padded',
    // Accessibility problems show as failures in the Accessibility panel, not warnings (SRS §41).
    a11y: { test: 'error' },
  },
};

export default preview;
