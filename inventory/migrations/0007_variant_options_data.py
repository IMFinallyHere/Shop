"""Step 2/3: turn each variant's color/size text into a Settings Color/Size row.

Own migration (own transaction): Postgres rejects the column drops in 0008 while FK
trigger events from these updates are still pending.
"""
from django.db import migrations
from django.db.models import Max


def _get_or_create(model, name):
    name = name.strip()
    if not name:
        return None
    obj = model.objects.filter(name__iexact=name).first()
    if obj:
        return obj
    last = model.objects.aggregate(m=Max("position"))["m"]
    return model.objects.create(name=name, position=0 if last is None else last + 1)


def forwards(apps, schema_editor):
    Variant = apps.get_model("inventory", "ProductVariant")
    Color = apps.get_model("shopsettings", "Color")
    Size = apps.get_model("shopsettings", "Size")
    for v in Variant.objects.all():
        v.color_ref = _get_or_create(Color, v.color)
        v.size_ref = _get_or_create(Size, v.size)
        v.save(update_fields=["color_ref", "size_ref"])


def backwards(apps, schema_editor):
    Variant = apps.get_model("inventory", "ProductVariant")
    for v in Variant.objects.select_related("color_ref", "size_ref"):
        v.color = v.color_ref.name if v.color_ref else ""
        v.size = v.size_ref.name if v.size_ref else ""
        v.save(update_fields=["color", "size"])


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0006_variant_option_refs"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
