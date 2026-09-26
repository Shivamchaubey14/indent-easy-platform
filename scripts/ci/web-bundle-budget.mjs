// SRS §17.4 / §46.2: the JavaScript needed for the first page (entry chunk plus everything
// index.html preloads) must stay within 250 KB gzip. Route chunks loaded later don't count.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 250;
const dist = 'apps/web/dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const initial = [
  ...new Set([...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1])),
];
if (initial.length === 0) throw new Error('no JavaScript referenced from index.html');

let total = 0;
for (const file of initial) {
  const size = gzipSync(readFileSync(join(dist, 'assets', file))).length;
  total += size;
  console.log(`  ${file.padEnd(40)} ${(size / 1024).toFixed(1)} KB`);
}
const chunks = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js')).length;
const kb = total / 1024;
console.log(
  `initial JS ${kb.toFixed(1)} KB gzip of ${BUDGET_KB} KB budget (${initial.length} of ${chunks} chunks)`,
);
if (kb > BUDGET_KB) {
  console.error(
    `::error::initial JavaScript is ${kb.toFixed(1)} KB gzip, over the ${BUDGET_KB} KB budget`,
  );
  process.exit(1);
}
