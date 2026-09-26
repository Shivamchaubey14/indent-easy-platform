import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** A bordered surface for a group of related content. Give it `aria-labelledby` its heading. */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('rounded-lg border border-border bg-surface p-6', className)}
      {...props}
    />
  );
}
