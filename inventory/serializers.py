from rest_framework import serializers

from .models import Category, Product, Seller, StockItem


def _in_stock_count(product):
    """Use the viewset's annotation when present, else count directly."""
    value = getattr(product, "stock_quantity", None)
    if value is None:
        return product.stock_items.filter(status=StockItem.IN_STOCK).count()
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


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    seller_name = serializers.CharField(source="seller.name", read_only=True)
    # Count of in-stock units (from the viewset annotation, or counted on the fly).
    stock_quantity = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "sku", "category", "category_name", "seller", "seller_name",
            "fabric_type", "color", "size", "cost_price", "price",
            "stock_quantity", "low_stock_threshold", "is_low_stock", "is_active",
            "created_at", "updated_at",
        ]

    def get_stock_quantity(self, obj):
        return _in_stock_count(obj)

    def get_is_low_stock(self, obj):
        return _in_stock_count(obj) <= obj.low_stock_threshold


class StockItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    category_name = serializers.CharField(source="product.category.name", read_only=True)
    price = serializers.DecimalField(source="product.price", max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = StockItem
        fields = [
            "id", "code", "product", "product_name", "category_name", "price",
            "status", "batch", "created_at",
        ]


class AddStockSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=1000)
