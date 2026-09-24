#!/usr/bin/env bash
# Installs or updates the Indent Easy stack and deploy agent on one environment VM.
#
#   infrastructure/deploy/install.sh DEV            # uses ghcr.io/shivamchaubey14/indent-easy-api
#   IE_IMAGE_REPO=localhost:5000/indent-easy-api infrastructure/deploy/install.sh DEV
#
# Safe to re-run: it copies the stack files and systemd units, but never overwrites the VM's
# secrets (.env) or data. Secrets are generated on the VM itself and never leave it.
set -euo pipefail

ENV_NAME=${1:?usage: install.sh DEV|QA|PROD}
ENV_NAME=$(printf '%s' "$ENV_NAME" | tr '[:lower:]' '[:upper:]')
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
IMAGE_REPO=${IE_IMAGE_REPO:-ghcr.io/shivamchaubey14/indent-easy-api}
KEY=${IE_SSH_KEY:-$HOME/.ssh/indent_easy_vms}

read -r IP DOMAIN ADMIN < <(node -e '
  const c = require(process.argv[1]);
  const e = c.environments.find((x) => x.name === process.argv[2]);
  if (!e) { console.error("unknown environment " + process.argv[2]); process.exit(1); }
  console.log(e.ip, c.network.domain, c.adminUser);
' "$ROOT/infrastructure/vm/environments.json" "$ENV_NAME")

HOST="$ADMIN@$IP"
LOWER=$(printf '%s' "$ENV_NAME" | tr '[:upper:]' '[:lower:]')
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
SCP=(scp -q -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
INTROSPECTION=false
[ "$ENV_NAME" != PROD ] && INTROSPECTION=true

echo "[$ENV_NAME] installing on $HOST (image $IMAGE_REPO:$LOWER)"
"${SSH[@]}" "$HOST" 'mkdir -p /opt/indent-easy/init /opt/indent-easy/state /tmp/ie-install'
"${SCP[@]}" "$ROOT/infrastructure/deploy/compose.yaml" "$ROOT/infrastructure/deploy/deploy.sh" \
  "$ROOT/infrastructure/deploy/systemd/indent-easy-deploy.service" \
  "$ROOT/infrastructure/deploy/systemd/indent-easy-deploy.timer" \
  "$ROOT/database/init/10-app-role.sh" "$HOST:/tmp/ie-install/"

"${SSH[@]}" "$HOST" bash -s -- "$ENV_NAME" "$LOWER" "$DOMAIN" "$IMAGE_REPO" "$INTROSPECTION" <<'REMOTE'
set -euo pipefail
ENV_NAME=$1 LOWER=$2 DOMAIN=$3 IMAGE_REPO=$4 INTROSPECTION=$5
D=/opt/indent-easy
install -m 0644 /tmp/ie-install/compose.yaml "$D/compose.yaml"
install -m 0755 /tmp/ie-install/deploy.sh "$D/deploy.sh"
install -m 0755 /tmp/ie-install/10-app-role.sh "$D/init/10-app-role.sh"
printf 'IE_IMAGE_REPO=%s\n' "$IMAGE_REPO" > "$D/agent.conf"

if [ ! -f "$D/.env" ]; then
  secret() { openssl rand -base64 36 | tr -d '/+=\n' | cut -c1-40; }
  umask 077
  cat > "$D/.env" <<ENV
# Generated on this VM by install.sh on $(date -I). Never copy these values off the machine.
APP_ENV=$LOWER
PUBLIC_BASE_URL=http://$LOWER.$DOMAIN
CORS_ALLOWED_ORIGINS=http://$LOWER.$DOMAIN
POSTGRES_PASSWORD=$(secret)
IE_APP_PASSWORD=$(secret)
# Placeholder until authentication (Phase 1) replaces it with an ES256 JWK set.
JWT_SIGNING_KEYS=$(secret)
CSRF_SECRET=$(secret)
GRAPHQL_INTROSPECTION=$INTROSPECTION
ENV
  echo "generated secrets in $D/.env"
fi
chmod 600 "$D/.env"

sudo install -m 0644 /tmp/ie-install/indent-easy-deploy.service /etc/systemd/system/
sudo install -m 0644 /tmp/ie-install/indent-easy-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now indent-easy-deploy.timer >/dev/null
rm -rf /tmp/ie-install
echo "timer: $(systemctl is-active indent-easy-deploy.timer)"
systemctl list-timers indent-easy-deploy.timer --no-pager --no-legend | awk '{print "next check: " $1 " " $2 " " $3}'
REMOTE
echo "[$ENV_NAME] done. Follow deploys with: ssh $HOST journalctl -fu indent-easy-deploy"
