-- ================================================================
-- SECURITY FIXES: Audit Remediations — June 18, 2026
-- ================================================================
-- 1. Fix users INSERT policy — was WITH CHECK(true), now scoped to own profile
-- 2. (removed in v3.1.0 — rls_auto_enable() not in v3.1.0 schema)
-- 3. (removed in v3.1.0 — currency/exchange tables are out of scope)
-- 4. Add SET search_path = '' to core public functions
-- ================================================================

-- ================================================================
-- 1. USERS INSERT POLICY FIX
--    Old: WITH CHECK(true) — any authenticated user could insert any role
--    New: WITH CHECK(auth.uid() = id) — can only insert own profile
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can insert their own profile" ON users;

CREATE POLICY "Users can only insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. (removed in v3.1.0 — rls_auto_enable() was a legacy event trigger
--    from a deleted migration; no longer in use)

-- NOTE: Section 3 (currency/exchange tables RLS) removed in v3.1.0.
-- Those tables are out of scope (dead features). If they exist at
-- migration time from a prior init.sql, no policy on them is safer
-- than a permissive one. They'll be dropped in a subsequent cleanup.

-- ================================================================
-- 4. FUNCTION SEARCH_PATH HARDENING
--    All 7 public functions lacked explicit search_path, making them
--    vulnerable to search-path injection (Supabase advisory #0011).
--    Adding SET search_path = '' locks them to pg_catalog only.
-- ================================================================

-- 4a. Trigger: update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4b. Invoice number generator
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
SET search_path = ''
AS $$
DECLARE
    prefix TEXT;
    counter INTEGER;
    new_invoice_number TEXT;
BEGIN
    SELECT invoice_prefix, invoice_counter
    INTO prefix, counter
    FROM app_settings
    LIMIT 1;

    IF prefix IS NULL THEN prefix := 'INV'; END IF;
    IF counter IS NULL THEN counter := 1000; END IF;

    new_invoice_number := prefix || '-' || LPAD(counter::TEXT, 6, '0');

    UPDATE app_settings
    SET invoice_counter = counter + 1,
        updated_at = timezone('utc'::text, now());

    RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- 4c. Trigger: update_customer_stats
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
    IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' THEN
        UPDATE customers
        SET
            total_purchases = total_purchases + NEW.total,
            last_purchase = NEW.created_at,
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.customer_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4d. Trigger: auto_generate_invoice_number
CREATE OR REPLACE FUNCTION auto_generate_invoice_number()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4e-4g: Currency/exchange rate functions removed in v3.1.0.
-- Those reference dead exchange_rates/exchange_rate_history tables.

-- ================================================================
-- SECURITY FIXES COMPLETE
-- ================================================================
