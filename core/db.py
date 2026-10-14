from django.contrib.postgres.indexes import GinIndex, OpClass
from django.db.models.functions import Upper


def trigram_index(field, name):
    """GIN trigram index serving ``field__icontains`` lookups.

    Django compiles ``icontains`` to ``UPPER(col::text) LIKE UPPER(...)``, so the index
    has to be on ``UPPER(col)`` — one on the bare column is never used.
    """
    return GinIndex(OpClass(Upper(field), name="gin_trgm_ops"), name=name)
