import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';
import { TONE_ICONS, TONE_STYLES } from './StatusBadge';
import type { Tone } from './status-map';
import { useUiStrings } from './strings';

export interface AlertProps {
  tone?: Exclude<Tone, 'neutral'>;
  title?: ReactNode;
  children?: ReactNode;
  /** A follow-up action, e.g. a retry button. */
  action?: ReactNode;
  className?: string;
}

/**
 * An inline message. Errors are announced at once (role="alert"); everything else politely
 * (role="status"), so it doesn't interrupt what the user is doing.
 */
export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const Icon = TONE_ICONS[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md p-4', TONE_STYLES[tone], className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1')}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export interface ErrorStateProps {
  /** What went wrong, in the user's words. Defaults to a generic message. */
  message?: ReactNode;
  /** The request ID to quote to support. */
  requestId?: string | undefined;
  onRetry?: () => void;
  className?: string;
}

/** Human message, a reference to quote to support, and a retry. No stack traces (SRS §40.4). */
export function ErrorState({ message, requestId, onRetry, className }: ErrorStateProps) {
  const strings = useUiStrings();
  return (
    <Alert
      tone="danger"
      title={message ?? strings.errorTitle}
      className={className}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {strings.retry}
          </Button>
        )
      }
    >
      {requestId && <p className="text-caption tabular">{strings.requestId(requestId)}</p>}
    </Alert>
  );
}
