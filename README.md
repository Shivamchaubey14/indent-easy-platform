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
pnpm db:smoke      # verify database invariants
```

| Service       | URL                                 |
| ------------- | ----------------------------------- |
| PostgreSQL    | `localhost:5432` (db `indent_easy`) |
| Redis         | `localhost:6380`                    |
| MinIO console | http://localhost:9001               |
| Mailpit       | http://localhost:8025               |

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
- Environments (DEV, QA, PROD): [`docs/runbooks/environments.md`](docs/runbooks/environments.md)
- Build progress: [`docs/PROGRESS.md`](docs/PROGRESS.md)
