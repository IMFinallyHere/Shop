import re

from rest_framework import serializers

from shopsettings.models import Color, ShopSettings, Size

from .models import Category, Product, ProductVariant, Seller, StockItem


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, default=0)  # viewset annotation

    class Meta:
        model = Category
        fields = ["id", "name", "description", "product_count", "created_at"]


MAX_SELLER_PHONES = 6
# Digits with an optional leading +, and spaces, dashes or brackets between them; 7-15 digits.
PHONE_CHARS = re.compile(r"^\+?[\d\s\-()]+$")


def is_valid_phone(number):
    return bool(PHONE_CHARS.match(number)) and 7 <= sum(ch.isdigit() for ch in number) <= 15


class SellerSerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, default=0)  # viewset annotation
    # Every number, primary first. `phone` is kept as phones[0] for lists and search.
    phones = serializers.ListField(child=serializers.CharField(max_length=20, allow_blank=True), required=False,
                                   max_length=MAX_SELLER_PHONES)

    class Meta:
        model = Seller
        fields = ["id", "name", "phone", "phones", "email", "address", "notes", "product_count", "created_at"]

    def validate_phones(self, numbers):
        out = []
        for n in (x.strip() for x in numbers):
            if not n:
                continue
            if not is_valid_phone(n):
                raise serializers.ValidationError(f'"{n}" is not a valid phone number. Use digits, and optionally +, spaces or dashes.')
            if n not in out:  # drop repeats
                out.append(n)
        return out

    def validate(self, attrs):
        # Keep `phone` = first of `phones`. Clients that still send only `phone` set the whole list.
        if "phones" not in attrs and "phone" in attrs:
            try:
                attrs["phones"] = self.validate_phones([attrs["phone"]])
            except serializers.ValidationError as e:
                raise serializers.ValidationError({"phone": e.detail}) from e
        if "phones" in attrs:
            attrs["phone"] = attrs["phones"][0] if attrs["phones"] else ""
        return attrs

    def to_representation(self, obj):
        data = super().to_representation(obj)
        if not data["phones"] and obj.phone:  # rows created before the list existed
            data["phones"] = [obj.phone]
        return data


class CostHiddenMixin:
    """Drops cost fields unless the view says this user may see them (context ``can_view_cost``).
    With no context the cost stays hidden, so a forgotten call site fails safe."""

    COST_FIELDS = ()

    def to_representation(self, obj):
        data = super().to_representation(obj)
        if not self.context.get("can_view_cost"):
            for key in self.COST_FIELDS:
                data.pop(key, None)
        return data


class ProductVariantSerializer(CostHiddenMixin, serializers.ModelSerializer):
    COST_FIELDS = ("last_cost_price",)
    # color/size are ids of the shop's Settings lists; names/swatch for display.
    color_name = serializers.CharField(source="color.name", read_only=True, default=None)
    color_hex = serializers.CharField(source="color.hex", read_only=True, default=None)
    size_name = serializers.CharField(source="size.name", read_only=True, default=None)
    is_low_stock = serializers.SerializerMethodField()
    # Cost/price of the newest batch (viewset annotations), to prefill the next restock.
    last_cost_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, default=None)
    last_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, default=None)

    class Meta:
        model = ProductVariant
        fields = [
            "id", "product", "color", "color_name", "color_hex", "size", "size_name", "low_stock_threshold",
            "stock_quantity", "is_low_stock", "last_cost_price", "last_price",
        ]
        read_only_fields = ["product", "stock_quantity"]

    def get_is_low_stock(self, obj):
        return obj.stock_quantity <= obj.low_stock_threshold

    def validate(self, attrs):
        inst = self.instance
        color = attrs.get("color", inst.color if inst else None)
        size = attrs.get("size", inst.size if inst else None)
        if inst and ProductVariant.objects.filter(
            product=inst.product, color=color, size=size
        ).exclude(pk=inst.pk).exists():
            raise serializers.ValidationError("This product already has that color and size.")
        return attrs


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    seller_name = serializers.CharField(source="seller.name", read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    is_low_stock = serializers.SerializerMethodField()
    name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "sku", "category", "category_name", "seller", "seller_name",
            "fabric_type", "variants", "stock_quantity", "is_low_stock",
            "price_min", "price_max", "is_active", "is_one_time", "created_at", "updated_at",
        ]
        # Denormalized in-stock figures (inventory.stock.recount).
        read_only_fields = ["stock_quantity", "price_min", "price_max"]

    def get_is_low_stock(self, obj):
        return any(v.stock_quantity <= v.low_stock_threshold for v in obj.variants.all())

    def validate(self, attrs):
        s = ShopSettings.load()
        inst = self.instance
        get = lambda k: attrs[k] if k in attrs else getattr(inst, k, None)  # noqa: E731
        errors = {}
        # On edit, only check fields being changed so old products can still be e.g. deactivated.
        touched = lambda k: inst is None or k in attrs  # noqa: E731
        if s.require_category and touched("category") and not get("category"):
            errors["category"] = "Category is required."
        if s.require_seller and touched("seller") and not get("seller"):
            errors["seller"] = "Seller is required."
        if s.require_sku and touched("sku") and not (get("sku") or "").strip():
            errors["sku"] = "SKU is required."
        if not s.hide_product_name and touched("name") and not (get("name") or "").strip():
            errors["name"] = "Name is required."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        product = super().create(validated_data)
        if not product.name.strip():
            base = " ".join(p for p in (product.fabric_type.strip(), product.category.name if product.category else "") if p)
            product.name = f"{base or 'Product'} #{product.pk}"
            product.save(update_fields=["name"])
        return product


class StockItemSerializer(CostHiddenMixin, serializers.ModelSerializer):
    COST_FIELDS = ("cost_price",)
    product = serializers.IntegerField(source="variant.product_id", read_only=True)
    product_name = serializers.CharField(source="variant.product.name", read_only=True)
    category_name = serializers.CharField(source="variant.product.category.name", read_only=True)
    color_name = serializers.CharField(source="variant.color.name", read_only=True, default=None)
    size_name = serializers.CharField(source="variant.size.name", read_only=True, default=None)
    color = serializers.IntegerField(source="variant.color_id", read_only=True)
    size = serializers.IntegerField(source="variant.size_id", read_only=True)
    price = serializers.DecimalField(source="batch.price", max_digits=10, decimal_places=2, read_only=True)
    cost_price = serializers.DecimalField(source="batch.cost_price", max_digits=10, decimal_places=2, read_only=True, allow_null=True)

    class Meta:
        model = StockItem
        fields = [
            "id", "code", "product", "product_name", "category_name", "variant", "color", "color_name", "size", "size_name",
            "price", "cost_price", "status", "batch", "created_at",
        ]


class AddStockLineSerializer(serializers.Serializer):
    # Ids from the shop's Settings lists; either may be omitted (e.g. a free-size item).
    color = serializers.PrimaryKeyRelatedField(queryset=Color.objects.all(), allow_null=True, required=False, default=None)
    size = serializers.PrimaryKeyRelatedField(queryset=Size.objects.all(), allow_null=True, required=False, default=None)
    quantity = serializers.IntegerField(min_value=1, max_value=1000)
    # Optional: what the shop paid, if it wants to track margins.
    cost_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False, allow_null=True, default=None)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)


class EditStockItemSerializer(serializers.Serializer):
    """Change a unit's colour/size. ``apply_to`` is this one unit or its whole batch."""

    color = serializers.PrimaryKeyRelatedField(queryset=Color.objects.all(), allow_null=True)
    size = serializers.PrimaryKeyRelatedField(queryset=Size.objects.all(), allow_null=True)
    apply_to = serializers.ChoiceField(choices=["unit", "batch"], default="unit")


class StockBatchEditSerializer(serializers.Serializer):
    """One current stock row (the in-stock units of a batch) edited in the product form."""

    id = serializers.UUIDField()
    color = serializers.PrimaryKeyRelatedField(queryset=Color.objects.all(), allow_null=True)
    size = serializers.PrimaryKeyRelatedField(queryset=Size.objects.all(), allow_null=True)
    quantity = serializers.IntegerField(min_value=0, max_value=1000)
    # Absent for users who can't see costs: the batch keeps the cost it has.
    cost_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, allow_null=True, required=False)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)


class UpdateBatchesSerializer(serializers.Serializer):
    batches = StockBatchEditSerializer(many=True, allow_empty=False, max_length=200)

    def validate_batches(self, rows):
        if ShopSettings.load().require_cost_price and self.context.get("can_view_cost"):
            # Rows being emptied (quantity 0) need no cost.
            errors = [{} if r.get("cost_price") is not None or r["quantity"] == 0 else {"cost_price": ["Cost price is required."]} for r in rows]
            if any(errors):
                raise serializers.ValidationError(errors)
        return rows


class AddStockSerializer(serializers.Serializer):
    lines = AddStockLineSerializer(many=True, allow_empty=False, max_length=50)

    def validate_lines(self, lines):
        if ShopSettings.load().require_cost_price and self.context.get("can_view_cost"):
            errors = [{} if line.get("cost_price") is not None else {"cost_price": ["Cost price is required."]}
                      for line in lines]
            if any(errors):
                raise serializers.ValidationError(errors)
        return lines
