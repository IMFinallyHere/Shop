from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import ProtectedError, TextField
from django.db.models.functions import Cast
from django.db.models import (
    Count, DateTimeField, Exists, ExpressionWrapper, F, OuterRef, Prefetch, Q, Subquery,
)
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from accounts.permissions import ANY_STAFF, ShopPermission, can_view_cost
from shopsettings.models import Color, ShopSettings, Size
from .models import LOW_STOCK, Category, Product, ProductVariant, Seller, StockBatch, StockItem, generate_stock_code
from .serializers import (
    AddStockSerializer,
    EditStockItemSerializer,
    UpdateBatchesSerializer,
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


class CostContextMixin:
    """Tells the serializers whether this user may see cost prices (see CostHiddenMixin)."""

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "can_view_cost": can_view_cost(self.request.user)}


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
    search_fields = ["name", "phones_text", "email"]  # phones_text: every number, not just the primary

    def get_queryset(self):
        return Seller.objects.annotate(
            product_count=Count("products"), phones_text=Cast("phones", TextField()),
        ).order_by("name", "id")


class ProductViewSet(CostContextMixin, viewsets.ModelViewSet):
    permission_classes = [ShopPermission]
    perm_model = "inventory.product"
    perms = {"add_stock": "inventory.add_stockitem", "batches": "inventory.view_stockitem",
             "update_batches": "inventory.change_stockitem", "incomplete": "inventory.view_product"}
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
        # ?id=N is exactly one product, active or not (links from search and stock pages).
        if params.get("id", "").isdigit():
            return qs.filter(pk=int(params["id"]))
        # The list shows active products; ?inactive=1 shows only the inactive ones and
        # ?inactive=all shows both. Detail routes (edit, add stock, delete) must still
        # reach inactive products.
        if self.action == "list" and params.get("inactive") != "all":
            qs = qs.filter(is_active=params.get("inactive") not in ("1", "true"))
        return qs

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        if StockItem.objects.filter(variant__product=product, status=StockItem.SOLD).exists():
            return Response(
                {"detail": "This product has sold units on bills and can't be deleted. Mark it inactive instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            with transaction.atomic():
                return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "This product is used on bills or returns and can't be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"], url_path="add-stock")
    def add_stock(self, request, pk=None):
        """Add units for one or more color/size lines, each line its own priced batch."""
        product = self.get_object()
        serializer = AddStockSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        see_cost = can_view_cost(request.user)
        ids, variant_ids = [], []
        with transaction.atomic():
            for line in serializer.validated_data["lines"]:
                variant, _ = ProductVariant.objects.get_or_create(
                    product=product, color=line["color"], size=line["size"]
                )
                batch = StockBatch.objects.create(
                    variant=variant, cost_price=line["cost_price"] if see_cost else None, price=line["price"],
                    quantity=line["quantity"],
                )
                ids += [u.id for u in create_units(variant, batch, line["quantity"])]
                variant_ids.append(variant.id)
            recount(variant_ids=variant_ids)
        items = StockItem.objects.select_related(*STOCK_ITEM_RELATED).filter(id__in=ids).order_by("id")
        return Response(
            {"count": len(items), "items": StockItemSerializer(items, many=True, context=self.get_serializer_context()).data},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="incomplete")
    def incomplete(self, request):
        """Active products missing something the shop now requires (Settings), with what is missing."""
        cfg = ShopSettings.load()
        need_cost = cfg.require_cost_price and can_view_cost(request.user)  # others can't fill it in
        costless = StockBatch.objects.filter(
            variant__product=OuterRef("pk"), cost_price__isnull=True, items__status=StockItem.IN_STOCK)
        gaps = {}  # name -> Q matching products with that gap
        if cfg.require_category:
            gaps["category"] = Q(category__isnull=True)
        if cfg.require_seller:
            gaps["seller"] = Q(seller__isnull=True)
        if cfg.require_sku:
            gaps["sku"] = Q(sku__regex=r"^\s*$")
        if not cfg.hide_product_name:
            gaps["name"] = Q(name__regex=r"^\s*$")
        qs = (Product.objects.filter(is_active=True).select_related("category", "seller")
              .prefetch_related(Prefetch("variants", queryset=variants_queryset())).order_by("name", "id"))
        if need_cost:
            qs = qs.annotate(cost_missing=Exists(costless))
            gaps["cost_price"] = Q(cost_missing=True)
        if not gaps:
            qs = qs.none()
        else:
            match = Q()
            for q in gaps.values():
                match |= q
            qs = qs.filter(match)
        page = self.paginate_queryset(qs)
        rows = []
        for p in page:
            missing = [k for k, q in gaps.items() if k != "cost_price" and _gap(p, k)]
            batches = []
            if need_cost and p.cost_missing:
                missing.append("cost_price")
                batches = [{
                    "id": str(b.id), "color": b.variant.color_id, "size": b.variant.size_id,
                    "color_name": b.variant.color.name if b.variant.color else None,
                    "size_name": b.variant.size.name if b.variant.size else None,
                    "quantity": b.in_stock, "price": str(b.price),
                } for b in StockBatch.objects.filter(variant__product=p, cost_price__isnull=True)
                    .annotate(in_stock=Count("items", filter=Q(items__status=StockItem.IN_STOCK)))
                    .filter(in_stock__gt=0).select_related("variant__color", "variant__size")]
            # Everything about the product (for reference on the page) plus what is missing.
            rows.append({**ProductSerializer(p, context=self.get_serializer_context()).data, "missing": missing, "batches_missing_cost": batches})
        return self.get_paginated_response(rows)

    @action(detail=True, methods=["get"], url_path="batches")
    def batches(self, request, pk=None):
        """The product's current stock as editable rows: one per batch that still has units in stock."""
        product = self.get_object()
        rows = (
            StockBatch.objects.filter(variant__product=product, items__status=StockItem.IN_STOCK)
            .annotate(in_stock=Count("items", filter=Q(items__status=StockItem.IN_STOCK)))
            .select_related("variant__color", "variant__size").order_by("created_at")
        )
        see_cost = can_view_cost(request.user)
        return Response([{
            "id": str(b.id), "color": b.variant.color_id, "size": b.variant.size_id,
            "color_name": b.variant.color.name if b.variant.color else None,
            "size_name": b.variant.size.name if b.variant.size else None,
            "quantity": b.in_stock, "price": str(b.price),
            **({"cost_price": None if b.cost_price is None else str(b.cost_price)} if see_cost else {}),
        } for b in rows])

    @action(detail=True, methods=["post"], url_path="update-batches")
    def update_batches(self, request, pk=None):
        """Apply edits to current stock rows: colour/size, cost, price and quantity (add or remove units)."""
        product = self.get_object()
        ser = UpdateBatchesSerializer(data=request.data, context=self.get_serializer_context())
        ser.is_valid(raise_exception=True)
        see_cost = can_view_cost(request.user)
        touched, added = set(), []
        with transaction.atomic():
            for row in ser.validated_data["batches"]:
                batch = StockBatch.objects.select_for_update().filter(pk=row["id"], variant__product=product).first()
                if batch is None:
                    raise serializers.ValidationError({"detail": "A stock row no longer exists. Reload and try again."})
                if not see_cost:
                    row["cost_price"] = batch.cost_price  # never changed by someone who can't see it
                else:
                    row.setdefault("cost_price", batch.cost_price)
                live = list(batch.items.filter(status=StockItem.IN_STOCK).order_by("created_at", "id"))
                variant, _ = ProductVariant.objects.get_or_create(product=product, color=row["color"], size=row["size"])
                changed = (variant.id != batch.variant_id or row["cost_price"] != batch.cost_price
                           or row["price"] != batch.price)
                touched |= {batch.variant_id, variant.id}
                if changed:
                    if batch.items.exclude(status=StockItem.IN_STOCK).exists():
                        # Sold/removed units keep the original price: split the live ones off.
                        batch = StockBatch.objects.create(
                            variant=variant, cost_price=row["cost_price"], price=row["price"], quantity=len(live))
                        StockItem.objects.filter(id__in=[u.id for u in live]).update(batch=batch, variant=variant)
                    else:
                        batch.variant, batch.cost_price, batch.price = variant, row["cost_price"], row["price"]
                        batch.save(update_fields=["variant", "cost_price", "price"])
                        batch.items.update(variant=variant)
                diff = row["quantity"] - len(live)
                if diff > 0:
                    added += create_units(variant, batch, diff)
                    batch.quantity += diff
                    batch.save(update_fields=["quantity"])
                elif diff < 0:
                    # Newest units go first.
                    StockItem.objects.filter(id__in=[u.id for u in live[diff:]]).update(status=StockItem.REMOVED)
            recount(variant_ids=touched)
        items = StockItem.objects.select_related(*STOCK_ITEM_RELATED).filter(id__in=[u.id for u in added]).order_by("id")
        return Response({"added": StockItemSerializer(items, many=True, context=self.get_serializer_context()).data})


def _gap(product, key):
    """Whether a product lacks the value for a required field."""
    if key == "category":
        return product.category_id is None
    if key == "seller":
        return product.seller_id is None
    return not (getattr(product, key) or "").strip()


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


class ProductVariantViewSet(CostContextMixin, viewsets.ModelViewSet):
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


class StockItemViewSet(CostContextMixin, viewsets.ReadOnlyModelViewSet):
    """The Stock section: every physical unit, one row each."""

    permission_classes = [ShopPermission]
    perm_model = "inventory.stockitem"
    perms = {"lookup": "inventory.view_stockitem", "remove": "inventory.change_stockitem",
             "edit": "inventory.change_stockitem"}
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
        return Response(StockItemSerializer(item, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="remove")
    def remove(self, request, pk=None):
        item = self.get_object()
        with transaction.atomic():
            item.status = StockItem.REMOVED
            item.save(update_fields=["status"])
            recount(variant_ids=[item.variant_id])
        return Response(StockItemSerializer(item, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="edit")
    def edit(self, request, pk=None):
        """Fix a unit's colour/size: just this unit, or every unit added in its batch."""
        item = self.get_object()
        ser = EditStockItemSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        old_variant_id = item.variant_id
        with transaction.atomic():
            target, _ = ProductVariant.objects.get_or_create(
                product_id=item.variant.product_id, color=data["color"], size=data["size"]
            )
            if target.id != old_variant_id:
                old = item.batch
                if data["apply_to"] == "batch":
                    old.variant = target
                    old.save(update_fields=["variant"])
                    old.items.update(variant=target)
                else:
                    # A batch belongs to one variant, so the unit moves into its own copy
                    # of the batch (same cost and price) under the new colour/size.
                    batch = StockBatch.objects.create(
                        variant=target, cost_price=old.cost_price, price=old.price, quantity=1)
                    StockBatch.objects.filter(pk=batch.pk).update(created_at=old.created_at)
                    item.variant, item.batch = target, batch
                    item.save(update_fields=["variant", "batch"])
                recount(variant_ids=[old_variant_id, target.id])
        item = StockItem.objects.select_related(*STOCK_ITEM_RELATED).get(pk=item.pk)
        return Response(StockItemSerializer(item, context=self.get_serializer_context()).data)
