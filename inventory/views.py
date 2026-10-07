from django.db import transaction
from django.db.models import Count, Exists, F, Max, Min, OuterRef, Prefetch, Q, Subquery
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from accounts.permissions import IsSuperuserOrStaff
from .models import Category, Product, ProductVariant, Seller, StockBatch, StockItem
from .serializers import (
    AddStockSerializer,
    CategorySerializer,
    ProductSerializer,
    ProductVariantSerializer,
    SellerSerializer,
    StockItemSerializer,
)

IN_STOCK = Q(stock_items__status=StockItem.IN_STOCK)
_LATEST_BATCH = StockBatch.objects.filter(variant=OuterRef("pk")).order_by("-created_at")


def variants_queryset():
    """Variants with in-stock count and newest batch cost/price annotated."""
    return ProductVariant.objects.select_related("color", "size").annotate(
        stock_quantity=Count("stock_items", filter=IN_STOCK),
        last_cost_price=Subquery(_LATEST_BATCH.values("cost_price")[:1]),
        last_price=Subquery(_LATEST_BATCH.values("price")[:1]),
    )


STOCK_ITEM_RELATED = ("batch", "variant__product__category", "variant__color", "variant__size")


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
    search_fields = ["name", "sku", "fabric_type", "variants__color__name", "variants__size__name"]
    ordering_fields = ["name", "price_min", "stock_quantity", "created_at"]

    def get_queryset(self):
        unit = "variants__stock_items__"
        in_stock = Q(**{f"{unit}status": StockItem.IN_STOCK})
        qs = (
            Product.objects.select_related("category", "seller")
            .prefetch_related(Prefetch("variants", queryset=variants_queryset()))
            .annotate(
                stock_quantity=Count(f"{unit}id", filter=in_stock),
                price_min=Min(f"{unit}batch__price", filter=in_stock),
                price_max=Max(f"{unit}batch__price", filter=in_stock),
            )
            # Explicit: GROUP BY querysets don't count Meta.ordering as ordered (pagination).
            .order_by("name", "id")
        )
        if self.request.query_params.get("low_stock") in ("1", "true"):
            low = ProductVariant.objects.filter(product=OuterRef("pk")).annotate(
                n=Count("stock_items", filter=IN_STOCK)
            ).filter(n__lte=F("low_stock_threshold"))
            qs = qs.filter(Exists(low))
        if self.request.query_params.get("category"):
            qs = qs.filter(category_id=self.request.query_params["category"])
        if self.request.query_params.get("seller"):
            qs = qs.filter(seller_id=self.request.query_params["seller"])
        return qs

    @action(detail=True, methods=["post"], url_path="add-stock")
    def add_stock(self, request, pk=None):
        """Add units for one or more color/size lines, each line its own priced batch."""
        product = self.get_object()
        serializer = AddStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = []
        with transaction.atomic():
            for line in serializer.validated_data["lines"]:
                variant, _ = ProductVariant.objects.get_or_create(
                    product=product, color=line["color"], size=line["size"]
                )
                batch = StockBatch.objects.create(
                    variant=variant, cost_price=line["cost_price"], price=line["price"],
                    quantity=line["quantity"],
                )
                for _ in range(line["quantity"]):
                    item = StockItem(variant=variant, batch=batch)
                    item.save()  # save() generates a unique code per item
                    items.append(item)
        items = StockItem.objects.select_related(*STOCK_ITEM_RELATED).filter(
            id__in=[i.id for i in items]
        ).order_by("id")
        return Response(
            {"count": len(items), "items": StockItemSerializer(items, many=True).data},
            status=status.HTTP_201_CREATED,
        )


class ProductVariantViewSet(viewsets.ModelViewSet):
    """Edit a variant's color/size/threshold, or delete one with no sales history."""

    permission_classes = [IsSuperuserOrStaff]
    serializer_class = ProductVariantSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = variants_queryset()
        if self.request.query_params.get("product"):
            qs = qs.filter(product_id=self.request.query_params["product"])
        return qs

    def destroy(self, request, *args, **kwargs):
        variant = self.get_object()
        if variant.stock_items.filter(status=StockItem.SOLD).exists():
            return Response(
                {"detail": "This variant has sold units on bills and can't be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class StockItemViewSet(viewsets.ReadOnlyModelViewSet):
    """The Stock section: every physical unit, one row each."""

    permission_classes = [IsSuperuserOrStaff]
    serializer_class = StockItemSerializer
    filter_backends = [SearchFilter]
    search_fields = ["code", "variant__product__name", "variant__color__name", "variant__size__name"]

    def get_queryset(self):
        qs = StockItem.objects.select_related(*STOCK_ITEM_RELATED)
        params = self.request.query_params
        status_param = params.get("status", StockItem.IN_STOCK)
        if status_param and status_param != "all":
            qs = qs.filter(status=status_param)
        if params.get("product"):
            qs = qs.filter(variant__product_id=params["product"])
        if params.get("variant"):
            qs = qs.filter(variant_id=params["variant"])
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
            StockItem.objects.select_related(*STOCK_ITEM_RELATED)
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
