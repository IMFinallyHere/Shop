"""GST maths (billing/tax.py): slabs per piece, inclusive/exclusive, discounts, rounding."""
from decimal import Decimal as D

from django.test import SimpleTestCase

from billing.tax import CLOTHING_SLABS, compute_bill, pick_rate


class TaxTests(SimpleTestCase):
    def test_slab_boundary_exclusive(self):
        self.assertEqual(pick_rate(D("2500.00"), CLOTHING_SLABS, inclusive=False), 5)
        self.assertEqual(pick_rate(D("2500.01"), CLOTHING_SLABS, inclusive=False), 18)

    def test_slab_boundary_inclusive(self):
        # Inclusive: the limit is on the value before GST, so ₹2,625 incl. 5% is exactly 2,500.
        self.assertEqual(pick_rate(D("2625.00"), CLOTHING_SLABS, inclusive=True), 5)
        self.assertEqual(pick_rate(D("2626.00"), CLOTHING_SLABS, inclusive=True), 18)

    def test_lines_add_up_and_cgst_sgst_split_exactly(self):
        bill = compute_bill(["999", "1499.50", "333.33", "2999"], "percent", "7", CLOTHING_SLABS, inclusive=True)
        lines = bill["lines"]
        self.assertEqual(sum(l["line_total"] for l in lines), bill["total"])
        self.assertEqual(bill["subtotal"] - bill["discount_amount"], bill["total"])  # inclusive: pay tag − discount
        self.assertEqual(sum(l["discount_share"] for l in lines), bill["discount_amount"])
        for row in bill["gst_summary"]:
            self.assertEqual(row["cgst"] + row["sgst"], row["tax"])
        self.assertEqual(sum(r["tax"] for r in bill["gst_summary"]), bill["tax_amount"])

    def test_single_flat_slab_matches_old_bill_maths(self):
        # The old app: 2 × 200, 10% off, 5% added on top → 18.00 tax, 378.00 total.
        bill = compute_bill(["200", "200"], "percent", "10", [{"upto": None, "rate": 5}], inclusive=False)
        self.assertEqual((bill["tax_amount"], bill["total"], bill["tax_rate"]), (D("18.00"), D("378.00"), 5))

    def test_flat_discount_never_exceeds_subtotal(self):
        bill = compute_bill(["100"], "flat", "500", CLOTHING_SLABS, inclusive=True)
        self.assertEqual((bill["discount_amount"], bill["total"]), (D("100.00"), D("0.00")))

    def test_empty_cart(self):
        bill = compute_bill([], "none", 0, CLOTHING_SLABS, inclusive=True)
        self.assertEqual((bill["total"], bill["lines"], bill["gst_summary"]), (D("0.00"), [], []))
