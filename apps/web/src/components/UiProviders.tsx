import { ToastProvider, UiStringsProvider, type UiStrings } from '@ie/ui';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** Gives the component library its words in the current language, and a place for toasts. */
export function UiProviders({ children }: { children: ReactNode }) {
  // `t` changes identity when the language changes, which rebuilds the strings.
  const { t } = useTranslation();
  const strings = useMemo<UiStrings>(
    () => ({
      close: t('state.close'),
      dismiss: t('state.dismiss'),
      loading: t('state.loading'),
      required: t('state.required'),
      errorTitle: t('state.error'),
      retry: t('state.retry'),
      requestId: (id) => t('state.requestId', { id }),
      notifications: t('state.notifications'),
    }),
    [t],
  );
  return (
    <UiStringsProvider strings={strings}>
      <ToastProvider>{children}</ToastProvider>
    </UiStringsProvider>
  );
}
