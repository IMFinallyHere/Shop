# Shop — Multi-Tenancy Build Plan & Progress

> Living document. Each phase is checked off as it lands. Keep this updated as work
> proceeds so any session (human or Claude) can pick up where the last left off.

## Goal & decisions

Turn `Shop` (a single-tenant cloth-shop management app) into a **multi-tenant SaaS**
so it can serve many companies. Confirmed decisions:

- **Multi-shop membership** — one user account can belong to several shops.
- **`django-tenants`** for isolation (PostgreSQL schema per shop).
- **`django-tenant-users`** companion package — required to let one user belong to
  multiple tenants with per-tenant permissions.
- **Self-serve signup** — owner registers → a shop is provisioned automatically.
- **Tenant resolution: subdomain** (`<slug>.localhost` in dev), the `django-tenants`
  default.

Key facts: `django-tenants` 3.10.x supports Django 6.0 but **requires PostgreSQL**
(SQLite cannot do schemas). Schema isolation gives each shop its own
`auth_group`/`auth_permission`, so per-shop roles no longer collide.

---

## Status legend
`[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0 — Finish & commit the in-flight UI refactor  ✅
- [x] `npm run build` clean (98 modules, no errors). Lint errors present but all
      pre-existing in untouched files (SearchInput/AuthContext/PermissionsPage) — not
      regressions from this refactor.
- [x] Committed — bundled into `daa957d "feat: initial changes"` on `main` (committed
      externally together with the settings/README/deletion changes, not isolated).
- Work continues on branch `feat/multi-tenancy`.

## Phase 1 — Prerequisites & cleanup
- [x] Decision: **existing/remote PostgreSQL** (user-provided). `psycopg[binary]==3.3.4`
      added. Verified Python 3.14 compatible (cp314 wheel) and Django 6.0 supported.
- [x] Settings hygiene: middleware list re-derived cleanly (AuthenticationMiddleware
      restored, TenantMainMiddleware added first).
- [x] Removed README `# flow` scratch note; added a Multi-tenancy section.
- [ ] Re-add a minimal test module — **deferred to Phase 4** (needs live DB / tenant
      test cases).

## Phase 2 — Backend: tenancy core
- [x] `django-tenants==3.10.1`, `django-tenant-users==2.2.1` added to requirements +
      installed.
- [x] New `tenants` app: `Tenant(TenantBase)` (+`name`), `Domain(DomainMixin)`.
- [x] `accounts.User` reworked to subclass `tenant_users` `UserProfile`
      (email = USERNAME_FIELD, keeps first_name/last_name). Stale 0001 migration +
      `db.sqlite3` removed; fresh migrations generated (`accounts` 0001/0002,
      `tenants` 0001).
- [x] `core/settings.py`: postgres `django_tenants` backend (reads `DB_*` from `.env`),
      `SHARED_APPS`/`TENANT_APPS`, `TENANT_MODEL`/`TENANT_DOMAIN_MODEL`,
      `TenantMainMiddleware` first, `UserBackend` auth backend, tenant DB router,
      subdomain-aware CORS regex.
- [x] Bootstrap done on remote Postgres (host <remote-db-host>, db `shop`): created the
      `shop` database, `migrate_schemas --shared`, `create_public_tenant` (domain
      `localhost`, owner `admin@shop.test` / pw `admin123`). Validated provisioning in
      shell — saving a Tenant auto-creates its schema + runs tenant migrations; demo
      shop `acme` (`acme.localhost`, owner `owner@acme.test` / pw `owner123`) exists.
- [x] Reworked serializers/views to per-tenant permissions (`UserTenantPermissions`
      as the shop-member resource), email login in `LoginView`, `MeSerializer` for
      tenant-scoped is_staff/is_superuser/group_names. Removed Django
      `AuthenticationMiddleware` (stateless JWT API — no sessions).
- [x] **Validated end-to-end via curl/urllib**: signup→schema, email login→JWT, me,
      per-tenant user/group CRUD, assign-groups, change-password, **tenant isolation**
      (Bella's Cashier group/users invisible to Acme), and **multi-shop membership**
      (one account = Cashier in Bella + member of Acme simultaneously).

## Phase 3 — Self-serve signup & provisioning  ✅
- [x] `POST /api/auth/signup/` (AllowAny, public domain): creates owner + provisions
      shop schema + Domain via `SignupSerializer`; returns `{shop, slug, domain, email}`.
- [x] Per-tenant `assign_groups`/`assign_permissions` operate on `UserTenantPermissions`.
- [x] Frontend: email login (`LoginPage`/`AuthContext`/`api/auth.js`), new
      `RegisterPage` (signup → redirect to `<slug>.localhost:PORT/login`), route added.
      `UserForm`/`UsersPage` switched username→email. Vite proxy `changeOrigin:false`
      + `allowedHosts:true` so the shop subdomain Host reaches django-tenants.
- [x] Validated through the Vite proxy: subdomain login → 200 (correct tenant), signup
      on main domain → 201. Frontend `npm run build` clean (99 modules).

## Phase 3.5 — Shop picker + Platform Admin  ✅
- [x] **Shop picker**: login on the main domain → `/shops`. `GET /api/auth/my-shops/`
      lists the user's shops; picking one redirects to `<slug>.localhost:PORT/dashboard`
      with the JWT passed in the URL **hash** (cross-origin handoff), which
      `AuthContext` consumes on load. Login on a shop subdomain still goes straight to
      `/dashboard`. (`utils/domain.js`, `ShopPickerPage`, `api/shops.js`.)
- [x] **Platform Admin** (`/admin`, gated by `IsPlatformAdmin` = public-schema
      superuser): `GET /api/admin/tenants/` lists every shop (owner, member count,
      created); `GET /api/admin/tenants/<slug>/users/` drills into a shop's members by
      switching schema. `PlatformAdminPage` renders the table + a members modal.
      Platform owner granted `is_superuser` in the public schema (admin@shop.test).
- [x] Validated: admin sees all 5 shops + drill-in; a shop owner gets 403 on
      `/admin/*` and only their own shop in the picker. Frontend build clean (103 mods).
- Note: login on bare `localhost` no longer dead-ends — it routes to the picker.

## Phase 4 — Tests & verification  ✅
- [x] `accounts/tests.py` — 6 passing tests (`python manage.py test accounts`, ~60s).
      Uses a plain `TestCase`: `setUpClass` runs `migrate_schemas --shared`,
      `create_public_tenant`, and `provision_tenant` for two shops; tests drive the API
      via `APIClient(..., HTTP_HOST=<shop>.localhost)`. Added
      `TENANT_USERS_DOMAIN=localhost` setting (used by `provision_tenant`).
      Covers: email login + JWT, public-domain login has no shop perms (403 on
      `/users`), signup provisions a schema, group isolation across shops, one account
      in multiple shops, platform admin lists all shops / non-admin gets 403.
- Note: tests create/destroy a transient `test_shop` database on the configured
  Postgres host (the platform user is a superuser, so CREATEDB is fine).

## Phase 3 — Self-serve signup & provisioning
- [ ] Unauthenticated register endpoint (public domain) → create user +
      `provision_tenant(...)` → return subdomain
- [ ] Frontend `RegisterPage.jsx` + route + `register` in `api/auth.js`; redirect to
      tenant subdomain on success
- [ ] Verify `assign_groups` / `assign_permissions` resolve against tenant-scoped
      Group/Permission querysets

### Verified manually (to be codified as automated tests in Phase 4)
- [x] Signup provisions a schema
- [x] Data in shop A invisible in shop B
- [x] Multi-shop user sees correct roles per shop
- [x] Email login returns JWT + user payload

## Phase 5 — Inventory app  ✅ (first cut)
- [x] New `inventory` app in `TENANT_APPS` (per-shop isolation automatic). Models:
      `Category`, `Seller` (suppliers), `Product` (cloth attrs, cost/price, stock,
      low-stock threshold, optional SKU unique-per-shop), `StockMovement` (audit log).
- [x] DRF API: `/api/categories/`, `/api/sellers/`, `/api/products/` (search, ordering,
      `?low_stock=1`, `?category=`), product actions `adjust-stock` (atomic, blocks
      negative stock, records a movement) and `movements`. Gated by `IsSuperuserOrStaff`.
      Note: Django auto-creates per-model permissions in each schema, so finer-grained
      access can be granted via the existing per-shop Groups UI later.
- [x] Migration applied to all tenant schemas via `migrate_schemas --tenant`.
- [x] Frontend: `ProductsPage` (CRUD + stock adjust + low-stock filter + search),
      `CategoriesPage`, `SellersPage`, sidebar links, `api/inventory.js`, `ProductForm`.
- [x] `inventory/tests.py`: product CRUD + stock movements + cross-shop isolation.
      Full suite now 8 tests (`python manage.py test accounts inventory`).
- Next for inventory: barcode/QR generation + scan, then billing (POS) in a new
  `billing` TENANT_APP. Customer management will use a **shared/public** customer
  table (per README) — note this crosses the isolation boundary by design.

## Phase 6 — Per-unit stock items + barcodes  ✅
- [x] Stock is now tracked **per physical unit**: new `StockItem` model (one row per
      unit) with an auto-generated unique `code` (no manual entry), `status`
      (in_stock/sold/removed), and a `batch` UUID grouping an add operation. Removed
      `Product.stock_quantity` field + `StockMovement`; product stock is now an annotated
      count of in-stock units.
- [x] API: `POST /products/<id>/add-stock/ {quantity}` creates N units in one batch and
      returns them; `StockItemViewSet` (`/stock-items/`, filters product/status/batch,
      search by code, `remove` action). `status=all` returns every status.
- [x] Frontend: **Stock** page (every unit, Code128 preview, per-unit Download, Remove,
      "Print this page"); Products "Add Stock" → opens a **print** view of the new
      batch's labels (Code128 + QR + name/price). Both barcodes rendered **client-side**
      (`jsbarcode` + `qrcode`); download composes a single PNG per unit.
- [x] `inventory/tests.py` updated (add-stock unique codes, count reflects units,
      remove drops count, cross-shop isolation). Suite green: 8 tests.
- Hierarchy: Category → Product (e.g. Bra) → many StockItems, each with its own barcode.
- `sold` status exists but is set only by the future billing/POS flow.

## Phase 7 — Point-of-Sale billing  ✅
- [x] New `customers` app (**SHARED_APPS**/public): global `Customer` (unique phone).
      `/api/customers/lookup/?phone=` searches the global table (cross-shop autofill);
      `/api/customers/` lists only this shop's buyers (resolved via its bills).
- [x] New `billing` app (**TENANT_APPS**): `Bill` + `BillItem`. Checkout `POST /api/bills/`
      validates scanned codes are in-stock units, marks them `sold`, snapshots
      product/price, computes subtotal − discount (flat/%) + tax, stores a soft
      `customer_id` + name/phone snapshot, `created_by=user`. `INV-{id:05d}` numbering.
      Sales history via list/retrieve. Inventory got a `stock-items/lookup/?code=` action.
- [x] Frontend: **Billing (POS)** page (autofocus barcode input → Enter adds unit;
      cart; customer phone with lookup-autofill; discount/tax/payment; live total;
      checkout → printable **receipt**); **Sales** history (view/reprint); **Customers**
      page. Sidebar links + routes.
- [x] Validated live (totals 400 −40 +18 = 378; units sold; stock dropped; cross-shop
      customer autofill but per-shop scoping) and by tests. Suite = **12 tests**
      (`python manage.py test accounts inventory billing`).
- Note: dev `SECRET_KEY` is short (warning in tests) — set a 32+ byte key for prod.
- Next: Bill PDF export, sales dashboard, low-stock notifications.

## Phase 8 — Per-shop settings (payment methods + default tax)  ✅
- [x] New `shopsettings` app (TENANT_APPS): `ShopSettings` singleton (`default_tax_rate`)
      + `PaymentMethod` (per shop, auto-seeded Cash/UPI/Card). Endpoints
      `/api/shop-settings/` (GET/PUT) and `/api/payment-methods/` (CRUD, `?active=1`).
- [x] POS: tax is read-only (from settings, applied server-side — checkout ignores any
      client tax); payment dropdown comes from the shop's enabled methods; invalid
      method → 400. New **Settings** page to edit both. `Bill.payment_mode` stores the
      method name.
- [x] Tests: per-shop tax isolation, payment seeding/CRUD, tax-from-settings,
      invalid-method rejection. Full suite = **16 tests** (accounts+inventory+billing+
      shopsettings), ~8 min (each class re-provisions tenants; use `--noinput` to avoid
      the leftover-`test_shop` prompt).

## Phase 9 — Product variants + per-batch pricing  ✅
- [x] Model: `Product` (name, category, **seller**, fabric, sku) → `ProductVariant`
      (color + size, unique per product, `low_stock_threshold`) → `StockBatch` (UUID pk,
      **cost_price + price**, quantity) → `StockItem` (unique barcode, FK `batch` +
      denormalised `variant`). Price is per batch: restocking Black/XL at a new price keeps
      older units at their old price; the scanned barcode decides the POS price.
- [x] Migrations `inventory/0004_wipe_inventory` (deletes bills + inventory — test data,
      by decision) and `0005_variants` (schema). Split because Postgres rejects ALTER TABLE
      with pending FK trigger events in the same transaction.
- [x] API: `POST /products/{id}/add-stock/` takes `{"lines": [{color,size,quantity,
      cost_price,price}]}` — case-insensitive get-or-create of the variant, one batch per
      line. Product payload has nested `variants` (stock, last cost/price), total
      `stock_quantity`, `price_min/max` of in-stock units, `low_stock=1` = any variant low.
      New `/api/variants/` (PATCH, DELETE blocked if units were sold). Stock items expose
      color/size/price/cost. Checkout prices from `batch.price`; bill line name is
      "Product — Color / Size".
- [x] Frontend: Add Stock is a multi-line editor (chips restock an existing variant with
      its last prices); Variants modal (threshold edit/delete); labels, Stock page and POS
      cart show color/size; product list shows variant summary + price range.
- [x] Tests: full suite = **17 tests** green (accounts+inventory+billing).
- [x] Applied `migrate_schemas` to the remote DB on 2026-10-07 (wiped inventory + bills in
      acme, bella-fabrics, pf, proxy-test-shop). API smoke test on acme: all endpoints 2xx.

## Phase 10 — Sizes & colors managed in Settings  ✅
- [x] `shopsettings.Size` / `Color` (name unique case-insensitive, `is_active`, `position`;
      color has optional `hex` swatch). Sizes seed XS…XXXL + Free Size on first access;
      colors start empty. `/api/sizes/`, `/api/colors/` (unpaginated, `?active=1`); new rows
      append at the end; delete of one used by a variant → 400 "deactivate instead".
- [x] `ProductVariant.color` / `.size` are now nullable PROTECT FKs to those lists
      (unique `(product, color, size)` with `nulls_distinct=False`, needs PG ≥ 15 — remote
      is 17). Renaming in Settings flows to every variant/label; bills keep their snapshot.
      Migrations `inventory/0006–0008` convert existing text values into Size/Color rows
      (data preserved), split in 3 for the same pending-trigger reason as Phase 9.
- [x] API: add-stock lines and variant PATCH take color/size **ids**; outputs carry
      `color_name` / `size_name` (+ `color_hex` on variants).
- [x] Frontend: Settings has Sizes + Colors sections (add, inline rename, ▲▼ reorder,
      active toggle, delete); Add Stock uses dropdowns of active options (plus any
      deactivated ones existing variants still use).
- [x] Tests: inventory+billing+shopsettings = **16 green**. Applied to the remote DB
      (acme's "black/blue" + "xl/xxl" converted in place), then smoke-tested.

## Phase 11 — Returns (refund / store credit)  ✅
- [x] Models (`billing/0004_returns`): `Return` (`RET-{id:05d}`, mode `refund`/`credit`,
      payout method, amount, reason, customer snapshot), `ReturnItem` (**OneToOne** to
      `BillItem` → a sold line is returned once; a restocked unit resold on a new bill can be
      returned again), `CreditEntry` per-shop ledger (+ credited, − spent; soft
      `customer_id`), `Bill.credit_used`.
- [x] Refund = each line's pro-rata share of `bill.total` (discount + tax included);
      `refund_shares()` gives the rounding remainder to the last line so a full return
      equals the bill total. Returned units always go back to `in_stock` (same barcode/price).
      No time limit.
- [x] API: `POST/GET /api/returns/` (refund needs an enabled payment method; credit needs a
      customer on the bill), `GET /bills/by-code/?code=` (bill with an unreturned sale of that
      unit), `GET /store-credit/?phone=`. Checkout takes `credit_used` (≤ balance and total,
      needs a phone; ledger rows locked). Bill payload adds `returned`/`refund_amount` per
      line, `returns`, `refunded_total`; customers list adds `credit_balance`.
- [x] Frontend: **Returns** page (scan unit barcode or type `INV-…`; tick lines; refund via
      method or store credit; printable **Credit Note**; past returns list); Sales "Return"
      button + Returned/Partly returned badge; receipt strikes returned lines and shows
      credit used; POS shows available store credit for the phone and applies it ("To pay");
      Customers "Store credit" column.
- [x] **Customer (name + exactly 10-digit phone) is mandatory at checkout** (API 400 + POS disables
      Checkout), so every sale can be returned as store credit. The "needs a customer"
      guard on credit returns remains only for older bills without one.
- [x] Tests: billing = **13 green** (pro-rata refund + restock, rounding, double/foreign/
      invalid returns, by-code lookup, credit earn/spend/overspend + per-shop isolation,
      checkout without customer rejected).
      Migration applied to the local Docker DB; live API smoke test on acme passed.

## Phase 12 — UI revamp (branch `feat/ui-revamp`)  ✅
Goal: modern, simple, functional, intuitive. Clean light look, one accent (indigo `brand`), Inter.
- [x] Foundation: Inter font, `brand` color token + shared `.input` styles (`tailwind.config.js`,
      `index.css`), `lucide-react` icons + `clsx`; Vite favicon/leftovers replaced by the app logo.
- [x] Component kit `frontend/src/components/ui/`: Button, Field/Input/Select/Checkbox,
      PasswordInput, Card, Badge/Swatch, Table/Tr/Td (skeleton + EmptyState), PageHeader/Toolbar,
      Pagination, SegmentedControl, Tabs, Switch, StatCard, Toast (`useToast`), Logo.
      `hooks/useQuery.js` for list loading; `utils/format.js` (money/dates/names).
- [x] Shell: grouped sidebar (Sell / Inventory / Admin), collapsible to icons, mobile drawer,
      shows the shop name; topbar with New bill + user menu (change password, log out).
- [x] Dashboard: `GET /api/dashboard/` (today's sales/bills/avg/refunds, 7-day series,
      low-stock variants, recent bills; tested) + new page with chart and quick actions.
      `TIME_ZONE = "Asia/Kolkata"` so "today" is the shop's local day. `/auth/me/` adds `shop_name`.
- [x] POS: big scan bar, inline scan errors, segmented discount/payment, returning-customer
      chip, F2 = scan, Ctrl/⌘+Enter = charge, clear-bill confirm. Shared `PrintSheet` chrome
      for receipts/labels (printed layout unchanged).
- [x] Every page on one pattern (header → toolbar → table → pagination, forms in modals,
      toasts); Settings split into tabs; sign-in/sign-up/shop picker on `AuthLayout`.
- [x] Verified in the browser (dashboard, POS scan, products/add stock, stock, sales,
      settings, phone width). Lint: only 2 pre-existing errors left in `AuthContext.jsx`.

## Local development database (Docker)  ✅
- `docker-compose.yml` runs `postgres:17-alpine` (`shop-db-1`, volume `shop_pgdata`,
  port 5432); it reads `DB_NAME/DB_USER/DB_PASSWORD` from `.env`, which now points at
  `localhost`. The old remote values are kept commented in `.env`; **prod sets its own
  `.env` on the server.**
- Start: `docker compose up -d db`. Bootstrapped on 2026-10-07: `migrate_schemas
  --shared`, public tenant `localhost` (`admin@shop.test` / `admin123`, platform
  superuser) and shop **Acme Cloth** (`acme.localhost`, `owner@acme.test` / `owner123`).
  Remote-only demo shops (bella-fabrics, pf, …) were not copied.


## Demo data seeded in the remote DB (for exploring)
- **`python manage.py seed_demo <shop>`** (e.g. `acme`) fills a shop through its own API:
  9 colors, 6 categories, 3 sellers, 12 clothing products (~170 units, alert at ≤2 left),
  sets tax to 5%, ~30 bills backdated over 14 days for 12 demo customers (phones
  `98765000xx`), 1 refund + 1 store-credit return. Refuses to run twice on a shop.
  Seeded on the local Docker DB for **acme** on 2026-10-07.
- Platform owner (public/`localhost`): `admin@shop.test` / `admin123` — now a
  public-schema superuser; log in on `localhost` → shop picker → **Platform Admin**
  (`/admin`) to see all shops + their members.
- Shop **Acme Cloth** (`acme.localhost`): owner `owner@acme.test` / `owner123`
- Shop **Bella Fabrics** (`bella-fabrics.localhost`): owner `bella@shop.test` /
  `bella123`; staff `cash@shop.test` / `cash999` (group: Cashier). `cash@shop.test`
  is ALSO a member of Acme (multi-shop demo).
- Also `proxy-test-shop.localhost` (owner `proxy@shop.test`/`proxy123`) — a throwaway
  from proxy testing; safe to drop.

---

## Changelog
- **2026-06-01** Phase 0 done (UI refactor in `daa957d`). Phase 1 + tenancy skeleton
  (Phase 2 core) landed on branch `feat/multi-tenancy`: packages installed, `tenants`
  app, `accounts.User` → `UserProfile`, settings rewritten for django-tenants,
  fresh migrations generate. **Blocked**: real `DB_*` values in `.env` needed to run
  `migrate_schemas` and validate the RBAC serializer/view rework + signup + frontend.

- **2026-06-01** Phases 1–3 complete on `feat/multi-tenancy`. Backend tenancy fully
  built + validated end-to-end against the remote Postgres (signup, email login, per-
  tenant RBAC, isolation, multi-shop membership). Frontend updated for email/signup +
  subdomain proxy. Only Phase 4 (formal automated tests) remains. Work uncommitted.

- **2026-06-01** Added shop picker (main-domain login → choose shop, JWT handed off via
  URL hash across the subdomain origin) and a Platform Admin area (`/admin`) where the
  platform owner sees every shop + drills into each shop's members. New endpoints:
  `/api/auth/my-shops/`, `/api/admin/tenants/`, `/api/admin/tenants/<slug>/users/`.

- **2026-06-01** Phase 4 complete: `accounts/tests.py` with 6 passing tests covering
  login, isolation, multi-shop membership, signup provisioning, and platform admin.
  All four phases of the multi-tenancy conversion are now done & validated. Work still
  uncommitted on `feat/multi-tenancy`.

- **2026-06-01** Phase 6: stock redesigned to per-unit `StockItem`s with auto-generated
  Code128 + QR barcodes; new Stock page, per-unit download, batch print view. Suite
  still 8 green tests. Committed on `feat/multi-tenancy`.

- **2026-06-01** Phase 7: POS billing. New `customers` (shared) + `billing` (tenant)
  apps; scan→bill→pay→sold flow with discount/tax, shared customer table, printable
  receipt, sales history. Suite = 12 green tests. Committed on `feat/multi-tenancy`.

- **2026-06-01** Phase 8: per-shop `shopsettings` (payment methods + default tax). POS
  applies the shop's tax read-only and lists its payment methods. Suite = 16 green tests.
  Committed on `feat/multi-tenancy`.

- **2026-06-02** DB indexing pass matched to the views' query/order patterns:
  `StockItem(product, status)` (serves the `IN_STOCK_COUNT` annotation + stock filters)
  and `(-created_at)`; `Bill(-created_at)` + `db_index` on the soft `customer_id`
  (customers aggregation); ordering indexes on `Product.name`, `Seller.name`,
  `Customer.name`. Skipped FKs / `unique=True` / `batch` (already indexed) and
  `icontains` searches (no B-tree benefit). Migrations `billing/0003`,
  `customers/0002`, `inventory/0003`, applied across public + tenant schemas.

- **2026-10-07** Phase 11: returns with refund or store credit (per-shop ledger usable at
  POS), scan-to-return, credit notes; customer now mandatory on every bill. Billing
  suite = 13 green tests.

## Bootstrap (run once `.env` DB_* is filled)
```bash
source .venv/bin/activate
# 1. Create the shared (public) schema + tenant_users/auth tables
python manage.py migrate_schemas --shared
# 2. Create the public ("system") tenant on the main dev domain
python manage.py create_public_tenant --domain_url localhost --owner_email admin@shop.test
# (set a password for that owner afterward, or via a follow-up step)
```
The DB user must be able to **CREATE SCHEMA**. Per-shop schemas are created
automatically when a Tenant row is saved (self-serve signup, Phase 3).
