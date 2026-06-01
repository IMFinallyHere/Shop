from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework import status, viewsets
from rest_framework.filters import SearchFilter
from rest_framework.response import Response

from accounts.permissions import IsSuperuserOrStaff
from inventory.models import StockItem
from .models import Bill, BillItem
from .serializers import BillSerializer, CheckoutSerializer


def money(value):
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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


class BillViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperuserOrStaff]
    serializer_class = BillSerializer
    http_method_names = ["get", "post"]  # bills are immutable once created
    filter_backends = [SearchFilter]
    search_fields = ["customer_name", "customer_phone", "id"]

    def get_queryset(self):
        return Bill.objects.prefetch_related("items", "items__stock_item").order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        codes = list(dict.fromkeys(data["codes"]))  # de-dupe, keep order

        with transaction.atomic():
            units = list(
                StockItem.objects.select_for_update()
                .filter(code__in=codes, status=StockItem.IN_STOCK)
                .select_related("product")
            )
            found = {u.code for u in units}
            missing = [c for c in codes if c not in found]
            if missing:
                return Response(
                    {"codes": f"Not available (sold or unknown): {', '.join(missing)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            subtotal = money(sum(u.product.price for u in units))
            dtype = data["discount_type"]
            dvalue = Decimal(data["discount_value"])
            if dtype == Bill.FLAT:
                discount_amount = money(min(dvalue, subtotal))
            elif dtype == Bill.PERCENT:
                discount_amount = money(subtotal * dvalue / 100)
            else:
                discount_amount = Decimal("0.00")
            taxable = subtotal - discount_amount
            tax_rate = Decimal(data["tax_rate"])
            tax_amount = money(taxable * tax_rate / 100)
            total = money(taxable + tax_amount)

            cust = data.get("customer") or {}
            customer_id, cname, cphone = resolve_customer(
                cust.get("name", ""), cust.get("phone", "")
            )

            bill = Bill.objects.create(
                customer_id=customer_id, customer_name=cname, customer_phone=cphone,
                subtotal=subtotal, discount_type=dtype, discount_value=dvalue,
                discount_amount=discount_amount, tax_rate=tax_rate, tax_amount=tax_amount,
                total=total, payment_mode=data["payment_mode"],
                created_by=request.user,
            )
            BillItem.objects.bulk_create([
                BillItem(bill=bill, stock_item=u, product_name=u.product.name, unit_price=u.product.price)
                for u in units
            ])
            StockItem.objects.filter(id__in=[u.id for u in units]).update(status=StockItem.SOLD)

        return Response(
            BillSerializer(bill, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
