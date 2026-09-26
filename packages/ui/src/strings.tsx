import { createContext, type ReactNode, use } from 'react';

/**
 * The few words the components say themselves (close buttons, loading, required fields). The
 * library has no translations of its own: the app passes these in from its i18n, so they follow
 * the user's language.
 */
export interface UiStrings {
  close: string;
  dismiss: string;
  loading: string;
  required: string;
  errorTitle: string;
  retry: string;
  requestId: (id: string) => string;
  /** Names the notifications region for screen readers. */
  notifications: string;
}

const UiStringsContext = createContext<UiStrings | null>(null);

export function UiStringsProvider({
  strings,
  children,
}: {
  strings: UiStrings;
  children: ReactNode;
}) {
  return <UiStringsContext value={strings}>{children}</UiStringsContext>;
}

export function useUiStrings(): UiStrings {
  const strings = use(UiStringsContext);
  if (!strings) throw new Error('@ie/ui components must be rendered inside <UiStringsProvider>.');
  return strings;
}
