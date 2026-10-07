from rest_framework import serializers

from shopsettings.models import Color, Size

from .models import Category, Product, ProductVariant, Seller, StockItem


def _in_stock_count(obj):
    """Use the viewset's annotation when present, else count directly."""
    value = getattr(obj, "stock_quantity", None)
    if value is None:
        return obj.stock_items.filter(status=StockItem.IN_STOCK).count()
    return value


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source="products.count", read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "description", "product_count", "created_at"]


class SellerSerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source="products.count", read_only=True)

    class Meta:
        model = Seller
        fields = ["id", "name", "phone", "email", "address", "notes", "product_count", "created_at"]


class ProductVariantSerializer(serializers.ModelSerializer):
    # color/size are ids of the shop's Settings lists; names/swatch for display.
    color_name = serializers.CharField(source="color.name", read_only=True, default=None)
    color_hex = serializers.CharField(source="color.hex", read_only=True, default=None)
    size_name = serializers.CharField(source="size.name", read_only=True, default=None)
    stock_quantity = serializers.SerializerMethodField()
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
        read_only_fields = ["product"]

    def get_stock_quantity(self, obj):
        return _in_stock_count(obj)

    def get_is_low_stock(self, obj):
        return _in_stock_count(obj) <= obj.low_stock_threshold

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
    # Total in-stock units across variants (from the viewset annotation, or counted).
    stock_quantity = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()
    price_min = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, default=None)
    price_max = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, default=None)

    class Meta:
        model = Product
        fields = [
            "id", "name", "sku", "category", "category_name", "seller", "seller_name",
            "fabric_type", "variants", "stock_quantity", "is_low_stock",
            "price_min", "price_max", "is_active", "created_at", "updated_at",
        ]

    def get_stock_quantity(self, obj):
        value = getattr(obj, "stock_quantity", None)
        if value is None:
            return StockItem.objects.filter(variant__product=obj, status=StockItem.IN_STOCK).count()
        return value

    def get_is_low_stock(self, obj):
        return any(_in_stock_count(v) <= v.low_stock_threshold for v in obj.variants.all())


class StockItemSerializer(serializers.ModelSerializer):
    product = serializers.IntegerField(source="variant.product_id", read_only=True)
    product_name = serializers.CharField(source="variant.product.name", read_only=True)
    category_name = serializers.CharField(source="variant.product.category.name", read_only=True)
    color_name = serializers.CharField(source="variant.color.name", read_only=True, default=None)
    size_name = serializers.CharField(source="variant.size.name", read_only=True, default=None)
    price = serializers.DecimalField(source="batch.price", max_digits=10, decimal_places=2, read_only=True)
    cost_price = serializers.DecimalField(source="batch.cost_price", max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = StockItem
        fields = [
            "id", "code", "product", "product_name", "category_name", "variant", "color_name", "size_name",
            "price", "cost_price", "status", "batch", "created_at",
        ]


class AddStockLineSerializer(serializers.Serializer):
    # Ids from the shop's Settings lists; either may be omitted (e.g. a free-size item).
    color = serializers.PrimaryKeyRelatedField(queryset=Color.objects.all(), allow_null=True, required=False, default=None)
    size = serializers.PrimaryKeyRelatedField(queryset=Size.objects.all(), allow_null=True, required=False, default=None)
    quantity = serializers.IntegerField(min_value=1, max_value=1000)
    cost_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)


class AddStockSerializer(serializers.Serializer):
    lines = AddStockLineSerializer(many=True, allow_empty=False, max_length=50)
