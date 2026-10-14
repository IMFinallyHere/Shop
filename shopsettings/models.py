from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

DEFAULT_PAYMENT_METHODS = ["Cash", "UPI", "Card"]
DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"]


class ShopSettings(models.Model):
    """Per-shop configuration (one row per schema)."""

    RECEIPT_WIDTHS = [(58, "58 mm"), (80, "80 mm"), (210, "A4")]

    default_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Stock-unit labels: one label per page at this physical size (thermal roll).
    label_width_mm = models.PositiveSmallIntegerField(default=50, validators=[MinValueValidator(20), MaxValueValidator(110)])
    label_height_mm = models.PositiveSmallIntegerField(default=25, validators=[MinValueValidator(10), MaxValueValidator(150)])
    label_show_name = models.BooleanField(default=True)
    label_show_variant = models.BooleanField(default=True)
    label_show_price = models.BooleanField(default=True)
    label_show_code_text = models.BooleanField(default=True)
    label_copies = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(10)])

    # Receipts.
    receipt_width_mm = models.PositiveSmallIntegerField(choices=RECEIPT_WIDTHS, default=80)
    receipt_shop_name = models.CharField(max_length=100, blank=True, help_text="Blank uses the shop's name")
    receipt_address = models.CharField(max_length=255, blank=True)
    receipt_phone = models.CharField(max_length=30, blank=True)
    receipt_gstin = models.CharField(max_length=20, blank=True)
    receipt_footer = models.CharField(max_length=200, blank=True, default="Thank you, visit again!")
    auto_print_after_bill = models.BooleanField(default=False, help_text="Open the print dialog right after checkout")

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


class UserOnboarding(models.Model):
    """First-run state for one member of this shop: tour, checklist and language.

    `user_id` points at the global account in the public schema (no FK across schemas).
    """

    LANGUAGES = [("en", "English"), ("hi", "Hindi")]

    user_id = models.PositiveIntegerField(unique=True)
    language = models.CharField(max_length=2, choices=LANGUAGES, default="en")
    tour_done_at = models.DateTimeField(null=True, blank=True)
    checklist_dismissed_at = models.DateTimeField(null=True, blank=True)
    # Things the checklist can't see in the data, e.g. "label_printed".
    events = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"UserOnboarding(user={self.user_id}, lang={self.language})"
