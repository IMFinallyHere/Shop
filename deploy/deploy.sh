#!/usr/bin/env bash
# Deploy the committed HEAD to production (from a laptop or GitHub Actions):
#   build the frontend → upload a new release → install deps → migrate every schema
#   → switch /opt/shop/app to it → restart the shop service → health check.
# Runs as the `shop` user, which owns /opt/shop and may only restart shop.service
# (sudoers), so a deploy can't touch anything else on the server. How-to videos live
# in /opt/shop/media/videos and are uploaded separately (deploy/upload-videos.sh).
#
# Usage: deploy/deploy.sh            Roll back: deploy/deploy.sh --rollback
set -euo pipefail

HOST=${DEPLOY_HOST:-shop@169.58.71.221}
DOMAIN=${DEPLOY_DOMAIN:-threadflo.shop}
cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--rollback" ]]; then
  ssh "$HOST" bash -s <<'EOF'
set -euo pipefail
cur=$(readlink -f /opt/shop/app)
prev=$(ls -1dt /opt/shop/releases/* | grep -vx "$cur" | head -1)
[[ -n "$prev" ]] || { echo "No earlier release to roll back to." >&2; exit 1; }
ln -sfn "$prev" /opt/shop/app.new && mv -T /opt/shop/app.new /opt/shop/app
sudo systemctl restart shop
echo "Rolled back to $prev (database migrations are not reverted)."
EOF
  exit
fi

# Production always matches a commit.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Uncommitted changes; commit or stash them first." >&2
  exit 1
fi

SHA=$(git rev-parse --short HEAD)
REL="/opt/shop/releases/$(date +%Y%m%d-%H%M%S)-$SHA"
echo "==> Deploying $SHA to $HOST as $REL"

echo "==> Building frontend for $DOMAIN"
(cd frontend && npm ci --silent && VITE_MAIN_DOMAIN="$DOMAIN" npm run build --silent)

echo "==> Uploading"
ssh "$HOST" "mkdir -p '$REL'"
git archive --format=tar HEAD | ssh "$HOST" "tar -x -C '$REL'"
# COPYFILE_DISABLE keeps macOS metadata (._* files) out of the archive.
# Videos are served from /opt/shop/media/videos, not shipped with every release.
COPYFILE_DISABLE=1 tar -C frontend --exclude dist/videos -cf - dist | ssh "$HOST" "tar -x -C '$REL/frontend'"

echo "==> Installing, migrating, switching"
ssh "$HOST" REL="$REL" bash -s <<'EOF'
set -euo pipefail
ln -sfn /opt/shop/shared/.env "$REL/.env"
chmod -R u=rwX,go=rX "$REL"
/opt/shop/venv/bin/pip install --quiet --no-cache-dir --disable-pip-version-check -r "$REL/requirements.txt"
cd "$REL"
/opt/shop/venv/bin/python manage.py migrate_schemas --noinput
ln -sfn "$REL" /opt/shop/app.new && mv -T /opt/shop/app.new /opt/shop/app
sudo systemctl restart shop
# Keep the five newest releases for rollback.
ls -1dt /opt/shop/releases/* | tail -n +6 | xargs -r rm -rf
EOF

echo "==> Health check"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  # 401 = Django answered (the endpoint needs a login); anything else is a problem.
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/api/auth/me/" || true)
  if [[ "$code" == "401" ]]; then echo "OK: https://$DOMAIN is serving $SHA"; exit 0; fi
  sleep 2
done
echo "Health check failed (last HTTP $code). Logs: ssh $HOST journalctl -u shop -n 50" >&2
exit 1
