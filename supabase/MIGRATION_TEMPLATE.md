# Migration Template

## ⚠️ CRITICAL: Avoid RLS Recursion

When creating RLS policies:

- **NEVER** call functions that query the same table the policy is on
- If you need `current_shop_ids()`, ensure it doesn't query `shop_memberships`
- Use direct subqueries instead of function calls when possible
- Test: `CREATE POLICY` → immediately test with `SELECT` → check for recursion

### Common recursion patterns to avoid

```
❌ Policy on shop_memberships → calls current_shop_ids() → queries shop_memberships
✅ Policy on shop_memberships → direct subquery → no function call
```

### The `current_shop_ids()` function

```sql
-- This function queries shop_memberships
CREATE OR REPLACE FUNCTION public.current_shop_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
    SELECT shop_id FROM public.shop_memberships
    WHERE user_id = auth.uid() AND is_active = true;
$$;
```

**NEVER** use `current_shop_ids()` in any policy ON `shop_memberships`.

### Safe pattern for shop_memberships policies

```sql
-- ✅ Safe: direct aliased subquery
CREATE POLICY "example" ON public.shop_memberships
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN (
      SELECT sm.shop_id FROM public.shop_memberships sm
      WHERE sm.user_id = auth.uid() AND sm.is_active = true
    ))
    AND (EXISTS (
      SELECT 1 FROM public.shop_memberships sm
      WHERE sm.user_id = auth.uid()
      AND sm.role = 'admin'::text
      AND sm.is_active = true
    ))
  );
```

---

## Migration Checklist

- [ ] No circular dependencies in RLS policies
- [ ] No `current_shop_ids()` calls in policies on `shop_memberships`
- [ ] Tested with SELECT after creation
- [ ] Both local and cloud databases updated
- [ ] Verified endpoints return 200 OK
