import { buildSchema, isEnumType, validateSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { ErrorCode, IndentStatus, Priority } from './index.js';
import { loadTypeDefs } from './schema.js';

const schema = buildSchema(loadTypeDefs());

describe('GraphQL contract', () => {
  it('is a valid schema', () => {
    expect(validateSchema(schema)).toEqual([]);
  });

  it('has root query, mutation and subscription types', () => {
    expect(schema.getQueryType()).toBeDefined();
    expect(schema.getMutationType()).toBeDefined();
    expect(schema.getSubscriptionType()).toBeDefined();
  });

  it('generated enum constants match the SDL', () => {
    const generated: Record<string, Record<string, string>> = { ErrorCode, IndentStatus, Priority };
    for (const [name, values] of Object.entries(generated)) {
      const type = schema.getType(name);
      if (!isEnumType(type)) throw new Error(`${name} is not an enum in the SDL`);
      expect(Object.values(values).sort()).toEqual(
        type
          .getValues()
          .map((v) => v.name)
          .sort(),
      );
    }
  });
});
