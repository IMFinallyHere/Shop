from django.db import models
from django.db.models.functions import Lower

from core.db import trigram_index


class Customer(models.Model):
    """A global customer, shared across all shops (lives in the public schema).

    Keyed by phone so a shop filling in a sale can find a customer another shop
    already entered. Bills reference a customer by id (soft) + name/phone snapshot;
    a shop only "sees" customers who have bought from it (resolved via its bills).
    """

    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, unique=True)
    email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            # Shop customer lists sort case-insensitively.
            models.Index(Lower("name"), "id", name="customer_lower_name_idx"),
            trigram_index("name", "customer_name_trgm"),
            trigram_index("phone", "customer_phone_trgm"),
        ]

    def __str__(self):
        return f"{self.name} ({self.phone})"
