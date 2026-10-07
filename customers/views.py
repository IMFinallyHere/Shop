from django.db.models import Count, Max, Min, Sum
from rest_framework import status
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
        from billing.models import Bill, CreditEntry  # tenant app; imported lazily

        counts = (
            Bill.objects.exclude(customer_id__isnull=True)
            .values("customer_id")
            .annotate(n=Count("id"))
        )
        count_map = {row["customer_id"]: row["n"] for row in counts}
        credit_map = {
            row["customer_id"]: row["s"]
            for row in CreditEntry.objects.values("customer_id").annotate(s=Sum("amount"))
        }
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
            row["credit_balance"] = str(credit_map.get(c.id) or "0.00")
            data.append(row)
        data.sort(key=lambda r: r["name"].lower())
        return Response(data)

    def retrieve(self, request, pk=None):
        """One customer as THIS shop knows them: profile, totals, bills, returns, credit."""
        from billing.models import Bill, CreditEntry, Return, credit_balance

        try:
            cid = int(pk)
        except (TypeError, ValueError):
            cid = None
        bills = Bill.objects.filter(customer_id=cid)
        customer = Customer.objects.filter(pk=cid).first() if cid else None
        if not customer or not bills.exists():
            return Response({"detail": "Customer not found in this shop."}, status=status.HTTP_404_NOT_FOUND)

        agg = bills.aggregate(n=Count("id"), spent=Sum("total"), first=Min("created_at"), last=Max("created_at"))
        returns = Return.objects.filter(customer_id=cid).select_related("bill").annotate(n_items=Count("items"))
        ledger = CreditEntry.objects.filter(customer_id=cid).select_related("ret", "bill")[:50]
        return Response({
            **CustomerSerializer(customer).data,
            "stats": {
                "bills": agg["n"], "spent": str(agg["spent"] or 0),
                "refunded": str(returns.aggregate(s=Sum("amount"))["s"] or 0),
                "credit_balance": str(credit_balance(cid)),
                "first_visit": agg["first"], "last_visit": agg["last"],
            },
            "bills": [
                {"id": b.id, "number": b.number, "items": b.n_items, "total": str(b.total),
                 "payment_mode": b.payment_mode, "returned": b.n_returns > 0, "created_at": b.created_at}
                for b in bills.annotate(n_items=Count("items", distinct=True), n_returns=Count("returns", distinct=True))
                .order_by("-created_at")[:50]
            ],
            "returns": [
                {"id": r.id, "number": r.number, "bill_number": r.bill.number, "items": r.n_items,
                 "amount": str(r.amount), "mode": r.mode, "payment_mode": r.payment_mode,
                 "reason": r.reason, "created_at": r.created_at}
                for r in returns.order_by("-created_at")[:50]
            ],
            "credit": [
                {"id": e.id, "amount": str(e.amount), "created_at": e.created_at,
                 "ref": e.ret.number if e.ret else e.bill.number if e.bill else None}
                for e in ledger
            ],
        })

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
