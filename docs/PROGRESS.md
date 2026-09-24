# Indent Easy — Progress

Single source of truth for where the build stands. Update the checklist and the session log at the
end of every session. Roadmap phases come from SRS §62; timelines are not estimated there.

**Current phase:** 0 — Foundation
**Next task:** 0.9b ship the web app (NGINX image, two API replicas behind it, rolling deploy without downtime, CI and release for the web image, live test on DEV). Then 0.8 worker/scheduler. PRs #1 → #10 are stacked; merge them in order. After #7 reaches `dev`, make the CI checks required (see 0.13). After the first image publish, make the GHCR package public (runbook `environments.md`).

**Repo:** https://github.com/Shivamchaubey14/indent-easy-platform (public). `main` and `dev` are protected. Branches are `feature/*` → PR → `dev`, and `dev` → PR → `main` at phase milestones. The owner merges PRs; they are not merged from the build session.

## Phase roadmap (SRS §62)

| # | Phase | Status |
|---|---|---|
| 0 | Foundation — monorepo, local infra, skeleton apps, CI, design tokens, i18n scaffold | **In progress** |
| 1 | Identity & Admin — auth, users/roles/permissions, masters, number series, audit, settings, flags | — |
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
- [ ] 0.8 `apps/worker` + `apps/scheduler` skeletons — BullMQ, outbox relay stub, leader lock
- [x] 0.9 `apps/web` (PR #10): Vite 8 + React 19, TanStack Router (file-based) + Query, typed GraphQL (client-preset codegen), Zustand (ui persisted, session in memory), Tailwind 4 on the design tokens, GSAP entrance via `useEnter` (token ease, reduced motion respected), i18next EN/HI (defaults to the browser's language). Screens: app shell, dashboard with live API/DB status and feature flags, and a login screen (auth is Phase 1). First-load JS 131.6 KB gzip of a 250 KB budget.
- [ ] 0.9b Ship the web app: NGINX image, two API replicas, rolling deploy, CI/release for the web image
- [~] 0.10 `packages/design-tokens` done (PR #10): W3C tokens → CSS vars (light/dark/system, reduced motion) + a typed object for React Native; 14 WCAG contrast pairs tested. `packages/ui` (Radix primitives, Storybook) still to do; minimal primitives live in `apps/web/src/components/ui.tsx` for now.
- [ ] 0.11 `apps/mobile` skeleton — Expo dev build, Expo Router, Zustand, Reanimated (decide `node-linker`)
- [ ] 0.12 ESLint + boundaries rules, Vitest, Testcontainers smoke test
- [x] 0.13 GitHub Actions CI (PR #7). Two jobs: `Format, types, unit tests, build` (plus OpenAPI lint and a docs artifact) and `Migrations, invariants, RLS` (real Postgres, drift gate, 8 invariant asserts, integration tests). Green on GitHub. **To do once #7 is in `dev`:** make both checks required on `dev` and `main`. Doing it earlier would block #1–#6, which never run CI.
- [x] 0.13a API documentation site `apps/docs` (PR #6): guide, REST (Scalar), GraphQL (SpectaQL), events, status generated from the API build. Published by CI to Cloudflare Pages behind Cloudflare Access, and the deploy refuses to publish without the gate. **Waiting on the user:** Cloudflare account, Access app and GitHub secrets (`docs/runbooks/api-docs.md`)
- [x] 0.14 API image (`infrastructure/docker/api.Dockerfile`, PR #8): distroless Debian 13, UID 10001, read-only root filesystem, about 60 MB compressed (285 MB unpacked), also the migrator (`dist/migrate.js`). CI lints, builds, scans (Trivy: 0 High/Critical) and boot-tests it. The web image waits for 0.9. Runbook: `docs/runbooks/containers.md`
- [x] 0.15 DEV/QA/PROD Hyper-V VMs (DEC-003): scripts in `infrastructure/vm/`, runbook `docs/runbooks/environments.md`. All three VMs created. DEV booted and verified (cloud-init clean, fixed IP, NAT internet, Docker 29 + Compose, ufw, IST, swap). QA and PROD have identical images but haven't been booted yet (PR #4)
- [x] 0.16 Deployment (PR #9): VM stack `infrastructure/deploy/` (Postgres, Redis, migrator, API) + deploy agent (systemd timer, follows the dev/qa/prod tag, auto-rollback). CI pushes `sha-<commit>` and moves `dev`; `release.yml` promotes rc tags to QA and release tags to PROD (with approval and an identical-to-rc check). GitHub environments dev/qa/production/docs created, production needs the owner's approval. **Tested live on DEV** with a registry inside the VM: first deploy, a broken release rolled back, an upgrade, a timer-driven deploy and a reboot. Still to do: GHCR publishing runs for real only after merge; installing on QA/PROD (`install.sh QA|PROD`); PROD backups off-host.

**Exit criteria (§62):** a hello-world request goes through the whole pipeline; OQ-003, OQ-004, and OQ-022 are closed.

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
