import { render, type RenderResult } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { UiStringsProvider, type UiStrings } from '../strings';
import { ToastProvider } from '../Toast';

export const testStrings: UiStrings = {
  close: 'Close',
  dismiss: 'Dismiss',
  loading: 'Loading…',
  required: 'required',
  errorTitle: 'Something went wrong.',
  retry: 'Try again',
  requestId: (id) => `Reference: ${id}`,
  notifications: 'Notifications',
};

/** Renders inside the providers every app sets up at its root. */
export function renderUi(ui: ReactElement): RenderResult {
  return render(
    <UiStringsProvider strings={testStrings}>
      <ToastProvider>{ui}</ToastProvider>
    </UiStringsProvider>,
  );
}

/**
 * Serious and critical accessibility problems axe finds in the document (SRS §41: none allowed).
 * Colour contrast needs real layout, so it is checked on the tokens instead (design-tokens tests).
 */
export async function axeViolations(): Promise<string[]> {
  const result = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}
