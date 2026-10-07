from decimal import Decimal

from rest_framework import serializers

from .models import Bill, BillItem, Return, ReturnItem, refund_shares


class BillItemSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="stock_item.code", read_only=True)
    returned = serializers.SerializerMethodField()
    refund_amount = serializers.SerializerMethodField()

    class Meta:
        model = BillItem
        fields = ["id", "stock_item", "code", "product_name", "unit_price", "returned", "refund_amount"]

    def get_returned(self, obj):
        return hasattr(obj, "return_item")

    def get_refund_amount(self, obj):
        # The line's share of the bill total (what a return of it pays back).
        if hasattr(obj, "return_item"):
            return str(obj.return_item.refund_amount)
        shares = self.context.setdefault("_shares", {})
        if obj.bill_id not in shares:
            shares[obj.bill_id] = refund_shares(obj.bill)
        return str(shares[obj.bill_id].get(obj.id, "0.00"))


class BillReturnSummarySerializer(serializers.ModelSerializer):
    number = serializers.CharField(read_only=True)

    class Meta:
        model = Return
        fields = ["id", "number", "mode", "payment_mode", "amount", "created_at"]


class BillSerializer(serializers.ModelSerializer):
    number = serializers.SerializerMethodField()
    items = BillItemSerializer(many=True, read_only=True)
    returns = BillReturnSummarySerializer(many=True, read_only=True)
    refunded_total = serializers.SerializerMethodField()
    shop_name = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = [
            "id", "number", "customer_id", "customer_name", "customer_phone",
            "subtotal", "discount_type", "discount_value", "discount_amount",
            "tax_rate", "tax_amount", "total", "credit_used", "payment_mode",
            "items", "returns", "refunded_total", "shop_name", "created_at",
        ]

    def get_refunded_total(self, obj):
        return str(sum((r.amount for r in obj.returns.all()), Decimal("0.00")))

    def get_number(self, obj):
        return obj.number

    def get_shop_name(self, obj):
        request = self.context.get("request")
        tenant = getattr(request, "tenant", None)
        return getattr(tenant, "name", "") if tenant else ""


class CheckoutCustomerSerializer(serializers.Serializer):
    # Mandatory on every bill, so any sale can later be returned as store credit.
    name = serializers.CharField(max_length=120, error_messages={"blank": "Customer name is required."})
    # Digits only: it's the key for the shared customer table, so "98765 43210" and
    # "9876543210" must not become two customers.
    phone = serializers.RegexField(
        r"^\d{10}$",
        error_messages={"invalid": "Phone number must be exactly 10 digits.",
                        "blank": "Customer phone is required."},
    )


class CheckoutSerializer(serializers.Serializer):
    codes = serializers.ListField(child=serializers.CharField(), allow_empty=False)
    customer = CheckoutCustomerSerializer()
    discount_type = serializers.ChoiceField(
        choices=[c[0] for c in Bill.DISCOUNT_CHOICES], default=Bill.NONE
    )
    discount_value = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Tax is NOT taken from the client — the shop's default rate is applied server-side.
    payment_mode = serializers.CharField()
    # Store credit to apply (capped by the customer's balance and the bill total).
    credit_used = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, default=0)


class ReturnItemSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="bill_item.stock_item.code", read_only=True)
    product_name = serializers.CharField(source="bill_item.product_name", read_only=True)
    unit_price = serializers.DecimalField(source="bill_item.unit_price", max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = ReturnItem
        fields = ["id", "bill_item", "code", "product_name", "unit_price", "refund_amount"]


class ReturnSerializer(serializers.ModelSerializer):
    number = serializers.CharField(read_only=True)
    bill_number = serializers.CharField(source="bill.number", read_only=True)
    items = ReturnItemSerializer(many=True, read_only=True)
    shop_name = serializers.SerializerMethodField()

    class Meta:
        model = Return
        fields = [
            "id", "number", "bill", "bill_number", "mode", "payment_mode", "amount", "reason",
            "customer_id", "customer_name", "customer_phone", "items", "shop_name", "created_at",
        ]

    def get_shop_name(self, obj):
        request = self.context.get("request")
        tenant = getattr(request, "tenant", None)
        return getattr(tenant, "name", "") if tenant else ""


class CreateReturnSerializer(serializers.Serializer):
    bill = serializers.IntegerField()
    items = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    mode = serializers.ChoiceField(choices=[c[0] for c in Return.MODE_CHOICES])
    payment_mode = serializers.CharField(required=False, allow_blank=True, default="")
    reason = serializers.CharField(required=False, allow_blank=True, default="", max_length=255)
