# Indent Easy

Indent-to-reconciliation platform for Shwetdhara Milk Producer Company Limited. It replaces the legacy
Django "Easy Indent" application with a web app, an offline-capable mobile app and a GraphQL/REST API.

It covers:

- indents and configurable approvals
- purchase orders and vendor communication
- GRN against PO and STN
- inter-location transfers
- ledger-based inventory
- MPP advance sales with proof of delivery
- finance cycles and SAP reconciliation

## Stack

| Layer   | Technology                                                           |
| ------- | -------------------------------------------------------------------- |
| API     | Node.js 24, TypeScript, Express 5, GraphQL Yoga, Drizzle ORM, BullMQ |
| Web     | React, Vite, TanStack Router/Query, Zustand, Tailwind CSS, GSAP      |
| Mobile  | React Native (Expo), Zustand, Reanimated, SQLite offline store       |
| Data    | PostgreSQL 16, Redis 7, S3-compatible object storage                 |
| Tooling | pnpm workspaces, Turborepo, Docker                                   |

## Getting started

Prerequisites: Node.js 22+, pnpm 10, Docker Desktop.

```sh
pnpm install
cp .env.example .env
pnpm infra:up      # PostgreSQL, Redis, MinIO, Mailpit
pnpm db:migrate    # apply database migrations
pnpm db:seed       # development organisation and feature flags
pnpm api:dev       # API on http://localhost:4000
pnpm web:dev       # web app on http://localhost:5173 (proxies the API)
pnpm worker:dev    # event relay, consumers and maintenance jobs
pnpm ui:storybook  # component library on http://localhost:6006
```

| Service       | URL                                 |
| ------------- | ----------------------------------- |
| PostgreSQL    | `localhost:5432` (db `indent_easy`) |
| Redis         | `localhost:6380`                    |
| MinIO console | http://localhost:9001               |
| Mailpit       | http://localhost:8025               |

## Code quality

```sh
pnpm lint          # ESLint: correctness, architecture boundaries, i18n (from the repo root)
pnpm typecheck
pnpm test          # unit tests
pnpm test:integration   # needs `pnpm infra:up` and `pnpm db:reset`
```

Architecture rules are part of lint. Packages never import apps. A web feature never reaches
into another feature. API code outside a module uses only its `index.ts`, and the domain layer
imports no frameworks. `scripts/ci/check-lint-rules.mjs` proves each of these still rejects a
planted violation.

## Repository layout

```text
apps/            api, worker, scheduler, web, mobile
packages/        shared config, GraphQL contract, validation, types, events, UI
database/        SQL migrations and integrity checks
infrastructure/  Docker Compose and deployment configuration
docs/            SRS, API contracts, ADRs, runbooks
```

## Environments

| Environment | Purpose                         | Updated                                                  |
| ----------- | ------------------------------- | -------------------------------------------------------- |
| DEV         | Integration of the `dev` branch | Automatically on every merge to `dev`                    |
| QA          | Testing and user acceptance     | When a release candidate `vX.Y.Z-rc.N` is tagged         |
| PROD        | Live use                        | When a release `vX.Y.Z` is tagged on `main` and approved |

Each environment is an Ubuntu VM under Hyper-V running the stack with Docker Compose. The same image moves from DEV to QA to PROD without being rebuilt.

## Branching

- `main` is the released line. It only changes through pull requests from `dev`.
- `dev` is the integration branch.
- Work happens on `feature/*` and `fix/*` branches cut from `dev`, and merges back through pull requests.

## Documentation

- Requirements: [`docs/srs/Indent-Easy-SRS.md`](docs/srs/Indent-Easy-SRS.md)
- GraphQL contract: [`packages/graphql/schema/schema.graphql`](packages/graphql/schema/schema.graphql)
- REST contract: [`docs/api/openapi.yaml`](docs/api/openapi.yaml)
- API documentation site (published behind Cloudflare Access): [`docs/runbooks/api-docs.md`](docs/runbooks/api-docs.md)
- Domain events, worker and scheduler: [`docs/runbooks/events.md`](docs/runbooks/events.md)
- Container images: [`docs/runbooks/containers.md`](docs/runbooks/containers.md)
- Database schema and migrations: [`docs/runbooks/database.md`](docs/runbooks/database.md)
- Environments (DEV, QA, PROD): [`docs/runbooks/environments.md`](docs/runbooks/environments.md)
- Build progress: [`docs/PROGRESS.md`](docs/PROGRESS.md)
