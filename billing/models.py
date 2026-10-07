from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import models
from django.db.models import Sum

from inventory.models import StockItem


def money(value):
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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
    # Store credit applied at checkout; the customer paid ``total - credit_used``.
    credit_used = models.DecimalField(max_digits=10, decimal_places=2, default=0)

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


def refund_shares(bill):
    """Each line's share of ``bill.total`` → ``{bill_item_id: Decimal}``.

    Shares are proportional to the unit price, so the bill's discount and tax are
    refunded pro rata; the rounding remainder goes to the last line so the shares
    always add up to exactly the bill total.
    """
    items = sorted(bill.items.all(), key=lambda i: i.id)
    if not items or not bill.subtotal:
        return {i.id: Decimal("0.00") for i in items}
    shares, allocated = {}, Decimal("0.00")
    for item in items[:-1]:
        shares[item.id] = money(item.unit_price * bill.total / bill.subtotal)
        allocated += shares[item.id]
    shares[items[-1].id] = money(bill.total) - allocated
    return shares


class Return(models.Model):
    """Units taken back from a bill, settled as a refund or as store credit."""

    REFUND, CREDIT = "refund", "credit"
    MODE_CHOICES = [(REFUND, "Refund"), (CREDIT, "Store credit")]

    bill = models.ForeignKey(Bill, on_delete=models.PROTECT, related_name="returns")
    mode = models.CharField(max_length=10, choices=MODE_CHOICES)
    # Payment method the refund was paid out through (blank for store credit).
    payment_mode = models.CharField(max_length=40, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    reason = models.CharField(max_length=255, blank=True)

    # Snapshot of the bill's customer (soft reference to the shared Customer).
    customer_id = models.IntegerField(null=True, blank=True, db_index=True)
    customer_name = models.CharField(max_length=120, blank=True)
    customer_phone = models.CharField(max_length=20, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["-created_at"])]

    @property
    def number(self):
        return f"RET-{self.id:05d}"

    def __str__(self):
        return self.number


class ReturnItem(models.Model):
    ret = models.ForeignKey(Return, on_delete=models.CASCADE, related_name="items")
    # One-to-one: a sold line can be returned only once. A restocked unit sold again
    # gets a new BillItem, so it can be returned again from that bill.
    bill_item = models.OneToOneField(BillItem, on_delete=models.PROTECT, related_name="return_item")
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.bill_item} → {self.refund_amount}"


class CreditEntry(models.Model):
    """Store-credit ledger for this shop: + when a return is credited, − when spent."""

    customer_id = models.IntegerField(db_index=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    ret = models.ForeignKey(Return, null=True, blank=True, on_delete=models.PROTECT, related_name="credit_entries")
    bill = models.ForeignKey(Bill, null=True, blank=True, on_delete=models.PROTECT, related_name="credit_entries")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "credit entries"

    def __str__(self):
        return f"customer {self.customer_id}: {self.amount}"


def credit_balance(customer_id):
    if not customer_id:
        return Decimal("0.00")
    total = CreditEntry.objects.filter(customer_id=customer_id).aggregate(s=Sum("amount"))["s"]
    return total or Decimal("0.00")
