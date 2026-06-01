# Shop — Cloth Shop Management System

A full-stack inventory and billing management system for cloth shops. Track stock using barcode/QR codes, manage sales, generate bills, and control staff access with role-based permissions.

---

## Features

### Inventory Management
- Add, edit, and delete cloth products (fabric type, color, size, price, stock quantity)
- Barcode and QR code generation per product
- Scan barcode/QR to instantly look up or add items to a bill
- Low stock alerts and stock history tracking

### Billing & Sales
- Point-of-sale interface — scan or search items to build a bill
- Apply discounts (flat or percentage) per item or on the total
- Print-ready bill generation (PDF)
- Sales history with filters by date, staff, and payment method
- Payment modes: cash, UPI, card

### User & Access Control
- JWT-based authentication (login with username + password)
- Role-based access control using Django's built-in Groups & Permissions
- Roles: Owner, Manager, Cashier
- Fine-grained permission assignment per user or group
- Audit trail — track who created/edited what

### Dashboard
- Daily, weekly, and monthly sales overview
- Top-selling products
- Low stock warnings
- Revenue and transaction counts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Django 6, Django REST Framework |
| Auth | JWT via `djangorestframework-simplejwt` |
| Frontend | React 19, Vite, Tailwind CSS |
| Routing | React Router v6 |
| HTTP Client | Axios (with auto token refresh) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Barcode/QR | `python-barcode`, `qrcode` (backend generation) |

---

## Project Structure

```
Shop/
├── core/               # Django project config (settings, urls)
├── accounts/           # Users, groups, JWT auth APIs
├── inventory/          # Products, categories, stock (planned)
├── billing/            # Bills, line items, payments (planned)
├── frontend/           # React app
│   └── src/
│       ├── api/        # Axios API calls
│       ├── contexts/   # Auth context
│       ├── components/ # Shared UI components
│       └── pages/      # Login, Dashboard, Users, Groups, Permissions, ...
├── .env.example
└── requirements.txt
```

---

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+

### Backend Setup

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set SECRET_KEY, DEBUG, ALLOWED_HOSTS

# Run migrations
python manage.py migrate

# Create a superuser (shop owner)
python manage.py createsuperuser

# Start server
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Environment Variables

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

---

## Roadmap

- [x] User management with RBAC
- [x] JWT authentication with token refresh and blacklist
- [x] Product / category management
- [x] Seller management
- [ ] Customer management
- [x] Barcode + QR generation **per stock unit** (auto-generated; print & download)
- [ ] Barcode scanner integration (webcam / USB scanner)
- [ ] Point-of-sale billing interface
- [ ] Bill PDF generation and print
- [x] Stock in/out tracking and history (StockMovement audit log + adjust action)
- [ ] Sales dashboard with charts
- [ ] Low stock notifications
- [x] PostgreSQL support (now required — schema-per-tenant)
- [~] Multi-tenancy: each shop isolated in its own PostgreSQL schema
      (`django-tenants` + `django-tenant-users`), self-serve signup, subdomain routing

## Multi-tenancy

Every shop is an isolated tenant in its own PostgreSQL schema. A single user
account (identified by **email**) can belong to multiple shops with per-shop
permissions. Shops are resolved by subdomain (`<slug>.localhost` in dev). See
`PLAN.md` for the build status and bootstrap commands.

## Customer Management
When we sell a stock we take in customer details, and we will have a global customer table shares across all the tenant.
Tenant will be able to see only those customers who have ever purchased anything from them. 
Having a unified table can help in search while some other tenant is filling the details. 

## Seller Management
Each tenant can add details of their sellers and while adding new inventory they can select the seller. 
Seller here means from where that tenant have purchased the items. 