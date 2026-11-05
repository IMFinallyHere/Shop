"""GST for one bill: the rate is picked per piece from the shop's price slabs.

Indian GST on clothes depends on each piece's value (from 22 Sep 2025: 5% up to
₹2,500 a piece, 18% above). The slab is chosen on the piece's *taxable value*: its
price after its share of the bill discount, excluding GST. Shops either price
including GST (the customer pays the tag price; the bill shows the GST inside it) or
add GST on top.

Everything is rounded per line to the paisa; bill totals are sums of lines, so the
bill always equals the sum of its lines (and returns can refund a line exactly).
Counter sales are intra-state, so GST is shown as CGST + SGST, half each.
"""
from collections import OrderedDict
from decimal import Decimal

from .models import Bill, money

ZERO = Decimal("0.00")

# Indian clothing (ready-made garments, HSN 61/62) from 22 Sep 2025.
CLOTHING_SLABS = [{"upto": 2500, "rate": 5}, {"upto": None, "rate": 18}]


def _d(value):
    return Decimal(str(value))


def pick_rate(gross, slabs, inclusive):
    """GST rate (%) for one piece whose price after discount is ``gross``."""
    for slab in slabs:
        rate = _d(slab["rate"])
        taxable = gross * 100 / (100 + rate) if inclusive else gross
        if slab.get("upto") is None or taxable <= _d(slab["upto"]):
            return rate
    return _d(slabs[-1]["rate"]) if slabs else ZERO


def discount_amount(subtotal, discount_type, discount_value):
    value = _d(discount_value or 0)
    if discount_type == Bill.FLAT:
        return money(min(value, subtotal))
    if discount_type == Bill.PERCENT:
        return money(subtotal * min(value, Decimal(100)) / 100)
    return ZERO


def split_discount(prices, amount):
    """The bill discount spread over lines by price; the remainder goes to the last line."""
    total = sum(prices, ZERO)
    if not prices or not total or not amount:
        return [ZERO] * len(prices)
    shares = [money(p * amount / total) for p in prices[:-1]]
    return shares + [amount - sum(shares, ZERO)]


def gst_summary(lines):
    """Per rate: taxable value, CGST and SGST (CGST + SGST == that rate's tax, exactly)."""
    by_rate = OrderedDict()
    for line in sorted(lines, key=lambda l: l["rate"]):
        row = by_rate.setdefault(line["rate"], {"rate": line["rate"], "taxable": ZERO, "tax": ZERO})
        row["taxable"] += line["taxable"]
        row["tax"] += line["tax"]
    out = []
    for row in by_rate.values():
        cgst = money(row["tax"] / 2)
        out.append({**row, "cgst": cgst, "sgst": row["tax"] - cgst})
    return out


def compute_bill(prices, discount_type, discount_value, slabs, inclusive):
    """Lines and totals for a bill of pieces priced ``prices`` (tag prices, in order)."""
    prices = [money(p) for p in prices]
    subtotal = sum(prices, ZERO)
    disc = discount_amount(subtotal, discount_type, discount_value)
    lines = []
    for price, share in zip(prices, split_discount(prices, disc)):
        gross = price - share
        rate = pick_rate(gross, slabs, inclusive)
        if inclusive:
            taxable = money(gross * 100 / (100 + rate))
            tax = gross - taxable
        else:
            taxable = gross
            tax = money(gross * rate / 100)
        lines.append({
            "price": price, "discount_share": share, "rate": rate,
            "taxable": taxable, "tax": tax, "line_total": taxable + tax,
        })
    rates = {l["rate"] for l in lines}
    return {
        "lines": lines,
        "subtotal": subtotal,
        "discount_amount": disc,
        "taxable_amount": sum((l["taxable"] for l in lines), ZERO),
        "tax_amount": sum((l["tax"] for l in lines), ZERO),
        "total": sum((l["line_total"] for l in lines), ZERO),
        # One rate for the whole bill when every line shares it, else 0 (see the lines).
        "tax_rate": rates.pop() if len(rates) == 1 else ZERO,
        "prices_include_tax": bool(inclusive),
        "gst_summary": gst_summary(lines),
    }
