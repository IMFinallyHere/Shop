import uuid

from django.db import models


class Category(models.Model):
    """A product category, scoped to one shop (its schema)."""

    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Seller(models.Model):
    """A supplier the shop buys stock from (selectable when adding products)."""

    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"])]

    def __str__(self):
        return self.name


class Product(models.Model):
    """A cloth product (e.g. "Kurti A"). Color/size live on :class:`ProductVariant`."""

    name = models.CharField(max_length=150)
    sku = models.CharField(max_length=64, blank=True, help_text="Optional manufacturer code")
    category = models.ForeignKey(
        Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="products"
    )
    seller = models.ForeignKey(
        Seller, null=True, blank=True, on_delete=models.SET_NULL, related_name="products"
    )
    fabric_type = models.CharField(max_length=80, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"])]

    def __str__(self):
        return self.name


class ProductVariant(models.Model):
    """A color + size of a product; stock is counted per variant.

    Color and size reference the shop's lists in Settings, so renaming one there
    updates every variant (bills keep the name snapshotted at sale time).
    """

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    # PROTECT: a color/size in use can only be deactivated, not deleted.
    color = models.ForeignKey(
        "shopsettings.Color", null=True, blank=True, on_delete=models.PROTECT, related_name="variants"
    )
    size = models.ForeignKey(
        "shopsettings.Size", null=True, blank=True, on_delete=models.PROTECT, related_name="variants"
    )
    low_stock_threshold = models.PositiveIntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["color__position", "color__name", "size__position", "size__name"]
        constraints = [
            # nulls_distinct=False: only one "no color" + "M" variant per product.
            models.UniqueConstraint(
                fields=["product", "color", "size"], name="uniq_variant_per_product", nulls_distinct=False
            ),
        ]

    @property
    def label(self):
        return " / ".join(v.name for v in (self.color, self.size) if v)

    def __str__(self):
        return f"{self.product.name} — {self.label}" if self.label else self.product.name


class StockBatch(models.Model):
    """Units of one variant added together, with their own cost and selling price."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="batches")
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.variant} × {self.quantity} @ {self.price}"


def generate_stock_code():
    """A short, unique barcode value (encoded by the Code128 label)."""
    return uuid.uuid4().hex[:12].upper()


class StockItem(models.Model):
    """A single physical unit of a variant, with its own barcode; priced by its batch."""

    IN_STOCK = "in_stock"
    SOLD = "sold"
    REMOVED = "removed"
    STATUS_CHOICES = [(IN_STOCK, "In stock"), (SOLD, "Sold"), (REMOVED, "Removed")]

    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="stock_items")
    batch = models.ForeignKey(StockBatch, on_delete=models.CASCADE, related_name="items")
    code = models.CharField(max_length=32, unique=True, editable=False)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=IN_STOCK)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # Serves the IN_STOCK_COUNT annotation and product/status filtering;
            # the leftmost-prefix also covers variant-only lookups.
            models.Index(fields=["variant", "status"]),
            models.Index(fields=["-created_at"]),
        ]

    def save(self, *args, **kwargs):
        if not self.code:
            # Retry on the rare unique collision.
            for _ in range(5):
                candidate = generate_stock_code()
                if not StockItem.objects.filter(code=candidate).exists():
                    self.code = candidate
                    break
            else:
                self.code = generate_stock_code()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.code
