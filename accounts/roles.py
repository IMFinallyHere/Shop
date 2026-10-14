"""Starter roles every shop gets, so staff have sensible access from day one.

The owner can change them on the Groups page; existing groups are never overwritten.
"""
from django.contrib.auth.models import Group, Permission

SHOP_APPS = ("inventory", "billing", "customers", "shopsettings")

CASHIER = [
    "billing.add_bill", "billing.view_bill",
    "billing.add_return", "billing.view_return", "billing.view_creditentry",
    "customers.view_customer",
    "inventory.view_product", "inventory.view_stockitem",
]


def _perms(names):
    q = Permission.objects.none()
    for name in names:
        app, codename = name.split(".")
        q = q | Permission.objects.filter(content_type__app_label=app, codename=codename)
    return q


def ensure_default_roles():
    """Create the Cashier and Manager groups in the current shop schema if missing."""
    roles = {
        "Cashier": _perms(CASHIER),
        # Everything in the shop except managing users, groups and permissions (owner only).
        "Manager": Permission.objects.filter(content_type__app_label__in=SHOP_APPS),
    }
    for name, perms in roles.items():
        group, created = Group.objects.get_or_create(name=name)
        if created:
            group.permissions.set(perms)
