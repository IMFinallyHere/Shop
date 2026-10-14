"""Dev only: rebuild the throwaway `walkthrough` shop the how-to videos are recorded in.

Every recording starts from the same catalogue, bills and customers:
    python manage.py reset_video_shop
"""
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import get_public_schema_name, schema_context, tenant_context
from tenant_users.tenants.tasks import provision_tenant

from accounts.models import User
from accounts.roles import ensure_default_roles
from tenants.models import Tenant

SCHEMA = "walkthrough"
OWNER = ("video@demo.test", "VideoDemo#2026", "Kavya", "Rao")


class Command(BaseCommand):
    help = "Drop and re-create the local 'walkthrough' demo shop used to record how-to videos."

    def handle(self, *args, **opts):
        if not settings.DEBUG:
            raise CommandError("Refusing to run with DEBUG off: this deletes a shop.")
        old = Tenant.objects.filter(schema_name=SCHEMA).first()
        if old:
            old.delete(force_drop=True)
            self.stdout.write(f"Dropped '{SCHEMA}'.")
        email, password, first, last = OWNER
        with schema_context(get_public_schema_name()):
            owner = User.objects.filter(email=email).first()
            if owner is None:
                owner = User.objects.create_user(email=email, password=password, first_name=first, last_name=last)
            else:
                owner.set_password(password)
                owner.save(update_fields=["password"])
        tenant, _ = provision_tenant("Kavya Fashions", SCHEMA, owner, schema_name=SCHEMA)
        with tenant_context(tenant):
            ensure_default_roles()
        call_command("seed_demo", SCHEMA, stdout=self.stdout)
        self.stdout.write(self.style.SUCCESS(f"Ready: {tenant.domains.first().domain} ({email} / {password})"))
