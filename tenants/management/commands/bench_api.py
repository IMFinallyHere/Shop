"""Time every read endpoint of a shop (in-process, real JWT auth + middleware).

    python manage.py bench_api perf            # 5 runs each, fail if any p95 > 500 ms
    python manage.py bench_api perf --runs 10 --only products

Prints p50 / p95 wall time and the query count per request. Pair with
``seed_large`` to get a shop big enough to matter.
"""
import statistics
import time

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django_tenants.utils import schema_context
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from tenants.models import Tenant


class Command(BaseCommand):
    help = "Benchmark the shop's read API endpoints."

    def add_arguments(self, parser):
        parser.add_argument("shop")
        parser.add_argument("--runs", type=int, default=5)
        parser.add_argument("--budget", type=float, default=500, help="p95 budget in ms")
        parser.add_argument("--only", default="", help="Substring filter on endpoint paths")

    def sample(self):
        """Real ids/codes/names to query with, so detail endpoints hit existing rows."""
        from billing.models import Bill, BillItem, Return
        from inventory.models import Product, StockItem

        bill = Bill.objects.exclude(customer_id=None).order_by("-id").values("id", "customer_id", "customer_phone",
                                                                             "customer_name").first() or {}
        ret = Return.objects.order_by("-id").values_list("id", flat=True).first()
        product = Product.objects.order_by("-id").values("id", "name").first() or {}
        unit = StockItem.objects.filter(status=StockItem.SOLD).order_by("-id").values_list("code", flat=True).first()
        in_stock = StockItem.objects.filter(status=StockItem.IN_STOCK).order_by("-id").values_list(
            "code", flat=True).first()
        sold = BillItem.objects.filter(return_item__isnull=True).order_by("-id").values_list(
            "stock_item__code", flat=True).first()
        return bill, ret, product, unit, sold, in_stock

    def endpoints(self):
        bill, ret, product, unit, sold, in_stock = self.sample()
        name = (bill.get("customer_name") or "x").split()[-1].lower()
        word = (product.get("name") or "kurti").split()[1].lower()
        return [
            "auth/me/",
            "dashboard/",
            "products/", f"products/?search={word}", "products/?low_stock=1", "products/?page=500",
            "products/?ordering=-stock_quantity", "products/?ordering=price_min",
            f"variants/?product={product.get('id')}",
            "stock-items/", "stock-items/?status=all", "stock-items/?page=1000", f"stock-items/?search={(unit or 'AB')[:5]}",
            f"stock-items/?search={word}", f"stock-items/lookup/?code={in_stock}",
            "categories/", "sellers/", "categories/?all=1", "sellers/?all=1",
            "bills/", f"bills/?search={name}", "bills/?page=1000", f"bills/{bill.get('id')}/", f"bills/by-code/?code={sold}",
            "returns/", f"returns/?search={name}", f"returns/{ret}/",
            "customers/", f"customers/?search={name}", f"customers/{bill.get('customer_id')}/",
            f"customers/lookup/?phone={(bill.get('customer_phone') or '70')[:6]}",
            f"store-credit/?phone={bill.get('customer_phone')}",
            f"search/?q={name}", f"search/?q={word}", f"search/?q={unit}", f"search/?q=INV-{bill.get('id')}",
            f"search/?q={bill.get('customer_phone')}", "search/?q=70001",
            f"units/{unit}/history/",
            "payment-methods/?active=1", "sizes/?active=1", "colors/?active=1", "shop-settings/",
        ]

    def handle(self, shop, runs, budget, only, **opts):
        tenant = Tenant.objects.filter(schema_name=shop).first()
        if not tenant:
            raise CommandError(f"No shop '{shop}'.")
        host = tenant.domains.filter(is_primary=True).first().domain
        with schema_context(tenant.schema_name):
            paths = [p for p in self.endpoints() if only in p]
        connection.set_schema_to_public()

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(tenant.owner).access_token}")

        slow = []
        self.stdout.write(f"{'endpoint':60} {'p50':>8} {'p95':>8} {'queries':>8}  status")
        for path in paths:
            times, n_queries, code = [], 0, None
            for i in range(runs + 1):  # first run warms caches, not counted
                with CaptureQueriesContext(connection) as ctx:
                    t = time.perf_counter()
                    resp = client.get(f"/api/{path}", HTTP_HOST=host)
                    ms = (time.perf_counter() - t) * 1000
                if i:
                    times.append(ms)
                n_queries, code = len(ctx.captured_queries), resp.status_code
            times.sort()
            p50 = statistics.median(times)
            p95 = times[min(len(times) - 1, round(0.95 * (len(times) - 1)))]
            flag = self.style.ERROR(" SLOW") if p95 > budget else ""
            self.stdout.write(f"{path[:60]:60} {p50:8.1f} {p95:8.1f} {n_queries:8d}  {code}{flag}")
            if p95 > budget:
                slow.append(path)
        if slow:
            raise CommandError(f"{len(slow)} endpoint(s) over {budget:.0f} ms p95: {', '.join(slow)}")
        self.stdout.write(self.style.SUCCESS(f"All {len(paths)} endpoints under {budget:.0f} ms p95."))
