import { X } from 'lucide-react';
import { Toast as RadixToast } from 'radix-ui';
import { createContext, type ReactNode, use, useCallback, useRef, useState } from 'react';
import { cn } from './cn';
import { TONE_ICONS, TONE_STYLES } from './StatusBadge';
import { useUiStrings } from './strings';

/**
 * Toasts confirm that something worked (SRS §40.4): polite, gone after 5 s, paused while hovered
 * or focused. There is deliberately no error tone: an error the user must act on belongs inline,
 * next to what failed, where it stays until dealt with.
 */
export interface ToastMessage {
  title: string;
  description?: string;
  tone?: 'success' | 'info';
}

type ShowToast = (message: ToastMessage) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** At most this many toasts at once; older ones make way. */
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const strings = useUiStrings();
  const [toasts, setToasts] = useState<(ToastMessage & { id: number })[]>([]);
  const nextId = useRef(0);

  const show = useCallback<ShowToast>((message) => {
    nextId.current += 1;
    const toast = { ...message, id: nextId.current };
    setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), toast]);
  }, []);
  const remove = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));

  return (
    <ToastContext value={show}>
      <RadixToast.Provider duration={5000} label={strings.notifications}>
        {children}
        {toasts.map(({ id, title, description, tone = 'success' }) => {
          const Icon = TONE_ICONS[tone];
          return (
            <RadixToast.Root
              key={id}
              type="background"
              onOpenChange={(open) => {
                if (!open) remove(id);
              }}
              className={cn(
                'flex items-start gap-3 rounded-md border border-border p-4',
                TONE_STYLES[tone],
              )}
            >
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <RadixToast.Title className="font-semibold">{title}</RadixToast.Title>
                {description && (
                  <RadixToast.Description className="mt-1">{description}</RadixToast.Description>
                )}
              </div>
              <RadixToast.Close
                aria-label={strings.dismiss}
                className="grid size-6 shrink-0 place-items-center rounded-sm hover:opacity-80"
              >
                <X aria-hidden="true" className="size-4" />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}
        <RadixToast.Viewport
          label={`${strings.notifications} ({hotkey})`}
          className="fixed right-0 bottom-0 z-[60] flex w-full max-w-sm flex-col gap-2 p-4 outline-none"
        />
      </RadixToast.Provider>
    </ToastContext>
  );
}

/** Returns a function that shows a toast. Needs a ToastProvider above it. */
export function useToast(): ShowToast {
  const show = use(ToastContext);
  if (!show) throw new Error('useToast() must be used inside <ToastProvider>.');
  return show;
}
