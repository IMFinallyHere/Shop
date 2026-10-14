from rest_framework.permissions import BasePermission

# DRF viewset action / HTTP method → Django permission verb.
ACTION_VERBS = {
    "list": "view", "retrieve": "view", "create": "add",
    "update": "change", "partial_update": "change", "destroy": "delete",
}
METHOD_VERBS = {
    "GET": "view", "HEAD": "view", "OPTIONS": "view",
    "POST": "add", "PUT": "change", "PATCH": "change", "DELETE": "delete",
}
ANY_STAFF = None  # in `perms`: any staff member of the shop may do this


class ShopPermission(BasePermission):
    """The shop owner (superuser in this shop) can do anything. Other members need
    is_staff plus the Django model permission for the action, granted directly or
    through a group (Users / Groups pages). All checks are per shop.

    Views declare what each action needs:
      perm_model = "inventory.product"              → list = view_product, create = add_product, …
      perms = {"lookup": "inventory.view_stockitem",  # explicit, by action name or HTTP method
               "GET": ANY_STAFF}                      # any staff member
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True
        if not user.is_staff:
            return False
        perm = self.required_perm(request, view)
        return perm is ANY_STAFF or user.has_perm(perm)

    @staticmethod
    def required_perm(request, view):
        perms = getattr(view, "perms", {})
        action = getattr(view, "action", None)
        for key in (action, request.method):
            if key in perms:
                return perms[key]
        model = getattr(view, "perm_model", None)
        if model is None:
            # Refuse rather than allow when a view forgot to declare its permission.
            return "__undeclared__"
        app, name = model.split(".")
        verb = ACTION_VERBS.get(action) or METHOD_VERBS.get(request.method, "change")
        return f"{app}.{verb}_{name}"


class IsShopOwner(BasePermission):
    """Owner-only areas (users, groups, permissions): superuser in the current shop."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsPlatformAdmin(BasePermission):
    """Platform owner: a superuser evaluated in the public schema.

    These endpoints are served on the main domain (public schema), so
    ``request.user.is_superuser`` reflects the user's public-tenant permissions.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )
