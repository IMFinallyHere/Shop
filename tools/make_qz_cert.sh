#!/usr/bin/env bash
# Self-signed certificate + private key that the site uses to sign QZ Tray requests
# (direct printing), so shops can tick "Remember this decision" once per laptop.
# Usage: tools/make_qz_cert.sh <dir>     → <dir>/cert.pem (public), <dir>/key.pem (secret)
# Then point QZ_CERT_FILE / QZ_PRIVATE_KEY_FILE at them. Never commit key.pem.
set -euo pipefail
dir=${1:?usage: $0 <output dir>}
mkdir -p "$dir"
umask 077
openssl req -x509 -newkey rsa:2048 -sha512 -days 3650 -nodes \
  -subj "/CN=Threadflo direct printing" \
  -keyout "$dir/key.pem" -out "$dir/cert.pem"
chmod 600 "$dir/key.pem"; chmod 644 "$dir/cert.pem"
echo "Wrote $dir/cert.pem and $dir/key.pem"
