from django.contrib.auth.models import Group, Permission
from django.shortcuts import get_object_or_404
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from tenant_users.permissions.models import UserTenantPermissions

from .models import User
from .permissions import IsPlatformAdmin, IsSuperuserOrStaff
from tenants.models import Tenant
from .serializers import (
    AssignGroupPermissionsSerializer,
    AssignGroupsSerializer,
    AssignUserPermissionsSerializer,
    ChangePasswordSerializer,
    GroupDetailSerializer,
    GroupSerializer,
    MeSerializer,
    PermissionSerializer,
    SignupSerializer,
    TenantUserCreateSerializer,
    TenantUserSerializer,
    TenantUserUpdateSerializer,
)


class LoginView(TokenObtainPairView):
    """Email + password login (USERNAME_FIELD is email). Adds the user payload."""

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            email = request.data.get('email')
            user = User.objects.filter(email=email).first()
            if user:
                response.data['user'] = MeSerializer(user).data
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Refresh token required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response({'detail': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = MeSerializer(request.user).data
        tenant = getattr(request, 'tenant', None)
        # Name of the shop being viewed (null on the main domain).
        data['shop_name'] = tenant.name if tenant and tenant.schema_name != get_public_schema_name() else None
        return Response(data)


def _shop_payload(tenant):
    domain = tenant.domains.filter(is_primary=True).first() or tenant.domains.first()
    return {
        'name': tenant.name,
        'slug': tenant.slug or tenant.schema_name,
        'domain': domain.domain if domain else None,
    }


class MyShopsView(APIView):
    """Shops the authenticated user belongs to (for the post-login shop picker)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        public = get_public_schema_name()
        tenants = (
            request.user.tenants.exclude(schema_name=public)
            .prefetch_related('domains')
            .order_by('name')
        )
        return Response([_shop_payload(t) for t in tenants])


class AdminTenantsView(APIView):
    """Platform admin: list every shop with basic stats."""

    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        public = get_public_schema_name()
        data = []
        for tenant in (
            Tenant.objects.exclude(schema_name=public)
            .select_related('owner')
            .prefetch_related('domains')
            .order_by('name')
        ):
            with schema_context(tenant.schema_name):
                member_count = UserTenantPermissions.objects.count()
            payload = _shop_payload(tenant)
            payload.update({
                'id': tenant.id,
                'owner_email': tenant.owner.email,
                'member_count': member_count,
                'created': tenant.created,
            })
            data.append(payload)
        return Response(data)


class AdminTenantUsersView(APIView):
    """Platform admin: view the members of a specific shop."""

    permission_classes = [IsPlatformAdmin]

    def get(self, request, slug):
        tenant = get_object_or_404(Tenant, schema_name=slug)
        with schema_context(tenant.schema_name):
            qs = (
                UserTenantPermissions.objects
                .select_related('profile')
                .prefetch_related('groups')
                .order_by('profile__email')
            )
            users = TenantUserSerializer(qs, many=True).data
        return Response({'tenant': tenant.name, 'slug': tenant.schema_name, 'users': users})


class SignupView(APIView):
    """Public, unauthenticated. Creates the owner account + provisions a new shop."""

    permission_classes = [AllowAny]

    def post(self, request):
        base_domain = request.get_host().split(':')[0]
        serializer = SignupSerializer(
            data=request.data, context={'base_domain': base_domain}
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_201_CREATED)


class UserViewSet(viewsets.ModelViewSet):
    """Members of the current shop (per-tenant UserTenantPermissions rows)."""

    permission_classes = [IsSuperuserOrStaff]
    filter_backends = [SearchFilter]
    search_fields = ['profile__email', 'profile__first_name', 'profile__last_name']

    def get_queryset(self):
        return (
            UserTenantPermissions.objects
            .select_related('profile')
            .prefetch_related('groups', 'user_permissions')
            .order_by('profile__email')
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return TenantUserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return TenantUserUpdateSerializer
        return TenantUserSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['tenant'] = self.request.tenant
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        return Response(TenantUserSerializer(membership).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        return Response(TenantUserSerializer(membership).data)

    def destroy(self, request, *args, **kwargs):
        membership = self.get_object()
        if membership.profile == request.user:
            return Response({'detail': 'Cannot remove your own membership.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if request.tenant.owner_id == membership.profile_id:
            return Response({'detail': 'Cannot remove the shop owner.'},
                            status=status.HTTP_400_BAD_REQUEST)
        request.tenant.remove_user(membership.profile)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='change-password')
    def change_password(self, request, pk=None):
        membership = self.get_object()
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = membership.profile
        with schema_context(get_public_schema_name()):
            profile.refresh_from_db()
            if not profile.check_password(serializer.validated_data['old_password']):
                return Response({'old_password': 'Wrong password.'},
                                status=status.HTTP_400_BAD_REQUEST)
            profile.set_password(serializer.validated_data['new_password'])
            profile.save(update_fields=['password'])
        return Response({'detail': 'Password updated.'})

    @action(detail=True, methods=['post'], url_path='assign-groups')
    def assign_groups(self, request, pk=None):
        membership = self.get_object()
        serializer = AssignGroupsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership.groups.set(serializer.validated_data['group_ids'])
        return Response(TenantUserSerializer(membership).data)

    @action(detail=True, methods=['post'], url_path='assign-permissions')
    def assign_permissions(self, request, pk=None):
        membership = self.get_object()
        serializer = AssignUserPermissionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership.user_permissions.set(serializer.validated_data['permission_ids'])
        return Response(TenantUserSerializer(membership).data)


class GroupViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperuserOrStaff]

    def get_queryset(self):
        return Group.objects.prefetch_related('permissions').order_by('name')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return GroupDetailSerializer
        return GroupSerializer

    @action(detail=True, methods=['post'], url_path='assign-permissions')
    def assign_permissions(self, request, pk=None):
        group = self.get_object()
        serializer = AssignGroupPermissionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group.permissions.set(serializer.validated_data['permission_ids'])
        return Response(GroupDetailSerializer(group).data)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PermissionSerializer
    pagination_class = None

    def get_queryset(self):
        return Permission.objects.select_related('content_type').order_by(
            'content_type__app_label', 'content_type__model', 'codename'
        )
