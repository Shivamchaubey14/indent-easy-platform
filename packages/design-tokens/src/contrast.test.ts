import { describe, expect, it } from 'vitest';
import { tokens } from '../dist/index.js';

/** WCAG 2.x relative luminance contrast ratio. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const { light, dark } = tokens.color;

// The pairs SRS §40.2 relies on, with their WCAG AA thresholds (4.5 text, 3 for controls).
const pairs: [string, string, string, number][] = [
  ['text-primary on surface', light['text-primary'], light.surface, 4.5],
  ['text-secondary on surface', light['text-secondary'], light.surface, 4.5],
  ['link on surface', light.link, light.surface, 4.5],
  ['primary button text', light['primary-foreground'], light.primary, 4.5],
  ['secondary button text', light['secondary-foreground'], light.secondary, 4.5],
  ['control border on surface', light['border-control'], light.surface, 3],
  ['danger text on its surface', light['danger-text'], light['danger-surface'], 4.5],
  ['success text on its surface', light['success-text'], light['success-surface'], 4.5],
  ['warning text on its surface', light['warning-text'], light['warning-surface'], 4.5],
  ['info text on its surface', light['info-text'], light['info-surface'], 4.5],
  ['dark: text-primary on background', dark['text-primary'], dark.background, 4.5],
  ['dark: text-secondary on background', dark['text-secondary'], dark.background, 4.5],
  ['dark: link on surface', dark.link, dark.surface, 4.5],
  ['dark: primary button text', dark['primary-foreground'], dark.primary, 4.5],
];

describe('colour tokens meet WCAG 2.2 AA', () => {
  it.each(pairs)('%s', (_name, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it('every light colour role has a dark counterpart', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });
});
