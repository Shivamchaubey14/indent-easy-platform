import en from './en.json';
import hi from './hi.json';

const keys = (node: object, prefix = ''): string[] =>
  Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

describe('translations', () => {
  it('has every English string in Hindi too, and nothing extra', () => {
    expect(keys(hi).sort()).toEqual(keys(en).sort());
  });
});
