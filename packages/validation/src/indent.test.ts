import { describe, expect, it } from 'vitest';
import { MAX_INDENT_LINES, createIndentInputSchema } from './indent.js';
import { toUserErrors } from './user-errors.js';

const schema = createIndentInputSchema({ today: () => '2026-09-24' });

const line = (overrides: Record<string, unknown> = {}) => ({
  productId: 'prod-cattle-feed',
  quantity: '10',
  uomId: 'uom-bag',
  ...overrides,
});

function errorsFor(input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? [] : toUserErrors(result.error);
}

describe('createIndent input', () => {
  it('accepts a minimal draft and applies defaults', () => {
    const result = schema.parse({ locationId: 'loc-akbarpur', lines: [line()] });
    expect(result.priority).toBe('NORMAL');
    expect(result.submit).toBe(false);
  });

  it('trims text and drops blank optional fields', () => {
    const result = schema.parse({
      locationId: 'loc-akbarpur',
      justification: '   ',
      remarks: '  urgent for BMC  ',
      lines: [line()],
    });
    expect(result.justification).toBeUndefined();
    expect(result.remarks).toBe('urgent for BMC');
  });

  it('requires between 1 and 200 lines', () => {
    expect(errorsFor({ locationId: 'l', lines: [] })[0]).toMatchObject({
      code: 'VALIDATION_FAILED',
      field: ['input', 'lines'],
      message: 'validation.indent.noLines',
    });
    const tooMany = Array.from({ length: MAX_INDENT_LINES + 1 }, (_, i) =>
      line({ productId: `p${i}` }),
    );
    expect(errorsFor({ locationId: 'l', lines: tooMany })[0]?.message).toBe(
      'validation.indent.tooManyLines',
    );
  });

  it.each([
    ['0', 'validation.mustBePositive'],
    ['-2', 'validation.mustBePositive'],
    ['1.2345', 'validation.decimal'],
    ['abc', 'validation.decimal'],
  ])('rejects quantity %s', (quantity, message) => {
    expect(errorsFor({ locationId: 'l', lines: [line({ quantity })] })).toEqual([
      expect.objectContaining({ field: ['input', 'lines', '0', 'quantity'], message }),
    ]);
  });

  it('accepts quantities with up to 3 decimals and prices with up to 2', () => {
    expect(
      errorsFor({
        locationId: 'l',
        lines: [line({ quantity: '0.125', estimatedUnitPrice: '1250.50' })],
      }),
    ).toEqual([]);
    expect(
      errorsFor({ locationId: 'l', lines: [line({ estimatedUnitPrice: '10.005' })] }),
    ).toHaveLength(1);
  });

  it('rejects dates before today (IST)', () => {
    expect(errorsFor({ locationId: 'l', requiredBy: '2026-09-23', lines: [line()] })).toEqual([
      expect.objectContaining({ field: ['input', 'requiredBy'], message: 'validation.dateInPast' }),
    ]);
    expect(errorsFor({ locationId: 'l', requiredBy: '2026-09-24', lines: [line()] })).toEqual([]);
  });

  it('flags a repeated product with the same delivery date as INDENT_DUPLICATE_LINE', () => {
    const errors = errorsFor({
      locationId: 'l',
      lines: [
        line({ expectedDeliveryDate: '2026-10-01' }),
        line({ expectedDeliveryDate: '2026-10-05' }),
        line({ expectedDeliveryDate: '2026-10-01' }),
      ],
    });
    expect(errors).toEqual([
      {
        code: 'INDENT_DUPLICATE_LINE',
        message: 'validation.indent.duplicateLine',
        field: ['input', 'lines', '2', 'productId'],
        details: { duplicateOf: 0 },
      },
    ]);
  });

  it('requires an idempotency key when submitting in the same call', () => {
    expect(errorsFor({ locationId: 'l', submit: true, lines: [line()] })).toEqual([
      expect.objectContaining({ field: ['input', 'idempotencyKey'] }),
    ]);
    expect(
      errorsFor({
        locationId: 'l',
        submit: true,
        idempotencyKey: '01926f6e-8a1c-7c3e-9d2a-3f4b5c6d7e8f',
        lines: [line()],
      }),
    ).toEqual([]);
  });

  it('rejects unknown priorities', () => {
    expect(errorsFor({ locationId: 'l', priority: 'CRITICAL', lines: [line()] })[0]?.field).toEqual(
      ['input', 'priority'],
    );
  });
});
