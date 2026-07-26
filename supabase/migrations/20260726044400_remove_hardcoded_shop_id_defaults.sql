-- ================================================================
-- Remove hardcoded shop_id DEFAULT values from tables
-- ================================================================
-- Problem: Tables have hardcoded DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid
--          which prevents seed scripts from inserting data for other shops.
-- Solution: Remove the DEFAULT constraint and rely on explicit shop_id values.
-- ================================================================

-- Remove DEFAULT from categories.shop_id
ALTER TABLE categories 
  ALTER COLUMN shop_id DROP DEFAULT;

-- Remove DEFAULT from products.shop_id
ALTER TABLE products 
  ALTER COLUMN shop_id DROP DEFAULT;

-- Remove DEFAULT from sales.shop_id
ALTER TABLE sales 
  ALTER COLUMN shop_id DROP DEFAULT;

-- Remove DEFAULT from customers.shop_id (if exists)
ALTER TABLE customers 
  ALTER COLUMN shop_id DROP DEFAULT;

-- Remove DEFAULT from discounts.shop_id (if exists)
ALTER TABLE discounts 
  ALTER COLUMN shop_id DROP DEFAULT;

-- Remove DEFAULT from users.shop_id (if exists)
ALTER TABLE users 
  ALTER COLUMN shop_id DROP DEFAULT;

-- Remove DEFAULT from shop_memberships.shop_id (if exists)
ALTER TABLE shop_memberships 
  ALTER COLUMN shop_id DROP DEFAULT;
