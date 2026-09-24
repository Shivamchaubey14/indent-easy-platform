# Indent Easy — SRS Pack

Software Requirements Specification for **Indent Easy**, the modernisation of the ShwetDhara "Easy Indent" Django/MySQL application into a Web + Mobile + API platform.

| Path | What it is | Validation performed |
|---|---|---|
| `srs/Indent-Easy-SRS.md` | The SRS (64 sections + appendices A–F), with 39 Mermaid diagrams; v1.2: WhatsApp removed (DEC-001); live v4 `views.py`/`urls.py`/`stock_report.html` reviewed — Sale & Stock Report specified as implemented (§5.10.2, §11.21) | All 39 diagrams render with Mermaid CLI 11; 287 unique requirement IDs; 55 open questions all cross-referenced |
| `api/schema.graphql` | Complete initial GraphQL contract (406 types, 82 queries, 102 mutations, 9 subscriptions; WhatsApp removed; Sale & Stock Report, STN post, stock condition, other sales, SAP order generator) | `graphql-js` `buildSchema` + `validateSchema`: 0 errors |
| `api/openapi.yaml` | OpenAPI 3.1 for REST: auth, files, exports, webhooks, SAP integrations, health | Redocly CLI lint: valid (warnings only for health/redirect endpoints without 4xx/2xx) |
| `events/event-contracts.schema.json` | JSON Schema (2020-12) for the event envelope + 42 event payloads (WhatsApp channel removed) | Meta-schema check + sample valid/invalid events |
| `database/initial-schema.sql` | PostgreSQL 16+ baseline DDL (19 schemas incl. reporting — stock statement tables with the live Closing formula as a generated column, constraints, partitions, RLS, permission seed) | Applied cleanly to PostgreSQL 16 |
| `database/constraint-smoke-test.sql` | Rolled-back smoke test of the key invariants (no negative stock, ledger idempotency, append-only ledger, non-overlapping cycles, single active cycle, monotonic delivery status, Sale & Stock Report closing formula) | All expected violations raised; closing = 74 as expected |

## Reading guide

- Provenance labels in the SRS: **[LEGACY-CONFIRMED]**, **[LEGACY-DEFECT]**, **[PROPOSED]**, **[NEW]**, **[TBD]**.
- Start with §2 Executive Summary, §5–6 (what the legacy system actually does and where it breaks), then §11 Functional Requirements.
- Scope decision **DEC-001**: WhatsApp removed completely (§1.4). Live v4 code partly reviewed; remaining files requested in OQ-051 (notably `stock_report.py` for the 35-product list, OQ-053).
- Blocking business decisions: **OQ-004** (rotate secrets found in the legacy archive, immediately) and **OQ-020** (reconciliation ledger formula, before Phase 6).

## Suggested location in the monorepo

`docs/srs/`, `docs/api/`, `packages/events/`, `database/migrations/0001_initial.sql`.
