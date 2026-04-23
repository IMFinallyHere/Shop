from django.contrib.auth.models import Group, Permission
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .permissions import IsSuperuserOrStaff
from .serializers import (
    AssignGroupPermissionsSerializer,
    AssignGroupsSerializer,
    AssignUserPermissionsSerializer,
    ChangePasswordSerializer,
    GroupDetailSerializer,
    GroupSerializer,
    PermissionSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)


class LoginView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            username = request.data.get('username')
            try:
                user = User.objects.get(username=username)
                response.data['user'] = UserListSerializer(user).data
            except User.DoesNotExist:
                pass
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
        return Response(UserListSerializer(request.user).data)


class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperuserOrStaff]
    filter_backends = [SearchFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']

    def get_queryset(self):
        return User.objects.prefetch_related('groups', 'user_permissions').order_by('username')

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UserUpdateSerializer
        return UserListSerializer

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response({'detail': 'Cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='change-password')
    def change_password(self, request, pk=None):
        user = self.get_object()
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'old_password': 'Wrong password.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'detail': 'Password updated.'})

    @action(detail=True, methods=['post'], url_path='assign-groups')
    def assign_groups(self, request, pk=None):
        user = self.get_object()
        serializer = AssignGroupsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.groups.set(serializer.validated_data['group_ids'])
        return Response(UserListSerializer(user).data)

    @action(detail=True, methods=['post'], url_path='assign-permissions')
    def assign_permissions(self, request, pk=None):
        user = self.get_object()
        serializer = AssignUserPermissionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.user_permissions.set(serializer.validated_data['permission_ids'])
        return Response(UserListSerializer(user).data)


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
