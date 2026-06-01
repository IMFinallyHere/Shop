from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsSuperuserOrStaff
from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(viewsets.ViewSet):
    permission_classes = [IsSuperuserOrStaff]

    def list(self, request):
        """Customers who have bought from THIS shop (resolved via its bills)."""
        from billing.models import Bill  # tenant app; imported lazily

        counts = (
            Bill.objects.exclude(customer_id__isnull=True)
            .values("customer_id")
            .annotate(n=Count("id"))
        )
        count_map = {row["customer_id"]: row["n"] for row in counts}
        if not count_map:
            return Response([])
        customers = Customer.objects.filter(id__in=count_map.keys())
        search = request.query_params.get("search")
        if search:
            customers = customers.filter(name__icontains=search) | customers.filter(phone__icontains=search)
        data = []
        for c in customers:
            row = CustomerSerializer(c).data
            row["bill_count"] = count_map.get(c.id, 0)
            data.append(row)
        data.sort(key=lambda r: r["name"].lower())
        return Response(data)

    @action(detail=False, methods=["get"])
    def lookup(self, request):
        """Search the GLOBAL customer table (for autofill across shops)."""
        phone = request.query_params.get("phone", "").strip()
        q = request.query_params.get("q", "").strip()
        qs = Customer.objects.all()
        if phone:
            qs = qs.filter(phone__icontains=phone)
        elif q:
            qs = qs.filter(name__icontains=q) | qs.filter(phone__icontains=q)
        else:
            return Response([])
        return Response(CustomerSerializer(qs[:10], many=True).data)
