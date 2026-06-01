from django.db import models
from tenant_users.tenants.models import UserProfile


class User(UserProfile):
    """Global user identity, stored once in the public schema.

    Authentication (email + password) is global; authorization is per-tenant
    via ``tenant_users.permissions.UserTenantPermissions``. ``email``,
    ``is_active``, ``is_verified``, the ``tenants`` M2M, ``USERNAME_FIELD`` and
    the ``UserProfileManager`` are all inherited from ``UserProfile``.
    """

    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)

    REQUIRED_FIELDS = []

    def get_full_name(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or self.email

    def get_short_name(self):
        return self.first_name or self.email
