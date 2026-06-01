from django.db import transaction
from django.db.models import F
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from accounts.permissions import IsSuperuserOrStaff
from .models import Category, Product, Seller, StockMovement
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    SellerSerializer,
    StockAdjustSerializer,
    StockMovementSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperuserOrStaff]
    serializer_class = CategorySerializer
    filter_backends = [SearchFilter]
    search_fields = ["name"]

    def get_queryset(self):
        return Category.objects.all()


class SellerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperuserOrStaff]
    serializer_class = SellerSerializer
    filter_backends = [SearchFilter]
    search_fields = ["name", "phone", "email"]

    def get_queryset(self):
        return Seller.objects.all()


class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperuserOrStaff]
    serializer_class = ProductSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "sku", "fabric_type", "color"]
    ordering_fields = ["name", "price", "stock_quantity", "created_at"]

    def get_queryset(self):
        qs = Product.objects.select_related("category", "seller")
        if self.request.query_params.get("low_stock") in ("1", "true"):
            qs = qs.filter(stock_quantity__lte=F("low_stock_threshold"))
        if self.request.query_params.get("category"):
            qs = qs.filter(category_id=self.request.query_params["category"])
        return qs

    @action(detail=True, methods=["post"], url_path="adjust-stock")
    def adjust_stock(self, request, pk=None):
        product = self.get_object()
        serializer = StockAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        delta = serializer.validated_data["quantity"]
        with transaction.atomic():
            product = Product.objects.select_for_update().get(pk=product.pk)
            new_stock = product.stock_quantity + delta
            if new_stock < 0:
                return Response(
                    {"quantity": "Not enough stock for this reduction."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            product.stock_quantity = new_stock
            product.save(update_fields=["stock_quantity", "updated_at"])
            StockMovement.objects.create(
                product=product,
                kind=StockMovement.IN if delta > 0 else StockMovement.OUT,
                quantity=delta,
                resulting_stock=new_stock,
                reason=serializer.validated_data.get("reason", ""),
            )
        return Response(ProductSerializer(product).data)

    @action(detail=True, methods=["get"], url_path="movements")
    def movements(self, request, pk=None):
        product = self.get_object()
        movements = product.movements.all()[:100]
        return Response(StockMovementSerializer(movements, many=True).data)
