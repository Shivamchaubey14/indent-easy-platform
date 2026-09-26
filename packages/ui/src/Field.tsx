import { CircleX } from 'lucide-react';
import { Label } from 'radix-ui';
import {
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  useId,
} from 'react';
import { cn } from './cn';
import { useUiStrings } from './strings';

/** Props a Field hands to its control so label, hint and error are wired up for assistive tech. */
export interface ControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
}

export interface FieldProps {
  label: ReactNode;
  /** Help shown under the label, before the user types. */
  hint?: ReactNode;
  /** The validation message; the field is marked invalid while it is set. */
  error?: string | undefined;
  required?: boolean;
  /** Renders the control, spreading the given props onto it. */
  children: (control: ControlProps) => ReactNode;
  className?: string;
}

/**
 * Label + control + hint + error (SRS §41 A11Y-005): the label is programmatic, "required" is said
 * in words, and the hint and error are linked with aria-describedby.
 */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const strings = useUiStrings();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label.Root htmlFor={id} className="text-body-sm font-medium text-text-primary">
        {label}
        {required && (
          <>
            {' '}
            <span className="font-normal text-text-secondary">({strings.required})</span>
          </>
        )}
      </Label.Root>
      {hint && (
        <p id={hintId} className="text-caption text-text-secondary">
          {hint}
        </p>
      )}
      {children({
        id,
        ...(describedBy && { 'aria-describedby': describedBy }),
        ...(error && { 'aria-invalid': true as const }),
        ...(required && { required }),
      })}
      {error && (
        <p id={errorId} className="flex items-center gap-1 text-body-sm text-danger-text">
          <CircleX aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function TextInput({ className, type = 'text', ...props }: TextInputProps) {
  return (
    <input
      type={type}
      className={cn(
        'h-10 w-full rounded-md border border-border-control bg-surface-input px-3 text-body text-text-primary',
        'placeholder:text-text-tertiary aria-invalid:border-danger',
        'disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-text',
        className,
      )}
      {...props}
    />
  );
}

export interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>;
}

/** A native select styled like TextInput: keyboard, screen readers and phones handle it well. */
export function SelectInput({ className, ...props }: SelectInputProps) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-md border border-border-control bg-surface-input px-3 text-body text-text-primary',
        'aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-text',
        className,
      )}
      {...props}
    />
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  /** Extra line under the label. */
  description?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/** A labelled checkbox; the whole label is the click target (at least 24 px, A11Y-004). */
export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-primary"
        {...(description ? { 'aria-describedby': `${inputId}-description` } : {})}
        {...props}
      />
      <label htmlFor={inputId} className="min-h-6 text-body">
        {label}
        {description && (
          <span id={`${inputId}-description`} className="block text-caption text-text-secondary">
            {description}
          </span>
        )}
      </label>
    </div>
  );
}
