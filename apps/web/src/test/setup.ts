import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '../i18n';

// jsdom has no matchMedia. Report "reduced motion" so animations are skipped, as they would be
// for a user who asked for less motion.
window.matchMedia ??= (query: string) =>
  ({
    matches: query.includes('prefers-reduced-motion: reduce'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

afterEach(() => cleanup());
