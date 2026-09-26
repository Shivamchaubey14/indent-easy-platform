#!/usr/bin/env bash
# Installs or updates the Indent Easy stack and deploy agent on one environment VM.
#
#   infrastructure/deploy/install.sh DEV                              # images from ghcr.io
#   IE_REGISTRY=localhost:5000 infrastructure/deploy/install.sh DEV   # e.g. a test registry
#
# Safe to re-run: it copies the stack files and systemd units, but never overwrites the VM's
# secrets (.env) or data. Secrets are generated on the VM itself and never leave it.
set -euo pipefail

ENV_NAME=${1:?usage: install.sh DEV|QA|PROD}
ENV_NAME=$(printf '%s' "$ENV_NAME" | tr '[:lower:]' '[:upper:]')
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
REGISTRY=${IE_REGISTRY:-ghcr.io/shivamchaubey14}
API_REPO=${IE_API_REPO:-$REGISTRY/indent-easy-api}
WEB_REPO=${IE_WEB_REPO:-$REGISTRY/indent-easy-web}
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

echo "[$ENV_NAME] installing on $HOST (images $API_REPO:$LOWER, $WEB_REPO:$LOWER)"
"${SSH[@]}" "$HOST" 'mkdir -p /opt/indent-easy/init /opt/indent-easy/state /tmp/ie-install'
"${SCP[@]}" "$ROOT/infrastructure/deploy/compose.yaml" "$ROOT/infrastructure/deploy/deploy.sh" \
  "$ROOT/infrastructure/deploy/systemd/indent-easy-deploy.service" \
  "$ROOT/infrastructure/deploy/systemd/indent-easy-deploy.timer" \
  "$ROOT/database/init/10-app-role.sh" "$HOST:/tmp/ie-install/"

"${SSH[@]}" "$HOST" bash -s -- "$ENV_NAME" "$LOWER" "$DOMAIN" "$API_REPO" "$WEB_REPO" "$INTROSPECTION" <<'REMOTE'
set -euo pipefail
ENV_NAME=$1 LOWER=$2 DOMAIN=$3 API_REPO=$4 WEB_REPO=$5 INTROSPECTION=$6
D=/opt/indent-easy
install -m 0644 /tmp/ie-install/compose.yaml "$D/compose.yaml"
install -m 0755 /tmp/ie-install/deploy.sh "$D/deploy.sh"
install -m 0755 /tmp/ie-install/10-app-role.sh "$D/init/10-app-role.sh"
printf 'IE_API_REPO=%s\nIE_WEB_REPO=%s\n' "$API_REPO" "$WEB_REPO" > "$D/agent.conf"

# Access-token signing key: an ES256 (P-256) private key as `kid:<base64 PKCS#8 DER>`.
signing_key() {
  printf 'k%s:%s' "$(date +%Y%m%d)" \
    "$(openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 2>/dev/null \
      | openssl pkcs8 -topk8 -nocrypt -outform DER | base64 -w0)"
}

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
JWT_SIGNING_KEYS=$(signing_key)
CSRF_SECRET=$(secret)
GRAPHQL_INTROSPECTION=$INTROSPECTION
ENV
  echo "generated secrets in $D/.env"
fi
# VMs installed before authentication existed hold a random placeholder instead of a key.
if ! grep -q '^JWT_SIGNING_KEYS=k[0-9]*:' "$D/.env"; then
  sed -i "s|^JWT_SIGNING_KEYS=.*|JWT_SIGNING_KEYS=$(signing_key)|" "$D/.env"
  # A release that failed only for want of this key may now be deployed again.
  rm -f "$D/state/failed"
  echo "replaced the placeholder access-token signing key"
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
