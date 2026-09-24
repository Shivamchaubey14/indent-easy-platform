# Runbook: container images

## API image

`infrastructure/docker/api.Dockerfile` builds one image with two roles:

| Role | Command | Connects as |
|---|---|---|
| API (default) | `node dist/main.js`: GraphQL + REST on `:8080`, metrics on `:9464` | `DATABASE_URL` → `ie_app` |
| Migrator | `node dist/migrate.js`: applies pending migrations, then exits | `MIGRATION_DATABASE_URL` → owner `ie` |

Build and run locally (with `pnpm infra:up` running):

```sh
docker build -f infrastructure/docker/api.Dockerfile -t indent-easy/api:local \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) --build-arg APP_VERSION=0.1.0 .

# migrations first, then the API
docker run --rm --network indent-easy_default \
  -e MIGRATION_DATABASE_URL=postgres://ie:ie_local_only@postgres:5432/indent_easy \
  indent-easy/api:local dist/migrate.js

docker run --rm --network indent-easy_default --read-only -p 4020:8080 --env-file .env \
  -e NODE_ENV=production -e PORT=8080 \
  -e DATABASE_URL=postgres://ie_app:ie_app_local_only@postgres:5432/indent_easy \
  -e REDIS_URL=redis://redis:6379 indent-easy/api:local
```

## How it is built

- **Three stages.** `deps` fetches packages from the lockfile only, so that layer stays cached until
  the lockfile changes. `build` compiles the API and its workspace packages with Turbo and
  assembles production files with `pnpm deploy`. `runtime` is a distroless image.
- **Runtime:** `gcr.io/distroless/nodejs24-debian13`. There's no shell or package manager, and it
  runs as user `10001`. It works with a read-only root filesystem (`--read-only`). The build stage
  uses the same Debian release (`node:24-trixie-slim`), so native modules match.
- **Contents:** compiled `dist/`, production dependencies, and `database/migrations` (at
  `MIGRATIONS_DIR=/app/migrations`, used by the migrator and the readiness check). No source files,
  tests or dev tools. About 59 MB.
- **Build info:** `GIT_COMMIT`, `BUILD_TIME` and `APP_VERSION` build args end up in the OCI labels and
  in `GET /api/v1/version`.
- **Health:** a Docker `HEALTHCHECK` calls `/health/live` with Node's `fetch`, since the image has no curl.
- **Shutdown:** on SIGTERM the API stops taking traffic, finishes in-flight requests and exits 0.

## Security gates (CI job "API image build and scan")

| Check | Tool | Fails on |
|---|---|---|
| Dockerfile lint | hadolint (digest-pinned image) | any warning |
| Vulnerabilities | Trivy (digest-pinned image) | any **High** or **Critical** finding not waived |
| Boot | `docker run --read-only` + `/health/live` | the image not starting |

Waivers go in `.trivyignore`, one CVE per line with a reason, an owner and an expiry date. Prefer
fixing: the base image moved from Debian 12 to Debian 13 because the Debian 12 distroless image
still shipped an OpenSSL with one Critical and five High CVEs.

## Not yet built

- **web** (NGINX serving the SPA): arrives with `apps/web` (step 0.9).
- **worker** and **scheduler**: arrive with step 0.8. They'll reuse this image with different
  commands.
- Publishing to a registry (GHCR) and deploying to the DEV/QA/PROD VMs: step 0.16.
