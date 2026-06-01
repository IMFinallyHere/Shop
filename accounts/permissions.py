from rest_framework.permissions import BasePermission


class IsSuperuserOrStaff(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser or request.user.is_staff)
        )


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
