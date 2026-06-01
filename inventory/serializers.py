from rest_framework import serializers

from .models import Category, Product, Seller, StockMovement


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
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "sku", "category", "category_name", "seller", "seller_name",
            "fabric_type", "color", "size", "cost_price", "price",
            "stock_quantity", "low_stock_threshold", "is_low_stock", "is_active",
            "created_at", "updated_at",
        ]
        # Stock is changed only via the adjust-stock action, never edited directly.
        read_only_fields = ["stock_quantity"]


class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = ["id", "kind", "quantity", "resulting_stock", "reason", "created_at"]


class StockAdjustSerializer(serializers.Serializer):
    quantity = serializers.IntegerField()
    reason = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_quantity(self, value):
        if value == 0:
            raise serializers.ValidationError("Quantity cannot be zero.")
        return value
