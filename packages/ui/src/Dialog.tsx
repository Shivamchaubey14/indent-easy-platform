import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import { type ReactNode, useRef, useState } from 'react';
import { cn } from './cn';
import { motion, prefersReducedMotion } from './motion';
import { useUiStrings } from './strings';

export interface DialogProps {
  open: boolean;
  /** Called with `false` when the user asks to close (Esc, the close button, a click outside). */
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Actions, right-aligned under the body (put the primary action last). */
  footer?: ReactNode;
  className?: string;
}

/**
 * A modal dialog (SRS §40.4): focus is trapped inside, Esc closes it, and focus returns to what
 * opened it. It fades and rises in over 200 ms and out over 150 ms (§40.5); with reduced motion it
 * appears and disappears at once.
 *
 * Controlled only: the caller owns `open`. While the exit animation plays the dialog stays mounted,
 * so focus goes back to the opener only once it has gone.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const strings = useUiStrings();
  const [mounted, setMounted] = useState(open);
  const overlay = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  // Radix only returns focus to its own Trigger; callers open this from any button, so remember it.
  const opener = useRef<HTMLElement | null>(null);

  // Opening mounts straight away; closing waits for the exit animation (below).
  if (open && !mounted) setMounted(true);

  useGSAP(
    () => {
      if (!mounted) return;
      const reduced = prefersReducedMotion();
      if (open) {
        if (reduced) return;
        gsap.fromTo(overlay.current, { opacity: 0 }, { opacity: 1, duration: motion.enter });
        gsap.fromTo(
          content.current,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: motion.enter, ease: motion.easeOut },
        );
        return;
      }
      if (reduced) {
        setMounted(false);
        return;
      }
      gsap.to(overlay.current, {
        opacity: 0,
        duration: motion.exit,
        ease: motion.easeIn,
        overwrite: true,
      });
      gsap.to(content.current, {
        opacity: 0,
        y: 8,
        duration: motion.exit,
        ease: motion.easeIn,
        overwrite: true,
        onComplete: () => setMounted(false),
      });
    },
    { dependencies: [open, mounted] },
  );

  return (
    <RadixDialog.Root
      open={mounted}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          ref={overlay}
          className={cn(
            'fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-overlay p-4',
            !open && 'pointer-events-none',
          )}
        >
          <RadixDialog.Content
            ref={content}
            onOpenAutoFocus={() => {
              opener.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              opener.current?.focus();
            }}
            {...(description ? {} : { 'aria-describedby': undefined })}
            className={cn(
              'relative w-full max-w-lg rounded-lg border border-border bg-surface p-6 text-text-primary',
              className,
            )}
          >
            <RadixDialog.Title className="pr-10 text-h2 font-semibold">{title}</RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="mt-2 text-text-secondary">
                {description}
              </RadixDialog.Description>
            )}
            {children && <div className="mt-4">{children}</div>}
            {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
            <RadixDialog.Close
              aria-label={strings.close}
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-md text-text-secondary hover:bg-surface-muted"
            >
              <X aria-hidden="true" className="size-4" />
            </RadixDialog.Close>
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
