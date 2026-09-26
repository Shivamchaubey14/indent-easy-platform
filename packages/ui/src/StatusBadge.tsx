import {
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { toneOf, type Tone } from './status-map';

export const TONE_STYLES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-text-secondary',
  info: 'bg-info-surface text-info-text',
  warning: 'bg-warning-surface text-warning-text',
  success: 'bg-success-surface text-success-text',
  danger: 'bg-danger-surface text-danger-text',
};

export const TONE_ICONS: Record<Tone, LucideIcon> = {
  neutral: CircleDashed,
  info: Clock,
  warning: TriangleAlert,
  success: CircleCheck,
  danger: CircleX,
};

export interface StatusBadgeProps {
  /** A workflow status code; its tone comes from the status map. */
  status?: string;
  /** Or set the tone directly, for things that aren't workflow statuses. */
  tone?: Tone;
  /** The translated label. */
  children: ReactNode;
  className?: string;
}

/** Status is colour + icon + text, never colour alone (SRS §40.1). */
export function StatusBadge({ status, tone, children, className }: StatusBadgeProps) {
  const resolved = tone ?? (status ? toneOf(status) : 'neutral');
  const Icon = TONE_ICONS[resolved];
  return (
    <span
      data-tone={resolved}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-medium',
        TONE_STYLES[resolved],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}
