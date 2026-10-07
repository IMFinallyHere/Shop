from rest_framework import serializers

import re

from .models import Color, PaymentMethod, ShopSettings, Size


class ShopSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopSettings
        fields = ["default_tax_rate", "updated_at"]


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ["id", "name", "is_active", "position"]


class _NamedOptionSerializer(serializers.ModelSerializer):
    """Trims names and rejects case-insensitive duplicates ("xl" vs "XL")."""

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        dupes = self.Meta.model.objects.filter(name__iexact=value)
        if self.instance:
            dupes = dupes.exclude(pk=self.instance.pk)
        if dupes.exists():
            raise serializers.ValidationError(f'"{value}" already exists.')
        return value


class SizeSerializer(_NamedOptionSerializer):
    class Meta:
        model = Size
        fields = ["id", "name", "is_active", "position"]


class ColorSerializer(_NamedOptionSerializer):
    class Meta:
        model = Color
        fields = ["id", "name", "hex", "is_active", "position"]

    def validate_hex(self, value):
        if value and not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise serializers.ValidationError("Use a hex color like #1a2b3c.")
        return value.lower()
