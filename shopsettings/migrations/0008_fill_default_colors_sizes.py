# Every shop gets the common clothing colours and sizes it doesn't have yet.
#
# Before this, defaults were only seeded into an *empty* list, so a shop that had
# added even one colour never got the rest. Names already present (any case) are
# left exactly as they are; missing defaults are appended after the shop's own.

from django.db import migrations


def fill(apps, schema_editor):
    from shopsettings.models import DEFAULT_COLORS, DEFAULT_SIZES

    Color = apps.get_model("shopsettings", "Color")
    Size = apps.get_model("shopsettings", "Size")

    # Brand-new (empty) shops are seeded on first open by ensure_colors/ensure_sizes,
    # in the intended order; only top up shops that already have their own entries.
    if Color.objects.exists():
        have = {n.lower() for n in Color.objects.values_list("name", flat=True)}
        start = (Color.objects.order_by("-position").values_list("position", flat=True).first() or 0) + 1
        Color.objects.bulk_create([
            Color(name=n, hex=h, position=start + i)
            for i, (n, h) in enumerate((n, h) for n, h in DEFAULT_COLORS if n.lower() not in have)
        ])
    if Size.objects.exists():
        have = {n.lower() for n in Size.objects.values_list("name", flat=True)}
        start = (Size.objects.order_by("-position").values_list("position", flat=True).first() or 0) + 1
        Size.objects.bulk_create([
            Size(name=n, position=start + i)
            for i, n in enumerate(n for n in DEFAULT_SIZES if n.lower() not in have)
        ])


class Migration(migrations.Migration):

    dependencies = [
        ("shopsettings", "0007_auto_product_names"),
    ]

    operations = [migrations.RunPython(fill, migrations.RunPython.noop)]
