from django.core.management.base import BaseCommand
from django_tenants.utils import get_public_schema_name, tenant_context

from accounts.roles import ensure_default_roles
from tenants.models import Tenant


class Command(BaseCommand):
    help = "Create the default Cashier and Manager groups in every shop that lacks them."

    def handle(self, *args, **options):
        for tenant in Tenant.objects.exclude(schema_name=get_public_schema_name()):
            with tenant_context(tenant):
                ensure_default_roles()
            self.stdout.write(f"{tenant.schema_name}: ok")
