# syntax=docker/dockerfile:1.7
#
# Indent Easy web image: the built SPA served by unprivileged NGINX, which also proxies API
# paths to the api-a / api-b replicas (infrastructure/docker/nginx/nginx.conf).
#   docker build -f infrastructure/docker/web.Dockerfile -t indent-easy/web .

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-trixie-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile

FROM deps AS build
ARG GIT_COMMIT=unknown
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@ie/web..." \
 && VITE_RELEASE="${GIT_COMMIT}" pnpm turbo run build --filter "@ie/web..."

# The slim variant has no curl/c-ares (not needed: the health check uses busybox wget), and
# upgrading at build time picks up Alpine security fixes the base image hasn't shipped yet.
FROM nginxinc/nginx-unprivileged:1.29-alpine-slim AS runtime
USER 0
RUN apk upgrade --no-cache
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
ARG APP_VERSION=0.0.0
LABEL org.opencontainers.image.title="indent-easy-web" \
      org.opencontainers.image.source="https://github.com/Shivamchaubey14/indent-easy-platform" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.created="${BUILD_TIME}" \
      org.opencontainers.image.version="${APP_VERSION}"
COPY infrastructure/docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
# Start nginx directly: the stock entrypoint rewrites config files, which a read-only root
# filesystem does not allow.
ENTRYPOINT ["nginx", "-g", "daemon off;"]
