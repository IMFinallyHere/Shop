"""Fill a scratch shop with a LARGE dataset for performance testing.

    python manage.py seed_large perf                 # creates shop "perf" if missing
    python manage.py seed_large perf --products 2000 # smaller run

Unlike ``seed_demo`` (which goes through the API), rows are streamed in with
PostgreSQL ``COPY`` so a million units load in about a minute. Defaults: 20k products,
5 variants each, 10 units per variant (1M units), 300k bills of 2 units, 30k returns,
100k customers. Customers are global (public schema) and get phones 70xxxxxxxx and a
"Perf " name prefix so they're easy to tell apart. Refuses to run on a shop that
already has products.
"""
import random
import uuid
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context

from accounts.models import User
from inventory.models import Product
from inventory.stock import recount_all
from shopsettings.models import Color, Size, ensure_payment_methods, ensure_sizes
from tenants.models import Tenant

from .seed_demo import CATEGORIES, COLORS, PRODUCTS

FABRICS = ["Cotton", "Rayon", "Silk", "Georgette", "Linen", "Denim", "Chiffon", "Wool", "Khadi"]
WORDS = ["Classic", "Printed", "Festive", "Slim", "Casual", "Embroidered", "Party", "Daily", "Premium", "Summer"]
FIRST = ["Priya", "Rahul", "Anjali", "Vikram", "Neha", "Arjun", "Kavya", "Rohan", "Sneha", "Aditya", "Meera", "Karan"]
LAST = ["Sharma", "Verma", "Gupta", "Singh", "Patel", "Mehta", "Iyer", "Das", "Reddy", "Joshi", "Nair", "Malhotra"]
PAYMENTS = ["Cash", "UPI", "Card"]


def copy(table, columns, rows):
    """Stream ``rows`` into ``table`` with COPY (on the current schema's search_path)."""
    with connection.cursor() as c:
        with c.cursor.copy(f"COPY {table} ({', '.join(columns)}) FROM STDIN") as cp:
            for row in rows:
                cp.write_row(row)


def reset_sequence(table):
    with connection.cursor() as c:
        c.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 1)) FROM {table}")


class Command(BaseCommand):
    help = "Seed a shop with a large dataset (via COPY) for performance testing."

    def add_arguments(self, parser):
        parser.add_argument("shop", help="Shop slug/schema; created (owner perf@shop.test) if missing")
        parser.add_argument("--products", type=int, default=20_000)
        parser.add_argument("--variants", type=int, default=5, help="Variants per product")
        parser.add_argument("--units", type=int, default=10, help="Units per variant")
        parser.add_argument("--bills", type=int, default=300_000)
        parser.add_argument("--returns", type=int, default=30_000)
        parser.add_argument("--customers", type=int, default=100_000)
        parser.add_argument("--seed", type=int, default=7)

    def handle(self, shop, **o):
        self.rng = random.Random(o["seed"])
        tenant = self.get_or_create_shop(shop)
        customers = self.seed_customers(o["customers"])
        with schema_context(tenant.schema_name):
            if Product.objects.exists():
                raise CommandError(f"'{tenant.name}' already has products.")
            self.seed_shop(tenant, customers, o)
        self.stdout.write(self.style.SUCCESS(f"Seeded {tenant.schema_name}."))

    def log(self, msg):
        self.stdout.write(f"  {msg}")
        self.stdout.flush()

    def get_or_create_shop(self, slug):
        tenant = Tenant.objects.filter(schema_name=slug).first()
        if tenant:
            return tenant
        from tenant_users.tenants.tasks import provision_tenant

        with schema_context(get_public_schema_name()):
            owner = User.objects.filter(email="perf@shop.test").first() or User.objects.create_user(
                email="perf@shop.test", password="perf12345")
        tenant, _ = provision_tenant(slug.title(), slug, owner, schema_name=slug)
        self.log(f"created shop '{slug}' (owner perf@shop.test / perf12345)")
        return tenant

    def seed_customers(self, n):
        from customers.models import Customer

        with schema_context(get_public_schema_name()):
            have = Customer.objects.filter(phone__startswith="70").count()
            if have < n:
                rng = self.rng
                now = timezone.now()
                copy("customers_customer", ["name", "phone", "email", "created_at"], (
                    (f"Perf {rng.choice(FIRST)} {rng.choice(LAST)}", f"70{i:08d}", "", now)
                    for i in range(have, n)
                ))
                self.log(f"{n - have} customers")
            return list(Customer.objects.filter(phone__startswith="70").values_list("id", "name", "phone")[:n])

    def seed_shop(self, tenant, customers, o):
        rng = self.rng
        now = timezone.now()
        ensure_sizes()
        ensure_payment_methods()
        for i, (name, hexv) in enumerate(COLORS):
            Color.objects.get_or_create(name=name, defaults={"hex": hexv, "position": i})
        colors = list(Color.objects.values_list("id", flat=True))
        sizes = list(Size.objects.values_list("id", flat=True))

        # Categories / sellers
        cats = [(f"{name} {j}" if j else name, desc) for j in range(10) for name, desc in CATEGORIES]
        copy("inventory_category", ["id", "name", "description", "created_at"],
             ((i, name, desc, now) for i, (name, desc) in enumerate(cats, start=1)))
        n_cat = len(cats)
        n_sel = 200
        copy("inventory_seller", ["id", "name", "phone", "email", "address", "notes", "created_at"],
             ((i, f"Seller {i:03d} Textiles", f"94{i:08d}", "", "", "", now) for i in range(1, n_sel + 1)))
        reset_sequence("inventory_category")
        reset_sequence("inventory_seller")

        # Products, variants, batches, units
        n_prod = o["products"]
        base_names = [p[0] for p in PRODUCTS]
        copy("inventory_product",
             ["id", "name", "sku", "category_id", "seller_id", "fabric_type", "is_active", "created_at", "updated_at"],
             ((i, f"{rng.choice(WORDS)} {rng.choice(base_names)} {i}", f"SKU{i:06d}", rng.randint(1, n_cat),
               rng.randint(1, n_sel), rng.choice(FABRICS), True, now, now) for i in range(1, n_prod + 1)))
        self.log(f"{n_prod} products")

        combos = [(c, s) for c in colors for s in sizes]
        variants = []  # (variant_id, price)
        vid = 0
        var_rows, batch_rows, unit_rows = [], [], []
        codes = set()
        for pid in range(1, n_prod + 1):
            for color, size in rng.sample(combos, min(o["variants"], len(combos))):
                vid += 1
                var_rows.append((vid, pid, color, size, 5, now))
                price = Decimal(rng.randrange(299, 4999))
                bid = uuid.uuid4()
                batch_rows.append((bid, vid, price / 2, price, o["units"], now))
                for _ in range(o["units"]):
                    code = f"{rng.getrandbits(48):012X}"
                    while code in codes:
                        code = f"{rng.getrandbits(48):012X}"
                    codes.add(code)
                    unit_rows.append([vid, bid, code, "in_stock", now, price])
        del codes
        copy("inventory_productvariant", ["id", "product_id", "color_id", "size_id", "low_stock_threshold", "created_at"],
             var_rows)
        copy("inventory_stockbatch", ["id", "variant_id", "cost_price", "price", "quantity", "created_at"], batch_rows)
        self.log(f"{len(var_rows)} variants / batches")

        # Bills: pick 2 random units each, mark sold.
        rng.shuffle(unit_rows)
        n_bills = min(o["bills"], len(unit_rows) // 3)
        bill_rows, item_rows = [], []
        start = now - timedelta(days=365)
        for b in range(1, n_bills + 1):
            lines = unit_rows[2 * b - 2: 2 * b]
            subtotal = sum(u[5] for u in lines)
            at = start + timedelta(seconds=rng.randrange(365 * 86400))
            cid, cname, cphone = rng.choice(customers) if customers else (None, "", "")
            bill_rows.append((b, cid, cname, cphone, subtotal, "none", 0, 0,
                              0, 0, subtotal, rng.choice(PAYMENTS), 0, at))
            for u in lines:
                u[3] = "sold"
                item_rows.append((len(item_rows) + 1, b, u, at))
        # Unit ids follow list order; COPY them with explicit ids.
        for i, u in enumerate(unit_rows):
            u.append(i + 1)
        copy("inventory_stockitem", ["id", "variant_id", "batch_id", "code", "status", "created_at"],
             ((u[6], u[0], u[1], u[2], u[3], u[4]) for u in unit_rows))
        reset_sequence("inventory_product")
        reset_sequence("inventory_productvariant")
        reset_sequence("inventory_stockitem")
        self.log(f"{len(unit_rows)} units")

        copy("billing_bill", ["id", "customer_id", "customer_name", "customer_phone", "subtotal", "discount_type",
                              "discount_value", "discount_amount", "tax_rate", "tax_amount", "total", "payment_mode",
                              "credit_used", "created_at"], bill_rows)
        copy("billing_billitem", ["id", "bill_id", "stock_item_id", "product_name", "unit_price"],
             ((iid, b, u[6], "Perf product", u[5]) for iid, b, u, _ in item_rows))
        reset_sequence("billing_bill")
        reset_sequence("billing_billitem")
        self.log(f"{n_bills} bills / {len(item_rows)} bill items")

        # Returns: one line each, restocked; every other one as store credit.
        picks = rng.sample(range(len(item_rows)), min(o["returns"], len(item_rows)))
        ret_rows, ret_items, credit_rows, restock = [], [], [], []
        for r, idx in enumerate(picks, start=1):
            iid, b, u, at = item_rows[idx]
            bill = bill_rows[b - 1]
            mode = "credit" if r % 2 and bill[1] else "refund"
            ret_rows.append((r, b, mode, "Cash" if mode == "refund" else "", u[5], "Perf", bill[1], bill[2], bill[3],
                             at + timedelta(days=1)))
            ret_items.append((r, r, iid, u[5]))
            if mode == "credit":
                credit_rows.append((bill[1], u[5], r, at + timedelta(days=1)))
            restock.append(u[6])
        copy("billing_return", ["id", "bill_id", "mode", "payment_mode", "amount", "reason", "customer_id",
                                "customer_name", "customer_phone", "created_at"], ret_rows)
        copy("billing_returnitem", ["id", "ret_id", "bill_item_id", "refund_amount"], ret_items)
        copy("billing_creditentry", ["customer_id", "amount", "ret_id", "created_at"], credit_rows)
        with connection.cursor() as c:
            c.execute("UPDATE inventory_stockitem SET status = 'in_stock' WHERE id = ANY(%s)", [restock])
        recount_all()
        with connection.cursor() as c:
            c.execute("ANALYZE")
        reset_sequence("billing_return")
        reset_sequence("billing_returnitem")
        self.log(f"{len(ret_rows)} returns")
