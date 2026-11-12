# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo. `README.md` covers features and
setup, `PLAN.md` is the build log, and `deploy/README.md` is the full production runbook.

## What this is

**Threadflo**: a multi-tenant inventory and POS app for clothing shops. Every physical piece
has its own barcode. Scan it to bill, scan it again to return it, and look up its history.
It has been live at <https://threadflo.shop> since 2026-10-15. Each shop is a tenant with its
own PostgreSQL schema and its own subdomain (`<slug>.threadflo.shop`, or `<slug>.localhost` in dev).

## Stack

- **Backend:** Django 6, DRF, `django-tenants` (schema per shop) + `django-tenant-users`
  (one user can belong to many shops, with permissions per shop), SimpleJWT. Python 3.12.
- **Auth:** pure JWT, **login by email**. There are no Django sessions or `AuthenticationMiddleware`.
- **DB:** PostgreSQL 17 (Docker in dev). It needs the `pg_trgm` extension because search uses trigram indexes.
- **Frontend:** React 19 + Vite, Tailwind 3, React Router 7, Axios, lucide icons, `jsbarcode`,
  `qz-tray` (direct thermal printing), `driver.js` (onboarding tours).

## Layout

| Path | What |
|---|---|
| `core/` | settings (`SHARED_APPS` / `TENANT_APPS`), root URLs |
| `tenants/` | `Tenant` and `Domain` models. Commands: `seed_demo`, `seed_large`, `bench_api`, `reset_video_shop` |
| `accounts/` | global `User` (subclasses `UserProfile`), JWT, signup, shop picker, per-shop RBAC, platform admin, `ensure_roles` command |
| `inventory/` | categories, sellers, products, variants, batches, `StockItem` (one row per physical unit) |
| `billing/` | bills, returns, store credit, dashboard and search APIs |
| `customers/` | **shared** (public schema) `Customer` keyed by phone. Each shop sees only its own buyers |
| `shopsettings/` | per-shop tax rate, payment methods, sizes and colours, printing settings |
| `frontend/src/` | `api/` (Axios clients), `components/` (`ui/` kit, `layout/`, …), `pages/` (one per screen), `hooks/`, `onboarding/` |
| `deploy/` | deploy script, nginx, systemd, certbot hook, prod env example |
| `tools/` | `make_qz_cert.sh` (QZ signing key) and `videos/` (Playwright recorder for the Help-page videos) |

Tenancy rules:
- Bills store a *soft* `customer_id` plus a name/phone snapshot. There is no FK across schemas.
- A new tenant app goes in `TENANT_APPS`. A model shared by every shop goes in `SHARED_APPS`.
- Tax is applied on the server from shop settings. The server ignores any tax the client sends.

Product and stock rules (all switched in Settings → Products / Printing, stored on `ShopSettings`):
- **One-time products** (`Product.is_one_time`): `inventory.stock.recount` makes one inactive when
  its stock hits 0, but only after it has had stock (`has_had_stock`); restocking reactivates it.
  The product list returns **active only**; `?inactive=1` returns only the inactive ones and `?inactive=all` both. Detail routes
  (edit, add stock, delete) still reach inactive products. `one_time_stock_default` presets new products.
- `hide_product_name`: the name is optional; the server fills one ("Silk Sarees #12") on create.
  The UI then never shows the stored name (`frontend/src/utils/names.js`): unit-level places (stock
  list, POS cart, returns, search, labels, bill/return receipts) show our unit code plus colour/size;
  product-level places show a neutral label like "Silk Sarees #12" (`productLabel`). Links to one
  product use `/products?product=<id>` (backend `?id=`), so a hidden name never lands in a URL.
  When adding a new screen that shows product names, honour `hide_product_name`.
- `require_category`, `require_seller` (`ProductSerializer`) and `require_cost_price`
  (`AddStockSerializer`) are enforced on the server. On edit, only fields being changed are checked.
- Sellers have several phone numbers: `Seller.phones` (list, primary first, up to 6). `Seller.phone` is
  kept as `phones[0]` (`Seller.save` and `SellerSerializer.validate`), so lists and search keep working;
  seller search matches any number (`phones_text` cast). Raw inserts (e.g. `seed_large` COPY) must write `phones`.
- Deleting a product that has sold units returns 400 with a message (the bill FK is `PROTECT`).
- The New product modal creates the product, then calls `add-stock` if any stock lines are filled in.
  The add-stock **Margin %** column is markup on cost (`price = cost × (1 + m/100)`) and is UI-only,
  never sent to the API (`frontend/src/utils/variant.js`).
- **Labels print one image dot per printer dot** (`utils/directPrint.js` `rasterizeLabel`, used when
  `direct.crisp` is set, i.e. labels only): render at 4x, average down to the printer's dpi
  (per-laptop `dpi` in the label profile, default 203, TVS LP 46), threshold to pure black/white, send 1:1
  so QZ never resamples. The barcode is a canvas with a whole number of dots per bar
  (`drawCode128Dots`, 2 dots = 0.25 mm at 203 dpi), centred on a whole dot. Never stretch a barcode
  SVG for labels: uneven bars scan badly. Label prices drop ".00" (`labelPrice`); layout is in `ThermalLabel.jsx`.
- Bill receipts print a CODE128 `INV-xxxxx` barcode (`receipt_show_invoice_barcode`). Scanning it in
  the global search opens the bill (`billing/search.py` `BILL_NO`).

## Dev commands

```bash
docker compose up -d db                                   # Postgres 17 (creds from .env)
source .venv/bin/activate && python manage.py runserver   # API on :8000
cd frontend && npm run dev                                # Vite on :5173, proxies /api → :8000
python manage.py test --noinput                           # backend tests (makes a test DB)
python manage.py makemigrations --check --dry-run         # CI fails if migrations are missing
python manage.py migrate_schemas                          # migrate public + every shop schema
python manage.py seed_demo acme                           # demo data for a shop
cd frontend && npm run lint && npm run build              # what CI runs for the frontend
```

Dev logins: `admin@shop.test` / `admin123` on `localhost:5173` (platform admin), and
`owner@acme.test` / `owner123` on `acme.localhost:5173`. `*.localhost` resolves without
editing the hosts file.

## Conventions

- **Commit messages: no `Co-Authored-By` trailer.** Use the conventional style already in the
  log (`feat(products): …`, `fix(settings): …`).
- Keep `PLAN.md` current for work with several phases: tick the boxes (`[ ]` / `[~]` / `[x]`)
  and add to its changelog.
- Use `migrate_schemas`, never plain `migrate`.

## Production

**A push to `main` that passes CI deploys to production.** `.github/workflows/ci.yml` runs the
backend tests (Postgres 17), the frontend lint and build, and then `deploy/deploy.sh` as the
server's `shop` user. A manual `deploy/deploy.sh` also works, but it needs a clean tree.
`deploy/deploy.sh --rollback` switches back to the previous release. Migrations are not reverted.

| Piece | Where |
|---|---|
| Server | `169.58.71.221` (Ubuntu 24.04). Deploys log in as `shop@`, admin work as `root@` |
| Domains | `threadflo.shop` + `*.threadflo.shop`; `www` redirects to the main site. DNS at **GoDaddy** (A/AAAA for `@` and `*`) |
| Code | `/opt/shop/releases/<time>-<sha>`, current release symlinked at `/opt/shop/app`, 5 kept |
| Venv / settings | `/opt/shop/venv`, `/opt/shop/shared/.env` (mode 600) |
| App | `shop.service` → gunicorn on `127.0.0.1:8001`. Logs: `journalctl -u shop -n 50` |
| DB | Postgres 17, localhost only, db and role `shop`. Nightly `pg_dump` to `/opt/shop/backups` (14 kept) |
| Web | nginx site `shop` (from `deploy/nginx-shop.conf`) + snippet `shop-proxy.conf` |
| TLS | Let's Encrypt wildcard `threadflo.shop`, renewed by DNS-01 through GoDaddy's API (IPv4 only). Hook `/etc/letsencrypt/godaddy-hook.sh` (source `deploy/certbot-godaddy-hook.sh`) |
| Videos | `/opt/shop/media/videos`, uploaded with `deploy/upload-videos.sh`. Deploys don't ship them |
| QZ Tray key | `/opt/shop/shared/qz/` (`key.pem` mode 600), set by `QZ_CERT_FILE` / `QZ_PRIVATE_KEY_FILE` |

### Hard rules: the server is shared

The same box runs **amazon-review**, someone else's app: FastAPI on `127.0.0.1:8000`, nginx
site `amazon-review`, cert `amazon.ecogas.co.in`. **Never disturb it.**

- Touch only what belongs to the shop: `/opt/shop`, `shop.service`, the `shop` database, nginx
  site `shop` + `shop-proxy.conf`, and the `threadflo.shop` cert.
- **Never restart nginx.** Run `nginx -t`, then `systemctl reload nginx`. Before and after any nginx
  change, check that `https://amazon.ecogas.co.in/` still returns 404 and `/docs` still returns 401.
- CI doesn't deploy nginx changes. As root, run
  `cp deploy/nginx-shop.conf /etc/nginx/sites-available/shop && nginx -t && systemctl reload nginx`.
- The `shop` user's sudo rights cover only `systemctl restart shop`. Root SSH is needed only for
  nginx, certbot and sudoers changes.
- **Never print or move secrets:** the GoDaddy API key (`/root/.secrets/godaddy.ini`), the
  prod `.env`, or the QZ `key.pem`. If `key.pem` is regenerated, every shop laptop has to
  re-approve QZ Tray.
