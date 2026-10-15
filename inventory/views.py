from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import (
    Count, DateTimeField, Exists, ExpressionWrapper, F, OuterRef, Prefetch, Q, Subquery,
)
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from accounts.permissions import ANY_STAFF, ShopPermission
from shopsettings.models import Color, Size
from .models import LOW_STOCK, Category, Product, ProductVariant, Seller, StockBatch, StockItem, generate_stock_code
from .serializers import (
    AddStockSerializer,
    CategorySerializer,
    ProductSerializer,
    ProductVariantSerializer,
    SellerSerializer,
    StockItemSerializer,
)
from .stock import recount

_LATEST_BATCH = StockBatch.objects.filter(variant=OuterRef("pk")).order_by("-created_at")


def variants_queryset():
    """Variants with the newest batch cost/price annotated (stock count is a column)."""
    return ProductVariant.objects.select_related("color", "size").annotate(
        last_cost_price=Subquery(_LATEST_BATCH.values("cost_price")[:1]),
        last_price=Subquery(_LATEST_BATCH.values("price")[:1]),
    )


def option_variant_ids(q):
    """Ids of variants whose color or size name contains ``q`` (tiny lookup tables)."""
    colors = list(Color.objects.filter(name__icontains=q).values_list("id", flat=True))
    sizes = list(Size.objects.filter(name__icontains=q).values_list("id", flat=True))
    if not colors and not sizes:
        return None
    return Q(color_id__in=colors) | Q(size_id__in=sizes)


class AllRowsMixin:
    """``?all=1`` returns every row unpaginated (for dropdowns of short lists)."""

    def paginate_queryset(self, queryset):
        if self.request.query_params.get("all") in ("1", "true"):
            return None
        return super().paginate_queryset(queryset)


STOCK_ITEM_RELATED = ("batch", "variant__product__category", "variant__color", "variant__size")


class CategoryViewSet(AllRowsMixin, viewsets.ModelViewSet):
    permission_classes = [ShopPermission]
    perm_model = "inventory.category"
    perms = {"list": ANY_STAFF, "retrieve": ANY_STAFF}  # names label products everywhere
    serializer_class = CategorySerializer
    filter_backends = [SearchFilter]
    search_fields = ["name"]

    def get_queryset(self):
        return Category.objects.annotate(product_count=Count("products")).order_by("name", "id")


class SellerViewSet(AllRowsMixin, viewsets.ModelViewSet):
    permission_classes = [ShopPermission]
    perm_model = "inventory.seller"
    perms = {"list": ANY_STAFF, "retrieve": ANY_STAFF}
    serializer_class = SellerSerializer
    filter_backends = [SearchFilter]
    search_fields = ["name", "phone", "email"]

    def get_queryset(self):
        return Seller.objects.annotate(product_count=Count("products")).order_by("name", "id")


class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [ShopPermission]
    perm_model = "inventory.product"
    perms = {"add_stock": "inventory.add_stockitem"}
    serializer_class = ProductSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ["name", "price_min", "stock_quantity", "created_at"]

    def get_queryset(self):
        params = self.request.query_params
        qs = (
            Product.objects.select_related("category", "seller")
            .prefetch_related(Prefetch("variants", queryset=variants_queryset()))
            .order_by("name", "id")
        )
        search = params.get("search", "").strip()
        if search:
            # Name/SKU/fabric hit trigram indexes; color/size go through the variants.
            match = Q(name__icontains=search) | Q(sku__icontains=search) | Q(fabric_type__icontains=search)
            options = option_variant_ids(search)
            if options is not None:
                match |= Q(id__in=ProductVariant.objects.filter(options).values("product_id"))
            qs = qs.filter(match)
        if params.get("low_stock") in ("1", "true"):
            qs = qs.filter(Exists(ProductVariant.objects.filter(LOW_STOCK, product=OuterRef("pk"))))
        if params.get("category"):
            qs = qs.filter(category_id=params["category"])
        if params.get("seller"):
            qs = qs.filter(seller_id=params["seller"])
        return qs

    @action(detail=True, methods=["post"], url_path="add-stock")
    def add_stock(self, request, pk=None):
        """Add units for one or more color/size lines, each line its own priced batch."""
        product = self.get_object()
        serializer = AddStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids, variant_ids = [], []
        with transaction.atomic():
            for line in serializer.validated_data["lines"]:
                variant, _ = ProductVariant.objects.get_or_create(
                    product=product, color=line["color"], size=line["size"]
                )
                batch = StockBatch.objects.create(
                    variant=variant, cost_price=line["cost_price"], price=line["price"],
                    quantity=line["quantity"],
                )
                ids += [u.id for u in create_units(variant, batch, line["quantity"])]
                variant_ids.append(variant.id)
            recount(variant_ids=variant_ids)
        items = StockItem.objects.select_related(*STOCK_ITEM_RELATED).filter(id__in=ids).order_by("id")
        return Response(
            {"count": len(items), "items": StockItemSerializer(items, many=True).data},
            status=status.HTTP_201_CREATED,
        )


def create_units(variant, batch, quantity):
    """Insert ``quantity`` units with fresh barcodes in one query (retrying a collision)."""
    for _ in range(5):
        codes = set()
        while len(codes) < quantity:
            codes.add(generate_stock_code())
        taken = set(StockItem.objects.filter(code__in=codes).values_list("code", flat=True))
        units = [StockItem(variant=variant, batch=batch, code=c) for c in codes - taken]
        units += [StockItem(variant=variant, batch=batch, code=generate_stock_code()) for _ in taken]
        try:
            with transaction.atomic():
                return StockItem.objects.bulk_create(units)
        except IntegrityError:  # a code was taken between the check and the insert
            continue
    raise IntegrityError("Could not generate unique stock codes.")


class ProductVariantViewSet(viewsets.ModelViewSet):
    """Edit a variant's color/size/threshold, or delete one with no sales history."""

    permission_classes = [ShopPermission]
    perm_model = "inventory.productvariant"
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
        with transaction.atomic():
            response = super().destroy(request, *args, **kwargs)
            recount(product_ids=[variant.product_id])
        return response


class StockItemViewSet(viewsets.ReadOnlyModelViewSet):
    """The Stock section: every physical unit, one row each."""

    permission_classes = [ShopPermission]
    perm_model = "inventory.stockitem"
    perms = {"lookup": "inventory.view_stockitem", "remove": "inventory.change_stockitem"}
    serializer_class = StockItemSerializer

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
        search = params.get("search", "").strip()
        if search:
            # Code via its trigram index; product/color/size resolved to variant ids first
            # so Postgres can OR two index scans instead of filtering every unit.
            variants = Q(product__name__icontains=search)
            options = option_variant_ids(search)
            if options is not None:
                variants |= options
            variant_ids = list(ProductVariant.objects.filter(variants).order_by().values_list("id", flat=True))
            qs = qs.filter(Q(code__icontains=search) | Q(variant_id__in=variant_ids)).order_by(
                # Sort the matches rather than walking the created_at index and filtering
                # every unit until 20 match (the planner's pick for a LIMIT, and very slow
                # when matches are rare). "+ 0" makes the expression unindexable.
                ExpressionWrapper(F("created_at") + timedelta(0), output_field=DateTimeField()).desc(), "-id"
            )
        return qs

    def list(self, request, *args, **kwargs):
        # Deferred join: page through bare ids (served by the covering status index),
        # then load the joined rows for just that page. OFFSET over the joined query
        # would build every skipped row first.
        ids = self.paginate_queryset(self.get_queryset().values_list("id", flat=True))
        rows = StockItem.objects.select_related(*STOCK_ITEM_RELATED).in_bulk(ids)
        data = self.get_serializer([rows[i] for i in ids], many=True).data
        return self.get_paginated_response(data)

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
        with transaction.atomic():
            item.status = StockItem.REMOVED
            item.save(update_fields=["status"])
            recount(variant_ids=[item.variant_id])
        return Response(StockItemSerializer(item).data)
