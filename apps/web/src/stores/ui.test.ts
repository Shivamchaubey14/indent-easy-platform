import { describe, expect, it } from 'vitest';
import { applyTheme, useUiStore } from './ui';

describe('theme preference', () => {
  it('pins light or dark on <html>, and follows the OS for system', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    applyTheme('system');
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('persists only UI preferences', () => {
    useUiStore.getState().setLocale('hi');
    useUiStore.getState().setTheme('dark');
    const saved = JSON.parse(localStorage.getItem('ie-ui') ?? '{}') as { state: object };
    expect(saved.state).toEqual({ theme: 'dark', locale: 'hi', navCollapsed: false });
  });
});
