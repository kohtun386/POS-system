# Recipe Bill of Materials (BOM) — Design Specification

> **⚠️ DEPRECATED — Out of Scope for v1**
>
> **Why:** Myanmar coffee shops buy supplies in bulk and sell finished drinks. They do not track exact ingredient usage per recipe. The BOM/auto-deduction model is too complex for the target market.
>
> **Replacement:** See [docs/specs/inventory-model.md](inventory-model.md) for the simplified inventory model (purchase log, stock overview, low stock alerts, simple profit report).
>
> **Database tables** (`raw_materials`, `recipes`, `recipe_lines`, `consumption_log`, `uom_conversions`) remain in the schema for forward compatibility but are not used by the simplified inventory workflow.
