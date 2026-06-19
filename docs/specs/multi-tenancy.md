# Multi-Tenant Readiness — Gap Analysis

**Status:** Not yet scoped for implementation. Single-tenant only.

**Current state:** Zero tenant isolation. Every table (`products`, `customers`, `sales`, `users`, `discounts`, `sales_tabs`, `categories`, `suppliers`) has no `shop_id` column. RLS policies check role only — any authenticated user sees ALL data. A shop in Yangon can see sales from a shop in Colombo. Fine for one shop. Breaks for multiple.

---

## Schema Overhaul — Every Core Table Needs `shop_id`

```sql
ALTER TABLE products ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE customers ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE sales ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE discounts ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE categories ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE suppliers ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE sales_tabs ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
```

Full analysis and migration strategy: see `docs/architecture/foundation-phase-analysis.md`.

### New Tables Required

- **`shops`** — `id`, `name`, `address`, `phone`, `owner_id`, `subscription_tier`, `is_active`, `created_at`
- **`shop_memberships`** — `user_id`, `shop_id`, `role` (per-shop role, not global). A user could be admin at Shop A and cashier at Shop B.

### RLS Rewrite — Every Policy Gets `AND shop_id = ...`

Current:
```sql
CREATE POLICY "Products viewable by all authenticated" ON products
  FOR SELECT USING (auth.role() = 'authenticated');
```

Must become:
```sql
CREATE POLICY "Products viewable by own shop members" ON products
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (
      SELECT shop_id FROM shop_memberships WHERE user_id = auth.uid()
    )
  );
```

Every policy on every table (~25 policies) needs this AND clause.

### Auth Model Changes

- `users.role` becomes a global default, not per-shop authority. Move role decisions to `shop_memberships`.
- Supabase Auth has no built-in multi-tenant concept. Handle via `public.users` + `shop_memberships`.

### Frontend Changes

- Shop selector on login (if user belongs to multiple shops)
- All service calls filter by `shop_id` implicitly (via RLS) or explicitly (via `.eq('shop_id', currentShopId)`)
- `app_settings` either scoped per-shop or shared with per-shop overrides

### Migration Path

1. Create `shops` table, seed with default shop from existing data
2. Create `shop_memberships`, seed all existing users as members of default shop
3. Add `shop_id` columns (nullable initially)
4. Backfill all existing rows with default shop_id
5. Make `shop_id NOT NULL`
6. Rewrite all RLS policies
7. Update frontend service layer
8. Add shop selector UI

**Estimated effort:** 2-3 weeks full-time (schema + RLS + frontend).

### Alternative if managing < 5 shops

Create one Supabase project per shop instead of implementing full multi-tenant. Simpler to maintain, harder to scale past ~10 shops (migration sync pain). Migrate to full multi-tenant when cross-shop reporting becomes a requirement.
