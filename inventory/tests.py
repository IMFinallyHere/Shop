"""Inventory tests: per-unit stock items, barcodes, isolation."""
from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework.test import APIClient
from tenant_users.tenants.tasks import provision_tenant
from tenant_users.tenants.utils import create_public_tenant

from accounts.models import User
from inventory.models import Product, StockItem
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

    def test_add_stock_creates_units_with_unique_barcodes(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        resp = c.post("/api/products/", {"name": "Cotton Bra", "price": "499", "low_stock_threshold": 3},
                      format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["stock_quantity"], 0)
        self.assertTrue(resp.data["is_low_stock"])
        pid = resp.data["id"]

        added = c.post(f"/api/products/{pid}/add-stock/", {"quantity": 5}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(added.status_code, 201, added.data)
        self.assertEqual(added.data["count"], 5)
        codes = [i["code"] for i in added.data["items"]]
        self.assertEqual(len(set(codes)), 5)  # all unique

        prod = c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost")
        self.assertEqual(prod.data["stock_quantity"], 5)
        self.assertFalse(prod.data["is_low_stock"])

        units = c.get(f"/api/stock-items/?product={pid}", HTTP_HOST="acme.localhost")
        self.assertEqual(units.data["count"], 5)

        rid = units.data["results"][0]["id"]
        removed = c.post(f"/api/stock-items/{rid}/remove/", HTTP_HOST="acme.localhost")
        self.assertEqual(removed.data["status"], "removed")
        prod = c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost")
        self.assertEqual(prod.data["stock_quantity"], 4)

    def test_stock_units_isolated_between_shops(self):
        with schema_context("acme"):
            p = Product.objects.create(name="Acme Fabric", price=100)
            import uuid
            StockItem.objects.create(product=p, batch=uuid.uuid4())
        acme = self.client_for("acme.localhost", "acme@test.com")
        bella = self.client_for("bella.localhost", "bella@test.com")
        acme_codes = [u["code"] for u in acme.get("/api/stock-items/", HTTP_HOST="acme.localhost").data["results"]]
        bella_units = bella.get("/api/stock-items/", HTTP_HOST="bella.localhost").data
        self.assertEqual(len(acme_codes), 1)
        self.assertEqual(bella_units["count"], 0)
