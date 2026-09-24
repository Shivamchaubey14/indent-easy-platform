// Compiles src/tokens.json into:
//   dist/tokens.css   CSS custom properties (--ie-*), light theme by default, dark via
//                     [data-theme="dark"] or the OS preference unless [data-theme="light"]
//   dist/index.js     resolved values for JavaScript / React Native (+ index.d.ts)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(new URL('../src/tokens.json', import.meta.url), 'utf8'));
const out = new URL('../dist/', import.meta.url);
mkdirSync(out, { recursive: true });

function resolve(value) {
  if (typeof value !== 'string' || !value.startsWith('{')) return value;
  const path = value.slice(1, -1).split('.');
  let node = src;
  for (const key of path) node = node?.[key];
  if (node?.$value === undefined) throw new Error(`Unresolved token reference ${value}`);
  return resolve(node.$value);
}

/** Leaf tokens under a group as { name: resolvedValue }. */
function leaves(group) {
  return Object.fromEntries(
    Object.entries(group)
      .filter(([key, v]) => !key.startsWith('$') && v && typeof v === 'object' && '$value' in v)
      .map(([key, v]) => [key, resolve(v.$value)]),
  );
}

const color = { light: leaves(src.color.light), dark: leaves(src.color.dark) };
const missing = Object.keys(color.light).filter((k) => !(k in color.dark));
if (missing.length) throw new Error(`Dark theme is missing: ${missing.join(', ')}`);

const space = leaves(src.space);
const radius = leaves(src.radius);
const duration = leaves(src.motion.duration);
const ease = leaves(src.motion.ease);
const font = leaves(src.font);

// Family names containing spaces are quoted; generic families (sans-serif) are not.
const cssFont = (families) => families.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(', ');
const vars = (prefix, entries, fmt = (v) => v) =>
  Object.entries(entries).map(([k, v]) => `  --ie-${prefix}-${k}: ${fmt(v)};`);

const lightColors = vars('color', color.light).join('\n');
const darkColors = vars('color', color.dark).join('\n');
const css = `/* Generated from src/tokens.json by \`pnpm --filter @ie/design-tokens build\`. Do not edit. */
:root {
${lightColors}
${vars('space', space).join('\n')}
${vars('radius', radius).join('\n')}
${vars('duration', duration).join('\n')}
${vars('ease', ease, (v) => `cubic-bezier(${v.join(', ')})`).join('\n')}
${vars('font', font, cssFont).join('\n')}
  color-scheme: light;
}

:root[data-theme='dark'] {
${darkColors}
  color-scheme: dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${darkColors.replaceAll('  --', '    --')}
    color-scheme: dark;
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --ie-duration-enter: 0ms;
    --ie-duration-exit: 0ms;
    --ie-duration-highlight: 0ms;
  }
}
`;
writeFileSync(new URL('tokens.css', out), css);

const px = (v) => Number(String(v).replace('px', ''));
const ms = (v) => Number(String(v).replace('ms', ''));
const tokens = {
  color,
  space: Object.fromEntries(Object.entries(space).map(([k, v]) => [k, px(v)])),
  radius: Object.fromEntries(Object.entries(radius).map(([k, v]) => [k, px(v)])),
  motion: {
    duration: Object.fromEntries(Object.entries(duration).map(([k, v]) => [k, ms(v)])),
    ease,
  },
  font,
};
writeFileSync(
  new URL('index.js', out),
  `// Generated from src/tokens.json. Do not edit.\nexport const tokens = ${JSON.stringify(tokens, null, 2)};\n`,
);
const colorKeys = Object.keys(color.light)
  .map((k) => `'${k}'`)
  .join(' | ');
writeFileSync(
  new URL('index.d.ts', out),
  `// Generated from src/tokens.json. Do not edit.
export type ColorToken = ${colorKeys};
export type Theme = 'light' | 'dark';
export declare const tokens: {
  color: Record<Theme, Record<ColorToken, string>>;
  space: Record<'1' | '2' | '3' | '4' | '6' | '8' | '12', number>;
  radius: Record<'sm' | 'md' | 'lg', number>;
  motion: {
    duration: Record<'enter' | 'exit' | 'highlight', number>;
    ease: Record<'out' | 'in', [number, number, number, number]>;
  };
  font: Record<'sans' | 'devanagari' | 'hindi', string[]>;
};
`,
);
console.log(`design tokens: ${Object.keys(color.light).length} colour roles × 2 themes`);
