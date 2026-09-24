// Builds the API documentation site into dist/.
//
//   /           portal with live implementation figures
//   /guide/     cross-cutting rules (auth, headers, errors, idempotency, pagination)
//   /rest/      OpenAPI reference (Scalar, bundled locally)
//   /graphql/   GraphQL reference (SpectaQL)
//   /events/    domain event catalogue from the JSON Schema
//   /status/    which operations this build implements (from the API's api-surface.json)
//
// Everything is static and self-contained (no CDN), so it can sit behind an access gate.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSchema } from 'graphql';
import { marked } from 'marked';
import { parse as parseYaml } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const repo = join(root, '..', '..');
const dist = join(root, 'dist');
const sources = {
  openapi: join(repo, 'docs', 'api', 'openapi.yaml'),
  sdl: join(repo, 'packages', 'graphql', 'schema', 'schema.graphql'),
  events: join(repo, 'packages', 'events', 'schema', 'event-contracts.schema.json'),
  surface: join(repo, 'apps', 'api', 'dist', 'api-surface.json'),
  guide: join(root, 'content', 'guide.md'),
};
if (!existsSync(sources.surface)) {
  throw new Error('apps/api/dist/api-surface.json is missing: build @ie/api first (turbo does this)');
}

const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const commit =
  process.env['GITHUB_SHA']?.slice(0, 7) ??
  (() => {
    try {
      return execSync('git rev-parse --short HEAD', { cwd: repo }).toString().trim();
    } catch {
      return 'local';
    }
  })();
const builtAt = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

const NAV = [
  ['', 'Overview'],
  ['guide/', 'Guide'],
  ['rest/', 'REST'],
  ['graphql/', 'GraphQL'],
  ['events/', 'Events'],
  ['status/', 'Status'],
];

function page({ path, title, body, prose = false, head = '' }) {
  const base = path === '' ? './' : '../';
  const nav = NAV.map(
    ([href, label]) =>
      `<a href="${base}${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · Indent Easy API</title>
<link rel="stylesheet" href="${base}assets/site.css">
${head}
</head>
<body>
<header class="site"><div class="inner"><a class="brand" href="${base}">Indent Easy API</a><nav>${nav}</nav></div></header>
<main${prose ? ' class="prose"' : ''}>
${body}
</main>
<footer class="site">Built ${esc(builtAt)} from commit <code>${esc(commit)}</code>. Internal documentation; access is restricted.</footer>
</body>
</html>
`;
}

function write(relative, content) {
  const file = join(dist, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

const table = (headers, rows) =>
  `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

// ---------------------------------------------------------------------------------------------
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'assets'), { recursive: true });
copyFileSync(join(root, 'src', 'site.css'), join(dist, 'assets', 'site.css'));
writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
// Cloudflare Pages response headers.
writeFileSync(
  join(dist, '_headers'),
  `/*
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`,
);

const openapi = parseYaml(readFileSync(sources.openapi, 'utf8'));
const sdl = readFileSync(sources.sdl, 'utf8');
const schema = buildSchema(sdl);
const events = JSON.parse(readFileSync(sources.events, 'utf8'));
const surface = JSON.parse(readFileSync(sources.surface, 'utf8'));

// --- Guide -----------------------------------------------------------------------------------
marked.use({
  renderer: {
    table(token) {
      return `<div class="table-wrap">${marked.Renderer.prototype.table.call(this, token)}</div>`;
    },
  },
});
const guideHtml = marked.parse(readFileSync(sources.guide, 'utf8'));
write('guide/index.html', page({ path: 'guide/', title: 'Guide', body: guideHtml, prose: true }));

// --- REST (Scalar) ---------------------------------------------------------------------------
const scalarJs = join(root, 'node_modules', '@scalar', 'api-reference', 'dist', 'browser', 'standalone.js');
copyFileSync(scalarJs, join(dist, 'assets', 'scalar.js'));
mkdirSync(join(dist, 'rest'), { recursive: true });
copyFileSync(sources.openapi, join(dist, 'rest', 'openapi.yaml'));
write(
  'rest/index.html',
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>REST reference · Indent Easy API</title>
<style>
  /* Scoped: the site stylesheet would clash with Scalar's own layout. */
  body { margin: 0; }
  .ie-header { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; padding: 12px 16px;
    border-bottom: 1px solid #e3e6eb; font: 14px/1.4 system-ui, 'Segoe UI', Roboto, sans-serif; background: #fff; }
  .ie-header a { color: #5b6675; text-decoration: none; padding: 6px 10px; border-radius: 6px; }
  .ie-header a.brand { color: #1c2430; font-weight: 700; font-size: 16px; padding: 0; }
  .ie-header a[aria-current='page'], .ie-header a:hover { color: #1c2430; background: #f1f3f6; }
  @media (prefers-color-scheme: dark) {
    .ie-header { background: #181e26; border-color: #2a323d; }
    .ie-header a { color: #9aa5b3; }
    .ie-header a.brand, .ie-header a[aria-current='page'], .ie-header a:hover { color: #e6eaf0; background: #1f2630; }
  }
</style>
</head>
<body>
<nav class="ie-header"><a class="brand" href="../">Indent Easy API</a>${NAV.map(
    ([href, label]) => `<a href="../${href}"${href === 'rest/' ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('')}</nav>
<div id="app"></div>
<script src="../assets/scalar.js"></script>
<script>
  Scalar.createApiReference('#app', {
    url: './openapi.yaml',
    hideClientButton: true,
    telemetry: false,
    showDeveloperTools: 'never',
    // No "Ask AI": the contract must not be sent to a third-party service.
    agent: { disabled: true },
    mcp: { disabled: true },
  });
</script>
</body>
</html>
`,
);

// --- GraphQL (SpectaQL) ----------------------------------------------------------------------
const spectaqlDir = join(tmpdir(), `ie-spectaql-${process.pid}`);
mkdirSync(spectaqlDir, { recursive: true });
const posix = (p) => p.replaceAll('\\', '/');
const spectaqlConfig = join(spectaqlDir, 'spectaql.yml');
writeFileSync(
  spectaqlConfig,
  `spectaql:
  targetDir: ${posix(join(dist, 'graphql'))}
  displayAllServers: true
introspection:
  schemaFile: ${posix(sources.sdl)}
info:
  title: Indent Easy GraphQL API
  description: >-
    The primary API for the web and mobile apps. Conventions (authentication, errors,
    idempotency, pagination) are in the [guide](../guide/); which operations are implemented
    is on the [status page](../status/).
servers:
${openapi.servers.map((s) => `  - url: ${s.url}/graphql\n    description: ${JSON.stringify(s.description)}`).join('\n')}
`,
);
execSync(`pnpm exec spectaql "${spectaqlConfig}"`, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
rmSync(spectaqlDir, { recursive: true, force: true });
// SpectaQL's page is standalone; add a way back to the rest of the docs.
const graphqlIndex = join(dist, 'graphql', 'index.html');
writeFileSync(
  graphqlIndex,
  readFileSync(graphqlIndex, 'utf8')
    .replace('<head>', '<head><meta name="robots" content="noindex, nofollow">')
    .replace(
      /<body([^>]*)>/,
      `<body$1><a href="../" style="position:fixed;top:12px;right:16px;z-index:1000;padding:6px 12px;border-radius:6px;background:#1c2430;color:#fff;font:14px system-ui,sans-serif;text-decoration:none">← All API docs</a>`,
    ),
);

// --- Events ----------------------------------------------------------------------------------
const defs = events.$defs;
const payloadByEvent = {};
for (const branch of events.allOf) {
  const type = branch.if?.properties?.eventType?.const;
  const ref = branch.then?.properties?.payload?.$ref;
  if (type && ref) payloadByEvent[type] = ref.split('/').pop();
}
function typeOf(s) {
  if (!s) return 'any';
  if (s.$ref) return s.$ref.split('/').pop();
  if (s.const !== undefined) return `"${s.const}"`;
  if (s.enum && s.enum.length > 8) return `string (one of ${s.enum.length} values, listed below)`;
  if (s.enum) return s.enum.map((v) => `"${v}"`).join(' | ');
  if (s.type === 'array') return `${typeOf(s.items)}[]`;
  const t = Array.isArray(s.type) ? s.type.join(' | ') : (s.type ?? 'object');
  return s.format ? `${t} (${s.format})` : t;
}
function propsTable(def) {
  const required = new Set(def.required ?? []);
  const props = Object.entries(def.properties ?? {});
  // Only show a Notes column when the schema actually describes a field.
  const withNotes = props.some(([, s]) => s.description);
  const rows = props.map(
    ([name, s]) =>
      `<tr><td><code>${esc(name)}</code></td><td><code>${esc(typeOf(s))}</code></td><td>${required.has(name) ? 'yes' : ''}</td>${withNotes ? `<td class="muted">${esc(s.description ?? '')}</td>` : ''}</tr>`,
  );
  const headers = ['Field', 'Type', 'Required', ...(withNotes ? ['Notes'] : [])];
  return rows.length ? table(headers, rows) : '<p class="muted">No fields.</p>';
}
const eventNames = Object.keys(payloadByEvent).sort();
const eventsBody = `
<h1>Domain events</h1>
<p class="lede">Every business change is written to a transactional outbox together with the change itself, then delivered to consumers (notifications, documents, projections, integrations). Consumers must be idempotent by <code>eventId</code> and tolerate redelivery. Contract: <code>packages/events/schema/event-contracts.schema.json</code>.</p>
<h2 id="envelope">Envelope</h2>
<p>Every event has these fields; <code>payload</code> depends on <code>eventType</code>.</p>
${propsTable(defs.Envelope)}
<h2>Events (${eventNames.length})</h2>
<ul class="jump">${eventNames.map((e) => `<li><a href="#${e}">${e}</a></li>`).join('')}</ul>
${eventNames
  .map(
    (e) => `<section class="event" id="${e}"><h3>${e}</h3>${defs[payloadByEvent[e]]?.description ? `<p>${esc(defs[payloadByEvent[e]].description)}</p>` : ''}${propsTable(defs[payloadByEvent[e]])}</section>`,
  )
  .join('\n')}
`;
write('events/index.html', page({ path: 'events/', title: 'Events', body: eventsBody }));

// --- Status ----------------------------------------------------------------------------------
const implemented = {
  Query: new Set(surface.graphql.query),
  Mutation: new Set(surface.graphql.mutation),
  Subscription: new Set(surface.graphql.subscription),
};
const badge = (done) =>
  done ? '<span class="badge done">Implemented</span>' : '<span class="badge planned">Planned</span>';
function rootFields(typeName) {
  const type = schema.getType(typeName);
  return Object.values(type?.getFields() ?? {}).map((field) => {
    const auth = field.astNode?.directives?.find((d) => d.name.value === 'auth');
    const permission = auth?.arguments?.[0]?.value?.value ?? '';
    return { name: field.name, permission, description: field.description ?? '', done: implemented[typeName].has(field.name) };
  });
}
const graphqlSections = ['Query', 'Mutation', 'Subscription'].map((typeName) => {
  const fields = rootFields(typeName);
  const done = fields.filter((f) => f.done).length;
  const anchor = typeName.toLowerCase();
  return {
    typeName,
    total: fields.length,
    done,
    html: `<h2 id="${anchor}">${typeName === 'Query' ? 'Queries' : typeName === 'Mutation' ? 'Mutations' : 'Subscriptions'} <span class="muted">(${done} of ${fields.length})</span></h2>
${table(
  ['Operation', 'Status', 'Permission', 'Description'],
  fields.map(
    (f) =>
      `<tr data-row><td><a href="../graphql/#${anchor}-${f.name}"><code>${esc(f.name)}</code></a></td><td>${badge(f.done)}</td><td>${f.permission ? `<code>${esc(f.permission)}</code>` : '<span class="muted">signed-in user</span>'}</td><td class="muted">${esc(f.description)}</td></tr>`,
  ),
)}`,
  };
});
const restServed = new Set(surface.rest.map((r) => r.operationId));
const restOps = Object.entries(openapi.paths).flatMap(([path, ops]) =>
  Object.entries(ops)
    .filter(([m]) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
    .map(([method, op]) => ({ method: method.toUpperCase(), path, op, done: restServed.has(op.operationId) })),
);
const restDone = restOps.filter((o) => o.done).length;
const statusBody = `
<h1>Implementation status</h1>
<p class="lede">Generated from the API build at commit <code>${esc(commit)}</code>: an operation is <em>Implemented</em> only if this build of the API serves it. Everything else is specified in the contract and answers <code>NOT_IMPLEMENTED</code> (GraphQL) or <code>404</code> (REST) until its phase is built.</p>
<input class="filter" type="search" placeholder="Filter operations…" aria-label="Filter operations" id="filter">
${graphqlSections.map((s) => s.html).join('\n')}
<h2 id="rest">REST <span class="muted">(${restDone} of ${restOps.length})</span></h2>
${table(
  ['Method', 'Path', 'Status', 'Area', 'Summary'],
  restOps.map(
    (o) =>
      `<tr data-row><td><code>${o.method}</code></td><td><code>${esc(o.path)}</code></td><td>${badge(o.done)}</td><td>${esc((o.op.tags ?? []).join(', '))}</td><td class="muted">${esc(o.op.summary ?? '')}</td></tr>`,
  ),
)}
<script>
  const input = document.getElementById('filter');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    for (const row of document.querySelectorAll('[data-row]')) {
      row.hidden = q !== '' && !row.textContent.toLowerCase().includes(q);
    }
  });
</script>
`;
write('status/index.html', page({ path: 'status/', title: 'Status', body: statusBody }));

// --- Portal ----------------------------------------------------------------------------------
const gqlTotal = graphqlSections.reduce((n, s) => n + s.total, 0);
const gqlDone = graphqlSections.reduce((n, s) => n + s.done, 0);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const card = (href, title, text, figure) =>
  `<a class="card" href="${href}"><h2>${title}</h2><p>${text}</p>${figure ?? ''}</a>`;
const progress = (done, total, label) =>
  `<div class="figure"><strong>${done}</strong> of ${total} ${label}<div class="progress"><span style="width:${pct(done, total)}%"></span></div></div>`;
const portalBody = `
<h1>Indent Easy API</h1>
<p class="lede">Reference for the platform behind indents, approvals, purchase orders, receipts, transfers, inventory, MPP sales and SAP reconciliation. Start with the guide, then use the references.</p>
<div class="cards">
${card('guide/', 'Guide', 'Authentication, headers, errors, idempotency, pagination and limits: the rules every call follows.')}
${card('graphql/', 'GraphQL reference', 'The primary API for the web and mobile apps: every query, mutation, subscription and type.', progress(gqlDone, gqlTotal, 'operations implemented'))}
${card('rest/', 'REST reference', 'Authentication, files, webhooks, SAP integration and health, with request/response schemas.', progress(restDone, restOps.length, 'endpoints implemented'))}
${card('events/', 'Domain events', 'Events published through the transactional outbox, with their payloads.', `<div class="figure"><strong>${eventNames.length}</strong> event contracts</div>`)}
${card('status/', 'Implementation status', 'Which operations this build serves, with the permission each one requires.')}
</div>
`;
write('index.html', page({ path: '', title: 'Overview', body: portalBody }));

console.log(
  `docs: GraphQL ${gqlDone}/${gqlTotal}, REST ${restDone}/${restOps.length}, ${eventNames.length} events -> ${posix(dist)}`,
);
