"""Keep the denormalized stock figures on variants/products in step with their units.

Call :func:`recount` (inside the same transaction) after anything that adds units or
changes a unit's status: add stock, checkout, return, remove.
"""
from django.db.models import Count, IntegerField, Max, Min, OuterRef, Subquery, Sum
from django.db.models.functions import Coalesce

from .models import Product, ProductVariant, StockItem


def _in_stock(**filters):
    return StockItem.objects.filter(status=StockItem.IN_STOCK, **filters).order_by()


def recount(variant_ids=(), product_ids=()):
    """Recompute stock counts for these variants and their (plus any extra) products."""
    variant_ids = set(variant_ids)
    product_ids = set(product_ids)
    if variant_ids:
        ProductVariant.objects.filter(id__in=variant_ids).update(stock_quantity=Coalesce(Subquery(
            _in_stock(variant=OuterRef("pk")).values("variant").annotate(n=Count("id")).values("n"),
            output_field=IntegerField()), 0))
        product_ids |= set(ProductVariant.objects.filter(id__in=variant_ids).values_list("product_id", flat=True))
    if product_ids:
        units = _in_stock(variant__product=OuterRef("pk")).values("variant__product")
        Product.objects.filter(id__in=product_ids).update(
            stock_quantity=Coalesce(Subquery(
                ProductVariant.objects.filter(product=OuterRef("pk")).order_by().values("product")
                .annotate(n=Sum("stock_quantity")).values("n"), output_field=IntegerField()), 0),
            price_min=Subquery(units.annotate(p=Min("batch__price")).values("p")),
            price_max=Subquery(units.annotate(p=Max("batch__price")).values("p")),
        )


RECOUNT_ALL_SQL = [
    """UPDATE inventory_productvariant v SET stock_quantity = COALESCE(s.n, 0)
       FROM inventory_productvariant v2 LEFT JOIN (
           SELECT variant_id, COUNT(*) AS n FROM inventory_stockitem WHERE status = 'in_stock' GROUP BY variant_id
       ) s ON s.variant_id = v2.id
       WHERE v.id = v2.id""",
    """UPDATE inventory_product p SET stock_quantity = COALESCE(s.n, 0), price_min = s.lo, price_max = s.hi
       FROM inventory_product p2 LEFT JOIN (
           SELECT v.product_id, COUNT(*) AS n, MIN(b.price) AS lo, MAX(b.price) AS hi
           FROM inventory_stockitem i
           JOIN inventory_productvariant v ON v.id = i.variant_id
           JOIN inventory_stockbatch b ON b.id = i.batch_id
           WHERE i.status = 'in_stock' GROUP BY v.product_id
       ) s ON s.product_id = p2.id
       WHERE p.id = p2.id""",
]


def recount_all():
    """Recompute every variant's and product's stock figures (bulk loads, repairs)."""
    from django.db import connection

    with connection.cursor() as c:
        for sql in RECOUNT_ALL_SQL:
            c.execute(sql)
