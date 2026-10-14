# Production deploy

Server `169.58.71.221` (Ubuntu 24.04) also runs **amazon-review** (FastAPI on 127.0.0.1:8000,
nginx site `amazon-review`). Everything below only **adds** to the server: its own user,
folder, database, port, nginx site file and certificate. Nothing of amazon-review's is
edited or restarted.

| Piece | Where |
|---|---|
| Domains | `shop.gokuldelicacy.in` + `*.shop.gokuldelicacy.in`, both DNS only (grey) in Cloudflare |
| Code | `/opt/shop/releases/<time>-<sha>`, current one symlinked at `/opt/shop/app` |
| Python venv | `/opt/shop/venv` |
| Settings | `/opt/shop/shared/.env` (from `env.production.example`, mode 600) |
| API | `shop.service` → gunicorn on 127.0.0.1:8001 |
| Database | PostgreSQL 17, localhost only, database and role `shop` |
| Web | `/etc/nginx/sites-available/shop` (from `nginx-shop.conf`) |
| TLS | Let's Encrypt `shop.gokuldelicacy.in` + wildcard, DNS-01 via `/root/.secrets/cloudflare.ini` |
| Backups | `/opt/shop/backups`, nightly `pg_dump`, 14 kept |

## Every deploy

```bash
deploy/deploy.sh             # commit first; deploys HEAD
deploy/deploy.sh --rollback  # back to the previous release (migrations stay applied)
```

## One-time setup (run as root on the server)

```bash
# 1. Packages. PostgreSQL 17 from the PGDG repo, the same major version as dev.
apt-get update
apt-get install -y postgresql-common python3.12-venv python3-certbot-dns-cloudflare
/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
apt-get install -y postgresql-17

# 2. User, folders, venv.
useradd --system --home-dir /opt/shop --shell /usr/sbin/nologin shop
install -d -o root -g root -m 755 /opt/shop
install -d -o shop -g shop -m 755 /opt/shop/releases
install -d -o shop -g shop -m 700 /opt/shop/shared /opt/shop/backups
sudo -u shop python3 -m venv /opt/shop/venv

# 3. Database. pg_trgm needs a superuser, so it is created here, not by migrations.
DBPW=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE shop LOGIN PASSWORD '$DBPW'"
sudo -u postgres createdb -O shop shop
sudo -u postgres psql -d shop -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"

# 4. Settings: env.production.example → /opt/shop/shared/.env with SECRET_KEY and DB_PASSWORD=$DBPW.
chown shop:shop /opt/shop/shared/.env && chmod 600 /opt/shop/shared/.env

# 5. Certificate. DNS-01 only, so nginx and the amazon-review cert are not touched.
certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 \
  -d shop.gokuldelicacy.in -d '*.shop.gokuldelicacy.in' \
  --deploy-hook "systemctl reload nginx" --non-interactive --agree-tos -m <email>

# 6. Service (from the laptop: scp deploy/shop.service root@server:/etc/systemd/system/).
systemctl daemon-reload && systemctl enable shop
```

Then from the laptop run `deploy/deploy.sh` (it starts the service), and on the server:

```bash
# 7. Public tenant for the main domain + the platform admin.
cd /opt/shop/app
sudo -u shop /opt/shop/venv/bin/python manage.py create_public_tenant \
  --domain_url shop.gokuldelicacy.in --owner_email <admin email>
# Set the admin's password with: … manage.py shell (accounts.User.set_password)

# 8. nginx site. Stop if `nginx -t` fails, and remove the symlink.
cp deploy/nginx-shop.conf /etc/nginx/sites-available/shop
ln -s /etc/nginx/sites-available/shop /etc/nginx/sites-enabled/shop
nginx -t && systemctl reload nginx

# 9. Nightly backup at 02:30, 14 kept.
cat > /etc/cron.d/shop-backup <<'CRON'
30 2 * * * shop pg_dump -Fc shop > /opt/shop/backups/shop-$(date +\%F).dump && find /opt/shop/backups -name 'shop-*.dump' -mtime +14 -delete
CRON
```

## Checks

```bash
curl -sI https://amazon.ecogas.co.in/ | head -1   # unchanged before and after nginx steps
systemctl status shop amazon-review
ss -tlnp | grep -E ':(8000|8001|5432)\b'          # all on 127.0.0.1 only
certbot renew --dry-run
journalctl -u shop -n 50                          # API logs
```
