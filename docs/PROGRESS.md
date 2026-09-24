# Indent Easy — Progress

Single source of truth for where the build stands. Update the checklist and the session log at the
end of every session. Roadmap phases come from SRS §62; timelines are not estimated there.

**Current phase:** 0 — Foundation
**Next task:** 0.5 — shared `packages/` (tsconfig, config, graphql, validation, domain-types)

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
- [ ] 0.5 Shared packages: `tsconfig`, `config` (Zod env loader), `graphql` (move schema + codegen), `validation`, `domain-types`, `events` (TS types from JSON Schema)
- [ ] 0.6 `apps/api` skeleton — Express 5 + GraphQL Yoga, `/health/{live,ready,startup}`, Pino, graceful shutdown, DB + Redis clients
- [ ] 0.7 Drizzle wired to the existing schema (introspect `0001_initial.sql`), migrations take over from the entrypoint mount
- [ ] 0.8 `apps/worker` + `apps/scheduler` skeletons — BullMQ, outbox relay stub, leader lock
- [ ] 0.9 `apps/web` skeleton — Vite + React + TanStack Router/Query + Tailwind; login page shell; EN/HI i18n
- [ ] 0.10 `packages/design-tokens` + `packages/ui` v0 (SRS §40)
- [ ] 0.11 `apps/mobile` skeleton — Expo dev build, Expo Router (decide `node-linker`)
- [ ] 0.12 ESLint + boundaries rules, Vitest, Testcontainers smoke test
- [ ] 0.13 Git repo + GitHub remote + Actions CI (lint, typecheck, test, db smoke)
- [ ] 0.14 Dockerfiles (api, web) per §44.2

**Exit criteria (§62):** a hello-world request goes through the whole pipeline; OQ-003, OQ-004, and OQ-022 are closed.

## Open business questions that block progress

| ID | Question | Blocks |
|---|---|---|
| OQ-004 | Rotate/revoke secrets found in the legacy archive (Django key, Gmail app password, WhatsApp token) | Urgent — independent of the build |
| OQ-003 | Production data volumes / peak load | Phase 0 exit, sizing |
| OQ-022 | Hosting target (on-prem k8s vs managed cloud); includes the production object store | Phase 0 exit, deploy |
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
