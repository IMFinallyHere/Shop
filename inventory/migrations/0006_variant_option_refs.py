import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Step 1/3: add FK columns next to the old color/size text columns."""

    dependencies = [
        ("inventory", "0005_variants"),
        ("shopsettings", "0002_sizes_colors"),
    ]

    operations = [
        migrations.AddField(
            model_name="productvariant",
            name="color_ref",
            field=models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.PROTECT, related_name="+", to="shopsettings.color"),
        ),
        migrations.AddField(
            model_name="productvariant",
            name="size_ref",
            field=models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.PROTECT, related_name="+", to="shopsettings.size"),
        ),
    ]
