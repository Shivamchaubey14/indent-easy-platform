#!/usr/bin/env bash
# Indent Easy deploy agent. Runs on each environment VM from a systemd timer.
#
# Follows this environment's channel tag (dev, qa or prod) for two images, the API and the web
# tier. When either tag points at a new digest it rolls the release out without downtime:
#   1. migrations (only if the API image changed)
#   2. api-a, then api-b: each must be healthy before the next is replaced, so one always serves;
#      then worker and scheduler
#   3. web (only if the web image changed)
#   4. /health/ready through the web tier must pass
# If any step fails, the previous pair of digests is rolled out the same way, and the failed
# pair is remembered so it isn't retried on every tick.
#
# Nothing ever reaches in from outside: CI only moves tags; this machine pulls.
set -euo pipefail

DIR=${IE_DIR:-/opt/indent-easy}
STATE="$DIR/state"
mkdir -p "$STATE"

# shellcheck source=/dev/null
. /etc/indent-easy/environment # IE_ENV=DEV|QA|PROD
# shellcheck source=/dev/null
. "$DIR/agent.conf" # IE_API_REPO, IE_WEB_REPO, optional IE_CHANNEL
CHANNEL=${IE_CHANNEL:-$(printf '%s' "$IE_ENV" | tr '[:upper:]' '[:lower:]')}

log() { printf '%s [%s] %s\n' "$(date -Is)" "$IE_ENV" "$*"; }
compose() {
  docker compose --project-directory "$DIR" -f "$DIR/compose.yaml" \
    --env-file "$DIR/.env" --env-file "$DIR/release.env" "$@"
}
record() { # result api web [detail]
  printf '{"time":"%s","environment":"%s","channel":"%s","result":"%s","api":"%s","web":"%s","detail":"%s"}\n' \
    "$(date -Is)" "$IE_ENV" "$CHANNEL" "$1" "$2" "$3" "${4:-}" >"$STATE/last-deploy.json"
}
release() { # api web
  printf 'IE_API_IMAGE=%s\nIE_WEB_IMAGE=%s\n' "$1" "$2" >"$DIR/release.env.tmp"
  mv "$DIR/release.env.tmp" "$DIR/release.env"
}
ready() { curl -fsS --max-time 5 http://127.0.0.1/health/ready >/dev/null; }

# Pull a channel tag and print its digest reference (repo@sha256:...).
resolve() { # repo
  if ! docker pull -q "$1:$CHANNEL" >/dev/null 2>"$STATE/pull.err"; then
    log "cannot pull $1:$CHANNEL: $(tr '\n' ' ' <"$STATE/pull.err")"
    return 1
  fi
  docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$1:$CHANNEL" |
    grep -m1 "^$1@"
}

# Roll out a pair of digests, replacing only what differs from what is running.
roll_out() { # api web running_api running_web
  local api=$1 web=$2 was_api=$3 was_web=$4 svc
  release "$api" "$web"
  # Data services first. --remove-orphans also clears containers from older stack layouts.
  compose up -d --remove-orphans --wait --wait-timeout 120 postgres redis || return 1
  # Also when a replica isn't running (first deploy of this layout, or one was removed by hand).
  if [ "$api" != "$was_api" ] || [ -z "$(compose ps -q api-a 2>/dev/null)" ] ||
    [ -z "$(compose ps -q api-b 2>/dev/null)" ]; then
    compose run --rm migrate || return 1
    for svc in api-a api-b; do
      compose up -d --no-deps --wait --wait-timeout 180 "$svc" || return 1
    done
  fi
  # Worker and scheduler run the API image too. Events wait safely in the outbox while the
  # worker restarts, so they don't need a rolling replacement.
  if [ "$api" != "$was_api" ] || [ -z "$(compose ps -q worker 2>/dev/null)" ] ||
    [ -z "$(compose ps -q scheduler 2>/dev/null)" ]; then
    compose up -d --no-deps --wait --wait-timeout 120 worker scheduler || return 1
  fi
  if [ "$web" != "$was_web" ] || [ -z "$(compose ps -q web 2>/dev/null)" ]; then
    compose up -d --no-deps --wait --wait-timeout 60 web || return 1
  fi
  ready
}

capture_failure() {
  {
    echo "== containers"
    compose ps -a 2>&1 || true
    for svc in api-a api-b worker scheduler web; do
      echo "== $svc health checks"
      docker inspect --format '{{if .State.Health}}{{range .State.Health.Log}}{{.End}} exit={{.ExitCode}} {{.Output}}{{println}}{{end}}{{end}}' \
        "$(compose ps -aq "$svc" 2>/dev/null | head -n1)" 2>&1 || true
    done
    echo "== logs"
    compose logs --no-color --tail 60 api-a api-b worker scheduler web 2>&1 || true
  } >"$STATE/failed-deploy.log"
}

# One deploy at a time.
exec 9>"$STATE/deploy.lock"
if ! flock -n 9; then
  log "another deploy is running; skipping"
  exit 0
fi

new_api=$(resolve "$IE_API_REPO") || exit 1
new_web=$(resolve "$IE_WEB_REPO") || exit 1
cur_api=$(cat "$STATE/current-api" 2>/dev/null || cat "$STATE/current" 2>/dev/null || true) # older agents kept only the API digest
cur_web=$(cat "$STATE/current-web" 2>/dev/null || true)

if [ "$new_api" = "$cur_api" ] && [ "$new_web" = "$cur_web" ]; then
  exit 0 # nothing to do
fi
if [ "$new_api $new_web" = "$(cat "$STATE/failed" 2>/dev/null || true)" ]; then
  exit 0 # already tried and rolled back; wait for a new tag
fi

log "deploying api=${new_api##*@} web=${new_web##*@} (was api=${cur_api##*@} web=${cur_web##*@})"
if roll_out "$new_api" "$new_web" "$cur_api" "$cur_web"; then
  printf '%s\n' "$new_api" >"$STATE/current-api"
  printf '%s\n' "$new_web" >"$STATE/current-web"
  [ -n "$cur_api" ] && printf '%s\n%s\n' "$cur_api" "$cur_web" >"$STATE/previous"
  rm -f "$STATE/failed"
  record deployed "$new_api" "$new_web"
  log "deployed api=${new_api##*@} web=${new_web##*@}"
  docker image prune -f >/dev/null || true
  exit 0
fi

capture_failure
printf '%s %s\n' "$new_api" "$new_web" >"$STATE/failed"
if [ -z "$cur_api" ]; then
  record failed "$new_api" "$new_web" "first deploy failed; nothing to roll back to"
  log "FAILED; nothing to roll back to (logs: $STATE/failed-deploy.log)"
  exit 1
fi
log "FAILED api=${new_api##*@} web=${new_web##*@}; rolling back (logs: $STATE/failed-deploy.log)"
if roll_out "$cur_api" "$cur_web" "$new_api" "$new_web"; then
  record rolled-back "$new_api" "$new_web" "running the previous release"
  log "rolled back to api=${cur_api##*@} web=${cur_web##*@}"
else
  record rollback-failed "$new_api" "$new_web" "the previous release did not become ready either"
  log "ROLLBACK FAILED: the previous release is not ready either"
fi
exit 1
