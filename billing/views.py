import re
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, OuterRef, Prefetch, Q, Subquery, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import ShopPermission
from inventory.models import LOW_STOCK, ProductVariant, StockItem
from inventory.stock import recount
from shopsettings.models import PaymentMethod, ShopSettings, ensure_payment_methods
from .models import (
    Bill, BillItem, CreditEntry, Return, ReturnItem, credit_balance, money, refund_shares,
)
from .serializers import BillSerializer, CheckoutSerializer, CreateReturnSerializer, ReturnSerializer


def is_active_payment_method(name):
    ensure_payment_methods()
    return PaymentMethod.objects.filter(is_active=True, name=name).exists()


def lock_credit(customer_id):
    """Lock the customer's ledger rows so concurrent spends can't overdraw it."""
    list(CreditEntry.objects.select_for_update().filter(customer_id=customer_id).values_list("id", flat=True))


def find_customer_id(phone):
    from customers.models import Customer

    with schema_context(get_public_schema_name()):
        return Customer.objects.filter(phone=phone).values_list("id", flat=True).first()


def resolve_customer(name, phone):
    """Find or create the global (public-schema) customer; return (id, name, phone)."""
    if not phone:
        return None, "", ""
    from customers.models import Customer

    with schema_context(get_public_schema_name()):
        customer, created = Customer.objects.get_or_create(
            phone=phone, defaults={"name": name}
        )
        if name and not created and customer.name != name:
            customer.name = name
            customer.save(update_fields=["name"])
        return customer.id, customer.name, customer.phone


class CustomerOrNumberSearch(SearchFilter):
    """Search by customer name/phone (trigram-indexed), or an exact document number.

    ``123``, ``INV-123`` or ``RET-123`` match that id exactly (returns also by bill); a substring match on the
    id would cast every row's id to text and scan the whole table.
    """

    NUMBER = re.compile(r"^(?:INV|RET)?-?(\d+)$", re.I)

    def filter_queryset(self, request, queryset, view):
        q = request.query_params.get(self.search_param, "").strip()
        if not q:
            return queryset
        match = Q(customer_name__icontains=q) | Q(customer_phone__icontains=q)
        number = self.NUMBER.match(q)
        if number:
            n = int(number.group(1))
            match |= Q(pk=n)
            if queryset.model is Return and not q.upper().startswith("RET"):
                match |= Q(bill_id=n)  # a return's bill number
        return queryset.filter(match)


class BillViewSet(viewsets.ModelViewSet):
    permission_classes = [ShopPermission]
    perm_model = "billing.bill"
    perms = {"by_code": "billing.view_bill"}
    serializer_class = BillSerializer
    http_method_names = ["get", "post"]  # bills are immutable once created
    filter_backends = [CustomerOrNumberSearch]

    def get_queryset(self):
        return Bill.objects.prefetch_related(
            "items__stock_item", "items__return_item", "returns"
        ).order_by("-created_at")

    @action(detail=False, methods=["get"], url_path="by-code")
    def by_code(self, request):
        """The bill holding a not-yet-returned sale of this unit (scan-to-return)."""
        code = request.query_params.get("code", "").strip()
        item = (
            BillItem.objects.filter(stock_item__code=code, return_item__isnull=True)
            .order_by("-bill__created_at").first()
        )
        if not code or not item:
            return Response({"detail": f"No unreturned sale found for {code}."}, status=status.HTTP_404_NOT_FOUND)
        bill = self.get_queryset().get(pk=item.bill_id)
        data = BillSerializer(bill, context={"request": request}).data
        data["scanned_item"] = item.id
        return Response(data)

    def create(self, request, *args, **kwargs):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        codes = list(dict.fromkeys(data["codes"]))  # de-dupe, keep order

        # Payment method must be one the shop has enabled.
        if not is_active_payment_method(data["payment_mode"]):
            return Response(
                {"payment_mode": "Not an enabled payment method for this shop."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Tax rate comes from the shop's settings, not the request.
        tax_rate = Decimal(ShopSettings.load().default_tax_rate)

        with transaction.atomic():
            units = list(
                StockItem.objects.select_for_update(of=("self",))
                .filter(code__in=codes, status=StockItem.IN_STOCK)
                .select_related("batch", "variant__product", "variant__color", "variant__size")
            )
            found = {u.code for u in units}
            missing = [c for c in codes if c not in found]
            if missing:
                return Response(
                    {"codes": f"Not available (sold or unknown): {', '.join(missing)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            subtotal = money(sum(u.batch.price for u in units))
            dtype = data["discount_type"]
            dvalue = Decimal(data["discount_value"])
            if dtype == Bill.FLAT:
                discount_amount = money(min(dvalue, subtotal))
            elif dtype == Bill.PERCENT:
                discount_amount = money(subtotal * dvalue / 100)
            else:
                discount_amount = Decimal("0.00")
            taxable = subtotal - discount_amount
            tax_amount = money(taxable * tax_rate / 100)
            total = money(taxable + tax_amount)

            cust = data["customer"]
            customer_id, cname, cphone = resolve_customer(cust["name"], cust["phone"])

            credit_used = money(data["credit_used"])
            if credit_used > 0:
                lock_credit(customer_id)
                balance = credit_balance(customer_id)
                if credit_used > balance or credit_used > total:
                    transaction.set_rollback(True)
                    return Response(
                        {"credit_used": f"Can use at most {min(balance, total)} store credit."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            bill = Bill.objects.create(
                customer_id=customer_id, customer_name=cname, customer_phone=cphone,
                subtotal=subtotal, discount_type=dtype, discount_value=dvalue,
                discount_amount=discount_amount, tax_rate=tax_rate, tax_amount=tax_amount,
                total=total, credit_used=credit_used, payment_mode=data["payment_mode"],
                created_by=request.user,
            )
            if credit_used > 0:
                CreditEntry.objects.create(customer_id=customer_id, amount=-credit_used, bill=bill)
            BillItem.objects.bulk_create([
                BillItem(bill=bill, stock_item=u, product_name=str(u.variant), unit_price=u.batch.price)
                for u in units
            ])
            StockItem.objects.filter(id__in=[u.id for u in units]).update(status=StockItem.SOLD)
            recount(variant_ids={u.variant_id for u in units})

        return Response(
            BillSerializer(bill, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ReturnViewSet(viewsets.ModelViewSet):
    permission_classes = [ShopPermission]
    perm_model = "billing.return"
    serializer_class = ReturnSerializer
    http_method_names = ["get", "post"]  # returns are immutable once created
    filter_backends = [CustomerOrNumberSearch]

    def get_queryset(self):
        return Return.objects.select_related("bill").prefetch_related(
            "items__bill_item__stock_item"
        ).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = CreateReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        item_ids = list(dict.fromkeys(data["items"]))
        bill = Bill.objects.filter(pk=data["bill"]).prefetch_related(
            Prefetch("items", queryset=BillItem.objects.select_related("stock_item"))
        ).first()
        if not bill:
            return Response({"bill": "Bill not found."}, status=status.HTTP_400_BAD_REQUEST)

        mode = data["mode"]
        payment_mode = ""
        if mode == Return.REFUND:
            payment_mode = data["payment_mode"]
            if not is_active_payment_method(payment_mode):
                return Response({"payment_mode": "Not an enabled payment method for this shop."},
                                status=status.HTTP_400_BAD_REQUEST)
        elif not bill.customer_id:  # only bills from before customers were mandatory
            return Response({"mode": "Store credit needs a customer on the bill."},
                            status=status.HTTP_400_BAD_REQUEST)

        lines = {i.id: i for i in bill.items.all()}
        foreign = [i for i in item_ids if i not in lines]
        if foreign:
            return Response({"items": f"Not on bill {bill.number}: {foreign}"},
                            status=status.HTTP_400_BAD_REQUEST)
        shares = refund_shares(bill)

        with transaction.atomic():
            units = StockItem.objects.select_for_update(of=("self",)).filter(
                id__in=[lines[i].stock_item_id for i in item_ids]
            )
            already = set(
                ReturnItem.objects.filter(bill_item_id__in=item_ids).values_list("bill_item_id", flat=True)
            )
            not_sold = {u.id for u in units if u.status != StockItem.SOLD}
            bad = [lines[i].stock_item.code for i in item_ids if i in already or lines[i].stock_item_id in not_sold]
            if bad:
                return Response({"items": f"Already returned: {', '.join(bad)}"},
                                status=status.HTTP_400_BAD_REQUEST)

            amount = sum((shares[i] for i in item_ids), Decimal("0.00"))
            ret = Return.objects.create(
                bill=bill, mode=mode, payment_mode=payment_mode, amount=amount,
                reason=data["reason"], customer_id=bill.customer_id,
                customer_name=bill.customer_name, customer_phone=bill.customer_phone,
                created_by=request.user,
            )
            ReturnItem.objects.bulk_create([
                ReturnItem(ret=ret, bill_item=lines[i], refund_amount=shares[i]) for i in item_ids
            ])
            # Always restocked: same barcode, same batch price.
            StockItem.objects.filter(id__in=[lines[i].stock_item_id for i in item_ids]).update(
                status=StockItem.IN_STOCK
            )
            recount(variant_ids={u.variant_id for u in units})
            if mode == Return.CREDIT:
                CreditEntry.objects.create(customer_id=bill.customer_id, amount=amount, ret=ret)

        ret = self.get_queryset().get(pk=ret.pk)
        return Response(ReturnSerializer(ret, context={"request": request}).data,
                        status=status.HTTP_201_CREATED)


class StoreCreditView(APIView):
    """``GET /store-credit/?phone=`` → this shop's credit balance for that customer."""

    permission_classes = [ShopPermission]
    perm_model = "billing.creditentry"

    def get(self, request):
        phone = request.query_params.get("phone", "").strip()
        customer_id = find_customer_id(phone) if phone else None
        return Response({"customer_id": customer_id, "balance": str(credit_balance(customer_id))})


class DashboardView(APIView):
    """``GET /dashboard/`` → today's figures, a 7-day sales series, low stock and recent bills."""

    permission_classes = [ShopPermission]
    perms = {"GET": "billing.view_bill"}  # sales figures

    def get(self, request):
        today = timezone.localdate()
        start = today - timedelta(days=6)
        # Datetime ranges (not ``__date``) so the created_at indexes are used.
        day_start = timezone.make_aware(datetime.combine(today, time.min))
        day_end = day_start + timedelta(days=1)
        week_start = day_start - timedelta(days=6)
        in_today = {"created_at__gte": day_start, "created_at__lt": day_end}

        agg = Bill.objects.filter(**in_today).aggregate(total=Sum("total"), count=Count("id"))
        sales, count = agg["total"] or Decimal("0"), agg["count"]
        items_sold = BillItem.objects.filter(**{f"bill__{k}": v for k, v in in_today.items()}).count()
        refunds = Return.objects.filter(**in_today).aggregate(s=Sum("amount"))["s"] or Decimal("0")

        per_day = {
            row["day"]: row
            for row in Bill.objects.filter(created_at__gte=week_start, created_at__lt=day_end)
            .annotate(day=TruncDate("created_at"))
            .values("day").annotate(total=Sum("total"), count=Count("id")).order_by()
        }
        last_7_days = []
        for i in range(7):
            d = start + timedelta(days=i)
            row = per_day.get(d, {})
            last_7_days.append({"date": d.isoformat(), "total": str(row.get("total") or Decimal("0")),
                                "count": row.get("count", 0)})

        low = ProductVariant.objects.filter(LOW_STOCK)
        low_stock = [
            {"variant_id": v.id, "product_id": v.product_id, "product_name": v.product.name, "label": v.label,
             "color_hex": (v.color.hex or None) if v.color else None, "stock": v.stock_quantity,
             "threshold": v.low_stock_threshold}
            for v in low.select_related("product", "color", "size").order_by("stock_quantity", "product__name")[:8]
        ]

        recent = [
            {"id": b.id, "number": b.number, "customer_name": b.customer_name, "total": str(b.total),
             "payment_mode": b.payment_mode, "created_at": b.created_at}
            for b in Bill.objects.all()[:5]
        ]
        recent_returns = [
            {"id": r.id, "number": r.number, "bill_number": r.bill.number, "customer_name": r.customer_name,
             "amount": str(r.amount), "mode": r.mode, "payment_mode": r.payment_mode,
             "items": r.n_items, "created_at": r.created_at}
            for r in Return.objects.select_related("bill").annotate(n_items=Subquery(
                ReturnItem.objects.filter(ret=OuterRef("pk")).order_by().values("ret").annotate(n=Count("id")).values("n")
            ))[:5]
        ]

        return Response({
            "today": {
                "sales": str(sales), "bills": count, "items_sold": items_sold,
                "avg_bill": str(money(sales / count) if count else Decimal("0")), "refunds": str(refunds),
            },
            "last_7_days": last_7_days,
            "low_stock": low_stock,
            "low_stock_count": low.count(),
            "recent_bills": recent,
            "recent_returns": recent_returns,
        })
