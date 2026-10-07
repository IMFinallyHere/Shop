import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Step 3/3: drop the text columns and take over their names with the FKs."""

    dependencies = [
        ("inventory", "0007_variant_options_data"),
    ]

    operations = [
        migrations.RemoveConstraint(model_name="productvariant", name="uniq_variant_per_product"),
        migrations.RemoveField(model_name="productvariant", name="color"),
        migrations.RemoveField(model_name="productvariant", name="size"),
        migrations.RenameField(model_name="productvariant", old_name="color_ref", new_name="color"),
        migrations.RenameField(model_name="productvariant", old_name="size_ref", new_name="size"),
        migrations.AlterField(
            model_name="productvariant",
            name="color",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="variants", to="shopsettings.color"),
        ),
        migrations.AlterField(
            model_name="productvariant",
            name="size",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="variants", to="shopsettings.size"),
        ),
        migrations.AlterModelOptions(
            name="productvariant",
            options={"ordering": ["color__position", "color__name", "size__position", "size__name"]},
        ),
        migrations.AddConstraint(
            model_name="productvariant",
            constraint=models.UniqueConstraint(fields=("product", "color", "size"), name="uniq_variant_per_product", nulls_distinct=False),
        ),
    ]
