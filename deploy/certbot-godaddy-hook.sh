#!/bin/sh
# certbot DNS-01 hook for GoDaddy DNS: adds / removes the _acme-challenge TXT record so
# the wildcard certificate (threadflo.shop + *.threadflo.shop) can be issued and renewed.
#
# Install: /etc/letsencrypt/godaddy-hook.sh (root, 700). Key: /root/.secrets/godaddy.ini
# (600) with GD_Key=... and GD_Secret=... lines. certbot passes CERTBOT_DOMAIN and
# CERTBOT_VALIDATION, and remembers the hooks for renewals:
#   certbot certonly --manual --preferred-challenges dns \
#     --manual-auth-hook "/etc/letsencrypt/godaddy-hook.sh auth" \
#     --manual-cleanup-hook "/etc/letsencrypt/godaddy-hook.sh cleanup" \
#     -d threadflo.shop -d '*.threadflo.shop'
set -eu

KEYS=/root/.secrets/godaddy.ini
KEY=$(sed -nE 's/^GD_Key *= *//p' "$KEYS" | tr -d '\r ')
SECRET=$(sed -nE 's/^GD_Secret *= *//p' "$KEYS" | tr -d '\r ')
ZONE=threadflo.shop
API="https://api.godaddy.com/v1/domains/$ZONE/records"

# _acme-challenge for the apex, _acme-challenge.<sub> for a subdomain of the zone.
SUB=${CERTBOT_DOMAIN%"$ZONE"}
NAME="_acme-challenge${SUB:+.${SUB%.}}"

# GoDaddy's API has no IPv6 address, hence -4.
gd() { curl -4 -sS --fail-with-body -H "Authorization: sso-key $KEY:$SECRET" -H "Content-Type: application/json" "$@"; }

case "${1:-}" in
  auth)
    # PATCH appends, so the apex and wildcard values can sit side by side.
    gd -X PATCH "$API" -d "[{\"type\":\"TXT\",\"name\":\"$NAME\",\"data\":\"$CERTBOT_VALIDATION\",\"ttl\":600}]"
    # Wait until GoDaddy's own nameservers serve it (usually under a minute).
    for _ in $(seq 1 60); do
      dig +short TXT "$NAME.$ZONE" @ns47.domaincontrol.com | grep -q "$CERTBOT_VALIDATION" && break
      sleep 5
    done
    sleep 15
    ;;
  cleanup)
    # Both values share one name, so the second cleanup finds nothing (404): fine.
    gd -X DELETE "$API/TXT/$NAME" >/dev/null 2>&1 || true
    ;;
  *)
    echo "usage: $0 auth|cleanup" >&2; exit 2
    ;;
esac
