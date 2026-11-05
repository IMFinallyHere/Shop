# Per-piece GST slabs replace the single default tax rate.

import shopsettings.models
from django.db import migrations, models


def _has_bills(schema_editor):
    conn = schema_editor.connection
    if "billing_bill" not in conn.introspection.table_names():
        return False
    with conn.cursor() as cur:
        cur.execute("SELECT EXISTS (SELECT 1 FROM billing_bill)")
        return cur.fetchone()[0]


def keep_current_tax(apps, schema_editor):
    """Existing shops keep exactly today's behaviour: their old rate as one open slab,
    added on top of prices. They switch to clothing slabs from Settings when ready.
    A shop that already billed without ever saving settings gets a 0% row so nothing
    changes for it either; a brand-new shop (empty schema) gets the clothing defaults."""
    ShopSettings = apps.get_model("shopsettings", "ShopSettings")
    rows = list(ShopSettings.objects.all())
    if not rows and _has_bills(schema_editor):
        ShopSettings.objects.create(pk=1, tax_slabs=[{"upto": None, "rate": 0}], prices_include_tax=False)
    for row in rows:
        rate = float(row.default_tax_rate or 0)
        row.tax_slabs = [{"upto": None, "rate": int(rate) if rate.is_integer() else rate}]
        row.prices_include_tax = False
        row.save(update_fields=["tax_slabs", "prices_include_tax"])


class Migration(migrations.Migration):

    dependencies = [
        ('shopsettings', '0005_receipt_printable_mm'),
    ]

    operations = [
        migrations.AddField(
            model_name='shopsettings',
            name='prices_include_tax',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='shopsettings',
            name='tax_slabs',
            field=models.JSONField(default=shopsettings.models.default_tax_slabs),
        ),
        migrations.RunPython(keep_current_tax, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='shopsettings',
            name='default_tax_rate',
        ),
    ]
