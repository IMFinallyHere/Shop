"""Inventory tests: per-shop product management, stock movements, isolation."""
from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework.test import APIClient
from tenant_users.tenants.tasks import provision_tenant
from tenant_users.tenants.utils import create_public_tenant

from accounts.models import User
from inventory.models import Product
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

    def test_product_crud_and_stock_movements(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        resp = c.post("/api/products/", {"name": "Silk Saree", "price": "1500", "low_stock_threshold": 3},
                      format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["stock_quantity"], 0)
        self.assertTrue(resp.data["is_low_stock"])
        pid = resp.data["id"]

        up = c.post(f"/api/products/{pid}/adjust-stock/", {"quantity": 10}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(up.data["stock_quantity"], 10)
        self.assertFalse(up.data["is_low_stock"])

        over = c.post(f"/api/products/{pid}/adjust-stock/", {"quantity": -50}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(over.status_code, 400)

        mv = c.get(f"/api/products/{pid}/movements/", HTTP_HOST="acme.localhost")
        self.assertEqual(len(mv.data), 1)
        self.assertEqual(mv.data[0]["resulting_stock"], 10)

    def test_products_are_isolated_between_shops(self):
        with schema_context("acme"):
            Product.objects.create(name="Acme-only Fabric", price=100)
        acme = self.client_for("acme.localhost", "acme@test.com")
        bella = self.client_for("bella.localhost", "bella@test.com")
        acme_names = [p["name"] for p in acme.get("/api/products/", HTTP_HOST="acme.localhost").data["results"]]
        bella_names = [p["name"] for p in bella.get("/api/products/", HTTP_HOST="bella.localhost").data["results"]]
        self.assertIn("Acme-only Fabric", acme_names)
        self.assertNotIn("Acme-only Fabric", bella_names)
