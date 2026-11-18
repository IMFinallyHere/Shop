from datetime import datetime, time

from django.utils import timezone

from accounts.permissions import can_view_all_sales


def visible_bills(bills, user):
    """Limit a Bill queryset to what ``user`` may see: all of it with ``billing.view_all_sales``,
    otherwise only the bills they made today."""
    if can_view_all_sales(user):
        return bills
    day_start = timezone.make_aware(datetime.combine(timezone.localdate(), time.min))
    return bills.filter(created_by=user, created_at__gte=day_start)
