"""Per-shop settings: tax isolation + payment-method management."""
from decimal import Decimal

from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django_tenants.utils import get_public_schema_name, schema_context, tenant_context
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

    def test_sizes_seed_in_order_and_are_per_shop(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        b = self.client_for("bella.localhost", "bella@test.com")
        names = [s["name"] for s in a.get("/api/sizes/", HTTP_HOST="acme.localhost").data]
        self.assertEqual(names[:4], ["XS", "S", "M", "L"])
        created = a.post("/api/sizes/", {"name": " 4XL "}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["name"], "4XL")
        self.assertEqual(created.data["position"], len(names))  # appended at the end
        dupe = a.post("/api/sizes/", {"name": "xl"}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(dupe.status_code, 400)  # case-insensitive duplicate of XL
        self.assertNotIn("4XL", [s["name"] for s in b.get("/api/sizes/", HTTP_HOST="bella.localhost").data])

    def test_colors_crud_hex_and_active_filter(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        self.assertEqual(a.get("/api/colors/", HTTP_HOST="acme.localhost").data, [])  # no seed
        bad = a.post("/api/colors/", {"name": "Teal", "hex": "teal"}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(bad.status_code, 400)
        teal = a.post("/api/colors/", {"name": "Teal", "hex": "#008080"}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(teal.status_code, 201, teal.data)
        a.patch(f"/api/colors/{teal.data['id']}/", {"is_active": False}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(a.get("/api/colors/?active=1", HTTP_HOST="acme.localhost").data, [])
        # Unused colors can be deleted.
        self.assertEqual(a.delete(f"/api/colors/{teal.data['id']}/", HTTP_HOST="acme.localhost").status_code, 204)

    def test_print_settings_round_trip_and_bounds(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        data = a.get("/api/shop-settings/", HTTP_HOST="acme.localhost").data
        self.assertEqual((data["label_width_mm"], data["label_height_mm"], data["receipt_width_mm"]), (50, 25, 80))
        resp = a.put("/api/shop-settings/", {
            "label_width_mm": 38, "label_height_mm": 25, "label_show_price": False, "label_copies": 2,
            "receipt_width_mm": 58, "receipt_gstin": "27ABCDE1234F1Z5", "auto_print_after_bill": True,
        }, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual((resp.data["label_width_mm"], resp.data["label_copies"], resp.data["receipt_width_mm"]), (38, 2, 58))
        self.assertFalse(resp.data["label_show_price"])
        self.assertTrue(resp.data["auto_print_after_bill"])
        for bad in ({"label_width_mm": 5}, {"label_height_mm": 500}, {"label_copies": 0}, {"receipt_width_mm": 100}):
            self.assertEqual(a.put("/api/shop-settings/", bad, format="json", HTTP_HOST="acme.localhost").status_code, 400, bad)

    # --- first-run onboarding --------------------------------------------------

    def test_onboarding_checklist_follows_the_shops_data(self):
        from inventory.models import Product
        h = {"HTTP_HOST": "bella.localhost"}
        owner = self.client_for("bella.localhost", "bella@test.com")
        steps = lambda: {c["key"]: c["done"] for c in owner.get("/api/onboarding/", **h).data["checklist"]}
        first = owner.get("/api/onboarding/", **h).data
        self.assertEqual((first["language"], first["tour_done"], first["checklist_dismissed"]), ("en", False, False))
        self.assertFalse(any(steps().values()))

        owner.put("/api/shop-settings/", {"receipt_gstin": "27AAKFA4721M1Z3"}, format="json", **h)
        with tenant_context(self.bella):
            Product.objects.create(name="Cotton Kurta")
        owner.patch("/api/onboarding/", {"add_event": "label_printed"}, format="json", **h)
        with schema_context(get_public_schema_name()):
            staff = User.objects.create_user(email="bella-staff@test.com", password=PW)
        self.bella.add_user(staff, is_staff=True)
        self.assertEqual(steps(), {"shop_details": True, "first_product": True, "first_label": True,
                                   "first_bill": False, "first_staff": True})

    def test_onboarding_tour_and_language_are_per_user_and_staff_get_no_checklist(self):
        h = {"HTTP_HOST": "acme.localhost"}
        with schema_context(get_public_schema_name()):
            staff = User.objects.create_user(email="acme-staff@test.com", password=PW)
        self.acme.add_user(staff, is_staff=True)
        owner = self.client_for("acme.localhost", "acme@test.com")
        member = self.client_for("acme.localhost", "acme-staff@test.com")

        done = owner.patch("/api/onboarding/", {"tour_done": True, "language": "hi", "checklist_dismissed": True},
                           format="json", **h).data
        self.assertEqual((done["tour_done"], done["language"], done["checklist_dismissed"]), (True, "hi", True))
        self.assertEqual(owner.patch("/api/onboarding/", {"language": "fr"}, format="json", **h).status_code, 400)
        self.assertEqual(owner.patch("/api/onboarding/", {"add_event": "anything"}, format="json", **h).status_code, 400)

        mine = member.get("/api/onboarding/", **h).data
        self.assertEqual((mine["tour_done"], mine["language"], mine["checklist"]), (False, "en", None))
        # The same owner in another shop starts fresh there.
        self.assertFalse(self.client_for("bella.localhost", "bella@test.com").get(
            "/api/onboarding/", HTTP_HOST="bella.localhost").data["tour_done"])
