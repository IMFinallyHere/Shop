# Shop — Cloth Shop Management

A multi-shop inventory and billing system for clothing stores. Every physical piece gets its own barcode; scan it at the counter to bill, scan it again to take it back, and look up its full history any time.

Each shop is an isolated tenant (its own PostgreSQL schema) on its own subdomain, e.g. `acme.localhost`.

---

## Features

**Inventory**
- Products with category, seller, fabric and colour/size **variants** (colours and sizes are managed per shop in Settings)
- Stock is added in **batches** with their own cost and selling price; every unit gets a unique Code128 barcode, printable as labels or downloadable as PNG
- Low-stock alerts per variant (adjustable threshold)
- Categories and sellers (the suppliers you buy from)

**Billing (POS)**
- Scan units into a bill; customer name + 10-digit phone required (returning customers are recognised)
- Bill-level discount (flat ₹ or %), shop-wide tax rate, per-shop payment methods (Cash / UPI / Card by default)
- Printable receipts (browser print)
- Keyboard-friendly: `F2` focuses the scanner box, `Ctrl/⌘ + Enter` charges

**Returns & store credit**
- Scan a sold unit or enter a bill number; refund is each item's share of the bill total (discount and tax included)
- Settle as a refund or as **store credit**, which the customer can spend on a later bill
- Returned units go back into stock with the same barcode; printable credit note

**Search & history**
- Search box on every page (`/` or `Ctrl/⌘ + K`): barcodes, bill/return numbers, customers, products, sellers
- Scanning a barcode opens that piece's full history: batch cost/price, seller, who bought it, returns and resales
- Customer pages with their bills, returns and store-credit balance

**Dashboard**
- Today's sales, bills, average bill and refunds; 7-day sales chart; low stock; recent bills and returns

**Shops & access**
- Self-serve sign-up creates a shop and its owner account
- One account (by **email**) can belong to several shops; a shop picker on the main domain
- Per-shop users, groups and permissions (Django's RBAC); a platform-admin view of all shops

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Django 6, Django REST Framework, `django-tenants` + `django-tenant-users` |
| Auth | JWT (`djangorestframework-simplejwt`), login by email |
| Database | PostgreSQL 15+ (17 in Docker), schema per shop |
| Frontend | React 19, Vite, Tailwind CSS 3, React Router 7, Axios, lucide icons |
| Barcodes | `jsbarcode` (generated in the browser) |

---

## Getting started

**Prerequisites:** Python 3.12+, Node 18+, Docker.

```bash
# 1. Config
cp .env.example .env                 # then set SECRET_KEY (and DB_* if you like)

# 2. Database
docker compose up -d db

# 3. Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate_schemas --shared
python manage.py create_public_tenant --domain_url localhost --owner_email admin@shop.test
python manage.py runserver

# 4. Frontend (new terminal)
cd frontend && npm install && npm run dev
```

**Create a shop:** open <http://localhost:5173/register> and sign up (e.g. shop name "Acme"). You're redirected to `http://acme.localhost:5173`. `*.localhost` resolves to your machine in modern browsers, so no hosts-file changes are needed.

**Fill it with demo data** (optional): catalogue, ~170 units, two weeks of bills and a few returns.

```bash
python manage.py seed_demo acme
```

**Platform admin:** the public-tenant owner (`admin@shop.test`) signs in on `http://localhost:5173` to see every shop. `create_public_tenant` doesn't set a password; set one with:

```bash
python manage.py shell -c "from accounts.models import User; u = User.objects.get(email='admin@shop.test'); u.set_password('admin123'); u.save()"
```

**Tests:** `python manage.py test`

---

## Environment variables

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Django secret key (required) |
| `DEBUG` | `True` in development |
| `ALLOWED_HOSTS` | Include `.localhost` so shop subdomains work |
| `TENANT_USERS_DOMAIN` | Base domain for shops (default `localhost`) |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | PostgreSQL connection; also used by `docker-compose.yml`. The user must be allowed to `CREATE SCHEMA`. |

---

## Project structure

```
Shop/
├── core/            # Django settings and root URLs
├── tenants/         # Tenant (shop) + Domain models; `seed_demo` command
├── accounts/        # Users (email login), JWT, signup, shop picker, per-shop RBAC
├── inventory/       # Categories, sellers, products, variants, batches, stock units
├── billing/         # Bills, returns, store credit, dashboard and search APIs
├── customers/       # Global customer table (each shop sees only its own buyers)
├── shopsettings/    # Per-shop tax rate, payment methods, sizes, colours
├── frontend/src/
│   ├── api/         # Axios API clients
│   ├── components/  # ui/ kit, layout/, billing/, inventory/, search/, …
│   ├── hooks/       # useQuery, useReceipts
│   └── pages/       # One file per screen
├── docker-compose.yml
└── PLAN.md          # Detailed build log and design notes
```

**Customers** live in one shared table so a phone number entered at one shop can auto-fill at another, but each shop only ever sees customers who have bought from it. **Sellers** are per shop: the suppliers that shop buys stock from.

---

## Not built yet

- PDF export of bills (printing works from the browser)
- Per-item discounts (discounts apply to the whole bill)
- Sales filters by date, staff or payment method
- Weekly/monthly reports and top-selling products
- An audit log of who changed what (bills and returns record who created them)
- A timestamp for when a unit was removed from stock
