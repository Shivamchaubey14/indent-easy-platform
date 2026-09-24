# syntax=docker/dockerfile:1.7
#
# Indent Easy API image (SRS §44.2). One image, several roles:
#   default     node dist/main.js     the API (GraphQL + REST) on :8080, metrics on :9464
#   migrator    node dist/migrate.js  applies database migrations, then exits
# Build from the repository root:
#   docker build -f infrastructure/docker/api.Dockerfile -t indent-easy/api .

ARG NODE_VERSION=24

# --- Dependencies: fetched from the lockfile alone, so this layer is reused until it changes ---
FROM node:${NODE_VERSION}-trixie-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile

# --- Build: compile the API and its workspace packages, then assemble production files -------
FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@ie/api..." \
 && pnpm turbo run build --filter "@ie/api..." \
 && pnpm --filter @ie/api deploy --prod --legacy /out \
 && cp -r database/migrations /out/migrations

# --- Runtime: distroless Node, no shell or package manager, non-root ------------------------
FROM gcr.io/distroless/nodejs${NODE_VERSION}-debian13:nonroot AS runtime
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
ARG APP_VERSION=0.0.0
LABEL org.opencontainers.image.title="indent-easy-api" \
      org.opencontainers.image.source="https://github.com/Shivamchaubey14/indent-easy-platform" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.created="${BUILD_TIME}" \
      org.opencontainers.image.version="${APP_VERSION}"
WORKDIR /app
COPY --from=build --chown=10001:10001 /out /app
ENV NODE_ENV=production \
    PORT=8080 \
    METRICS_PORT=9464 \
    MIGRATIONS_DIR=/app/migrations \
    GIT_COMMIT=${GIT_COMMIT} \
    BUILD_TIME=${BUILD_TIME} \
    APP_VERSION=${APP_VERSION} \
    NODE_OPTIONS="--enable-source-maps --max-old-space-size=768"
USER 10001
EXPOSE 8080 9464
# No shell or curl in the image: the probe uses Node's own fetch.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
ENTRYPOINT ["/nodejs/bin/node"]
CMD ["dist/main.js"]
