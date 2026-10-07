import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0004_wipe_inventory"),
    ]

    operations = [
        migrations.RemoveIndex(model_name="stockitem", name="inventory_s_product_ec5d3b_idx"),
        migrations.RemoveField(model_name="stockitem", name="product"),
        migrations.RemoveField(model_name="stockitem", name="batch"),
        migrations.RemoveField(model_name="product", name="color"),
        migrations.RemoveField(model_name="product", name="size"),
        migrations.RemoveField(model_name="product", name="cost_price"),
        migrations.RemoveField(model_name="product", name="price"),
        migrations.RemoveField(model_name="product", name="low_stock_threshold"),
        migrations.CreateModel(
            name="ProductVariant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("color", models.CharField(blank=True, max_length=50)),
                ("size", models.CharField(blank=True, max_length=30)),
                ("low_stock_threshold", models.PositiveIntegerField(default=5)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="variants", to="inventory.product")),
            ],
            options={
                "ordering": ["color", "size"],
                "constraints": [
                    models.UniqueConstraint(fields=("product", "color", "size"), name="uniq_variant_per_product"),
                ],
            },
        ),
        migrations.CreateModel(
            name="StockBatch",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("cost_price", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("price", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("quantity", models.PositiveIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("variant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="batches", to="inventory.productvariant")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        # Table is empty after 0004, so non-null FKs need no default.
        migrations.AddField(
            model_name="stockitem",
            name="variant",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="stock_items", to="inventory.productvariant"),
        ),
        migrations.AddField(
            model_name="stockitem",
            name="batch",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="inventory.stockbatch"),
        ),
        migrations.AddIndex(
            model_name="stockitem",
            index=models.Index(fields=["variant", "status"], name="inventory_s_variant_a90127_idx"),
        ),
    ]
