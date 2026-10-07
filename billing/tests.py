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
CUST = {"name": "Walk-in", "phone": "9000000000"}


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
        pid = client.post("/api/products/", {"name": "Tee"}, format="json", HTTP_HOST=host).data["id"]
        def opt(kind, name):
            found = [o for o in client.get(f"/api/{kind}/", HTTP_HOST=host).data if o["name"] == name]
            return found[0]["id"] if found else client.post(f"/api/{kind}/", {"name": name}, format="json", HTTP_HOST=host).data["id"]
        line = {"color": opt("colors", "Black"), "size": opt("sizes", "XL"), "quantity": qty, "cost_price": "50", "price": price}
        items = client.post(f"/api/products/{pid}/add-stock/", {"lines": [line]}, format="json", HTTP_HOST=host).data["items"]
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
        self.assertEqual({(i["product_name"], i["unit_price"]) for i in b["items"]}, {("Tee — Black / XL", "200.00")})
        prod = c.get(f"/api/products/{pid}/", HTTP_HOST="acme.localhost")
        self.assertEqual(prod.data["stock_quantity"], 1)
        self.assertEqual(c.get(f"/api/stock-items/lookup/?code={codes[0]}", HTTP_HOST="acme.localhost").status_code, 404)

    def test_tax_comes_from_settings_not_request(self):
        self.set_tax("acme", 10)
        c = self.client_for("acme.localhost", "acme@test.com")
        _, codes = self._product_with_units("acme.localhost", c, 1, price="100")
        # tax_rate in the body must be ignored; server uses the shop's 10%.
        resp = c.post("/api/bills/", {"codes": codes, "payment_mode": "Cash", "tax_rate": "99", "customer": CUST},
                      format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Decimal(resp.data["tax_rate"]), Decimal("10.00"))
        self.assertEqual(Decimal(resp.data["tax_amount"]), Decimal("10.00"))  # 10% of 100

    def test_invalid_payment_method_rejected(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        _, codes = self._product_with_units("acme.localhost", c, 1)
        resp = c.post("/api/bills/", {"codes": codes, "payment_mode": "Bitcoin", "customer": CUST},
                      format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 400)

    def test_checkout_rejects_unknown_code(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        resp = c.post("/api/bills/", {"codes": ["NOPE123"], "payment_mode": "Cash", "customer": CUST},
                      format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 400)

    def test_checkout_rejects_non_digit_phone(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        _, codes = self._product_with_units("acme.localhost", c, 1)
        for bad in ["98765 43210", "+919876543210", "abc", "987654321", "98765432101"]:
            resp = c.post("/api/bills/", {"codes": codes, "payment_mode": "Cash",
                                          "customer": {"name": "X", "phone": bad}},
                          format="json", HTTP_HOST="acme.localhost")
            self.assertEqual(resp.status_code, 400, bad)
            self.assertIn("phone", resp.data["customer"])
        # (Valid digit phones are covered by the checkout tests; no bill is created here
        # so the INV numbering other tests assert stays intact.)

    def test_checkout_requires_customer(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        _, codes = self._product_with_units("acme.localhost", c, 1)
        for customer in [None, {}, {"name": "X", "phone": ""}, {"name": "", "phone": "9000000000"}]:
            body = {"codes": codes, "payment_mode": "Cash"}
            if customer is not None:
                body["customer"] = customer
            resp = c.post("/api/bills/", body, format="json", HTTP_HOST="acme.localhost")
            self.assertEqual(resp.status_code, 400, customer)
            self.assertIn("customer", resp.data)

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

    # --- Returns & store credit (named test_return*/test_store_credit* so they run after
    # the INV-00001 assertion above; Postgres sequences survive test rollbacks) ---

    def _sell(self, host, client, qty, phone="9000000000", **extra):
        _, codes = self._product_with_units(host, client, qty)
        body = {"codes": codes, "payment_mode": "Cash", "customer": {"name": "Ret", "phone": phone}, **extra}
        resp = client.post("/api/bills/", body, format="json", HTTP_HOST=host)
        self.assertEqual(resp.status_code, 201, resp.data)
        return resp.data, codes

    def _return(self, host, client, bill_id, item_ids, mode="refund", payment_mode="Cash"):
        return client.post("/api/returns/", {"bill": bill_id, "items": item_ids, "mode": mode,
                                             "payment_mode": payment_mode},
                           format="json", HTTP_HOST=host)

    def test_return_refund_is_pro_rata_and_restocks(self):
        self.set_tax("acme", 5)
        c = self.client_for("acme.localhost", "acme@test.com")
        # 3 × 200, 10% off, 5% tax → total 567.00; each line's share is 189.00.
        bill, codes = self._sell("acme.localhost", c, 3, discount_type="percent", discount_value="10")
        self.assertEqual(Decimal(bill["total"]), Decimal("567.00"))
        first = bill["items"][0]
        resp = self._return("acme.localhost", c, bill["id"], [first["id"]])
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Decimal(resp.data["amount"]), Decimal("189.00"))
        self.assertTrue(resp.data["number"].startswith("RET-"))
        # The unit is back in stock and sellable again.
        self.assertEqual(c.get(f"/api/stock-items/lookup/?code={first['code']}", HTTP_HOST="acme.localhost").status_code, 200)
        # Same line twice → 400; the rest of the bill → shares sum to the total.
        self.assertEqual(self._return("acme.localhost", c, bill["id"], [first["id"]]).status_code, 400)
        rest = [i["id"] for i in bill["items"][1:]]
        self.assertEqual(Decimal(self._return("acme.localhost", c, bill["id"], rest).data["amount"]), Decimal("378.00"))
        b = c.get(f"/api/bills/{bill['id']}/", HTTP_HOST="acme.localhost").data
        self.assertEqual(Decimal(b["refunded_total"]), Decimal(b["total"]))
        self.assertTrue(all(i["returned"] for i in b["items"]))

    def test_return_rounding_remainder_goes_to_last_line(self):
        self.set_tax("acme", 0)
        c = self.client_for("acme.localhost", "acme@test.com")
        # 3 × 200 = 600, flat 100 off → 500; shares 166.67 + 166.67 + 166.66.
        bill, _ = self._sell("acme.localhost", c, 3, discount_type="flat", discount_value="100")
        shares = [Decimal(i["refund_amount"]) for i in sorted(bill["items"], key=lambda i: i["id"])]
        self.assertEqual(shares, [Decimal("166.67"), Decimal("166.67"), Decimal("166.66")])

    def test_return_validation(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        bill_a, _ = self._sell("acme.localhost", c, 1)
        bill_b, _ = self._sell("acme.localhost", c, 1)
        # Item from another bill, unknown payment method.
        self.assertEqual(self._return("acme.localhost", c, bill_a["id"], [bill_b["items"][0]["id"]]).status_code, 400)
        self.assertEqual(self._return("acme.localhost", c, bill_a["id"], [bill_a["items"][0]["id"]],
                                      payment_mode="Bitcoin").status_code, 400)
        # Every bill has a customer now, so store credit is always available.
        self.assertEqual(self._return("acme.localhost", c, bill_a["id"], [bill_a["items"][0]["id"]],
                                      mode="credit").status_code, 201)

    def test_return_by_code_lookup(self):
        c = self.client_for("acme.localhost", "acme@test.com")
        bill, codes = self._sell("acme.localhost", c, 1)
        found = c.get(f"/api/bills/by-code/?code={codes[0]}", HTTP_HOST="acme.localhost")
        self.assertEqual(found.status_code, 200)
        self.assertEqual(found.data["id"], bill["id"])
        self.assertEqual(found.data["scanned_item"], bill["items"][0]["id"])
        self._return("acme.localhost", c, bill["id"], [bill["items"][0]["id"]])
        self.assertEqual(c.get(f"/api/bills/by-code/?code={codes[0]}", HTTP_HOST="acme.localhost").status_code, 404)

    def test_store_credit_earn_spend_and_isolation(self):
        self.set_tax("acme", 0)
        a = self.client_for("acme.localhost", "acme@test.com")
        b = self.client_for("bella.localhost", "bella@test.com")
        phone = "9123456780"
        bill, _ = self._sell("acme.localhost", a, 1, phone=phone)  # 200.00
        resp = self._return("acme.localhost", a, bill["id"], [bill["items"][0]["id"]], mode="credit")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["payment_mode"], "")
        bal = lambda c, host: Decimal(c.get(f"/api/store-credit/?phone={phone}", HTTP_HOST=host).data["balance"])
        self.assertEqual(bal(a, "acme.localhost"), Decimal("200.00"))
        self.assertEqual(bal(b, "bella.localhost"), Decimal("0.00"))  # per-shop credit
        customers = a.get("/api/customers/", HTTP_HOST="acme.localhost").data
        self.assertEqual(Decimal([x for x in customers if x["phone"] == phone][0]["credit_balance"]), Decimal("200.00"))

        # Spend: more than balance → 400; no phone → 400; 150 of it → ok.
        _, codes = self._product_with_units("acme.localhost", a, 2)  # 400.00
        body = {"codes": codes, "payment_mode": "Cash", "customer": {"name": "Ret", "phone": phone}}
        self.assertEqual(a.post("/api/bills/", {**body, "credit_used": "250"}, format="json", HTTP_HOST="acme.localhost").status_code, 400)
        self.assertEqual(a.post("/api/bills/", {"codes": codes, "payment_mode": "Cash", "credit_used": "50"},
                                format="json", HTTP_HOST="acme.localhost").status_code, 400)
        resp = a.post("/api/bills/", {**body, "credit_used": "150"}, format="json", HTTP_HOST="acme.localhost")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Decimal(resp.data["credit_used"]), Decimal("150.00"))
        self.assertEqual(bal(a, "acme.localhost"), Decimal("50.00"))
