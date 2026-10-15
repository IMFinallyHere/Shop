from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.models import Group, Permission
from django.db import transaction
from django.utils.text import slugify
from django_tenants.utils import get_public_schema_name, schema_context, tenant_context
from rest_framework import serializers
from tenant_users.permissions.models import UserTenantPermissions

from .models import User
from .roles import ensure_default_roles
from tenants.models import Domain, Tenant


class PermissionSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source='content_type.app_label', read_only=True)
    model = serializers.CharField(source='content_type.model', read_only=True)

    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename', 'app_label', 'model']


class GroupSerializer(serializers.ModelSerializer):
    permissions = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Permission.objects.all(), required=False
    )

    class Meta:
        model = Group
        fields = ['id', 'name', 'permissions']


class GroupDetailSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = ['id', 'name', 'permissions']


class TenantUserSerializer(serializers.ModelSerializer):
    """A shop member: a per-tenant ``UserTenantPermissions`` row joined to the
    global ``User`` profile. ``id`` is the membership id (used for actions)."""

    email = serializers.EmailField(source='profile.email', read_only=True)
    first_name = serializers.CharField(source='profile.first_name', read_only=True)
    last_name = serializers.CharField(source='profile.last_name', read_only=True)
    is_active = serializers.BooleanField(source='profile.is_active', read_only=True)
    is_verified = serializers.BooleanField(source='profile.is_verified', read_only=True)
    groups = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    user_permissions = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    group_names = serializers.SerializerMethodField()

    class Meta:
        model = UserTenantPermissions
        fields = [
            'id', 'email', 'first_name', 'last_name', 'is_active', 'is_verified',
            'is_staff', 'is_superuser', 'groups', 'group_names', 'user_permissions',
        ]

    def get_group_names(self, obj):
        return list(obj.groups.values_list('name', flat=True))


class TenantUserCreateSerializer(serializers.Serializer):
    """Adds a user to the current shop, creating the global account if needed.

    A password is always required so the response doesn't reveal whether the email
    already has an account; an existing account keeps its own password.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    first_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name = serializers.CharField(required=False, allow_blank=True, default='')
    is_staff = serializers.BooleanField(default=False)

    def validate(self, attrs):
        tenant = self.context['tenant']
        public = get_public_schema_name()
        with schema_context(public):
            profile = User.objects.filter(email=attrs['email']).first()
        if profile and UserTenantPermissions.objects.filter(profile=profile).exists():
            raise serializers.ValidationError(
                {'email': 'This user is already a member of this shop.'}
            )
        attrs['_profile'] = profile
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        tenant = self.context['tenant']
        profile = validated_data['_profile']
        public = get_public_schema_name()
        with schema_context(public):
            if profile is None:
                profile = User.objects.create_user(
                    email=validated_data['email'],
                    password=validated_data['password'],
                    first_name=validated_data.get('first_name', ''),
                    last_name=validated_data.get('last_name', ''),
                )
        tenant.add_user(profile, is_staff=validated_data.get('is_staff', False))
        return UserTenantPermissions.objects.get(profile=profile)


class TenantUserUpdateSerializer(serializers.Serializer):
    """Updates per-shop staff status and the global profile's name fields."""

    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    is_staff = serializers.BooleanField(required=False)

    @transaction.atomic
    def update(self, instance, validated_data):
        if 'is_staff' in validated_data:
            instance.is_staff = validated_data['is_staff']
            instance.save(update_fields=['is_staff'])
        profile = instance.profile
        name_fields = [f for f in ('first_name', 'last_name') if f in validated_data]
        if name_fields:
            public = get_public_schema_name()
            with schema_context(public):
                for f in name_fields:
                    setattr(profile, f, validated_data[f])
                profile.save(update_fields=name_fields)
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])


class AssignGroupsSerializer(serializers.Serializer):
    group_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Group.objects.all()
    )


class AssignUserPermissionsSerializer(serializers.Serializer):
    permission_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Permission.objects.all()
    )


class AssignGroupPermissionsSerializer(serializers.Serializer):
    permission_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Permission.objects.all()
    )


class MeSerializer(serializers.Serializer):
    """The authenticated user plus their permissions in the current shop."""

    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    is_staff = serializers.BooleanField()
    is_superuser = serializers.BooleanField()
    group_names = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    def get_group_names(self, obj):
        if not obj.has_tenant_permissions():
            return []
        return list(obj.tenant_perms.groups.values_list('name', flat=True))

    def get_permissions(self, obj):
        """'app.codename' strings this user holds in the current shop (owners hold all)."""
        if not obj.has_tenant_permissions():
            return []
        return sorted(obj.get_all_permissions())


# Shop names become <name>.<main domain>; these addresses are kept for the site itself.
RESERVED_SLUGS = {
    'www', 'admin', 'api', 'app', 'apps', 'mail', 'email', 'webmail', 'smtp', 'imap', 'pop', 'ftp',
    'ns', 'ns1', 'ns2', 'dns', 'static', 'assets', 'cdn', 'media', 'files', 'help', 'support', 'docs',
    'blog', 'status', 'login', 'signup', 'register', 'account', 'accounts', 'billing', 'dashboard',
    'shop', 'shops', 'store', 'threadflo', 'test', 'demo', 'dev', 'staging', 'public', 'root',
    'auth', 'acme-challenge', 'autodiscover', 'autoconfig',
}


class SignupSerializer(serializers.Serializer):
    """Self-serve signup: creates the owner account and provisions a new shop schema."""

    shop_name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    first_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_shop_name(self, value):
        slug = slugify(value)
        if not slug:
            raise serializers.ValidationError('Shop name must contain letters or numbers.')
        if slug in RESERVED_SLUGS:
            raise serializers.ValidationError('That name is reserved. Try adding your area or a word, e.g. "Asha Boutique Jaipur".')
        if Tenant.objects.filter(schema_name=slug).exists():
            raise serializers.ValidationError('A shop with a similar name already exists.')
        self._slug = slug
        return value

    def validate_email(self, value):
        with schema_context(get_public_schema_name()):
            profile = User.objects.filter(email=value).first()
            if profile and Tenant.objects.filter(owner=profile).exists():
                raise serializers.ValidationError('This email already owns a shop.')
        return value

    def validate(self, attrs):
        # An existing account (e.g. staff elsewhere) may open a shop only with its own
        # password; otherwise anyone could attach a shop to someone else's account.
        with schema_context(get_public_schema_name()):
            profile = User.objects.filter(email=attrs['email']).first()
        if profile and not profile.check_password(attrs['password']):
            raise serializers.ValidationError(
                {'password': 'This email already has an account. Enter its password.'}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        slug = self._slug
        public = get_public_schema_name()
        with schema_context(public):
            owner = User.objects.filter(email=validated_data['email']).first()
            if owner is None:
                owner = User.objects.create_user(
                    email=validated_data['email'],
                    password=validated_data['password'],
                    first_name=validated_data.get('first_name', ''),
                    last_name=validated_data.get('last_name', ''),
                )
            tenant = Tenant(schema_name=slug, name=validated_data['shop_name'],
                            slug=slug, owner=owner)
            tenant.save()
            domain = f'{slug}.{settings.TENANT_USERS_DOMAIN}'
            Domain.objects.create(domain=domain, tenant=tenant, is_primary=True)
            tenant.add_user(owner, is_superuser=True, is_staff=True)
        with tenant_context(tenant):
            ensure_default_roles()
        return {'shop': validated_data['shop_name'], 'slug': slug,
                'domain': domain, 'email': validated_data['email']}
