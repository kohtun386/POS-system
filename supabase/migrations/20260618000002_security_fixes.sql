-- ================================================================
-- SECURITY FIXES: Audit Remediations — June 18, 2026
-- ================================================================
-- 1. Fix users INSERT policy — was WITH CHECK(true), now scoped to own profile
-- 2. Revoke client-side EXECUTE on SECURITY DEFINER rls_auto_enable()
-- 3. Apply role-aware RLS to currency_config, exchange_rates, exchange_rate_history
-- 4. Add SET search_path = '' to all 7 public functions
-- ================================================================

-- ================================================================
-- 1. USERS INSERT POLICY FIX
--    Old: WITH CHECK(true) — any authenticated user could insert any role
--    New: WITH CHECK(auth.uid() = id) — can only insert own profile
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can insert their own profile" ON users;

CREATE POLICY "Users can only insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ================================================================
-- 2. RLS_AUTO_ENABLE() — REVOKE FROM CLIENT ROLES
--    This SECURITY DEFINER function runs as event trigger.
--    No client (anon/authenticated) should call it via RPC.
-- ================================================================
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- ================================================================
-- 3. CURRENCY / EXCHANGE TABLES — ROLE-AWARE RLS
--    Old: blanket auth.role()='authenticated' FOR ALL
--    New: SELECT for all, write only for admin/manager
-- ================================================================

-- Drop old blanket policies
DROP POLICY IF EXISTS "Currency config is viewable by authenticated users" ON currency_config;
DROP POLICY IF EXISTS "Currency config is editable by authenticated users" ON currency_config;
DROP POLICY IF EXISTS "Exchange rates are viewable by authenticated users" ON exchange_rates;
DROP POLICY IF EXISTS "Exchange rates are editable by authenticated users" ON exchange_rates;
DROP POLICY IF EXISTS "Exchange rate history is viewable by authenticated users" ON exchange_rate_history;
DROP POLICY IF EXISTS "Exchange rate history is editable by authenticated users" ON exchange_rate_history;

-- Currency Config
CREATE POLICY "Currency config viewable by all authenticated" ON currency_config
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Currency config write by admin/manager" ON currency_config
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Exchange Rates
CREATE POLICY "Exchange rates viewable by all authenticated" ON exchange_rates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Exchange rates write by admin/manager" ON exchange_rates
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Exchange Rate History
CREATE POLICY "Exchange rate history viewable by all authenticated" ON exchange_rate_history
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Exchange rate history write by admin/manager" ON exchange_rate_history
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

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

-- 4e. Get current exchange rate
CREATE OR REPLACE FUNCTION get_current_exchange_rate(
    p_base_currency TEXT,
    p_target_currency TEXT
)
RETURNS DECIMAL(15,8)
SET search_path = ''
AS $$
DECLARE
    current_rate DECIMAL(15,8);
BEGIN
    IF p_base_currency = p_target_currency THEN
        RETURN 1.0;
    END IF;

    SELECT rate INTO current_rate
    FROM exchange_rates
    WHERE base_currency = p_base_currency
      AND target_currency = p_target_currency
      AND (effective_to IS NULL OR effective_to > NOW())
    ORDER BY effective_from DESC
    LIMIT 1;

    IF current_rate IS NULL THEN
        SELECT (1.0 / rate) INTO current_rate
        FROM exchange_rates
        WHERE base_currency = p_target_currency
          AND target_currency = p_base_currency
          AND (effective_to IS NULL OR effective_to > NOW())
        ORDER BY effective_from DESC
        LIMIT 1;
    END IF;

    RETURN COALESCE(current_rate, 1.0);
END;
$$ LANGUAGE plpgsql;

-- 4f. Convert currency amount
CREATE OR REPLACE FUNCTION convert_currency_amount(
    p_amount DECIMAL(12,2),
    p_from_currency TEXT,
    p_to_currency TEXT
)
RETURNS DECIMAL(12,2)
SET search_path = ''
AS $$
DECLARE
    exchange_rate DECIMAL(15,8);
    converted_amount DECIMAL(12,2);
BEGIN
    exchange_rate := get_current_exchange_rate(p_from_currency, p_to_currency);
    converted_amount := p_amount * exchange_rate;
    RETURN converted_amount;
END;
$$ LANGUAGE plpgsql;

-- 4g. Update exchange rate with history tracking
CREATE OR REPLACE FUNCTION update_exchange_rate(
    p_base_currency TEXT,
    p_target_currency TEXT,
    p_rate DECIMAL(15,8),
    p_source TEXT DEFAULT 'api',
    p_is_manual_override BOOLEAN DEFAULT false
)
RETURNS VOID
SET search_path = ''
AS $$
DECLARE
    previous_rate DECIMAL(15,8);
    change_percentage DECIMAL(8,4);
BEGIN
    SELECT rate INTO previous_rate
    FROM exchange_rates
    WHERE base_currency = p_base_currency
      AND target_currency = p_target_currency
      AND (effective_to IS NULL OR effective_to > NOW())
    ORDER BY effective_from DESC
    LIMIT 1;

    IF previous_rate IS NOT NULL AND previous_rate > 0 THEN
        change_percentage := ((p_rate - previous_rate) / previous_rate) * 100;
    END IF;

    UPDATE exchange_rates
    SET effective_to = NOW()
    WHERE base_currency = p_base_currency
      AND target_currency = p_target_currency
      AND effective_to IS NULL;

    INSERT INTO exchange_rates (base_currency, target_currency, rate, source, is_manual_override)
    VALUES (p_base_currency, p_target_currency, p_rate, p_source, p_is_manual_override);

    INSERT INTO exchange_rate_history (base_currency, target_currency, rate, previous_rate, change_percentage, source, is_manual_override)
    VALUES (p_base_currency, p_target_currency, p_rate, previous_rate, change_percentage, p_source, p_is_manual_override);
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SECURITY FIXES COMPLETE
-- ================================================================
