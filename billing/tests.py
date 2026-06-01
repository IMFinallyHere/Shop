"""POS / billing tests: checkout, totals, sold units, shared customer, isolation."""
from decimal import Decimal

from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework.test import APIClient
from tenant_users.tenants.tasks import provision_tenant
from tenant_users.tenants.utils import create_public_tenant

from accounts.models import User
from customers.models import Customer
from shopsettings.models import ShopSettings
from tenants.models import Tenant

PW = "pw12345678"


class BillingTestCase(TestCase):
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

    def set_tax(self, schema, rate):
        with schema_context(schema):
            s = ShopSettings.load()
            s.default_tax_rate = rate
            s.save()

    def _product_with_units(self, host, client, qty, price="200"):
        pid = client.post("/api/products/", {"name": "Tee", "price": price}, format="json", HTTP_HOST=host).data["id"]
        items = client.post(f"/api/products/{pid}/add-stock/", {"quantity": qty}, format="json", HTTP_HOST=host).data["items"]
        return pid, [i["code"] for i in items]

    def test_checkout_totals_marks_sold_and_drops_stock(self):
        self.set_tax("acme", 5)
        c = self.client_for("acme.localhost", "acme@test.com")
        pid, codes = self._product_with_units("acme.localhost", c, 3)
        resp = c.post("/api/bills/", {
            "codes": codes[:2], "customer": {"name": "Asha", "phone": "9990001111"},
            "discount_type": "percent", "discount_value": "10", "payment_mode": "UPI",
        }, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 201, resp.data)
        b = resp.data
        self.assertEqual(Decimal(b["subtotal"]), Decimal("400.00"))
        self.assertEqual(Decimal(b["discount_amount"]), Decimal("40.00"))
        self.assertEqual(Decimal(b["tax_amount"]), Decimal("18.00"))  # 5% of 360
        self.assertEqual(Decimal(b["total"]), Decimal("378.00"))
        self.assertEqual(b["number"], "INV-00001")
        self.assertEqual(b["payment_mode"], "UPI")
        prod = c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost")
        self.assertEqual(prod.data["stock_quantity"], 1)
        self.assertEqual(c.get(f"/api/stock-items/lookup/?code={codes[0]}", HTTP_HOST="acme.localhost").status_code, 404)

    def test_tax_comes_from_settings_not_request(self):
        self.set_tax("acme", 10)
        c = self.client_for("acme.localhost", "acme@test.com")
        _, codes = self._product_with_units("acme.localhost", c, 1, price="100")
        # tax_rate in the body must be ignored; server uses the shop's 10%.
        resp = c.post("/api/bills/", {"codes": codes, "payment_mode": "Cash", "tax_rate": "99"},
                      format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Decimal(resp.data["tax_rate"]), Decimal("10.00"))
        self.assertEqual(Decimal(resp.data["tax_amount"]), Decimal("10.00"))  # 10% of 100

    def test_invalid_payment_method_rejected(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        _, codes = self._product_with_units("acme.localhost", c, 1)
        resp = c.post("/api/bills/", {"codes": codes, "payment_mode": "Bitcoin"},
                      format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 400)

    def test_checkout_rejects_unknown_code(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        resp = c.post("/api/bills/", {"codes": ["NOPE123"], "payment_mode": "Cash"},
                      format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 400)

    def test_shared_customer_dedup_and_per_shop_scoping(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        b = self.client_for("bella.localhost", "bella@test.com")
        _, acodes = self._product_with_units("acme.localhost", a, 1)
        _, bcodes = self._product_with_units("bella.localhost", b, 1)
        a.post("/api/bills/", {"codes": acodes, "payment_mode": "Cash", "customer": {"name": "Ravi", "phone": "8887776666"}},
               format="json", HTTP_HOST="acme.localhost")
        b.post("/api/bills/", {"codes": bcodes, "payment_mode": "Cash", "customer": {"name": "Ravi", "phone": "8887776666"}},
               format="json", HTTP_HOST="bella.localhost")
        with schema_context(get_public_schema_name()):
            self.assertEqual(Customer.objects.filter(phone="8887776666").count(), 1)
        a_customers = a.get("/api/customers/", HTTP_HOST="acme.localhost").data
        self.assertEqual([c["name"] for c in a_customers], ["Ravi"])
        lookup = a.get("/api/customers/lookup/?phone=8887776666", HTTP_HOST="acme.localhost").data
        self.assertEqual(lookup[0]["name"], "Ravi")

    def test_my_customers_excludes_other_shops_buyers(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        b = self.client_for("bella.localhost", "bella@test.com")
        _, acodes = self._product_with_units("acme.localhost", a, 1)
        a.post("/api/bills/", {"codes": acodes, "payment_mode": "Cash", "customer": {"name": "OnlyAcme", "phone": "7000000000"}},
               format="json", HTTP_HOST="acme.localhost")
        bella_customers = b.get("/api/customers/", HTTP_HOST="bella.localhost").data
        self.assertNotIn("OnlyAcme", [c["name"] for c in bella_customers])
