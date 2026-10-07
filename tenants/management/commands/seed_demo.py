"""Fill a shop with realistic demo data: catalogue, stock, two weeks of bills, returns.

    python manage.py seed_demo acme

Everything goes through the shop's own API (as the shop owner), so stock, checkout,
tax and return rules apply exactly as in real use. Bills and returns are then
backdated across the last 14 days so the dashboard has history. Refuses to run twice
on the same shop.
"""
import random
from datetime import datetime, time, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from billing.models import Bill, Return
from inventory.models import Product
from tenants.models import Tenant

LOW_STOCK_AT = 2

CATEGORIES = [
    ("Kurtis", "Everyday and festive kurtis"),
    ("Sarees", "Cotton, silk and georgette sarees"),
    ("Shirts", "Men's formal and casual shirts"),
    ("T-Shirts", "Round neck and polo tees"),
    ("Jeans", "Denim for men and women"),
    ("Kids", "Kids' ethnic and casual wear"),
]
SELLERS = [
    {"name": "Jaipur Textiles", "phone": "9414000001", "email": "orders@jaipurtextiles.example", "address": "Johari Bazaar, Jaipur"},
    {"name": "Surat Silk House", "phone": "9824000002", "email": "sales@suratsilk.example", "address": "Ring Road, Surat"},
    {"name": "Tiruppur Knits", "phone": "9443000003", "email": "hello@tiruppurknits.example", "address": "Avinashi Road, Tiruppur"},
]
COLORS = [
    ("Black", "#111827"), ("White", "#f9fafb"), ("Navy", "#1e3a8a"), ("Maroon", "#7f1d1d"),
    ("Mustard", "#ca8a04"), ("Olive", "#4d7c0f"), ("Pink", "#ec4899"), ("Grey", "#6b7280"),
    ("Sky Blue", "#38bdf8"),
]
# name, category, seller, fabric, [(color, size, qty, cost, price), ...]
PRODUCTS = [
    ("Cotton A-line Kurti", "Kurtis", "Jaipur Textiles", "Cotton", [
        ("Mustard", "M", 6, 320, 649), ("Mustard", "L", 5, 320, 649), ("Navy", "M", 4, 320, 649), ("Navy", "XL", 3, 320, 649)]),
    ("Rayon Printed Kurti", "Kurtis", "Jaipur Textiles", "Rayon", [
        ("Pink", "S", 5, 280, 549), ("Pink", "M", 6, 280, 549), ("Olive", "L", 4, 280, 549)]),
    ("Chikankari Kurta", "Kurtis", "Jaipur Textiles", "Georgette", [
        ("White", "M", 4, 650, 1299), ("White", "L", 3, 650, 1299)]),
    ("Banarasi Silk Saree", "Sarees", "Surat Silk House", "Silk", [
        ("Maroon", "Free Size", 3, 2100, 3999), ("Navy", "Free Size", 2, 2100, 3999)]),
    ("Georgette Party Saree", "Sarees", "Surat Silk House", "Georgette", [
        ("Pink", "Free Size", 4, 950, 1799), ("Black", "Free Size", 3, 950, 1799)]),
    ("Cotton Daily Saree", "Sarees", "Surat Silk House", "Cotton", [
        ("Sky Blue", "Free Size", 6, 380, 749), ("Mustard", "Free Size", 5, 380, 749)]),
    ("Formal Oxford Shirt", "Shirts", "Tiruppur Knits", "Cotton", [
        ("White", "M", 5, 420, 899), ("White", "L", 6, 420, 899), ("Sky Blue", "L", 4, 420, 899), ("Sky Blue", "XL", 3, 420, 899)]),
    ("Linen Casual Shirt", "Shirts", "Tiruppur Knits", "Linen", [
        ("Olive", "M", 4, 560, 1199), ("Grey", "L", 4, 560, 1199)]),
    ("Round Neck Tee", "T-Shirts", "Tiruppur Knits", "Cotton", [
        ("Black", "S", 6, 140, 349), ("Black", "M", 8, 140, 349), ("Black", "L", 8, 140, 349),
        ("White", "M", 6, 140, 349), ("Grey", "L", 5, 140, 349)]),
    ("Pique Polo T-Shirt", "T-Shirts", "Tiruppur Knits", "Cotton Pique", [
        ("Navy", "M", 5, 260, 599), ("Navy", "L", 5, 260, 599), ("Maroon", "L", 3, 260, 599)]),
    ("Slim Fit Jeans", "Jeans", None, "Denim", [
        ("Navy", "M", 5, 650, 1399), ("Navy", "L", 5, 650, 1399), ("Black", "L", 4, 650, 1399)]),
    ("Kids Kurta Pyjama Set", "Kids", "Jaipur Textiles", "Cotton", [
        ("Mustard", "S", 4, 350, 799), ("Maroon", "S", 3, 350, 799)]),
]
CUSTOMERS = [
    ("Priya Sharma", "9876500001"), ("Rahul Verma", "9876500002"), ("Anjali Gupta", "9876500003"),
    ("Vikram Singh", "9876500004"), ("Neha Patel", "9876500005"), ("Arjun Mehta", "9876500006"),
    ("Kavya Iyer", "9876500007"), ("Rohan Das", "9876500008"), ("Sneha Reddy", "9876500009"),
    ("Aditya Joshi", "9876500010"), ("Meera Nair", "9876500011"), ("Karan Malhotra", "9876500012"),
]


class Command(BaseCommand):
    help = "Seed a shop with demo catalogue, stock, two weeks of bills and a few returns."

    def add_arguments(self, parser):
        parser.add_argument("shop", help="Shop slug or schema name, e.g. acme")
        parser.add_argument("--seed", type=int, default=7, help="Random seed (default 7)")

    def handle(self, shop, seed, **opts):
        tenant = Tenant.objects.filter(slug=shop).first() or Tenant.objects.filter(schema_name=shop).first()
        if not tenant:
            raise CommandError(f"No shop '{shop}'.")
        domain = tenant.domains.filter(is_primary=True).first() or tenant.domains.first()
        if not domain:
            raise CommandError(f"Shop '{shop}' has no domain.")
        with schema_context(tenant.schema_name):
            if Product.objects.filter(name=PRODUCTS[0][0]).exists():
                raise CommandError(f"'{tenant.name}' already has demo data ({PRODUCTS[0][0]}).")

        self.rng = random.Random(seed)
        self.host = domain.domain
        self.client = APIClient()
        self.client.force_authenticate(tenant.owner)
        try:
            self.seed()
        finally:
            connection.set_schema_to_public()

    # -- API helpers -------------------------------------------------------------
    def call(self, method, path, data=None, expect=(200, 201)):
        resp = getattr(self.client, method)(f"/api/{path}", data, format="json", HTTP_HOST=self.host)
        if resp.status_code not in expect:
            raise CommandError(f"{method.upper()} /api/{path} → {resp.status_code}: {resp.data}")
        return resp.data

    def rows(self, path):
        data = self.call("get", path)
        return data.get("results", data) if isinstance(data, dict) else data

    # -- seeding -----------------------------------------------------------------
    def seed(self):
        out = self.stdout
        self.call("put", "shop-settings/", {"default_tax_rate": "5"})

        # Colors and sizes (sizes list self-seeds the defaults on first read).
        colors = {c["name"].lower(): c["id"] for c in self.rows("colors/")}
        for name, hexv in COLORS:
            if name.lower() not in colors:
                colors[name.lower()] = self.call("post", "colors/", {"name": name, "hex": hexv})["id"]
        sizes = {s["name"]: s["id"] for s in self.rows("sizes/")}
        self.rows("payment-methods/")  # ensure Cash / UPI / Card exist

        cats = {c["name"]: c["id"] for c in self.rows("categories/")}
        for name, desc in CATEGORIES:
            if name not in cats:
                cats[name] = self.call("post", "categories/", {"name": name, "description": desc})["id"]
        sellers = {s["name"]: s["id"] for s in self.rows("sellers/")}
        for s in SELLERS:
            if s["name"] not in sellers:
                sellers[s["name"]] = self.call("post", "sellers/", s)["id"]

        units = []  # (code, price)
        for name, cat, seller, fabric, lines in PRODUCTS:
            pid = self.call("post", "products/", {
                "name": name, "category": cats[cat], "seller": sellers.get(seller), "fabric_type": fabric,
            })["id"]
            payload = [{"color": colors[c.lower()], "size": sizes[sz], "quantity": q,
                        "cost_price": str(cost), "price": str(price)} for c, sz, q, cost, price in lines]
            items = self.call("post", f"products/{pid}/add-stock/", {"lines": payload})["items"]
            units += [item["code"] for item in items]
            # Small boutique batches: alert at 2 left rather than the default 5.
            for vid in {item["variant"] for item in items}:
                self.call("patch", f"variants/{vid}/", {"low_stock_threshold": LOW_STOCK_AT})
        out.write(f"  {len(PRODUCTS)} products, {len(units)} units in stock")

        # ~40 bills over the last 14 days (busier on weekends), 1–3 units each.
        rng = self.rng
        rng.shuffle(units)
        today = timezone.localdate()
        bills = []
        for days_ago in range(13, -1, -1):
            day = today - timedelta(days=days_ago)
            n = rng.randint(1, 3) + (2 if day.weekday() >= 5 else 0)
            for _ in range(n):
                take = rng.choice([1, 1, 1, 2, 2, 3])
                if len(units) < take + 25:  # keep most shelves stocked
                    break
                codes, units = units[:take], units[take:]
                name, phone = rng.choice(CUSTOMERS)
                discount = rng.choice([("none", 0)] * 6 + [("percent", 10), ("flat", 100)])
                bill = self.call("post", "bills/", {
                    "codes": codes, "customer": {"name": name, "phone": phone},
                    "discount_type": discount[0], "discount_value": discount[1],
                    "payment_mode": rng.choice(["Cash", "Cash", "UPI", "UPI", "UPI", "Card"]),
                })
                hour = rng.randint(10, 20) if days_ago else rng.randint(10, max(10, timezone.localtime().hour))
                at = timezone.make_aware(datetime.combine(day, time(hour, rng.randint(0, 59))))
                bills.append((bill, at))

        # Two returns: one refunded, one settled as store credit.
        returns = []
        for (bill, at), mode in zip([bills[3], bills[8]], ["refund", "credit"]):
            ret = self.call("post", "returns/", {
                "bill": bill["id"], "items": [bill["items"][0]["id"]], "mode": mode,
                "payment_mode": "Cash" if mode == "refund" else "",
                "reason": "Size didn't fit" if mode == "refund" else "Colour not as expected",
            })
            returns.append((ret, at + timedelta(days=1, hours=1)))

        with schema_context(self.tenant_schema()):
            for bill, at in bills:
                Bill.objects.filter(pk=bill["id"]).update(created_at=at)
            for ret, at in returns:
                Return.objects.filter(pk=ret["id"]).update(created_at=min(at, timezone.now()))

        out.write(f"  {len(bills)} bills over 14 days, {len(returns)} returns")
        self.stdout.write(self.style.SUCCESS(f"Seeded {self.host}."))

    def tenant_schema(self):
        return Tenant.objects.get(domains__domain=self.host).schema_name
