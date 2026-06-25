-- ================================================================
-- Migration: Feature Flags — Per-Shop Feature Toggling
-- Date: June 24, 2026
-- Description:
--   Creates feature_definitions (platform-level catalog) and
--   shop_features (per-shop overrides). Seeds 13 features.
-- ================================================================

-- ================================================================
-- 1. TABLE: feature_definitions — Platform-Level Feature Catalog
-- ================================================================

CREATE TABLE feature_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  default_enabled BOOLEAN NOT NULL DEFAULT true,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================
-- 2. TABLE: shop_features — Per-Shop Overrides
--    Only stores rows that deviate from the default.
-- ================================================================

CREATE TABLE shop_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES feature_definitions(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, feature_key)
);

-- ================================================================
-- 3. INDEXES
-- ================================================================

CREATE INDEX idx_shop_features_shop_id ON shop_features(shop_id);
CREATE INDEX idx_shop_features_feature_key ON shop_features(feature_key);
CREATE INDEX idx_feature_definitions_category ON feature_definitions(category);

-- ================================================================
-- 4. RLS POLICIES
-- ================================================================

-- feature_definitions: readable by all authenticated, writable by admin only
ALTER TABLE feature_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feature definitions viewable by all authenticated"
  ON feature_definitions
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Feature definitions writable by platform admin"
  ON feature_definitions
  FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- shop_features: readable by shop members, writable by shop admin
ALTER TABLE shop_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop features viewable by shop members"
  ON shop_features
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Shop features writable by shop admin"
  ON shop_features
  FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.shop_memberships sm
      WHERE sm.user_id = auth.uid()
      AND sm.shop_id = shop_features.shop_id
      AND sm.role = 'admin'
    )
  );

-- ================================================================
-- 5. SEED DATA — 13 Feature Definitions
-- ================================================================

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier) VALUES
  ('inventory_tracking',   'Inventory Tracking',     'Track and manage product stock levels', 'inventory',  true,  'free'),
  ('batch_tracking',       'Batch Tracking',         'Track product batches with expiry dates', 'inventory',  true,  'free'),
  ('weight_based_products','Weight-Based Products',   'Sell products by weight instead of unit', 'inventory',  true,  'free'),
  ('customer_management',  'Customer Management',     'Track customers, purchase history, and credit', 'customers',  true,  'free'),
  ('credit_system',        'Customer Credit System',  'Allow customers to buy on credit and track balances', 'customers',  true,  'free'),
  ('discount_engine',      'Discount Engine',         'Apply percentage, fixed, and BOGO discounts', 'pos',        true,  'free'),
  ('multi_currency',       'Multi-Currency Support',  'Support multiple currencies with exchange rates', 'general',    true,  'free'),
  ('draft_sales',          'Draft Sales',             'Save sales as drafts before completing', 'pos',        true,  'free'),
  ('multi_tab_sales',      'Multi-Tab Sales',         'Multiple open sales tabs per user', 'pos',        true,  'free'),
  ('kitchen_display',      'Kitchen Display System',  'Kitchen display for order preparation', 'kitchen',    false, 'pro'),
  ('online_ordering',      'Online Ordering',         'Accept online orders from customers', 'pos',        false, 'pro'),
  ('advanced_reports',     'Advanced Reports',        'Advanced analytics and reporting dashboard', 'general',    false, 'pro'),
  ('supplier_management',  'Supplier Management',     'Track suppliers and purchase orders', 'inventory',  false, 'pro');

-- ================================================================
-- VERIFICATION
-- ================================================================

-- SELECT key, name, category, default_enabled FROM feature_definitions ORDER BY category, key;
-- SELECT COUNT(*) AS total_definitions FROM feature_definitions;  -- Expected: 13

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
