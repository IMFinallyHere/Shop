from django.conf import settings
from django.db import models

from inventory.models import StockItem


class Bill(models.Model):
    """A point-of-sale bill, scoped to one shop (its schema)."""

    NONE, FLAT, PERCENT = "none", "flat", "percent"
    DISCOUNT_CHOICES = [(NONE, "None"), (FLAT, "Flat"), (PERCENT, "Percent")]

    # Soft reference to the shared/public Customer (no cross-schema FK) + snapshot.
    customer_id = models.IntegerField(null=True, blank=True, db_index=True)
    customer_name = models.CharField(max_length=120, blank=True)
    customer_phone = models.CharField(max_length=20, blank=True)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_type = models.CharField(max_length=10, choices=DISCOUNT_CHOICES, default=NONE)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Stores the chosen payment method name (configured per shop in shopsettings).
    payment_mode = models.CharField(max_length=40, default="Cash")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["-created_at"])]

    @property
    def number(self):
        return f"INV-{self.id:05d}"

    def __str__(self):
        return self.number


class BillItem(models.Model):
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name="items")
    # PROTECT: a sold unit can't be deleted out from under a bill.
    stock_item = models.ForeignKey(StockItem, on_delete=models.PROTECT, related_name="bill_items")
    product_name = models.CharField(max_length=150)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.product_name} @ {self.unit_price}"
