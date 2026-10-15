from django.db.models import Max
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from tenant_users.permissions.models import UserTenantPermissions

from accounts.permissions import ANY_STAFF, ShopPermission
from .models import Color, PaymentMethod, ShopSettings, Size, UserOnboarding, ensure_payment_methods, ensure_sizes
from .serializers import ColorSerializer, OnboardingUpdateSerializer, PaymentMethodSerializer, ShopSettingsSerializer, SizeSerializer


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


def _setup_checklist():
    """The owner's first-run steps, each done when the shop's data says so."""
    from billing.models import Bill  # tenant apps; imported lazily like elsewhere
    from inventory.models import Product

    settings = ShopSettings.load()
    shop_details = settings.default_tax_rate > 0 or any(
        getattr(settings, f) for f in ("receipt_address", "receipt_phone", "receipt_gstin")
    )
    return [
        {"key": "shop_details", "done": bool(shop_details)},
        {"key": "first_product", "done": Product.objects.exists()},
        # Anyone in the shop printing tags counts, not just the owner.
        {"key": "first_label", "done": UserOnboarding.objects.filter(events__contains=["label_printed"]).exists()},
        {"key": "first_bill", "done": Bill.objects.exists()},
        {"key": "first_staff", "done": UserTenantPermissions.objects.count() > 1},
    ]


class OnboardingView(APIView):
    """First-run tour, setup checklist and language for the signed-in member."""

    permission_classes = [ShopPermission]
    perms = {"GET": ANY_STAFF, "PATCH": ANY_STAFF}

    def _state(self, request):
        obj, _ = UserOnboarding.objects.get_or_create(user_id=request.user.pk)
        return obj

    def _payload(self, request, obj):
        data = {
            "language": obj.language,
            "tour_done": obj.tour_done_at is not None,
            "checklist_dismissed": obj.checklist_dismissed_at is not None,
            "checklist": None,
        }
        # Setting the shop up is the owner's job; staff only get the tour.
        if request.user.is_superuser:
            data["checklist"] = _setup_checklist()
        return data

    def get(self, request):
        return Response(self._payload(request, self._state(request)))

    def patch(self, request):
        serializer = OnboardingUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        now = timezone.now()
        # Two quick PATCHes (pick Hindi, then close the tour) must not undo each other:
        # lock the row and save only the fields this request changes.
        with transaction.atomic():
            self._state(request)
            obj = UserOnboarding.objects.select_for_update().get(user_id=request.user.pk)
            changed = []
            if "language" in d:
                obj.language = d["language"]
                changed.append("language")
            if "tour_done" in d:
                obj.tour_done_at = now if d["tour_done"] else None
                changed.append("tour_done_at")
            if "checklist_dismissed" in d:
                obj.checklist_dismissed_at = now if d["checklist_dismissed"] else None
                changed.append("checklist_dismissed_at")
            if d.get("add_event") and d["add_event"] not in obj.events:
                obj.events = [*obj.events, d["add_event"]]
                changed.append("events")
            if changed:
                obj.save(update_fields=changed)
        return Response(self._payload(request, obj))
