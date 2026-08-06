---
name: scope-guard
description: Use when evaluating feature requests or scope changes — lists what is OUT OF SCOPE and the guard clause for stopping work
---

## OUT OF SCOPE — Do NOT Build

| Feature | Reason |
|---------|--------|
| Recipe BOM / Bill of Materials | Too complex for Myanmar coffee shops |
| Auto-deduct ingredients on sale | Requires precise recipes; shops don't track this |
| Per-drink COGS calculation | Monthly profit (Revenue − Purchases) is sufficient |
| Consumption log per ingredient | No auto-deduction means no consumption to log |
| UOM conversion system | Not needed without recipe tracking |
| Waste tracking per recipe | No recipe tracking; use low stock alerts instead |
| Kitchen Display System (KDS) | Not practical in Myanmar; use thermal printer |
| Multi-currency / exchange rates | MMK only |

## Guard Clause

If a request implies any of the following → **STOP and ask before proceeding:**
- BOM / Bill of Materials / recipe ingredient tracking
- COGS calculation per product or per sale
- Consumption logging per ingredient
- Kitchen Display System / KDS screens
- Multi-currency support or exchange rate integration
- UOM conversion tables or logic
