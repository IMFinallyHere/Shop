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

    def test_add_stock_without_color_or_cost(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        pid = c.post("/api/products/", {"name": "Stole"}, format="json", HTTP_HOST="acme.localhost").data["id"]
        resp = self.add_stock(c, pid, {"quantity": 2, "price": "499"})
        self.assertEqual(resp.status_code, 201, resp.data)
        unit = resp.data["items"][0]
        self.assertEqual((unit["color_name"], unit["price"], unit["cost_price"]), (None, "499.00", None))
        both = self.add_stock(c, pid, {"quantity": 1, "price": "499", "cost_price": None, "color": None})
        self.assertEqual(both.status_code, 201, both.data)

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

        c.patch(f"/api/colors/{cid}/", {"name": "Deep Maroon"}, format="json", HTTP_HOST="acme.localhost")
        v = c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost").data["variants"][0]
        self.assertEqual((v["color_name"], v["size_name"]), ("Deep Maroon", None))
        unit = c.get(f"/api/stock-items/?product={pid}", HTTP_HOST="acme.localhost").data["results"][0]
        self.assertEqual(unit["color_name"], "Deep Maroon")

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

    # --- one-time products, inactive filter, delete guard, mandatory fields, hidden names ---

    def settings(self, c, **kw):
        resp = c.put("/api/shop-settings/", kw, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 200, resp.data)

    def new_product(self, c, **kw):
        resp = c.post("/api/products/", {"name": "P", **kw}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 201, resp.data)
        return resp.data["id"]

    def test_one_time_product_goes_inactive_when_sold_out_and_returns_on_restock(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        pid = self.new_product(c, name="Once", is_one_time=True)
        # Nothing acts until it has had stock: still active with zero units.
        self.assertTrue(c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost").data["is_active"])
        added = self.add_stock(c, pid, {"quantity": 2, "price": "100"})
        for unit in added.data["items"]:
            c.post(f"/api/stock-items/{unit['id']}/remove/", HTTP_HOST="acme.localhost")
        self.assertFalse(c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost").data["is_active"])
        ids = lambda q: [p["id"] for p in c.get(f"/api/products/{q}", HTTP_HOST="acme.localhost").data["results"]]  # noqa: E731
        self.assertNotIn(pid, ids(""))
        self.assertIn(pid, ids("?inactive=1"))
        self.add_stock(c, pid, {"quantity": 1, "price": "100"})
        self.assertTrue(c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost").data["is_active"])
        self.assertIn(pid, ids(""))

    def test_regular_product_stays_active_when_sold_out(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        pid = self.new_product(c, name="Regular")
        unit = self.add_stock(c, pid, {"quantity": 1, "price": "100"}).data["items"][0]
        c.post(f"/api/stock-items/{unit['id']}/remove/", HTTP_HOST="acme.localhost")
        self.assertTrue(c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost").data["is_active"])

    def test_product_with_sold_units_cannot_be_deleted(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        pid = self.new_product(c, name="Sold")
        unit = self.add_stock(c, pid, {"quantity": 1, "price": "100"}).data["items"][0]
        with schema_context("acme"):
            StockItem.objects.filter(pk=unit["id"]).update(status=StockItem.SOLD)
        resp = c.delete(f"/api/products/{pid}/", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("sold units", resp.data["detail"])
        with schema_context("acme"):
            self.assertTrue(Product.objects.filter(pk=pid).exists())
        # An untouched product still deletes.
        other = self.new_product(c, name="Fresh")
        self.assertEqual(c.delete(f"/api/products/{other}/", HTTP_HOST="acme.localhost").status_code, 204)

    def test_mandatory_category_seller_and_cost_price(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        self.settings(c, require_category=True, require_seller=True, require_cost_price=True)
        bad = c.post("/api/products/", {"name": "X"}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(set(bad.data), {"category", "seller"})
        cat = c.post("/api/categories/", {"name": "Req Cat"}, format="json", HTTP_HOST="acme.localhost").data["id"]
        sel = c.post("/api/sellers/", {"name": "Req Seller"}, format="json", HTTP_HOST="acme.localhost").data["id"]
        pid = self.new_product(c, category=cat, seller=sel)
        no_cost = self.add_stock(c, pid, {"quantity": 1, "price": "10"})
        self.assertEqual(no_cost.status_code, 400)
        self.assertEqual(self.add_stock(c, pid, {"quantity": 1, "price": "10", "cost_price": "5"}).status_code, 201)
        # Editing something else on an old product isn't blocked by the new rules.
        self.settings(c, require_category=False, require_seller=False, require_cost_price=False)
        old = self.new_product(c, name="Old")
        self.settings(c, require_category=True)
        self.assertEqual(c.patch(f"/api/products/{old}/", {"is_active": False}, format="json", HTTP_HOST="acme.localhost").status_code, 200)
        self.settings(c, require_category=False)

    def test_hidden_product_name_is_generated(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        self.assertEqual(c.post("/api/products/", {"name": ""}, format="json", HTTP_HOST="acme.localhost").status_code, 400)
        self.settings(c, hide_product_name=True)
        cat = c.post("/api/categories/", {"name": "Sarees"}, format="json", HTTP_HOST="acme.localhost").data["id"]
        resp = c.post("/api/products/", {"category": cat, "fabric_type": "Silk"}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["name"], f"Silk Sarees #{resp.data['id']}")
        bare = c.post("/api/products/", {}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(bare.data["name"], f"Product #{bare.data['id']}")
        self.settings(c, hide_product_name=False)

    def test_product_list_can_be_narrowed_to_one_product_even_if_inactive(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        pid = self.new_product(c, name="Pinned")
        self.new_product(c, name="Other")
        c.patch(f"/api/products/{pid}/", {"is_active": False}, format="json", HTTP_HOST="acme.localhost")
        got = c.get(f"/api/products/?id={pid}", HTTP_HOST="acme.localhost").data["results"]
        self.assertEqual([p["id"] for p in got], [pid])
        self.assertEqual(c.get("/api/products/?id=abc", HTTP_HOST="acme.localhost").status_code, 200)

    def test_seller_with_several_phone_numbers(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        h = {"format": "json", "HTTP_HOST": "acme.localhost"}
        made = c.post("/api/sellers/", {"name": "Multi", "phones": ["9000000001", " 9000000002 ", "", "9000000001"]}, **h)
        self.assertEqual(made.status_code, 201, made.data)
        self.assertEqual(made.data["phones"], ["9000000001", "9000000002"])  # trimmed, blanks and repeats dropped
        self.assertEqual(made.data["phone"], "9000000001")  # primary = first
        sid = made.data["id"]
        # Any number finds the seller, in the list and in global search.
        by_second = c.get("/api/sellers/?search=9000000002", HTTP_HOST="acme.localhost").data["results"]
        self.assertEqual([s["id"] for s in by_second], [sid])
        hit = c.get("/api/search/?q=9000000002", HTTP_HOST="acme.localhost").data["sellers"]
        self.assertEqual([s["id"] for s in hit], [sid])
        # Older clients sending only `phone` still work; clearing the list clears the primary too.
        self.assertEqual(c.patch(f"/api/sellers/{sid}/", {"phone": "9111111111"}, **h).data["phones"], ["9111111111"])
        cleared = c.patch(f"/api/sellers/{sid}/", {"phones": []}, **h).data
        self.assertEqual((cleared["phones"], cleared["phone"]), ([], ""))
        self.assertEqual(c.post("/api/sellers/", {"name": "Too many", "phones": [str(i) for i in range(7)]}, **h).status_code, 400)
