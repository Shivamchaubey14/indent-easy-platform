import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/*
 * Minimal primitives until packages/ui (Radix-based) exists. Token utilities only; no colour
 * literals.
 */

type Variant = 'primary' | 'secondary';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground hover:opacity-90'
      : 'bg-secondary text-secondary-foreground hover:opacity-90';
  return (
    <button
      type="button"
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-body font-semibold transition-opacity disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-text ${styles} ${className}`}
      {...props}
    />
  );
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={`rounded-lg border border-border bg-surface p-6 ${className}`} {...props} />
  );
}

/** Status is colour + icon + text, never colour alone (SRS §40.1). */
export function StatusBadge({
  tone,
  children,
}: {
  tone: 'success' | 'danger' | 'neutral';
  children: ReactNode;
}) {
  const styles = {
    success: 'bg-success-surface text-success-text',
    danger: 'bg-danger-surface text-danger-text',
    neutral: 'bg-surface-muted text-text-secondary',
  }[tone];
  const icon = { success: '✓', danger: '✕', neutral: '•' }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-medium ${styles}`}
    >
      <span aria-hidden="true">{icon}</span>
      {children}
    </span>
  );
}

export function ErrorState({
  requestId,
  onRetry,
}: {
  requestId?: string | undefined;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="rounded-md bg-danger-surface p-4 text-danger-text">
      <p className="font-semibold">{t('state.error')}</p>
      {requestId && (
        <p className="mt-1 text-caption tabular">{t('state.requestId', { id: requestId })}</p>
      )}
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          {t('state.retry')}
        </Button>
      )}
    </div>
  );
}

export function Loading() {
  const { t } = useTranslation();
  return (
    <p role="status" className="text-text-secondary">
      {t('state.loading')}
    </p>
  );
}
