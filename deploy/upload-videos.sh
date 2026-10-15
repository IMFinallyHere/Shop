#!/usr/bin/env bash
# Upload the how-to videos (recorded by tools/videos into frontend/public/videos) to the
# server. They live outside the releases in /opt/shop/media/videos, served by nginx at
# /videos/, so code deploys (including GitHub Actions, which doesn't have them) never
# need to ship them. Run after re-recording.
set -euo pipefail
HOST=${DEPLOY_HOST:-shop@169.58.71.221}
cd "$(dirname "$0")/.."
SRC=frontend/public/videos
[[ -f "$SRC/index.json" ]] || { echo "No videos in $SRC. Record them first (tools/videos)." >&2; exit 1; }
TMP="/opt/shop/media/videos.new"
ssh "$HOST" "rm -rf '$TMP' && mkdir -p '$TMP'"
COPYFILE_DISABLE=1 tar -C "$SRC" -cf - . | ssh "$HOST" "tar -x -C '$TMP' && chmod -R u=rwX,go=rX '$TMP' \
  && rm -rf /opt/shop/media/videos.old && { [ ! -d /opt/shop/media/videos ] || mv /opt/shop/media/videos /opt/shop/media/videos.old; } \
  && mv '$TMP' /opt/shop/media/videos && rm -rf /opt/shop/media/videos.old && ls /opt/shop/media/videos | wc -l"
echo "Videos uploaded."
