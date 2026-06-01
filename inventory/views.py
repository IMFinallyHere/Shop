import uuid

from django.db import transaction
from django.db.models import Count, F, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from accounts.permissions import IsSuperuserOrStaff
from .models import Category, Product, Seller, StockItem
from .serializers import (
    AddStockSerializer,
    CategorySerializer,
    ProductSerializer,
    SellerSerializer,
    StockItemSerializer,
)

IN_STOCK_COUNT = Count("stock_items", filter=Q(stock_items__status=StockItem.IN_STOCK))


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
        qs = Product.objects.select_related("category", "seller").annotate(
            stock_quantity=IN_STOCK_COUNT
        )
        if self.request.query_params.get("low_stock") in ("1", "true"):
            qs = qs.filter(stock_quantity__lte=F("low_stock_threshold"))
        if self.request.query_params.get("category"):
            qs = qs.filter(category_id=self.request.query_params["category"])
        return qs

    @action(detail=True, methods=["post"], url_path="add-stock")
    def add_stock(self, request, pk=None):
        product = self.get_object()
        serializer = AddStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quantity = serializer.validated_data["quantity"]
        batch = uuid.uuid4()
        with transaction.atomic():
            items = [StockItem(product=product, batch=batch) for _ in range(quantity)]
            for item in items:
                item.save()  # save() generates a unique code per item
        return Response(
            {
                "batch": str(batch),
                "count": len(items),
                "items": StockItemSerializer(items, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class StockItemViewSet(viewsets.ReadOnlyModelViewSet):
    """The Stock section: every physical unit, one row each."""

    permission_classes = [IsSuperuserOrStaff]
    serializer_class = StockItemSerializer
    filter_backends = [SearchFilter]
    search_fields = ["code", "product__name"]

    def get_queryset(self):
        qs = StockItem.objects.select_related("product", "product__category")
        params = self.request.query_params
        status_param = params.get("status", StockItem.IN_STOCK)
        if status_param and status_param != "all":
            qs = qs.filter(status=status_param)
        if params.get("product"):
            qs = qs.filter(product_id=params["product"])
        if params.get("batch"):
            qs = qs.filter(batch=params["batch"])
        return qs

    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request):
        """Resolve a scanned barcode to an in-stock unit (for POS)."""
        code = request.query_params.get("code", "").strip()
        if not code:
            return Response({"detail": "code required."}, status=status.HTTP_400_BAD_REQUEST)
        item = (
            StockItem.objects.select_related("product", "product__category")
            .filter(code=code, status=StockItem.IN_STOCK)
            .first()
        )
        if not item:
            return Response({"detail": "No in-stock unit with that code."}, status=status.HTTP_404_NOT_FOUND)
        return Response(StockItemSerializer(item).data)

    @action(detail=True, methods=["post"], url_path="remove")
    def remove(self, request, pk=None):
        item = self.get_object()
        item.status = StockItem.REMOVED
        item.save(update_fields=["status"])
        return Response(StockItemSerializer(item).data)
