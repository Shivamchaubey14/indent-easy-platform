# Indent Easy — Progress

Single source of truth for where the build stands. Update the checklist and the session log at the
end of every session. Roadmap phases come from SRS §62; timelines are not estimated there.

**Current phase:** 1 — Identity & Admin
**Next task:** 1.2 authorization: role templates and the Appendix C permission seed per organisation, scoped role assignments, `authorize()`, the `me` query, and sign-in required for GraphQL. PRs #14 (component library), #15 (mobile) and #16 (authentication) are stacked; merge in order. Before #16 reaches DEV, re-run `infrastructure/deploy/install.sh DEV` (see docs/runbooks/auth.md).

**Repo:** https://github.com/Shivamchaubey14/indent-easy-platform (public). `main` and `dev` are protected. Branches are `feature/*` → PR → `dev`, and `dev` → PR → `main` at phase milestones. The owner merges PRs; they are not merged from the build session.

## Phase roadmap (SRS §62)

| # | Phase | Status |
|---|---|---|
| 0 | Foundation — monorepo, local infra, skeleton apps, CI, design tokens, i18n scaffold | **Done** (exit criteria still wait on OQ-003/004) |
| 1 | Identity & Admin — auth, users/roles/permissions, masters, number series, audit, settings, flags | **In progress** |
| 2 | Indent & Approval — indent module, workflow engine, delegation/SLA, approval notifications | — |
| 3 | Purchase & Vendor — procurement queue, PO, SAP PO import, vendor mail + delivery schedule | — |
| 4 | Inventory & Transfer — ledger, stock views, counts, adjustments, STN, Sale & Stock Report | — |
| 5 | GRN & Logistics — GRN vs PO/STN, tolerance, PDFs, advance sale + POD (web) | — |
| 6 | Finance & Reconciliation — cycles, SAP sale import, MPP ledger (blocked on OQ-020), invoices | — |
| 7 | Notifications & Integrations — SMS/push/e-mail adapters, EN/HI templates, delivery tracking | — |
| 8 | Mobile & Offline — Expo app for Store/HOD/Logistics, offline sync | — |
| 9 | Analytics & Reporting — dashboards, report parity, Hindi completion | — |
| 10 | Production Hardening — pen test, load, DR drill, migration rehearsals, cutover | — |

## Phase 0 checklist

- [x] 0.1 Project folder `D:\indent-easy`; SRS pack unpacked into the §63 layout
- [x] 0.2 Tooling on D: — pnpm 10 (`D:\devtools\node-global`), pnpm store, Docker data disk
- [x] 0.3 Local infra via Docker Compose — Postgres 16, Redis 7, MinIO (+ buckets), Mailpit, Gotenberg (opt-in)
- [x] 0.4 Monorepo root — `package.json`, `pnpm-workspace.yaml`, `turbo.json`, prettier, `.env.example`, README
- [x] 0.5 Shared packages: `tsconfig`, `config` (Zod env loader), `graphql` (move schema + codegen), `validation`, `domain-types`, `events` (TS types from JSON Schema). PR #1
- [x] 0.6 `apps/api` skeleton: Express 5 + GraphQL Yoga, `/health/{live,ready,startup}`, Pino, graceful shutdown, DB + Redis clients (PR #3)
- [x] 0.7 Drizzle: `@ie/db` package, `0000_baseline` + `0001_app_role` migrations, `ie_app` role so RLS applies, readiness gated on migrations, 9 integration tests (PR #5). Runbook: `docs/runbooks/database.md`
- [x] 0.8 Worker + scheduler (PR #12), as extra entry points of the API image (SRS §44.1): outbox relay (NOTIFY + 1 s poll, SKIP LOCKED), a BullMQ queue per consumer, inbox dedupe, per-aggregate ordering via consumer_position, retries 5 s…30 min, dead letters, maintenance jobs (outbox/inbox prune, lag alert), and a Redis leader lock for the scheduler. `appendEvent` validates against the event contract. 13 unit + 6 integration tests; verified locally and on the DEV VM. Still to do: the admin dead-letter replay (with the admin console).
- [x] 0.9 `apps/web` (PR #10): Vite 8 + React 19, TanStack Router (file-based) + Query, typed GraphQL (client-preset codegen), Zustand (ui persisted, session in memory), Tailwind 4 on the design tokens, GSAP entrance via `useEnter` (token ease, reduced motion respected), i18next EN/HI (defaults to the browser's language). Screens: app shell, dashboard with live API/DB status and feature flags, and a login screen (auth is Phase 1). First-load JS 131.6 KB gzip of a 250 KB budget.
- [x] 0.9b Ship the web app (PR #11): NGINX web image (unprivileged, read-only, strict CSP, SPA fallback, immutable asset caching), two API replicas (`api-a`, `api-b`) behind it, and a rolling deploy agent for both images. CI builds, scans and boot-tests api and web as a matrix and promotes both. **Tested live on DEV**: API release with 0 failed requests (67/67), broken API release with 0 failed (492/492) plus rollback, web-only release ~0.6 s gap, one-time layout switch ~8 s.
- [x] 0.10 `packages/design-tokens` (PR #10): W3C tokens → CSS vars (light/dark/system, reduced motion) + a typed object for React Native; WCAG contrast pairs tested. `packages/ui` (PR #14): Radix primitives on the tokens, replacing the web app's stopgap components. Button, Card, StatusBadge with the status map (`status-map.ts`; a test checks every status the database allows has a tone), Alert/ErrorState, Loading/Skeleton, Field/TextInput (label, "required" in words, hint and error linked), Dialog (GSAP enter/exit, focus returns to the opener), Menu, Toast (polite, 5 s, confirmations only). The app passes the library its words through `UiStringsProvider`, so EN/HI follow the user. Component tests run axe (0 serious/critical). Storybook 10 with the a11y addon and theme/language toolbars; CI builds it. First-load JS 154.3 KB gzip.
- [x] 0.11 `apps/mobile` (PR #15): Expo SDK 57 (React Native 0.86, New Architecture), Expo Router with Home/More tabs, Zustand preferences (persisted in SQLite key-value storage), Reanimated entrance on the motion tokens (reduced motion respected), i18next EN/HI following the phone's language, Inter + Tiro Devanagari Hindi, colours from the design tokens (light/dark/system), TanStack Query calling the API (readiness + version, pull to refresh), offline banner (NetInfo), on-device SQLite via Drizzle with the mutation queue and sync cursor tables (migrations applied at start-up). Runs in **Expo Go** for now; development builds come with the first native module Expo Go lacks. pnpm stays isolated (no `node-linker=hoisted`). CI bundles the Android app. Runbook: `docs/runbooks/mobile.md`.
- [x] 0.12 ESLint 9 flat config (PR #13), type-aware (typescript-eslint), plus architecture boundaries (eslint-plugin-boundaries v7): packages never import apps; a web feature never reaches into another; shared web code never imports features or routes; API code outside a module uses only its `index.ts`; shared API code is the bottom layer; the domain layer imports no frameworks. Also i18n literal-string checks (I18N-001), `fetch` only via `lib/api.ts`, React hooks and jsx-a11y. `scripts/ci/check-lint-rules.mjs` proves each rule rejects a planted violation (9 probes), and CI runs both. **Testcontainers not adopted:** integration tests already run against real PostgreSQL/Redis (compose locally, service containers in CI), so it would duplicate that.
- [x] 0.13 GitHub Actions CI (PR #7). Two jobs: `Format, types, unit tests, build` (plus OpenAPI lint and a docs artifact) and `Migrations, invariants, RLS` (real Postgres, drift gate, 8 invariant asserts, integration tests). Green on GitHub. **To do once #7 is in `dev`:** make both checks required on `dev` and `main`. Doing it earlier would block #1–#6, which never run CI.
- [x] 0.13a API documentation site `apps/docs` (PR #6): guide, REST (Scalar), GraphQL (SpectaQL), events, status generated from the API build. Published by CI to Cloudflare Pages behind Cloudflare Access, and the deploy refuses to publish without the gate. **Waiting on the user:** Cloudflare account, Access app and GitHub secrets (`docs/runbooks/api-docs.md`)
- [x] 0.14 API image (`infrastructure/docker/api.Dockerfile`, PR #8): distroless Debian 13, UID 10001, read-only root filesystem, about 60 MB compressed (285 MB unpacked), also the migrator (`dist/migrate.js`). CI lints, builds, scans (Trivy: 0 High/Critical) and boot-tests it. The web image waits for 0.9. Runbook: `docs/runbooks/containers.md`
- [x] 0.15 DEV/QA/PROD Hyper-V VMs (DEC-003): scripts in `infrastructure/vm/`, runbook `docs/runbooks/environments.md`. All three VMs created. DEV booted and verified (cloud-init clean, fixed IP, NAT internet, Docker 29 + Compose, ufw, IST, swap). QA and PROD have identical images but haven't been booted yet (PR #4)
- [x] 0.16 Deployment (PR #9): VM stack `infrastructure/deploy/` (Postgres, Redis, migrator, API) + deploy agent (systemd timer, follows the dev/qa/prod tag, auto-rollback). CI pushes `sha-<commit>` and moves `dev`; `release.yml` promotes rc tags to QA and release tags to PROD (with approval and an identical-to-rc check). GitHub environments dev/qa/production/docs created, production needs the owner's approval. **Tested live on DEV** with a registry inside the VM: first deploy, a broken release rolled back, an upgrade, a timer-driven deploy and a reboot. Still to do: GHCR publishing runs for real only after merge; installing on QA/PROD (`install.sh QA|PROD`); PROD backups off-host.

**Exit criteria (§62):** a hello-world request goes through the whole pipeline; OQ-003, OQ-004, and OQ-022 are closed.

## Phase 1 checklist

- [x] 1.1 Authentication API (PR #16): sign-in by e-mail or employee code, Argon2id (upgraded on sign-in when parameters rise), lockout after 5 failures in 15 min, per-IP and per-account limits (Redis), ES256 access tokens (10 min) with JWKS and key rotation, rotating refresh tokens with reuse detection (web: HttpOnly cookie + signed double-submit CSRF; mobile: body), sign-out and sign-out everywhere with an immediate Redis deny-list, password reset by e-mail (30 min, single use, EN/HI), password change, temporary passwords that must be replaced, security and sign-in events. Password rules: 12–128 characters, not built from the user's e-mail or employee code, not breached (Have I Been Pwned, k-anonymity). `pnpm user:create` for the first administrator. Runbook: `docs/runbooks/auth.md`. MFA (AUTH-014) and session listing (AUTH-010) are later "Should" items.
- [ ] 1.2 Authorization: role templates + Appendix C permission seed per organisation, scoped role assignments, `authorize()` (RBAC + scope + policy), `me` query with permissions, sign-in required for GraphQL, `roles_version` checks
- [ ] 1.3 Web sign-in: session store, silent refresh (one refresh across tabs), route guards, sign-out, forgot/reset/change password screens
- [ ] 1.4 Mobile sign-in: refresh token in SecureStore, app lock after background
- [ ] 1.5 Admin console: users (invite, roles, scopes, deactivate, reset), roles, locations, departments, designations
- [ ] 1.6 Masters: products, UOM and conversions, vendors, MPPs, external codes
- [ ] 1.7 Number series, settings, feature-flag admin, audit viewer
- [ ] 1.8 Legacy master-data migration (M1), incl. the OQ-025 decision on legacy password hashes

## Open business questions that block progress

| ID | Question | Blocks |
|---|---|---|
| OQ-004 | Rotate/revoke secrets found in the legacy archive (Django key, Gmail app password, WhatsApp token) | Urgent — independent of the build |
| OQ-003 | Production data volumes / peak load | Phase 0 exit, sizing |
| OQ-022 | Mostly decided (DEC-003): Hyper-V VMs DEV/QA/PROD, Docker Compose. Still open: office server specs (the laptop is the interim host) | Go-live |
| OQ-025 | Legacy password hashes: PBKDF2 adapter vs forced reset | Phase 1 login |
| OQ-020 | Reconciliation ledger formula | Phase 6 |
| OQ-031 | Chart library (ECharts vs Recharts) | Phase 9 dashboards |

## Session log

### 2026-09-24 — kickoff
- Read the SRS pack v1.2 (SRS, GraphQL, OpenAPI, events, DDL). Laid it out as `docs/`, `database/`, `packages/events/`.
- Installed pnpm 10.34.5 to `D:\devtools\node-global`, because corepack couldn't write to Program Files without admin. Put it on user PATH and set the store to `D:\devtools\pnpm-store`.
- Wrote the compose stack. Docker Hub's `minio/minio` is gone, so switched to `quay.io/minio/*`. Mapped Redis to 6380 because the old Windows Redis 3.2 service holds 6379.
- `0001_initial.sql` applied cleanly: 19 schemas, 132 tables. `pnpm db:smoke` raised every expected violation (non-negative stock, idempotency, append-only ledger, cycle overlap, single active cycle, transfer sign) and returned SSR closing = 74.
- No git repo yet. Need a public/private decision before creating the GitHub remote.

### 2026-09-24 — repo, shared packages, Zustand + GSAP
- Created the public repo `indent-easy-platform`. The name `indent-easy` was taken by the legacy Django repo, which was left untouched. Pushed `main` and `dev`, and protected both: PR required, no approvals needed, no force-push or deletion. Merge commits only.
- Built the shared packages with 29 tests. Generated code (GraphQL types, event types) is not committed; Turbo's `codegen` task rebuilds it. graphql 17 is fine: Yoga, codegen and graphql-ws all accept it.
- Zod 4 gotcha: checks keep running after a failed `.regex`, so pass `abort: true` when later refinements assume a well-formed value.
- SRS changed to v1.3 (DEC-002, ADR-016): Zustand is the client state manager on web and mobile, and server data stays in TanStack Query. GSAP handles web animation, and Reanimated handles mobile because GSAP needs the DOM.
- PR #1 (shared packages) → `dev`. PR #2 (SRS change) is stacked on #1 because both touch the README table. Merging #1 retargets #2 to `dev` automatically.

### 2026-09-24: API skeleton, environments
- Started 0.6 on top of PR #2 without waiting for merges. PR #3 contains the API.
- graphql-armor hard-depends on graphql 16, so graphql is pinned to 16 for the whole workspace. graphql 16 also has a dual ESM/CJS package, which makes `instanceof GraphQLError` fail under Vitest; the error mask checks the error's shape instead.
- A Python `http.server` on this laptop holds 127.0.0.1:8080, so the local API runs on port 4000. Containers keep 8080.
- Found generated files tracked since PR #1 (the ignore pattern was root-anchored). Fixed on the PR #1 branch and restacked the later branches.
- Decision DEC-003: three environments, DEV, QA and PROD, as Hyper-V VMs on this laptop for now, moving to an office server later (specs pending). SRS v1.4 adds ADR-017 and R-18. Deployment is pull-based, because self-hosted runners on a public repo are unsafe.
- Hardware limit: 2 cores and 7.7 GB RAM. An earlier attempt at a 2 GB VM failed for lack of memory. VMs use dynamic memory (768 MB start, 2 GB max). Run at most two at a time, with Docker Desktop stopped.
- VMs built from the Ubuntu 26.04 cloud image (checksum verified). Disks are converted with qemu-img, and the cloud-init seed ISO is built with xorriso, both in Docker; no Windows tools needed.
- The first `New-VMSwitch` failed ("Internal miniport create failed … already exists"). Hyper-V rolled it back and a retry succeeded.
- UAC on this laptop elevates as a separate `Administrator` account, so `$env:USERNAME` inside the elevated script is wrong. `create-vms.ps1` now takes `-ForUser` from the normal shell. `Shivam` is in Hyper-V Administrators, effective after the next sign-in. Until then, starting and stopping VMs needs elevation.
- Memory: with Docker Desktop running, only 0.45 GB was free. After `docker desktop stop`, free memory reached 1.5 GB once WSL released its RAM (it takes a minute). DEV booted at 768 MB startup. Docker Desktop is still stopped; run `pnpm infra:up` after starting it again.

### 2026-09-24: Drizzle, app role, RLS enforced
- Resumed with PRs #1–#4 unmerged, so kept stacking (#5 builds on #4).
- DEV was running and Docker Desktop was stopped. I shut DEV down with `sudo systemctl poweroff` over SSH (no UAC needed), then started Docker with Postgres and Redis only, to save RAM.
- drizzle-kit pull skips the 4 partitioned parents, so they are hand-written in `partitioned.ts`, outside drizzle-kit's view. It also mangled things; `scripts/pull-schema.mjs` fixes them all. See the pitfalls table in the database runbook. The worst was the backslash in the phone-number regex: a naive diff would have weakened the CHECK constraint.
- The baseline snapshot is generated from the corrected `schema.ts`. `pnpm db:generate` reports "No schema changes".
- Found that the app connected as the owner, so RLS was never applied. It now connects as `ie_app`, which tests prove sees 0 rows without `app.org_id` and can't write across organisations.
- The Windows dynamic port range was 1024–65535, and Hyper-V had reserved 3407–4440, including API port 4000. With the user's OK, reset it to the default 49152+. **Port 4000 stays blocked until the laptop reboots.** The API now exits with a clear message on EACCES.

### 2026-09-24: API docs site and CI
- The user wanted the docs live but visible only to authorised people. Chose Cloudflare Pages + Cloudflare Access (e-mail one-time PIN, free for up to 50 users), because GitHub Pages can't restrict viewers on a personal account and the VMs aren't reachable from the internet.
- The docs are generated entirely from the contracts and code. REST routes are now declared in one table keyed by operationId and tested against the OpenAPI file. The API build writes `api-surface.json` for the status page.
- Found with headless Edge screenshots: Scalar's layout broke under the site stylesheet, and it showed "Ask AI" and "Generate MCP" on localhost. Fixed with scoped header CSS and `agent`/`mcp` disabled.
- First CI run failed: (1) Turbo strict env mode hid DATABASE_URL from the integration tests (now `passThroughEnv`); (2) `.npmrc` had `store-dir=D:/...`, which on Linux became a directory inside the checkout. The store location now lives only in the user-level pnpm config. Second run green.
- Lesson: never pipe a check into `tail` inside an `&&` chain, because the exit code is lost. That's how an unformatted turbo.json was pushed; it was amended before CI picked it up.

### 2026-09-24: API image
- Built, then ran against the local services: the migrator applies migrations; the API on a read-only root filesystem is ready, answers GraphQL and serves metrics; Docker health is `healthy`; SIGTERM gives a clean exit 0.
- Found and fixed: the whole `apps/api` folder, including src and tests, was copied into the image (pnpm deploy follows `files`, which was unset).
- Trivy: the Debian 12 distroless base still shipped an OpenSSL with 1 Critical and 5 High CVEs, while the Debian 13 base had none. Moved both build and runtime stages to Debian 13.
- CI runs hadolint and Trivy as digest-pinned Docker images instead of third-party actions, to limit supply-chain risk.

### 2026-09-25: deployment pipeline
- DEV first failed to start: after `docker desktop stop` only 0.4–0.65 GB was free (VS Code 1.36 GB, Chrome 810 MB). The user closed apps, 1.36 GB came free and DEV booted.
- Live test on DEV used a temporary registry inside the VM, because GHCR publishing needs the PRs merged. Results: first deploy 34 s; broken release rolled back in about 100 s and wasn't retried; upgrade 8 s with **about 4 s of downtime** (single API container); the timer deployed on its own within 30 s of a tag move; after a reboot the stack was ready in about 100 s.
- Fixed during the test: the failure log now includes container status and health-check history (the broken image printed nothing); the installer's "next run" line used a systemd field monotonic timers don't set.
- DEV now points at GHCR and logs "denied" every 2 minutes until the first publish (and until the package is made public). DEV is powered off to free memory, and Docker Desktop is stopped.
- Installed native actionlint and shellcheck in `D:\devtools\bin` for when Docker is down.

### 2026-09-25: web app
- Verified in headless Edge against the real API through Vite's preview proxy: dashboard in English/light and Hindi/dark, and the login page. Findings fixed: (1) in Hindi even Latin text used Tiro's serif Latin; there's now a `hindi` font token, Inter first then Tiro, so each script gets the right face; (2) the "washed-out" login screenshot was the entrance fade caught mid-animation, and forcing reduced motion confirmed that path.
- jsdom has no `matchMedia`; the test setup stubs it as reduced motion, which skips GSAP in tests.
- New CI checks: `no-colour-literals.sh` (SRS §40.2) and `web-bundle-budget.mjs` (≤ 250 KB initial JS).
- Port 4173 was reserved by Hyper-V (range 4141–4240, until reboot); the preview ran on 4710 instead.

### 2026-09-25: shipping the web app
- Found on resume that the user had merged PRs #1–#9 into `dev`. CI on `dev` published the first API image; the GHCR package pulls anonymously (public). Made the three CI jobs required on `dev` and `main`.
- CodeRabbit (an AI review app the user installed) runs on PRs; it reported "pass" with no comments on #10.
- The NGINX `resolve` upstream parameter (1.27.3+) is essential: a recreated replica gets a new IP. Tested locally: replaced both replicas under 400 requests, with 0 failures and 11 transparent retries.
- Agent bug found before it bit: on the first deploy of the new layout the API digest was unchanged, so api-a/api-b would never have started. The agent now also rolls the API when a replica is missing.
- Test mistake of mine: after the broken-API test I retagged only web, so the "web test" re-deployed the broken API (correctly rolled back). Reran properly: web-only release costs ~0.6 s.
- DEV now follows GHCR for both images. Until #11 merges there is no `indent-easy-web:dev`, so the agent logs "cannot pull" and keeps the current release. DEV is powered off.
- First CI run of #11 failed the web image scan: the full `nginx-unprivileged:1.29-alpine` had 38 High CVEs (curl, c-ares, OpenSSL, libxml2...). Switched to `alpine-slim` + `apk upgrade`: 0 High/Critical and 10 MB instead of 23. hadolint also rejects `USER root` (DL3066); use `USER 0`.

### 2026-09-25: worker and scheduler
- BullMQ 6.3 (ioredis is a peer dependency; connection passed as options with `maxRetriesPerRequest: null`). BullMQ's group ordering is a paid tier, so per-aggregate ordering uses `events.consumer_position`, per the SRS rule.
- Local run: an event inserted into the outbox was processed within about 1 s (NOTIFY). Metrics and health are served on the metrics port. Scheduler failover after a hard kill took about 15 s (the lock TTL). A normal stop releases the lock, so takeover is within 5 s.
- DEV VM: the agent added worker and scheduler to the running stack (35 s; all 7 services healthy; about 800 MB used of 1.9 GB). The event flowed through the VM's own database; the leader registered the schedules and the minute lag check ran.
- CI's database job now has a Redis service (the API integration tests need it). Turbo passes REDIS_URL through.

### 2026-09-26: lint and architecture rules
- Pinned ESLint 9: eslint-plugin-jsx-a11y doesn't support ESLint 10 yet (unmet peer).
- The first run found a **real boundary violation**: `graphql/context.ts` imported `modules/configuration/feature-flags.js` directly. Also fixed: `any` leaking from Express's `req.route` and Vite's `import.meta.env`, a GraphQL error code that could stringify as `[object Object]`, an async event handler whose promise was ignored, and the migrator writing with `console` instead of the JSON logger.
- The rule probes caught a rule that silently did nothing: the boundaries v7 file-path selector for the domain layer never matched. Replaced with a scoped `no-restricted-imports`.
- Lint takes ~110 s cold and ~20 s with the cache (type-aware, whole repo). Run `pnpm lint` from the root.
- Follow-up: `prom-client` is deprecated in favour of `@prometheus-io/client`. The API's metrics work today; switch in a small separate change.

### 2026-09-26: component library
- `@ie/ui` ships TypeScript source (no build step): Vite compiles it inside the web app. `sideEffects` is set so unused components are tree-shaken; without it first-load JS grew by 56 KB instead of 23 KB.
- The Tailwind theme mapping moved from the web app into `@ie/ui/theme.css`, with `@source` so Tailwind sees the library's classes. Added an `overlay` colour token (dialog scrim) for both themes.
- Radix returns focus only to its own `Trigger`; our Dialog is controlled from any button, so it remembers the opener itself. The exit animation keeps the dialog mounted until it finishes.
- "Web image build and scan" is now a required check on `dev` and `main`.

### 2026-09-26: mobile skeleton
- Expo Go instead of a development build for now: everything in the skeleton ships in Expo Go, and the phone already has it. The SRS's development builds (§18.1) are needed once MMKV, SQLCipher or Sentry arrive. MMKV's role (preferences) is covered by `expo-sqlite/kv-store` until then.
- pnpm works with Expo's isolated installs; no hoisted linker needed. But pnpm resolves an optional peer whenever the package exists anywhere in the workspace, so the API's `drizzle-orm` picked up the mobile app's `expo-sqlite` and a test deploy of the API grew to 540 MB. `.pnpmfile.cjs` drops that one peer; both Dockerfiles copy it.
- Expo's recommended TypeScript is 6.0, which then became the auto-installed peer for other packages too, and TS 6 no longer loads Node's types by default (`@ie/graphql` stopped building). The whole repo is pinned to TypeScript 5.9 with a pnpm override; moving to 6 is a separate, repo-wide change.
- React Native 0.86 ships React 19.2 while the web app is on 19.3; each app has its own copy. React Native Testing Library stays on 13 (14 needs React 19.3).
- In development the app finds the API on the computer that served the bundle (port 4000), so a phone on the same Wi-Fi needs no configuration. `EXPO_PUBLIC_API_URL` overrides it.

### 2026-09-26: authentication
- Sign-in has to find an account before any organisation is known, but row-level security hides users outside `app.org_id`. Migration `0002_auth_lookup` adds two narrow owner-defined functions (identifier → user and organisation; user → organisation) granted to the app role; everything else runs inside the organisation's context.
- `JWT_SIGNING_KEYS` is now `kid:<base64 PKCS#8>` ES256 keys. The VM installer generates one and replaces the old random placeholder; existing VMs need `install.sh` re-run before this release reaches them.
- Refresh cookie is `Secure` only under https. The VMs are still plain HTTP: TLS on the VMs is an open item before real users sign in there.
- Password reset links carry the token in the URL fragment, so it never reaches server or proxy logs.
- Rate limits and the deny-list fail open if Redis is down (logged); lockouts and revocations are also in PostgreSQL, so the gap is at most one access-token lifetime.
- Local admin for development: `admin@shwetdhara.local` (password shared in the session, local database only).

