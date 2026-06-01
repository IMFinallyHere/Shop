from django.db import models
from django_tenants.models import DomainMixin
from tenant_users.tenants.models import TenantBase


class Tenant(TenantBase):
    """A shop. Each tenant lives in its own PostgreSQL schema.

    Inherits ``schema_name`` from django-tenants' TenantMixin and
    ``slug`` / ``owner`` / ``created`` / ``modified`` plus the
    ``add_user`` / ``remove_user`` helpers from ``TenantBase``.
    """

    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Domain(DomainMixin):
    """Maps a hostname (e.g. ``acme.localhost``) to a :class:`Tenant`."""
