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
    """A cloth product in a shop's inventory."""

    name = models.CharField(max_length=150)
    sku = models.CharField(max_length=64, blank=True, help_text="Barcode / QR value")
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
    stock_quantity = models.IntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            # SKUs are unique within a shop, but blank SKUs are allowed.
            models.UniqueConstraint(
                fields=["sku"], condition=~models.Q(sku=""), name="unique_sku_per_shop"
            )
        ]

    def __str__(self):
        return self.name

    @property
    def is_low_stock(self):
        return self.stock_quantity <= self.low_stock_threshold


class StockMovement(models.Model):
    """An audit record of a change to a product's stock level."""

    IN = "in"
    OUT = "out"
    ADJUST = "adjust"
    KIND_CHOICES = [(IN, "Stock In"), (OUT, "Stock Out"), (ADJUST, "Adjustment")]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="movements")
    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    quantity = models.IntegerField(help_text="Signed delta applied to stock")
    resulting_stock = models.IntegerField()
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.product.name}: {self.quantity:+d}"
