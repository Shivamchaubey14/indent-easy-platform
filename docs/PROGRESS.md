# Indent Easy — Progress

Single source of truth for where the build stands. Update the checklist and the session log at the
end of every session. Roadmap phases come from SRS §62; timelines are not estimated there.

**Current phase:** 0 — Foundation
**Next task:** 0.7 (Drizzle), then 0.13/0.14/0.16 (CI, Dockerfiles, deployment pipeline to the VMs). PRs #1 → #2 → #3 → #4 are stacked; merge them in order.

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
- [ ] 0.7 Drizzle wired to the existing schema (introspect `0001_initial.sql`), migrations take over from the entrypoint mount
- [ ] 0.8 `apps/worker` + `apps/scheduler` skeletons — BullMQ, outbox relay stub, leader lock
- [ ] 0.9 `apps/web` skeleton — Vite + React + TanStack Router/Query + Zustand (session/ui stores) + Tailwind + GSAP (`useGSAP`); login page shell; EN/HI i18n
- [ ] 0.10 `packages/design-tokens` (incl. motion tokens shared by GSAP and Reanimated) + `packages/ui` v0 (SRS §40)
- [ ] 0.11 `apps/mobile` skeleton — Expo dev build, Expo Router, Zustand, Reanimated (decide `node-linker`)
- [ ] 0.12 ESLint + boundaries rules, Vitest, Testcontainers smoke test
- [ ] 0.13 Actions CI (lint, typecheck, test, db smoke); then make CI a required check on `main`/`dev`. The repo and branch protection are already done.
- [ ] 0.14 Dockerfiles (api, web) per §44.2
- [x] 0.15 DEV/QA/PROD Hyper-V VMs (DEC-003): scripts in `infrastructure/vm/`, runbook `docs/runbooks/environments.md`. All three VMs created. DEV booted and verified (cloud-init clean, fixed IP, NAT internet, Docker 29 + Compose, ufw, IST, swap). QA and PROD have identical images but haven't been booted yet (PR #4)
- [ ] 0.16 Deployment pipeline: VM compose stack (NGINX web + api + worker + scheduler + PG + Redis + MinIO), deploy agent (systemd timer following the env tag), GHCR images built once on `dev`, promote workflows (rc tag → QA, release tag + `production` approval → PROD), PROD backups off-host

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
