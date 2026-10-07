from django.db import models

DEFAULT_PAYMENT_METHODS = ["Cash", "UPI", "Card"]
DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"]


class ShopSettings(models.Model):
    """Per-shop configuration (one row per schema)."""

    default_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"ShopSettings(tax={self.default_tax_rate})"


class PaymentMethod(models.Model):
    """A payment method the shop accepts (configurable per shop)."""

    name = models.CharField(max_length=40, unique=True)
    is_active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "name"]

    def __str__(self):
        return self.name


def ensure_payment_methods():
    """Seed the default methods the first time a shop touches its payment list."""
    if not PaymentMethod.objects.exists():
        PaymentMethod.objects.bulk_create(
            [PaymentMethod(name=n, position=i) for i, n in enumerate(DEFAULT_PAYMENT_METHODS)]
        )


class Size(models.Model):
    """A size the shop stocks (e.g. M, XL); product variants reference these."""

    name = models.CharField(max_length=30, unique=True)
    is_active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0, help_text="Display order (S before M)")

    class Meta:
        ordering = ["position", "name"]

    def __str__(self):
        return self.name


class Color(models.Model):
    """A color the shop stocks; product variants reference these."""

    name = models.CharField(max_length=50, unique=True)
    hex = models.CharField(max_length=7, blank=True, help_text="Optional swatch, e.g. #000000")
    is_active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "name"]

    def __str__(self):
        return self.name


def ensure_sizes():
    """Seed common clothing sizes the first time a shop touches its size list."""
    if not Size.objects.exists():
        Size.objects.bulk_create([Size(name=n, position=i) for i, n in enumerate(DEFAULT_SIZES)])
