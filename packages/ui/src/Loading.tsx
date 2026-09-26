import { LoaderCircle } from 'lucide-react';
import { cn } from './cn';
import { useUiStrings } from './strings';

/** Announces that content is loading. Pass `label` to say what is loading. */
export function Loading({ label, className }: { label?: string; className?: string }) {
  const strings = useUiStrings();
  return (
    <p
      role="status"
      className={cn('inline-flex items-center gap-2 text-text-secondary', className)}
    >
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      {label ?? strings.loading}
    </p>
  );
}

/**
 * A placeholder shaped like the content on its way. Decorative: pair it with a Loading status (or
 * aria-busy on the region) so screen readers hear something. No shimmer under reduced motion
 * (SRS §40.5).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block h-4 animate-pulse rounded-sm bg-surface-muted motion-reduce:animate-none',
        className,
      )}
    />
  );
}
