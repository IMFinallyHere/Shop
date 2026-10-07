"""Wipe inventory (and the bills that reference its units) before the variant rework.

Kept separate from the schema migration: Postgres refuses ALTER TABLE in the same
transaction as pending FK trigger events from these deletes.
"""
from django.db import migrations


def wipe(apps, schema_editor):
    apps.get_model("billing", "BillItem").objects.all().delete()
    apps.get_model("billing", "Bill").objects.all().delete()
    apps.get_model("inventory", "StockItem").objects.all().delete()
    apps.get_model("inventory", "Product").objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0003_product_inventory_p_name_f6a6a1_idx_and_more"),
        ("billing", "0003_alter_bill_customer_id_and_more"),
    ]

    operations = [
        migrations.RunPython(wipe, migrations.RunPython.noop),
    ]
