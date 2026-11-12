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

    def test_tax_slabs_per_shop_and_validated(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        b = self.client_for("bella.localhost", "bella@test.com")
        h = {"format": "json", "HTTP_HOST": "acme.localhost"}
        # New shops start on Indian clothing slabs, prices including GST.
        data = a.get("/api/shop-settings/", HTTP_HOST="acme.localhost").data
        self.assertEqual((data["tax_slabs"], data["prices_include_tax"]),
                         ([{"upto": 2500, "rate": 5}, {"upto": None, "rate": 18}], True))
        resp = a.put("/api/shop-settings/", {"tax_slabs": [{"upto": "1000", "rate": "5"}, {"upto": None, "rate": 12}],
                                             "prices_include_tax": False}, **h)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["tax_slabs"], [{"upto": 1000, "rate": 5}, {"upto": None, "rate": 12}])
        # Bella is untouched.
        self.assertEqual(b.get("/api/shop-settings/", HTTP_HOST="bella.localhost").data["tax_slabs"][0], {"upto": 2500, "rate": 5})
        for bad in (
            [],                                                       # none
            [{"upto": 2500, "rate": 5}],                              # last slab capped
            [{"upto": None, "rate": 5}, {"upto": None, "rate": 18}],  # open slab not last
            [{"upto": 3000, "rate": 5}, {"upto": 2000, "rate": 12}, {"upto": None, "rate": 18}],  # not ascending
            [{"upto": None, "rate": 40}],                             # rate too high
        ):
            self.assertEqual(a.put("/api/shop-settings/", {"tax_slabs": bad}, **h).status_code, 400, bad)

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
        seeded = a.get("/api/colors/", HTTP_HOST="acme.localhost").data  # common colours on first open
        self.assertEqual([c["name"] for c in seeded[:3]], ["Black", "White", "Off White"])
        self.assertEqual(seeded[0]["hex"], "#111111")
        self.assertEqual(len(a.get("/api/colors/", HTTP_HOST="acme.localhost").data), len(seeded))  # seeded once
        bad = a.post("/api/colors/", {"name": "Teal", "hex": "teal"}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(bad.status_code, 400)
        teal = a.post("/api/colors/", {"name": "Teal", "hex": "#008080"}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(teal.status_code, 201, teal.data)
        a.patch(f"/api/colors/{teal.data['id']}/", {"is_active": False}, format="json", HTTP_HOST="acme.localhost")
        self.assertNotIn("Teal", [c["name"] for c in a.get("/api/colors/?active=1", HTTP_HOST="acme.localhost").data])
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

    def test_auto_product_names_setting(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        h = {"format": "json", "HTTP_HOST": "acme.localhost"}
        self.assertFalse(a.get("/api/shop-settings/", HTTP_HOST="acme.localhost").data["auto_product_names"])
        self.assertTrue(a.put("/api/shop-settings/", {"auto_product_names": True}, **h).data["auto_product_names"])

    def test_receipt_printable_width(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        h = {"format": "json", "HTTP_HOST": "acme.localhost"}
        self.assertIsNone(a.get("/api/shop-settings/", HTTP_HOST="acme.localhost").data["receipt_printable_mm"])
        resp = a.put("/api/shop-settings/", {"receipt_width_mm": 80, "receipt_printable_mm": 72}, **h)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["receipt_printable_mm"], 72)
        # Wider than the paper: on its own, and when switching to a narrower roll.
        self.assertEqual(a.put("/api/shop-settings/", {"receipt_printable_mm": 90}, **h).status_code, 400)
        self.assertEqual(a.put("/api/shop-settings/", {"receipt_width_mm": 58}, **h).status_code, 400)
        self.assertEqual(a.put("/api/shop-settings/", {"receipt_printable_mm": 10}, **h).status_code, 400)
        # Cleared back to auto.
        resp = a.put("/api/shop-settings/", {"receipt_printable_mm": None}, **h)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIsNone(resp.data["receipt_printable_mm"])

    def test_receipt_address_keeps_line_breaks(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        h = {"format": "json", "HTTP_HOST": "acme.localhost"}
        resp = a.put("/api/shop-settings/", {"receipt_address": "  Gokul Complex \r\n\r\nMathura  \n"}, **h)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["receipt_address"], "Gokul Complex\nMathura")
        self.assertEqual(a.put("/api/shop-settings/", {"receipt_address": "a\nb\nc\nd\ne"}, **h).status_code, 400)
        resp = a.put("/api/shop-settings/", {"receipt_footer": "Thank you!\n\n  No exchange after 7 days "}, **h)
        self.assertEqual(resp.data["receipt_footer"], "Thank you!\nNo exchange after 7 days")
        self.assertEqual(a.put("/api/shop-settings/", {"receipt_footer": "a\nb\nc\nd\ne"}, **h).status_code, 400)

    def test_qz_signing(self):
        import base64
        import tempfile
        from pathlib import Path

        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding, rsa
        from django.test import override_settings

        a = self.client_for("acme.localhost", "acme@test.com")
        h = {"format": "json", "HTTP_HOST": "acme.localhost"}
        # Not configured: 404, so the frontend falls back to unsigned.
        self.assertEqual(a.post("/api/print/qz-sign/", {"request": "x"}, **h).status_code, 404)
        self.assertEqual(APIClient().post("/api/print/qz-sign/", {"request": "x"}, **h).status_code, 401)

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        with tempfile.TemporaryDirectory() as d:
            key_file, cert_file = Path(d, "key.pem"), Path(d, "cert.pem")
            key_file.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                                   serialization.NoEncryption()))
            cert_file.write_text("-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----\n")
            with override_settings(QZ_CERT_FILE=str(cert_file), QZ_PRIVATE_KEY_FILE=str(key_file)):
                self.assertIn("BEGIN CERTIFICATE", a.get("/api/print/qz-cert/", HTTP_HOST="acme.localhost").data["certificate"])
                resp = a.post("/api/print/qz-sign/", {"request": "hello qz"}, **h)
                self.assertEqual(resp.status_code, 200, resp.data)
                key.public_key().verify(base64.b64decode(resp.data["signature"]), b"hello qz",
                                        padding.PKCS1v15(), hashes.SHA512())  # raises if wrong
                self.assertEqual(a.post("/api/print/qz-sign/", {}, **h).status_code, 400)

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
        with schema_context(get_public_schema_name()):
            staff = User.objects.create_user(email="bella-staff@test.com", password=PW)
        self.bella.add_user(staff, is_staff=True)
        # Tags printed by staff tick the owner's "Print a tag" too.
        self.client_for("bella.localhost", "bella-staff@test.com").patch(
            "/api/onboarding/", {"add_event": "label_printed"}, format="json", **h)
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

    def test_product_and_invoice_barcode_settings(self):
        a = self.client_for("acme.localhost", "acme@test.com")
        h = {"format": "json", "HTTP_HOST": "acme.localhost"}
        keys = ["one_time_stock_default", "hide_product_name", "require_category", "require_seller", "require_cost_price"]
        got = a.get("/api/shop-settings/", HTTP_HOST="acme.localhost").data
        self.assertTrue(all(got[k] is False for k in keys))
        self.assertTrue(got["receipt_show_invoice_barcode"])
        resp = a.put("/api/shop-settings/", {**{k: True for k in keys}, "receipt_show_invoice_barcode": False}, **h)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(all(resp.data[k] for k in keys))
        self.assertFalse(resp.data["receipt_show_invoice_barcode"])
