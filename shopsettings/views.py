from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperuserOrStaff
from .models import PaymentMethod, ShopSettings, ensure_payment_methods
from .serializers import PaymentMethodSerializer, ShopSettingsSerializer


class ShopSettingsView(APIView):
    """Singleton per-shop settings (currently just the default tax rate)."""

    permission_classes = [IsSuperuserOrStaff]

    def get(self, request):
        return Response(ShopSettingsSerializer(ShopSettings.load()).data)

    def put(self, request):
        settings = ShopSettings.load()
        serializer = ShopSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperuserOrStaff]
    serializer_class = PaymentMethodSerializer

    def get_queryset(self):
        ensure_payment_methods()  # seed defaults on first access
        qs = PaymentMethod.objects.all()
        if self.request.query_params.get("active") in ("1", "true"):
            qs = qs.filter(is_active=True)
        return qs
