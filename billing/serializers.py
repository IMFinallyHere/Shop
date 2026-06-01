from rest_framework import serializers

from .models import Bill, BillItem


class BillItemSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="stock_item.code", read_only=True)

    class Meta:
        model = BillItem
        fields = ["id", "stock_item", "code", "product_name", "unit_price"]


class BillSerializer(serializers.ModelSerializer):
    number = serializers.SerializerMethodField()
    items = BillItemSerializer(many=True, read_only=True)
    shop_name = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = [
            "id", "number", "customer_id", "customer_name", "customer_phone",
            "subtotal", "discount_type", "discount_value", "discount_amount",
            "tax_rate", "tax_amount", "total", "payment_mode",
            "items", "shop_name", "created_at",
        ]

    def get_number(self, obj):
        return obj.number

    def get_shop_name(self, obj):
        request = self.context.get("request")
        tenant = getattr(request, "tenant", None)
        return getattr(tenant, "name", "") if tenant else ""


class CheckoutCustomerSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(required=False, allow_blank=True, default="")


class CheckoutSerializer(serializers.Serializer):
    codes = serializers.ListField(child=serializers.CharField(), allow_empty=False)
    customer = CheckoutCustomerSerializer(required=False)
    discount_type = serializers.ChoiceField(
        choices=[c[0] for c in Bill.DISCOUNT_CHOICES], default=Bill.NONE
    )
    discount_value = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Tax is NOT taken from the client — the shop's default rate is applied server-side.
    payment_mode = serializers.CharField()
