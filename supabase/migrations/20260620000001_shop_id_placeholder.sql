-- ================================================================
-- MULTI-TENANCY FOUNDATION: shop_id Placeholder Migration
-- Generated on: June 20, 2026
-- Description:
--   Chunk 1 of multi-tenant migration. Schema-only — no RLS
--   changes, no service layer changes. Zero behavior change.
--   POS continues to work identically after this migration.
--
--   1. Create `shops` table with default shop row
--   2. Create `shop_memberships` table
--   3. Add `shop_id` to all 13 existing tables
--   4. Backfill all existing rows with default shop
--   5. Set NOT NULL + DEFAULT + FK + INDEX on all shop_id columns
--   6. Create 5 alert tables (born with shop_id from day one)
--
--   Default shop UUID: 4f3dab19-144e-4a29-95a5-2ee82f160ce5
-- ================================================================

-- ================================================================
-- 1. CREATE SHOPS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    owner_id UUID,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================================================================
-- 2. CREATE SHOP_MEMBERSHIPS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS shop_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'manager', 'cashier')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, shop_id)
);

-- ================================================================
-- 3. INSERT DEFAULT SHOP
--    Uses existing store name from app_settings
-- ================================================================

INSERT INTO shops (id, name, address, phone, email)
SELECT
    '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid,
    COALESCE(store_name, 'CoffeeShop POS'),
    store_address,
    store_phone,
    store_email
FROM app_settings
LIMIT 1
ON CONFLICT DO NOTHING;

-- Fallback if app_settings is empty
INSERT INTO shops (id, name)
VALUES ('4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid, 'CoffeeShop POS')
ON CONFLICT DO NOTHING;

-- ================================================================
-- 4. SEED SHOP_MEMBERSHIPS
--    All existing users become members of default shop
--    with their current role from public.users
-- ================================================================

INSERT INTO shop_memberships (user_id, shop_id, role, is_active)
SELECT
    u.id,
    '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid,
    COALESCE(u.role, 'cashier'),
    COALESCE(u.active, true)
FROM users u
ON CONFLICT (user_id, shop_id) DO NOTHING;

-- ================================================================
-- 5. ADD shop_id TO ALL EXISTING TABLES
--    Phase 1: Add as nullable column (no disruption)
-- ================================================================

-- app_settings
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS shop_id UUID;

-- categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS shop_id UUID;

-- customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shop_id UUID;

-- suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS shop_id UUID;

-- products
ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_id UUID;

-- product_batches
ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS shop_id UUID;

-- discounts
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS shop_id UUID;

-- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_id UUID;

-- sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shop_id UUID;

-- sales_tabs
ALTER TABLE sales_tabs ADD COLUMN IF NOT EXISTS shop_id UUID;

-- currency_config
ALTER TABLE currency_config ADD COLUMN IF NOT EXISTS shop_id UUID;

-- exchange_rates
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS shop_id UUID;

-- exchange_rate_history
ALTER TABLE exchange_rate_history ADD COLUMN IF NOT EXISTS shop_id UUID;

-- ================================================================
-- 6. BACKFILL ALL ROWS WITH DEFAULT SHOP
-- ================================================================

UPDATE app_settings SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE categories SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE customers SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE suppliers SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE products SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE product_batches SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE discounts SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE users SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE sales SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE sales_tabs SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE currency_config SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE exchange_rates SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;
UPDATE exchange_rate_history SET shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid WHERE shop_id IS NULL;

-- ================================================================
-- 7. SET NOT NULL + DEFAULT + FK CONSTRAINTS
--    Phase 2: Lock columns after backfill
-- ================================================================

-- app_settings
ALTER TABLE app_settings ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE app_settings ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE app_settings ADD CONSTRAINT fk_app_settings_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- categories
ALTER TABLE categories ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE categories ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE categories ADD CONSTRAINT fk_categories_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- customers
ALTER TABLE customers ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE customers ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE customers ADD CONSTRAINT fk_customers_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- suppliers
ALTER TABLE suppliers ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE suppliers ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE suppliers ADD CONSTRAINT fk_suppliers_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- products
ALTER TABLE products ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE products ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE products ADD CONSTRAINT fk_products_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- product_batches
ALTER TABLE product_batches ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE product_batches ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE product_batches ADD CONSTRAINT fk_product_batches_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- discounts
ALTER TABLE discounts ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE discounts ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE discounts ADD CONSTRAINT fk_discounts_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- users
ALTER TABLE users ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE users ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- sales
ALTER TABLE sales ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE sales ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE sales ADD CONSTRAINT fk_sales_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- sales_tabs
ALTER TABLE sales_tabs ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE sales_tabs ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE sales_tabs ADD CONSTRAINT fk_sales_tabs_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- currency_config
ALTER TABLE currency_config ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE currency_config ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE currency_config ADD CONSTRAINT fk_currency_config_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- exchange_rates
ALTER TABLE exchange_rates ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE exchange_rates ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE exchange_rates ADD CONSTRAINT fk_exchange_rates_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- exchange_rate_history
ALTER TABLE exchange_rate_history ALTER COLUMN shop_id SET DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
ALTER TABLE exchange_rate_history ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE exchange_rate_history ADD CONSTRAINT fk_exchange_rate_history_shop FOREIGN KEY (shop_id) REFERENCES shops(id);

-- ================================================================
-- 8. INDEXES ON ALL shop_id FK COLUMNS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_app_settings_shop_id ON app_settings(shop_id);
CREATE INDEX IF NOT EXISTS idx_categories_shop_id ON categories(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_shop_id ON suppliers(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_shop_id ON product_batches(shop_id);
CREATE INDEX IF NOT EXISTS idx_discounts_shop_id ON discounts(shop_id);
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_tabs_shop_id ON sales_tabs(shop_id);
CREATE INDEX IF NOT EXISTS idx_currency_config_shop_id ON currency_config(shop_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_shop_id ON exchange_rates(shop_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_shop_id ON exchange_rate_history(shop_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sales_shop_created_at ON sales(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_products_shop_active ON products(shop_id, active);
CREATE INDEX IF NOT EXISTS idx_customers_shop_name ON customers(shop_id, name);
CREATE INDEX IF NOT EXISTS idx_sales_tabs_shop_user ON sales_tabs(shop_id, user_id);

-- ================================================================
-- 9. SHOP MEMBERSHIPS INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_shop_memberships_user_id ON shop_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_memberships_shop_id ON shop_memberships(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_memberships_user_shop ON shop_memberships(user_id, shop_id);

-- ================================================================
-- 10. UPDATED_AT TRIGGERS FOR NEW TABLES
-- ================================================================

CREATE TRIGGER update_shops_updated_at
    BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_memberships_updated_at
    BEFORE UPDATE ON shop_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 11. ENABLE RLS ON NEW TABLES
--    Policies will be added in Chunk 2 (RLS rewrite)
-- ================================================================

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_memberships ENABLE ROW LEVEL SECURITY;

-- Temporary permissive policies for Chunk 1 (no behavior change)
-- These will be replaced in Chunk 2 with proper role-aware policies
CREATE POLICY "Shops viewable by all authenticated" ON shops
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Shops write by all authenticated" ON shops
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Shop memberships viewable by all authenticated" ON shop_memberships
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Shop memberships write by all authenticated" ON shop_memberships
  FOR ALL USING (auth.role() = 'authenticated');

-- ================================================================
-- 12. CREATE ALERT TABLES (born with shop_id)
--     These tables exist in service layer code but not in DB.
--     Creating them here with shop_id from day one.
-- ================================================================

-- Alert Recipients
CREATE TABLE IF NOT EXISTS alert_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid REFERENCES shops(id),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager', 'cashier')),
    alert_types TEXT[] DEFAULT '{"low_stock", "out_of_stock"}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alert Templates
CREATE TABLE IF NOT EXISTS alert_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid REFERENCES shops(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('low_stock', 'out_of_stock', 'reorder', 'expiry_warning', 'batch_expiry')),
    channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'both')),
    subject TEXT,
    body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alert Configurations
CREATE TABLE IF NOT EXISTS alert_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid REFERENCES shops(id),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'reorder', 'expiry_warning', 'batch_expiry')),
    is_enabled BOOLEAN DEFAULT true,
    threshold_value INTEGER DEFAULT 150,
    check_frequency_minutes INTEGER DEFAULT 60,
    cooldown_minutes INTEGER DEFAULT 1440,
    email_template_id UUID,
    sms_template_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alert History
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid REFERENCES shops(id),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'reorder', 'expiry_warning', 'batch_expiry')),
    product_id UUID,
    product_name TEXT,
    product_sku TEXT,
    current_stock INTEGER,
    min_stock INTEGER,
    threshold_value INTEGER,
    recipient_id UUID,
    recipient_name TEXT,
    recipient_email TEXT,
    recipient_phone TEXT,
    channel TEXT CHECK (channel IN ('email', 'sms')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    template_id UUID,
    message_content TEXT,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Notification Service Config
CREATE TABLE IF NOT EXISTS notification_service_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid REFERENCES shops(id),
    service_name TEXT NOT NULL,
    service_type TEXT NOT NULL DEFAULT 'email' CHECK (service_type IN ('email', 'sms', 'both')),
    config_data JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================================================================
-- 13. ALERT TABLES: INDEXES + TRIGGERS + RLS
-- ================================================================

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alert_recipients_shop_id ON alert_recipients(shop_id);
CREATE INDEX IF NOT EXISTS idx_alert_templates_shop_id ON alert_templates(shop_id);
CREATE INDEX IF NOT EXISTS idx_alert_configurations_shop_id ON alert_configurations(shop_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_shop_id ON alert_history(shop_id);
CREATE INDEX IF NOT EXISTS idx_notification_service_config_shop_id ON notification_service_config(shop_id);

CREATE INDEX IF NOT EXISTS idx_alert_history_product_id ON alert_history(product_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_recipient_id ON alert_history(recipient_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at);

-- Triggers
CREATE TRIGGER update_alert_recipients_updated_at
    BEFORE UPDATE ON alert_recipients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_templates_updated_at
    BEFORE UPDATE ON alert_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_configurations_updated_at
    BEFORE UPDATE ON alert_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_service_config_updated_at
    BEFORE UPDATE ON notification_service_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (temporary permissive — Chunk 2 will add role-aware policies)
ALTER TABLE alert_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_service_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alert recipients viewable by all authenticated" ON alert_recipients
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Alert recipients write by all authenticated" ON alert_recipients
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Alert templates viewable by all authenticated" ON alert_templates
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Alert templates write by all authenticated" ON alert_templates
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Alert configurations viewable by all authenticated" ON alert_configurations
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Alert configurations write by all authenticated" ON alert_configurations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Alert history viewable by all authenticated" ON alert_history
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Alert history write by all authenticated" ON alert_history
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Notification service config viewable by all authenticated" ON notification_service_config
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Notification service config write by all authenticated" ON notification_service_config
  FOR ALL USING (auth.role() = 'authenticated');

-- ================================================================
-- 14. GRANT PERMISSIONS ON NEW TABLES
-- ================================================================

GRANT ALL ON shops TO authenticated;
GRANT ALL ON shop_memberships TO authenticated;
GRANT ALL ON alert_recipients TO authenticated;
GRANT ALL ON alert_templates TO authenticated;
GRANT ALL ON alert_configurations TO authenticated;
GRANT ALL ON alert_history TO authenticated;
GRANT ALL ON notification_service_config TO authenticated;

-- ================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ================================================================

-- Verify all tables have shop_id:
-- SELECT table_name FROM information_schema.columns
-- WHERE column_name = 'shop_id' AND table_schema = 'public'
-- ORDER BY table_name;
-- Expected: 18 rows (13 existing + 5 alert tables + shops + shop_memberships... minus shops itself = 18)

-- Verify no NULL shop_id remains:
-- SELECT 'app_settings' AS t, COUNT(*) FROM app_settings WHERE shop_id IS NULL
-- UNION ALL SELECT 'products', COUNT(*) FROM products WHERE shop_id IS NULL
-- UNION ALL SELECT 'sales', COUNT(*) FROM sales WHERE shop_id IS NULL;
-- Expected: all 0

-- Verify default shop exists:
-- SELECT id, name FROM shops WHERE id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5';

-- Verify memberships seeded:
-- SELECT u.email, sm.role FROM shop_memberships sm JOIN users u ON u.id = sm.user_id;

-- ================================================================
-- MIGRATION COMPLETE — CHUNK 1 DONE
-- No behavior change. POS works identically.
-- Next: Chunk 2 (RLS rewrite with shop_id scoping)
-- ================================================================
