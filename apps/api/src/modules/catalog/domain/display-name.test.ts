import { describe, expect, it } from 'vitest';
import { displayName } from './display-name.js';

const sap = { system: 'SAP', name: 'CATTLE FEED 50KG', isPrimary: true, displayPriority: 20 };
const nddb = {
  system: 'NDDB',
  name: 'Cattle feed (BIS type II)',
  isPrimary: true,
  displayPriority: 10,
};

describe('displayName', () => {
  it('prefers the lowest display priority', () => {
    expect(displayName('Cattle Feed', [sap, nddb])).toBe('Cattle feed (BIS type II)');
  });

  it('falls back to SAP, then to the internal name', () => {
    expect(displayName('Cattle Feed', [sap])).toBe('CATTLE FEED 50KG');
    expect(displayName('Cattle Feed', [])).toBe('Cattle Feed');
  });

  it('ignores secondary names and systems switched off for display', () => {
    expect(
      displayName('Cattle Feed', [
        { ...nddb, isPrimary: false },
        { ...sap, displayPriority: 0 },
      ]),
    ).toBe('Cattle Feed');
  });
});
