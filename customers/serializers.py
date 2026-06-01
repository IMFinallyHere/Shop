from rest_framework import serializers

from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    bill_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "email", "bill_count", "created_at"]
