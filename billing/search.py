"""Global search (top bar) and the full history of one stock unit."""
import re

from django.db.models import Count, Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperuserOrStaff
from customers.models import Customer
from inventory.models import Product, Seller, StockItem
from .models import Bill, BillItem, Return, credit_balance

LIMIT = 5
BILL_NO = re.compile(r"^INV-?(\d+)$", re.I)
RETURN_NO = re.compile(r"^RET-?(\d+)$", re.I)
UNIT_RELATED = ("batch", "variant__product__category", "variant__product__seller", "variant__color", "variant__size")


def _bill_row(b):
    return {"id": b.id, "number": b.number, "customer_name": b.customer_name, "customer_phone": b.customer_phone,
            "total": str(b.total), "items": b.n_items, "created_at": b.created_at}


def _return_row(r):
    return {"id": r.id, "number": r.number, "bill_number": r.bill.number, "customer_name": r.customer_name,
            "amount": str(r.amount), "mode": r.mode, "created_at": r.created_at}


def shop_customer_ids():
    """Global customers who have bought from the current shop."""
    return set(Bill.objects.exclude(customer_id__isnull=True).values_list("customer_id", flat=True))


class SearchView(APIView):
    """``GET /search/?q=`` → units, bills, returns, customers, products, sellers (≤5 each).

    ``exact`` names a single unambiguous hit (a scanned barcode, ``INV-00012``,
    ``RET-00003`` or a full phone number) so the UI can jump straight to it.
    """

    permission_classes = [IsSuperuserOrStaff]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        out = {k: [] for k in ("units", "bills", "returns", "customers", "products", "sellers")}
        out["exact"] = None
        bill_no, return_no = BILL_NO.match(q), RETURN_NO.match(q)
        if len(q) < 2 and not (bill_no or return_no):
            return Response(out)

        bills = Bill.objects.annotate(n_items=Count("items")).order_by("-created_at")
        returns = Return.objects.select_related("bill").order_by("-created_at")
        if bill_no:
            out["bills"] = [_bill_row(b) for b in bills.filter(pk=int(bill_no.group(1)))]
            if out["bills"]:
                out["exact"] = {"type": "bill", "id": out["bills"][0]["id"]}
            return Response(out)
        if return_no:
            out["returns"] = [_return_row(r) for r in returns.filter(pk=int(return_no.group(1)))]
            if out["returns"]:
                out["exact"] = {"type": "return", "id": out["returns"][0]["id"]}
            return Response(out)

        units = StockItem.objects.select_related(*UNIT_RELATED)
        exact_unit = units.filter(code__iexact=q).first()
        unit_hits = [exact_unit] if exact_unit else list(units.filter(code__icontains=q)[:LIMIT])
        out["units"] = [{"code": u.code, "product_name": u.variant.product.name, "label": u.variant.label,
                         "status": u.status, "price": str(u.batch.price)} for u in unit_hits]
        if exact_unit:
            out["exact"] = {"type": "unit", "code": exact_unit.code}
            return Response(out)

        who = Q(customer_name__icontains=q) | Q(customer_phone__icontains=q)
        out["bills"] = [_bill_row(b) for b in bills.filter(who)[:LIMIT]]
        out["returns"] = [_return_row(r) for r in returns.filter(who)[:LIMIT]]

        customers = Customer.objects.filter(id__in=shop_customer_ids()).filter(
            Q(name__icontains=q) | Q(phone__icontains=q))[:LIMIT]
        out["customers"] = [{"id": c.id, "name": c.name, "phone": c.phone} for c in customers]
        if q.isdigit() and len(q) == 10:
            match = next((c for c in out["customers"] if c["phone"] == q), None)
            if match:
                out["exact"] = {"type": "customer", "id": match["id"]}

        products = (
            Product.objects.select_related("category")
            .filter(Q(name__icontains=q) | Q(sku__icontains=q) | Q(fabric_type__icontains=q))
            .annotate(in_stock=Count("variants__stock_items", filter=Q(variants__stock_items__status=StockItem.IN_STOCK)))
            .order_by("name")[:LIMIT]
        )
        out["products"] = [{"id": p.id, "name": p.name, "category": p.category.name if p.category else None,
                            "in_stock": p.in_stock} for p in products]
        sellers = Seller.objects.filter(Q(name__icontains=q) | Q(phone__icontains=q)).annotate(
            n_products=Count("products")).order_by("name")[:LIMIT]
        out["sellers"] = [{"id": s.id, "name": s.name, "phone": s.phone, "products": s.n_products} for s in sellers]
        return Response(out)


class UnitHistoryView(APIView):
    """``GET /units/<code>/history/`` → everything about one physical unit."""

    permission_classes = [IsSuperuserOrStaff]

    def get(self, request, code):
        item = StockItem.objects.select_related(*UNIT_RELATED).filter(code__iexact=code.strip()).first()
        if not item:
            return Response({"detail": f"No stock unit with code {code}."}, status=status.HTTP_404_NOT_FOUND)
        v, b = item.variant, item.batch
        p, seller = v.product, v.product.seller

        timeline = [{"type": "added", "at": b.created_at, "batch_quantity": b.quantity,
                     "cost_price": str(b.cost_price), "price": str(b.price)}]
        sales = (
            BillItem.objects.filter(stock_item=item)
            .select_related("bill__created_by", "return_item__ret__created_by")
            .order_by("bill__created_at")
        )
        buyer_ids = []
        for line in sales:
            bill = line.bill
            timeline.append({
                "type": "sold", "at": bill.created_at, "bill_id": bill.id, "bill_number": bill.number,
                "price": str(line.unit_price), "payment_mode": bill.payment_mode,
                "customer_id": bill.customer_id, "customer_name": bill.customer_name,
                "customer_phone": bill.customer_phone,
                "by": bill.created_by.email if bill.created_by else None,
            })
            if bill.customer_id and bill.customer_id not in buyer_ids:
                buyer_ids.append(bill.customer_id)
            ret_item = getattr(line, "return_item", None)
            if ret_item:
                ret = ret_item.ret
                timeline.append({
                    "type": "returned", "at": ret.created_at, "return_id": ret.id, "return_number": ret.number,
                    "mode": ret.mode, "payment_mode": ret.payment_mode, "refund": str(ret_item.refund_amount),
                    "reason": ret.reason, "by": ret.created_by.email if ret.created_by else None,
                })
        timeline.sort(key=lambda e: e["at"])
        if item.status == StockItem.REMOVED:
            # No removal timestamp is stored; it is always the latest thing that happened.
            timeline.append({"type": "removed", "at": None})

        bill_counts = dict(
            Bill.objects.filter(customer_id__in=buyer_ids).values("customer_id")
            .annotate(n=Count("id")).values_list("customer_id", "n")
        )
        people = {c.id: c for c in Customer.objects.filter(id__in=buyer_ids)}
        customers = [
            {"id": cid, "name": people[cid].name, "phone": people[cid].phone, "email": people[cid].email,
             "bills": bill_counts.get(cid, 0), "credit_balance": str(credit_balance(cid))}
            for cid in buyer_ids if cid in people
        ]

        return Response({
            "unit": {"id": item.id, "code": item.code, "status": item.status, "created_at": item.created_at},
            "product": {"id": p.id, "name": p.name, "category": p.category.name if p.category else None,
                        "fabric_type": p.fabric_type, "sku": p.sku},
            "variant": {"id": v.id, "label": v.label, "color_name": v.color.name if v.color else None,
                        "size_name": v.size.name if v.size else None,
                        "color_hex": (v.color.hex or None) if v.color else None,
                        "low_stock_threshold": v.low_stock_threshold,
                        "in_stock": v.stock_items.filter(status=StockItem.IN_STOCK).count()},
            "batch": {"id": str(b.id), "cost_price": str(b.cost_price), "price": str(b.price),
                      "margin": str(b.price - b.cost_price), "quantity": b.quantity, "created_at": b.created_at},
            "seller": seller and {"id": seller.id, "name": seller.name, "phone": seller.phone,
                                  "email": seller.email, "address": seller.address},
            "timeline": timeline,
            "customers": customers,
        })
