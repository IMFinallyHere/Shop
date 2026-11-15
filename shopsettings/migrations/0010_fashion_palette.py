# Every existing shop gets the full fashion-industry colour palette.
#
# Same rules as 0008: names already present (any case) are left exactly as they are,
# and missing ones are appended after the shop's own, so nobody's order changes.
# Empty (brand-new) shops are seeded in the intended order on first open.

from django.db import migrations


def fill(apps, schema_editor):
    from shopsettings.models import DEFAULT_COLORS

    Color = apps.get_model("shopsettings", "Color")
    if not Color.objects.exists():
        return
    have = {n.lower() for n in Color.objects.values_list("name", flat=True)}
    start = (Color.objects.order_by("-position").values_list("position", flat=True).first() or 0) + 1
    Color.objects.bulk_create([
        Color(name=n, hex=h, position=start + i)
        for i, (n, h) in enumerate((n, h) for n, h in DEFAULT_COLORS if n.lower() not in have)
    ], batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        ("shopsettings", "0009_shopsettings_hide_product_name_and_more"),
    ]

    operations = [migrations.RunPython(fill, migrations.RunPython.noop)]
