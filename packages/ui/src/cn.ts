import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Our type scale (text-body, text-caption, ...) are font sizes, not colours. Without this,
// tailwind-merge would treat `text-body` and `text-text-primary` as the same kind of class and drop one.
const merge = extendTailwindMerge({
  extend: {
    theme: { text: ['display', 'h1', 'h2', 'h3', 'body', 'body-sm', 'caption'] },
  },
});

/** Joins class names, letting later utilities override earlier ones (e.g. a caller's padding). */
export function cn(...classes: ClassValue[]): string {
  return merge(clsx(classes));
}
