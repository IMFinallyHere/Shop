"""End-to-end tests for the multi-tenant guarantees.

Run: `python manage.py test accounts` (creates/drops a `test_shop` database on the
configured Postgres host).
"""
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django_tenants.utils import (
    get_public_schema_name,
    schema_context,
    tenant_context,
)
from rest_framework.test import APIClient
from tenant_users.permissions.models import UserTenantPermissions
from tenant_users.tenants.tasks import provision_tenant
from tenant_users.tenants.utils import create_public_tenant

from accounts.models import User
from tenants.models import Tenant

PW = "pw12345678"


class MultiTenancyTestCase(TestCase):
    """Provisions a public tenant + two shops once, then exercises the API."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        call_command("migrate_schemas", "--shared", interactive=False, verbosity=0)
        public = get_public_schema_name()
        with schema_context(public):
            if not Tenant.objects.filter(schema_name=public).exists():
                create_public_tenant(
                    domain_url="localhost",
                    owner_email="sys@test.com",
                    is_superuser=True,
                    is_staff=True,
                    password=PW,
                )
            cls.acme_owner = User.objects.create_user(email="acme@test.com", password=PW, first_name="Acme")
            cls.bella_owner = User.objects.create_user(email="bella@test.com", password=PW, first_name="Bella")
        cls.acme, _ = provision_tenant("Acme Cloth", "acme", cls.acme_owner, schema_name="acme")
        cls.bella, _ = provision_tenant("Bella Fabrics", "bella", cls.bella_owner, schema_name="bella")

    @classmethod
    def tearDownClass(cls):
        # The whole test database is dropped after the run, so we don't drop tenant
        # schemas by hand; we only ensure the connection is back on the public schema
        # so the class-transaction rollback runs cleanly.
        connection.set_schema_to_public()
        super().tearDownClass()

    def tearDown(self):
        # Requests switch the active schema by Host; reset it between tests.
        connection.set_schema_to_public()
        super().tearDown()

    def login(self, host, email, password=PW):
        client = APIClient()
        resp = client.post(
            "/api/auth/login/", {"email": email, "password": password},
            format="json", HTTP_HOST=host,
        )
        return resp, client

    # --- auth ---------------------------------------------------------------

    def test_email_login_returns_jwt_and_user(self):
        resp, _ = self.login("acme.localhost", "acme@test.com")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertEqual(resp.data["user"]["email"], "acme@test.com")
        self.assertTrue(resp.data["user"]["is_superuser"])  # owner is superuser in their shop

    def test_login_on_public_domain_has_no_shop_permissions(self):
        # The same account authenticates on the main domain, but in the public
        # tenant it has no staff/superuser rights and cannot manage users.
        resp, client = self.login("localhost", "acme@test.com")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["user"]["is_staff"])
        self.assertFalse(resp.data["user"]["is_superuser"])
        token = resp.data["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        forbidden = client.get("/api/users/", HTTP_HOST="localhost")
        self.assertEqual(forbidden.status_code, 403)

    # --- provisioning -------------------------------------------------------

    def test_signup_provisions_a_new_schema(self):
        client = APIClient()
        resp = client.post(
            "/api/auth/signup/",
            {"shop_name": "Carol Couture", "email": "carol@test.com", "password": PW},
            format="json", HTTP_HOST="localhost",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        slug = resp.data["slug"]
        self.assertTrue(Tenant.objects.filter(schema_name=slug).exists())
        # owner can immediately log in to the new shop
        login, _ = self.login(resp.data["domain"], "carol@test.com")
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.data["user"]["is_superuser"])

    # --- isolation & membership --------------------------------------------

    def test_groups_are_isolated_between_shops(self):
        with tenant_context(self.acme):
            Group.objects.create(name="Cashier")
        _, acme_client = self._auth("acme.localhost", "acme@test.com")
        _, bella_client = self._auth("bella.localhost", "bella@test.com")
        acme_groups = acme_client.get("/api/groups/", HTTP_HOST="acme.localhost").data["results"]
        bella_groups = bella_client.get("/api/groups/", HTTP_HOST="bella.localhost").data["results"]
        self.assertIn("Cashier", [g["name"] for g in acme_groups])
        self.assertNotIn("Cashier", [g["name"] for g in bella_groups])

    def test_one_account_can_belong_to_multiple_shops(self):
        # Add the acme owner to bella as a plain member.
        with tenant_context(self.bella):
            self.bella.add_user(self.acme_owner, is_staff=False)
        with tenant_context(self.acme):
            self.assertTrue(UserTenantPermissions.objects.filter(profile=self.acme_owner).exists())
        with tenant_context(self.bella):
            membership = UserTenantPermissions.objects.get(profile=self.acme_owner)
            self.assertFalse(membership.is_superuser)  # not an owner of bella

    # --- platform admin -----------------------------------------------------

    def test_platform_admin_sees_all_shops_others_forbidden(self):
        _, admin_client = self._auth("localhost", "sys@test.com")
        listing = admin_client.get("/api/admin/tenants/", HTTP_HOST="localhost")
        self.assertEqual(listing.status_code, 200)
        names = {t["name"] for t in listing.data}
        self.assertTrue({"Acme Cloth", "Bella Fabrics"}.issubset(names))

        _, owner_client = self._auth("localhost", "acme@test.com")
        forbidden = owner_client.get("/api/admin/tenants/", HTTP_HOST="localhost")
        self.assertEqual(forbidden.status_code, 403)

    def _auth(self, host, email):
        resp, client = self.login(host, email)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        return resp, client
