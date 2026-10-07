"""Inventory tests: variants, per-batch pricing, per-unit barcodes, isolation."""
from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework.test import APIClient
from tenant_users.tenants.tasks import provision_tenant
from tenant_users.tenants.utils import create_public_tenant

from accounts.models import User
from inventory.models import Product, ProductVariant, StockBatch, StockItem
from shopsettings.models import Color, Size
from tenants.models import Tenant

PW = "pw12345678"


class InventoryTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        call_command("migrate_schemas", "--shared", interactive=False, verbosity=0)
        with schema_context(get_public_schema_name()):
            if not Tenant.objects.filter(schema_name=get_public_schema_name()).exists():
                create_public_tenant(domain_url="localhost", owner_email="sys@test.com",
                                     is_superuser=True, is_staff=True, password=PW)
            cls.acme_owner = User.objects.create_user(email="acme@test.com", password=PW)
            cls.bella_owner = User.objects.create_user(email="bella@test.com", password=PW)
        cls.acme, _ = provision_tenant("Acme", "acme", cls.acme_owner, schema_name="acme")
        cls.bella, _ = provision_tenant("Bella", "bella", cls.bella_owner, schema_name="bella")

    @classmethod
    def tearDownClass(cls):
        connection.set_schema_to_public()
        super().tearDownClass()

    def tearDown(self):
        connection.set_schema_to_public()
        super().tearDown()

    def client_for(self, host, email):
        c = APIClient()
        resp = c.post("/api/auth/login/", {"email": email, "password": PW}, format="json", HTTP_HOST=host)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        return c

    def opt(self, c, kind, name):
        """Id of a shop color/size by name, creating it in Settings if missing."""
        existing = [o for o in c.get(f"/api/{kind}/", HTTP_HOST="acme.localhost").data if o["name"] == name]
        if existing:
            return existing[0]["id"]
        return c.post(f"/api/{kind}/", {"name": name}, format="json", HTTP_HOST="acme.localhost").data["id"]

    def line(self, c, color, size, quantity, cost, price):
        return {"color": self.opt(c, "colors", color), "size": self.opt(c, "sizes", size),
                "quantity": quantity, "cost_price": cost, "price": price}

    def add_stock(self, c, pid, *lines):
        return c.post(f"/api/products/{pid}/add-stock/", {"lines": list(lines)},
                      format="json", HTTP_HOST="acme.localhost")

    def test_add_stock_creates_variants_and_units_with_unique_barcodes(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        resp = c.post("/api/products/", {"name": "Kurti A"}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["stock_quantity"], 0)
        self.assertEqual(resp.data["variants"], [])
        pid = resp.data["id"]

        added = self.add_stock(
            c, pid,
            self.line(c, "Black", "XL", 2, "200", "300"),
            self.line(c, "Blue", "XXL", 3, "250", "350"),
        )
        self.assertEqual(added.status_code, 201, added.data)
        self.assertEqual(added.data["count"], 5)
        codes = [i["code"] for i in added.data["items"]]
        self.assertEqual(len(set(codes)), 5)  # all unique
        black = [i for i in added.data["items"] if i["color_name"] == "Black"]
        self.assertEqual(len(black), 2)
        self.assertEqual({(i["size_name"], i["price"], i["cost_price"]) for i in black}, {("XL", "300.00", "200.00")})

        prod = c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost").data
        self.assertEqual(prod["stock_quantity"], 5)
        self.assertEqual((prod["price_min"], prod["price_max"]), ("300.00", "350.00"))
        by_label = {(v["color_name"], v["size_name"]): v for v in prod["variants"]}
        self.assertEqual(by_label[("Black", "XL")]["stock_quantity"], 2)
        self.assertEqual(by_label[("Blue", "XXL")]["stock_quantity"], 3)
        self.assertEqual(by_label[("Blue", "XXL")]["last_price"], "350.00")

        units = c.get(f"/api/stock-items/?product={pid}", HTTP_HOST="acme.localhost")
        self.assertEqual(units.data["count"], 5)
        rid = units.data["results"][0]["id"]
        removed = c.post(f"/api/stock-items/{rid}/remove/", HTTP_HOST="acme.localhost")
        self.assertEqual(removed.data["status"], "removed")
        prod = c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost")
        self.assertEqual(prod.data["stock_quantity"], 4)

    def test_restock_reuses_variant_with_new_batch_price(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        pid = c.post("/api/products/", {"name": "Kurti B"}, format="json", HTTP_HOST="acme.localhost").data["id"]
        old = self.add_stock(c, pid, self.line(c, "Black", "XL", 2, "200", "300"))
        new = self.add_stock(c, pid, self.line(c, "Black", "XL", 1, "220", "330"))
        self.assertEqual(new.status_code, 201, new.data)
        self.assertEqual(ProductVariant.objects.filter(product_id=pid).count(), 1)
        self.assertEqual(old.data["items"][0]["variant"], new.data["items"][0]["variant"])
        self.assertEqual(new.data["items"][0]["price"], "330.00")
        # Older units keep their own batch price.
        lookup = c.get(f"/api/stock-items/lookup/?code={old.data['items'][0]['code']}", HTTP_HOST="acme.localhost")
        self.assertEqual(lookup.data["price"], "300.00")
        prod = c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost").data
        self.assertEqual(prod["stock_quantity"], 3)
        self.assertEqual(prod["variants"][0]["last_price"], "330.00")

    def test_low_stock_filter_and_search_by_variant(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        pid = c.post("/api/products/", {"name": "Saree Low"}, format="json", HTTP_HOST="acme.localhost").data["id"]
        self.add_stock(
            c, pid,
            self.line(c, "Red", "M", 10, "1", "2"),
            self.line(c, "Green", "M", 1, "1", "2"),
        )
        low_ids = [p["id"] for p in c.get("/api/products/?low_stock=1", HTTP_HOST="acme.localhost").data["results"]]
        self.assertIn(pid, low_ids)
        found = c.get("/api/products/?search=Green", HTTP_HOST="acme.localhost").data["results"]
        self.assertEqual([p["id"] for p in found], [pid])
        # Searching through variants must not inflate the aggregate counts.
        self.assertEqual(found[0]["stock_quantity"], 11)

    def test_add_stock_validates_lines(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        pid = c.post("/api/products/", {"name": "Bad"}, format="json", HTTP_HOST="acme.localhost").data["id"]
        self.assertEqual(self.add_stock(c, pid).status_code, 400)
        bad = self.add_stock(c, pid, self.line(c, "Red", "S", 0, "1", "2"))
        self.assertEqual(bad.status_code, 400)
        unknown = self.add_stock(c, pid, {"color": 999999, "quantity": 1, "cost_price": "1", "price": "2"})
        self.assertEqual(unknown.status_code, 400)
        with schema_context("acme"):
            self.assertFalse(ProductVariant.objects.filter(product_id=pid).exists())

    def test_settings_rename_flows_to_variants_and_in_use_cannot_be_deleted(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        pid = c.post("/api/products/", {"name": "Dupatta"}, format="json", HTTP_HOST="acme.localhost").data["id"]
        cid = self.opt(c, "colors", "Maroon")
        # No size: a free-size item; still one variant per (product, color, no-size).
        first = self.add_stock(c, pid, {"color": cid, "quantity": 1, "cost_price": "1", "price": "2"})
        again = self.add_stock(c, pid, {"color": cid, "size": None, "quantity": 1, "cost_price": "1", "price": "2"})
        self.assertEqual(first.data["items"][0]["variant"], again.data["items"][0]["variant"])

        c.patch(f"/api/colors/{cid}/", {"name": "Wine"}, format="json", HTTP_HOST="acme.localhost")
        v = c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost").data["variants"][0]
        self.assertEqual((v["color_name"], v["size_name"]), ("Wine", None))
        unit = c.get(f"/api/stock-items/?product={pid}", HTTP_HOST="acme.localhost").data["results"][0]
        self.assertEqual(unit["color_name"], "Wine")

        resp = c.delete(f"/api/colors/{cid}/", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Deactivate", resp.data["detail"])

    def test_stock_units_isolated_between_shops(self):
        with schema_context("acme"):
            p = Product.objects.create(name="Acme Fabric")
            red, _ = Color.objects.get_or_create(name="Red")
            m, _ = Size.objects.get_or_create(name="M")
            v = ProductVariant.objects.create(product=p, color=red, size=m)
            b = StockBatch.objects.create(variant=v, cost_price=50, price=100, quantity=1)
            StockItem.objects.create(variant=v, batch=b)
        acme = self.client_for("acme.localhost", "acme@test.com")
        bella = self.client_for("bella.localhost", "bella@test.com")
        acme_codes = [u["code"] for u in acme.get("/api/stock-items/", HTTP_HOST="acme.localhost").data["results"]]
        bella_units = bella.get("/api/stock-items/", HTTP_HOST="bella.localhost").data
        self.assertEqual(len(acme_codes), 1)
        self.assertEqual(bella_units["count"], 0)
