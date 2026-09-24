#!/usr/bin/env bash
# Indent Easy deploy agent. Runs on each environment VM from a systemd timer.
#
# Follows this environment's channel tag in the registry (dev, qa or prod). When the tag points
# at a new image digest it deploys that digest: migrations first, then the API, and it waits
# until the API reports ready. If the new version doesn't become ready, it puts the previous
# digest back and remembers the bad one so it isn't retried on every tick.
#
# Nothing ever reaches in from outside: CI only moves tags; this machine pulls.
set -euo pipefail

DIR=${IE_DIR:-/opt/indent-easy}
STATE="$DIR/state"
mkdir -p "$STATE"

# shellcheck source=/dev/null
. /etc/indent-easy/environment # IE_ENV=DEV|QA|PROD
# shellcheck source=/dev/null
. "$DIR/agent.conf" # IE_IMAGE_REPO, optional IE_CHANNEL
CHANNEL=${IE_CHANNEL:-$(printf '%s' "$IE_ENV" | tr '[:upper:]' '[:lower:]')}

log() { printf '%s [%s] %s\n' "$(date -Is)" "$IE_ENV" "$*"; }
compose() {
  docker compose --project-directory "$DIR" -f "$DIR/compose.yaml" \
    --env-file "$DIR/.env" --env-file "$DIR/release.env" "$@"
}
record() { # result digest [detail]
  printf '{"time":"%s","environment":"%s","channel":"%s","result":"%s","digest":"%s","detail":"%s"}\n' \
    "$(date -Is)" "$IE_ENV" "$CHANNEL" "$1" "$2" "${3:-}" >"$STATE/last-deploy.json"
}
release() { printf 'IE_IMAGE=%s\n' "$1" >"$DIR/release.env.tmp" && mv "$DIR/release.env.tmp" "$DIR/release.env"; }
ready() { curl -fsS --max-time 5 http://127.0.0.1/health/ready >/dev/null; }

# One deploy at a time.
exec 9>"$STATE/deploy.lock"
if ! flock -n 9; then
  log "another deploy is running; skipping"
  exit 0
fi

if ! docker pull -q "$IE_IMAGE_REPO:$CHANNEL" >/dev/null 2>"$STATE/pull.err"; then
  log "cannot pull $IE_IMAGE_REPO:$CHANNEL: $(tr '\n' ' ' <"$STATE/pull.err")"
  exit 1
fi
new=$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$IE_IMAGE_REPO:$CHANNEL" |
  grep -m1 "^$IE_IMAGE_REPO@" || true)
if [ -z "$new" ]; then
  log "no digest for $IE_IMAGE_REPO:$CHANNEL"
  exit 1
fi

current=$(cat "$STATE/current" 2>/dev/null || true)
if [ "$new" = "$current" ]; then
  exit 0 # nothing to do
fi
if [ "$new" = "$(cat "$STATE/failed" 2>/dev/null || true)" ]; then
  exit 0 # already tried and rolled back; wait for a new tag
fi

log "deploying $new (was: ${current:-nothing})"
release "$new"
if compose up -d --remove-orphans --wait --wait-timeout 240 && ready; then
  printf '%s\n' "$new" >"$STATE/current"
  [ -n "$current" ] && printf '%s\n' "$current" >"$STATE/previous"
  rm -f "$STATE/failed"
  record deployed "$new"
  log "deployed $new"
  docker image prune -f >/dev/null || true
  exit 0
fi

# The new version did not become ready: keep its logs and health history, then go back.
{
  echo "== containers"
  compose ps -a 2>&1 || true
  echo "== api health checks"
  docker inspect --format '{{range .State.Health.Log}}{{.End}} exit={{.ExitCode}} {{.Output}}{{println}}{{end}}' \
    "$(compose ps -aq api 2>/dev/null | head -n1)" 2>&1 || true
  echo "== logs"
  compose logs --no-color --tail 80 migrate api 2>&1 || true
} >"$STATE/failed-deploy.log"
printf '%s\n' "$new" >"$STATE/failed"
if [ -z "$current" ]; then
  record failed "$new" "first deploy failed; nothing to roll back to"
  log "FAILED $new; nothing to roll back to (logs: $STATE/failed-deploy.log)"
  exit 1
fi
log "FAILED $new; rolling back to $current (logs: $STATE/failed-deploy.log)"
release "$current"
if compose up -d --remove-orphans --wait --wait-timeout 240 && ready; then
  record rolled-back "$new" "running $current"
  log "rolled back to $current"
else
  record rollback-failed "$new" "previous $current did not become ready either"
  log "ROLLBACK FAILED: $current is not ready either"
fi
exit 1
