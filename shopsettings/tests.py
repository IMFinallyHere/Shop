"""Per-shop settings: tax isolation + payment-method management."""
from decimal import Decimal

from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework.test import APIClient
from tenant_users.tenants.tasks import provision_tenant
from tenant_users.tenants.utils import create_public_tenant

from accounts.models import User
from tenants.models import Tenant

PW = "pw12345678"


class ShopSettingsTestCase(TestCase):
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

    def test_default_tax_is_per_shop(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        b = self.client_for("bella.localhost", "bella@test.com")
        a.put("/api/shop-settings/", {"default_tax_rate": "12"}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(Decimal(a.get("/api/shop-settings/", HTTP_HOST="acme.localhost").data["default_tax_rate"]), Decimal("12.00"))
        # Bella is untouched (its own default).
        self.assertEqual(Decimal(b.get("/api/shop-settings/", HTTP_HOST="bella.localhost").data["default_tax_rate"]), Decimal("0.00"))

    def test_payment_methods_seed_and_manage(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        seeded = a.get("/api/payment-methods/", HTTP_HOST="acme.localhost").data
        names = {m["name"] for m in (seeded.get("results", seeded) if isinstance(seeded, dict) else seeded)}
        self.assertEqual(names, {"Cash", "UPI", "Card"})
        created = a.post("/api/payment-methods/", {"name": "Paytm"}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(created.status_code, 201)
        # active-only filter
        a.patch(f"/api/payment-methods/{created.data['id']}/", {"is_active": False}, format="json", HTTP_HOST="acme.localhost")
        active = a.get("/api/payment-methods/?active=1", HTTP_HOST="acme.localhost").data
        active_names = {m["name"] for m in (active.get("results", active) if isinstance(active, dict) else active)}
        self.assertNotIn("Paytm", active_names)
