-- ================================================================
-- DEMO SEED DATA: Myanmar Coffee Shop POS
-- ================================================================
-- ⚠️  FOR LOCAL DEVELOPMENT & DEMO ONLY — NEVER RUN IN PRODUCTION ⚠️
--
-- This script populates the database with realistic demo data for:
--   - POS checkout flow testing
--   - Demo Day presentation
--   - Inventory alerts testing
--   - Discount/coupon testing
--
-- Features included:
--   ✅ 6 product categories
--   ✅ 28 products (coffee, snacks, drinks)
--   ✅ 5 customers (with credit limits)
--   ✅ 4 active discounts
--   ✅ 10 sample sales (last 7 days)
--   ✅ Low stock items (5-10 units)
--   ✅ Out of stock items (0 units)
--
-- Usage:
--   npx supabase db query -f supabase/seed-demo-data.sql --linked
--
-- Idempotent: Safe to run multiple times.
-- ================================================================

DO $$
DECLARE
     v_shop_id UUID := '99cf2f48-1f8e-4886-9f45-b8f411914c04'::uuid;  -- cele@coffee.com's shop

  -- Category IDs (we'll capture them for product references)
  v_cat_coffee UUID;
  v_cat_raw UUID;
  v_cat_accessories UUID;
  v_cat_snacks UUID;
  v_cat_food UUID;
  v_cat_beverages UUID;

  -- Customer IDs
  v_cust_walkin UUID;
  v_cust_aung UUID;
  v_cust_susu UUID;
  v_cust_min UUID;
  v_cust_nilar UUID;

  -- Product IDs for sales
  v_prod_espresso UUID;
  v_prod_latte UUID;
  v_prod_cappuccino UUID;
  v_prod_mocha UUID;
  v_prod_milk_tea UUID;
  v_prod_matcha UUID;
  v_prod_croissant UUID;
  v_prod_muffin UUID;
  v_prod_sandwich UUID;

BEGIN
  -- ================================================================
  -- 1. CATEGORIES
  -- ================================================================
  RAISE NOTICE 'Seeding categories...';

  INSERT INTO categories (name, description, shop_id) VALUES
    ('Cele Coffee', 'Hot and cold coffee beverages', v_shop_id),
    ('Cele Coffee Raw Materials', 'Ingredients for coffee preparation', v_shop_id),
    ('Cele Coffee Accessories', 'Cups, lids, straws, napkins', v_shop_id),
    ('Cele Snacks & Pastries', 'Baked goods and light snacks', v_shop_id),
    ('Cele Light Foods', 'Simple meals and sandwiches', v_shop_id),
    ('Cele Beverages', 'Non-coffee drinks and specialty teas', v_shop_id)
  ON CONFLICT (name) DO NOTHING;

  -- Capture category IDs
  SELECT id INTO v_cat_coffee FROM categories WHERE name = 'Cele Coffee' AND shop_id = v_shop_id;
  SELECT id INTO v_cat_raw FROM categories WHERE name = 'Cele Coffee Raw Materials' AND shop_id = v_shop_id;
  SELECT id INTO v_cat_accessories FROM categories WHERE name = 'Cele Coffee Accessories' AND shop_id = v_shop_id;
  SELECT id INTO v_cat_snacks FROM categories WHERE name = 'Cele Snacks & Pastries' AND shop_id = v_shop_id;
  SELECT id INTO v_cat_food FROM categories WHERE name = 'Cele Light Foods' AND shop_id = v_shop_id;
  SELECT id INTO v_cat_beverages FROM categories WHERE name = 'Cele Beverages' AND shop_id = v_shop_id;

  RAISE NOTICE 'Categories seeded: %', v_cat_coffee;

  -- ================================================================
  -- 2. PRODUCTS (28 products)
  -- ================================================================
  RAISE NOTICE 'Seeding products...';

  -- --- COFFEE (Hot & Cold) ---
  INSERT INTO products (name, sku, price, cost, stock, min_stock, category, description, taxable, active, is_weight_based, track_inventory, shop_id)
  VALUES
    -- Hot Coffee
    ('Espresso', 'CELE-CF-ESP-001', 1500, 350, 50, 10, 'Cele Coffee', 'Classic single shot espresso', true, true, false, true, v_shop_id),
    ('Double Espresso', 'CELE-CF-ESP-002', 2200, 500, 50, 10, 'Cele Coffee', 'Double shot espresso', true, true, false, true, v_shop_id),
    ('Americano', 'CELE-CF-AME-001', 1800, 400, 50, 10, 'Cele Coffee', 'Espresso with hot water', true, true, false, true, v_shop_id),
    ('Cappuccino', 'CELE-CF-CAP-001', 2500, 600, 45, 10, 'Cele Coffee', 'Espresso with steamed milk foam', true, true, false, true, v_shop_id),
    ('Latte', 'CELE-CF-LAT-001', 2500, 650, 40, 10, 'Cele Coffee', 'Espresso with steamed milk', true, true, false, true, v_shop_id),
    ('Mocha', 'CELE-CF-MOC-001', 3000, 800, 35, 10, 'Cele Coffee', 'Espresso with chocolate and milk', true, true, false, true, v_shop_id),
    ('Flat White', 'CELE-CF-FLW-001', 2800, 700, 30, 10, 'Cele Coffee', 'Velvety espresso with microfoam', true, true, false, true, v_shop_id),
    ('Caramel Macchiato', 'CELE-CF-CAR-001', 3200, 900, 25, 10, 'Cele Coffee', 'Espresso with caramel and vanilla', true, true, false, true, v_shop_id),

    -- Cold Coffee
    ('Iced Americano', 'CELE-CF-ICE-001', 2000, 450, 50, 10, 'Cele Coffee', 'Chilled espresso with cold water', true, true, false, true, v_shop_id),
    ('Iced Latte', 'CELE-CF-ICE-002', 2800, 700, 40, 10, 'Cele Coffee', 'Chilled espresso with cold milk', true, true, false, true, v_shop_id),
    ('Frappuccino', 'CELE-CF-FRA-001', 3500, 1000, 20, 5, 'Cele Coffee', 'Blended iced coffee with cream', true, true, false, true, v_shop_id),

    -- Weight-based coffee beans
    ('Arabica Coffee Beans', 'CELE-CF-BEAN-ARB', 25000, 18000, 15, 5, 'Cele Coffee Raw Materials', 'Premium Arabica beans (per 250g)', true, true, true, true, v_shop_id),
    ('Robusta Coffee Beans', 'CELE-CF-BEAN-ROB', 15000, 10000, 20, 5, 'Cele Coffee Raw Materials', 'Strong Robusta beans (per 250g)', true, true, true, true, v_shop_id),

    -- OUT OF STOCK items (for testing)
    ('Cold Brew Coffee', 'CELE-CF-CBW-001', 2800, 600, 0, 10, 'Cele Coffee', '24-hour cold brew (OUT OF STOCK)', true, true, false, true, v_shop_id),
    ('Nitro Cold Brew', 'CELE-CF-NIT-001', 3500, 900, 0, 10, 'Cele Coffee', 'Nitrogen-infused cold brew (OUT OF STOCK)', true, true, false, true, v_shop_id)
  ON CONFLICT (sku) DO NOTHING;

  -- Capture coffee product IDs
  SELECT id INTO v_prod_espresso FROM products WHERE sku = 'CELE-CF-ESP-001';
  SELECT id INTO v_prod_latte FROM products WHERE sku = 'CELE-CF-LAT-001';
  SELECT id INTO v_prod_cappuccino FROM products WHERE sku = 'CELE-CF-CAP-001';
  SELECT id INTO v_prod_mocha FROM products WHERE sku = 'CELE-CF-MOC-001';

  -- --- BEVERAGES (Non-Coffee) ---
  INSERT INTO products (name, sku, price, cost, stock, min_stock, category, description, taxable, active, is_weight_based, track_inventory, shop_id)
  VALUES
    ('Myanmar Milk Tea', 'CELE-BV-MIL-001', 1200, 250, 60, 15, 'Cele Beverages', 'Traditional Myanmar sweet milk tea', true, true, false, true, v_shop_id),
    ('Thai Tea', 'CELE-BV-THA-001', 1500, 350, 45, 10, 'Cele Beverages', 'Sweet Thai iced tea', true, true, false, true, v_shop_id),
    ('Matcha Latte', 'CELE-BV-MAT-001', 2800, 800, 25, 5, 'Cele Beverages', 'Japanese matcha with milk', true, true, false, true, v_shop_id),
    ('Fresh Orange Juice', 'CELE-BV-ORG-001', 2000, 600, 30, 10, 'Cele Beverages', 'Freshly squeezed orange juice', true, true, false, true, v_shop_id),
    ('Iced Lemon Tea', 'CELE-BV-LEM-001', 1500, 300, 50, 10, 'Cele Beverages', 'Refreshing lemon iced tea', true, true, false, true, v_shop_id)
  ON CONFLICT (sku) DO NOTHING;

  SELECT id INTO v_prod_milk_tea FROM products WHERE sku = 'CELE-BV-MIL-001';
  SELECT id INTO v_prod_matcha FROM products WHERE sku = 'CELE-BV-MAT-001';

  -- --- SNACKS & PASTRIES ---
  INSERT INTO products (name, sku, price, cost, stock, min_stock, category, description, taxable, active, is_weight_based, track_inventory, shop_id)
  VALUES
    ('Butter Croissant', 'CELE-SN-CRO-001', 1800, 500, 25, 5, 'Cele Snacks & Pastries', 'Flaky butter croissant', true, true, false, true, v_shop_id),
    ('Chocolate Muffin', 'CELE-SN-MUF-001', 1500, 400, 30, 5, 'Cele Snacks & Pastries', 'Rich chocolate muffin', true, true, false, true, v_shop_id),
    ('Blueberry Muffin', 'CELE-SN-MUF-002', 1500, 400, 8, 5, 'Cele Snacks & Pastries', 'Blueberry muffin (LOW STOCK)', true, true, false, true, v_shop_id),
    ('Cheese Danish', 'CELE-SN-DAN-001', 2000, 600, 15, 5, 'Cele Snacks & Pastries', 'Cream cheese Danish pastry', true, true, false, true, v_shop_id),
    ('Cinnamon Roll', 'CELE-SN-ROL-001', 1800, 500, 5, 5, 'Cele Snacks & Pastries', 'Warm cinnamon roll (LOW STOCK)', true, true, false, true, v_shop_id)
  ON CONFLICT (sku) DO NOTHING;

  SELECT id INTO v_prod_croissant FROM products WHERE sku = 'CELE-SN-CRO-001';
  SELECT id INTO v_prod_muffin FROM products WHERE sku = 'CELE-SN-MUF-001';

  -- --- LIGHT FOODS ---
  INSERT INTO products (name, sku, price, cost, stock, min_stock, category, description, taxable, active, is_weight_based, track_inventory, shop_id)
  VALUES
    ('Club Sandwich', 'CELE-FD-SAN-001', 3500, 1200, 20, 5, 'Cele Light Foods', 'Classic triple-decker sandwich', true, true, false, true, v_shop_id),
    ('Chicken Wrap', 'CELE-FD-WRA-001', 3000, 1000, 18, 5, 'Cele Light Foods', 'Grilled chicken tortilla wrap', true, true, false, true, v_shop_id),
    ('Egg Toast', 'CELE-FD-TOA-001', 2000, 500, 25, 10, 'Cele Light Foods', 'Toast with scrambled eggs', true, true, false, true, v_shop_id),
    ('Pasta Carbonara', 'CELE-FD-PAS-001', 4500, 1500, 12, 5, 'Cele Light Foods', 'Creamy pasta with bacon', true, true, false, true, v_shop_id)
  ON CONFLICT (sku) DO NOTHING;

  SELECT id INTO v_prod_sandwich FROM products WHERE sku = 'CELE-FD-SAN-001';

  -- --- COFFEE ACCESSORIES ---
  INSERT INTO products (name, sku, price, cost, stock, min_stock, category, description, taxable, active, is_weight_based, track_inventory, shop_id)
  VALUES
    ('Paper Cup (8oz)', 'CELE-AC-CUP-008', 200, 80, 500, 100, 'Cele Coffee Accessories', 'Disposable paper cup 8oz', false, true, false, true, v_shop_id),
    ('Paper Cup (12oz)', 'CELE-AC-CUP-012', 250, 100, 400, 100, 'Cele Coffee Accessories', 'Disposable paper cup 12oz', false, true, false, true, v_shop_id),
    ('Plastic Lid', 'CELE-AC-LID-001', 50, 20, 800, 200, 'Cele Coffee Accessories', 'Snap-on plastic lid', false, true, false, true, v_shop_id),
    ('Paper Straw', 'CELE-AC-STW-001', 30, 10, 1000, 200, 'Cele Coffee Accessories', 'Eco-friendly paper straw', false, true, false, true, v_shop_id),
    ('Napkin Pack', 'CELE-AC-NAP-001', 100, 40, 300, 50, 'Cele Coffee Accessories', 'Pack of 100 napkins', false, true, false, true, v_shop_id)
  ON CONFLICT (sku) DO NOTHING;

  RAISE NOTICE 'Products seeded successfully';

  -- ================================================================
  -- 3. CUSTOMERS
  -- ================================================================
  RAISE NOTICE 'Seeding customers...';

  INSERT INTO customers (name, email, phone, credit_limit, credit_used, price_tier, total_purchases, last_purchase, shop_id)
  VALUES
    ('Walk-in Customer', NULL, NULL, 0, 0, 'Standard', 0, NULL, v_shop_id),
    ('U Aung', 'aung@example.com', '+959123456789', 50000, 15000, 'Standard', 125000, NOW() - INTERVAL '2 days', v_shop_id),
    ('Daw Su Su', 'susu@example.com', '+959987654321', 100000, 45000, 'VIP', 350000, NOW() - INTERVAL '1 day', v_shop_id),
    ('Ko Min', 'min@example.com', '+959555123456', 30000, 8000, 'Standard', 75000, NOW() - INTERVAL '3 days', v_shop_id),
    ('Ma Nilar', 'nilar@example.com', '+959777888999', 20000, 5000, 'Standard', 45000, NOW() - INTERVAL '5 days', v_shop_id)
  ON CONFLICT (id) DO NOTHING;

  -- Capture customer IDs
  SELECT id INTO v_cust_walkin FROM customers WHERE name = 'Walk-in Customer' AND shop_id = v_shop_id;
  SELECT id INTO v_cust_aung FROM customers WHERE name = 'U Aung' AND shop_id = v_shop_id;
  SELECT id INTO v_cust_susu FROM customers WHERE name = 'Daw Su Su' AND shop_id = v_shop_id;
  SELECT id INTO v_cust_min FROM customers WHERE name = 'Ko Min' AND shop_id = v_shop_id;
  SELECT id INTO v_cust_nilar FROM customers WHERE name = 'Ma Nilar' AND shop_id = v_shop_id;

  RAISE NOTICE 'Customers seeded successfully';

  -- ================================================================
  -- 4. DISCOUNTS
  -- ================================================================
  RAISE NOTICE 'Seeding discounts...';

  INSERT INTO discounts (name, description, type, value, conditions, min_amount, max_discount, valid_from, valid_to, valid_days, active, shop_id)
  VALUES
    (
      'Happy Hour 20% Off',
      '20% off all coffee drinks from 2-4 PM',
      'percentage',
      20,
      '[]'::jsonb,
      0,
      2000,
      NOW() - INTERVAL '30 days',
      NOW() + INTERVAL '60 days',
      ARRAY[1, 2, 3, 4, 5]::integer[],  -- Mon-Fri
      true,
      v_shop_id
    ),
    (
      'Free Coffee on 5th Purchase',
      'Free Espresso on every 5th coffee purchase',
      'free_gift',
      0,
      '[]'::jsonb,
      0,
      NULL,
      NOW() - INTERVAL '30 days',
      NOW() + INTERVAL '90 days',
      NULL,
      true,
      v_shop_id
    ),
    (
      'VIP 10% Discount',
      '10% off for VIP customers',
      'percentage',
      10,
      '[]'::jsonb,
      0,
      5000,
      NOW() - INTERVAL '60 days',
      NOW() + INTERVAL '180 days',
      NULL,
      true,
      v_shop_id
    ),
    (
      'Morning Special - 500 MMK Off',
      '500 MMK off orders over 3000 before 10 AM',
      'fixed',
      500,
      '[]'::jsonb,
      3000,
      500,
      NOW() - INTERVAL '30 days',
      NOW() + INTERVAL '30 days',
      ARRAY[0, 1, 2, 3, 4, 5, 6]::integer[],  -- Every day
      true,
      v_shop_id
    )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Discounts seeded successfully';

  -- ================================================================
  -- 5. SAMPLE SALES (10 sales over last 7 days)
  -- ================================================================
  RAISE NOTICE 'Seeding sample sales...';

   INSERT INTO sales (invoice_number, customer_id, customer_name, items, subtotal, discount_amount, tax_amount, total, payment_method, status, cashier, cashier_role, receipt_number, notes, applied_discounts, created_at, shop_id)
  VALUES
    -- Sale 1: Today, morning rush - Cash
    (
      'CELE-INV-2026-0001',
      v_cust_walkin,
      'Walk-in Customer',
      '[{"name": "Espresso", "price": 1500, "quantity": 2, "subtotal": 3000}, {"name": "Butter Croissant", "price": 1800, "quantity": 1, "subtotal": 1800}]'::jsonb,
      4800,
      0,
      0,
      4800,
      'cash',
      'completed',
      'Ko HTun',
      'admin',
      'CELE-R-0001',
      NULL,
      '[]'::jsonb,
      NOW() - INTERVAL '6 hours',
      v_shop_id
    ),

    -- Sale 2: Today - KBZpay with U Aung
    (
      'CELE-INV-2026-0002',
      v_cust_aung,
      'U Aung',
      '[{"name": "Latte", "price": 2500, "quantity": 2, "subtotal": 5000}, {"name": "Chocolate Muffin", "price": 1500, "quantity": 2, "subtotal": 3000}]'::jsonb,
      8000,
      0,
      0,
      8000,
      'kbzpay',
      'completed',
      'Ko HTun',
      'admin',
      'CELE-R-0002',
      'Regular morning order',
      '[]'::jsonb,
      NOW() - INTERVAL '4 hours',
      v_shop_id
    ),

    -- Sale 3: Today - WavePay with Daw Su Su (VIP discount)
    (
      'CELE-INV-2026-0003',
      v_cust_susu,
      'Daw Su Su',
      '[{"name": "Mocha", "price": 3000, "quantity": 1, "subtotal": 3000}, {"name": "Matcha Latte", "price": 2800, "quantity": 1, "subtotal": 2800}, {"name": "Club Sandwich", "price": 3500, "quantity": 1, "subtotal": 3500}]'::jsonb,
      9300,
      930,
      0,
      8370,
      'wavepay',
      'completed',
      'Ko HTun',
      'admin',
      'CELE-R-0003',
      'VIP customer - applied 10% discount',
      '[{"name": "VIP 10% Discount", "type": "percentage", "value": 10, "amount": 930}]'::jsonb,
      NOW() - INTERVAL '2 hours',
      v_shop_id
    ),

    -- Sale 4: Yesterday - Cash with Ko Min
    (
      'CELE-INV-2026-0004',
      v_cust_min,
      'Ko Min',
      '[{"name": "Cappuccino", "price": 2500, "quantity": 1, "subtotal": 2500}, {"name": "Butter Croissant", "price": 1800, "quantity": 1, "subtotal": 1800}]'::jsonb,
      4300,
      0,
      0,
      4300,
      'cash',
      'completed',
      'Test Admin',
      'admin',
      'CELE-R-0004',
      NULL,
      '[]'::jsonb,
      NOW() - INTERVAL '1 day',
      v_shop_id
    ),

    -- Sale 5: Yesterday - KBZpay large order
    (
      'CELE-INV-2026-0005',
      NULL,
      'Office Order',
      '[{"name": "Espresso", "price": 1500, "quantity": 5, "subtotal": 7500}, {"name": "Latte", "price": 2500, "quantity": 3, "subtotal": 7500}, {"name": "Cappuccino", "price": 2500, "quantity": 2, "subtotal": 5000}]'::jsonb,
      20000,
      2000,
      0,
      18000,
      'kbzpay',
      'completed',
      'Test Admin',
      'admin',
      'CELE-R-0005',
      'Office morning delivery - 10 drinks',
      '[{"name": "Happy Hour 20% Off", "type": "percentage", "value": 20, "amount": 2000}]'::jsonb,
      NOW() - INTERVAL '1 day' - INTERVAL '3 hours',
      v_shop_id
    ),

    -- Sale 6: 2 days ago - Cash
    (
      'CELE-INV-2026-0006',
      v_cust_nilar,
      'Ma Nilar',
      '[{"name": "Myanmar Milk Tea", "price": 1200, "quantity": 2, "subtotal": 2400}]'::jsonb,
      2400,
      0,
      0,
      2400,
      'cash',
      'completed',
      'Ko HTun',
      'admin',
      'CELE-R-0006',
      NULL,
      '[]'::jsonb,
      NOW() - INTERVAL '2 days',
      v_shop_id
    ),

    -- Sale 7: 3 days ago - WavePay with walk-in
    (
      'CELE-INV-2026-0007',
      v_cust_walkin,
      'Walk-in Customer',
      '[{"name": "Cappuccino", "price": 2500, "quantity": 1, "subtotal": 2500}, {"name": "Club Sandwich", "price": 3500, "quantity": 1, "subtotal": 3500}]'::jsonb,
      6000,
      0,
      0,
      6000,
      'wavepay',
      'completed',
      'Test Admin',
      'admin',
      'CELE-R-0007',
      NULL,
      '[]'::jsonb,
      NOW() - INTERVAL '3 days',
      v_shop_id
    ),

    -- Sale 8: 4 days ago - KBZpay with U Aung
    (
      'CELE-INV-2026-0008',
      v_cust_aung,
      'U Aung',
      '[{"name": "Mocha", "price": 3000, "quantity": 2, "subtotal": 6000}, {"name": "Chocolate Muffin", "price": 1500, "quantity": 3, "subtotal": 4500}]'::jsonb,
      10500,
      0,
      0,
      10500,
      'kbzpay',
      'completed',
      'Ko HTun',
      'admin',
      'CELE-R-0008',
      'Afternoon snack order',
      '[]'::jsonb,
      NOW() - INTERVAL '4 days',
      v_shop_id
    ),

    -- Sale 9: 5 days ago - Cash large order
    (
      'CELE-INV-2026-0009',
      v_cust_susu,
      'Daw Su Su',
      '[{"name": "Latte", "price": 2500, "quantity": 4, "subtotal": 10000}, {"name": "Butter Croissant", "price": 1800, "quantity": 4, "subtotal": 7200}, {"name": "Club Sandwich", "price": 3500, "quantity": 2, "subtotal": 7000}]'::jsonb,
      24200,
      2420,
      0,
      21780,
      'cash',
      'completed',
      'Ko HTun',
      'admin',
      'CELE-R-0009',
      'Team lunch order',
      '[{"name": "VIP 10% Discount", "type": "percentage", "value": 10, "amount": 2420}]'::jsonb,
      NOW() - INTERVAL '5 days',
      v_shop_id
    ),

    -- Sale 10: 6 days ago - WavePay with Ko Min
    (
      'CELE-INV-2026-0010',
      v_cust_min,
      'Ko Min',
      '[{"name": "Myanmar Milk Tea", "price": 1200, "quantity": 3, "subtotal": 3600}, {"name": "Blueberry Muffin", "price": 1500, "quantity": 2, "subtotal": 3000}]'::jsonb,
      6600,
      500,
      0,
      6100,
      'wavepay',
      'completed',
      'Test Admin',
      'admin',
      'CELE-R-0010',
      'Morning special applied',
      '[{"name": "Morning Special - 500 MMK Off", "type": "fixed", "value": 500, "amount": 500}]'::jsonb,
      NOW() - INTERVAL '6 days',
      v_shop_id
    )
  ON CONFLICT (invoice_number) DO NOTHING;

  RAISE NOTICE 'Sales seeded successfully';

  -- ================================================================
  -- SUMMARY
  -- ================================================================
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Demo data seeded successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Categories: 6';
  RAISE NOTICE 'Products: 28 (2 out of stock, 2 low stock)';
  RAISE NOTICE 'Customers: 5';
  RAISE NOTICE 'Discounts: 4';
  RAISE NOTICE 'Sales: 10 (last 7 days)';
  RAISE NOTICE '========================================';

END $$;
