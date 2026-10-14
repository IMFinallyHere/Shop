from django.db.models import Max
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import ANY_STAFF, ShopPermission
from .models import Color, PaymentMethod, ShopSettings, Size, ensure_payment_methods, ensure_sizes
from .serializers import ColorSerializer, PaymentMethodSerializer, ShopSettingsSerializer, SizeSerializer


class ShopSettingsView(APIView):
    """Singleton per-shop settings (tax rate, label and receipt printing)."""

    permission_classes = [ShopPermission]
    # Every staff member reads these: the counter needs the tax rate and print settings.
    perms = {"GET": ANY_STAFF, "PUT": "shopsettings.change_shopsettings"}

    def get(self, request):
        return Response(ShopSettingsSerializer(ShopSettings.load()).data)

    def put(self, request):
        settings = ShopSettings.load()
        serializer = ShopSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    permission_classes = [ShopPermission]
    perm_model = "shopsettings.paymentmethod"
    perms = {"list": ANY_STAFF, "retrieve": ANY_STAFF}
    serializer_class = PaymentMethodSerializer

    def get_queryset(self):
        ensure_payment_methods()  # seed defaults on first access
        qs = PaymentMethod.objects.all()
        if self.request.query_params.get("active") in ("1", "true"):
            qs = qs.filter(is_active=True)
        return qs


class _VariantOptionViewSet(viewsets.ModelViewSet):
    """Shared CRUD for sizes/colors: `?active=1` filter, append new rows at the end,
    and refuse to delete one that product variants still use."""

    permission_classes = [ShopPermission]
    perms = {"list": ANY_STAFF, "retrieve": ANY_STAFF}
    pagination_class = None  # short lists, used whole in dropdowns
    model = None

    def get_queryset(self):
        qs = self.model.objects.all()
        if self.request.query_params.get("active") in ("1", "true"):
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        if "position" not in serializer.validated_data:
            last = self.model.objects.aggregate(m=Max("position"))["m"]
            serializer.validated_data["position"] = 0 if last is None else last + 1
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        used = obj.variants.count()
        if used:
            return Response(
                {"detail": f'"{obj.name}" is used by {used} product variant(s). Deactivate it instead.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class SizeViewSet(_VariantOptionViewSet):
    perm_model = "shopsettings.size"
    serializer_class = SizeSerializer
    model = Size

    def get_queryset(self):
        ensure_sizes()  # seed defaults on first access
        return super().get_queryset()


class ColorViewSet(_VariantOptionViewSet):
    perm_model = "shopsettings.color"
    serializer_class = ColorSerializer
    model = Color
