import { businessDate } from '@ie/domain-types';
import { Priority, type CreateIndentInput, type IndentLineInput } from '@ie/graphql';
import { z } from 'zod';
import { dateNotBefore, id, money, quantity, text, uuid } from './primitives.js';

export const MAX_INDENT_LINES = 200;

export interface IndentRuleOptions {
  /** Business "today" (YYYY-MM-DD). Injected so tests and offline clients are deterministic. */
  today?: () => string;
}

export function indentLineInputSchema({ today = businessDate }: IndentRuleOptions = {}) {
  return z.object({
    clientLineId: uuid.optional(),
    productId: id,
    quantity,
    uomId: id,
    expectedDeliveryDate: dateNotBefore(today).optional(),
    estimatedUnitPrice: money.optional(),
    remark: text(500).optional(),
    remarkInternal: z.boolean().optional(),
  });
}

/** Rules for `createIndent` (SRS OP-01, IND-001…IND-003). The server re-applies them. */
export function createIndentInputSchema(options: IndentRuleOptions = {}) {
  const today = options.today ?? businessDate;
  return z
    .object({
      idempotencyKey: uuid.optional(),
      locationId: id,
      departmentId: id.optional(),
      requestedForEmployeeCode: text(32).optional(),
      priority: z.enum(Priority).default('NORMAL'),
      requiredBy: dateNotBefore(today).optional(),
      justification: text(2000).optional(),
      budgetCode: text(50).optional(),
      remarks: text(2000).optional(),
      lines: z
        .array(indentLineInputSchema({ today }))
        .min(1, 'validation.indent.noLines')
        .max(MAX_INDENT_LINES, 'validation.indent.tooManyLines'),
      attachmentDocumentIds: z.array(id).max(50).optional(),
      submit: z.boolean().default(false),
    })
    .superRefine((input, ctx) => {
      // Offline submits are replayed; without a key a replay would create a second indent.
      if (input.submit && !input.idempotencyKey) {
        ctx.addIssue({
          code: 'custom',
          path: ['idempotencyKey'],
          message: 'validation.indent.idempotencyKeyRequired',
        });
      }
      // The same product may appear twice only for different delivery dates (IND-003).
      const seen = new Map<string, number>();
      input.lines.forEach((line, index) => {
        const key = `${line.productId}|${line.expectedDeliveryDate ?? ''}`;
        const first = seen.get(key);
        if (first === undefined) {
          seen.set(key, index);
          return;
        }
        ctx.addIssue({
          code: 'custom',
          path: ['lines', index, 'productId'],
          message: 'validation.indent.duplicateLine',
          params: { errorCode: 'INDENT_DUPLICATE_LINE', duplicateOf: first },
        });
      });
    });
}

export type CreateIndentValues = z.output<ReturnType<typeof createIndentInputSchema>>;

// Compile-time guard: the Zod schemas must cover exactly the fields of the GraphQL inputs.
type SameKeys<A, B> = [keyof A] extends [keyof B]
  ? [keyof B] extends [keyof A]
    ? true
    : never
  : never;
const inputsMatchContract: [
  SameKeys<z.input<ReturnType<typeof createIndentInputSchema>>, CreateIndentInput>,
  SameKeys<z.input<ReturnType<typeof indentLineInputSchema>>, IndentLineInput>,
] = [true, true];
void inputsMatchContract;
