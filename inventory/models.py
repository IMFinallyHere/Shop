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

    def __str__(self):
        return self.name


class Product(models.Model):
    """A cloth product. Physical units live in :class:`StockItem`."""

    name = models.CharField(max_length=150)
    sku = models.CharField(max_length=64, blank=True, help_text="Optional manufacturer code")
    category = models.ForeignKey(
        Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="products"
    )
    seller = models.ForeignKey(
        Seller, null=True, blank=True, on_delete=models.SET_NULL, related_name="products"
    )
    fabric_type = models.CharField(max_length=80, blank=True)
    color = models.CharField(max_length=50, blank=True)
    size = models.CharField(max_length=30, blank=True)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


def generate_stock_code():
    """A short, unique barcode value (encoded by both the Code128 and QR labels)."""
    return uuid.uuid4().hex[:12].upper()


class StockItem(models.Model):
    """A single physical unit of a product, with its own barcode."""

    IN_STOCK = "in_stock"
    SOLD = "sold"
    REMOVED = "removed"
    STATUS_CHOICES = [(IN_STOCK, "In stock"), (SOLD, "Sold"), (REMOVED, "Removed")]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_items")
    code = models.CharField(max_length=32, unique=True, editable=False)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=IN_STOCK)
    batch = models.UUIDField(db_index=True, help_text="Groups units added together")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

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
