-- Migration: Add category_id foreign key to products table
-- Migration timestamp: 20260816000000
-- Branches: feat/category-foundation

BEGIN;

-- Step 1: Add nullable category_id column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS category_id UUID;

-- Step 2: Preflight duplicate check - halt if any case-insensitive duplicates exist
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT shop_id,
           lower(name) AS normalized_name,
           array_agg(name ORDER BY id) AS display_names
    FROM categories
    GROUP BY shop_id, lower(name)
    HAVING COUNT(*) > 1
  LOOP
    RAISE EXCEPTION
      'Duplicate category names in shop %: %',
      dup.shop_id, dup.display_names;
  END LOOP;
END;
$$;

-- Step 3: Add parent-side unique constraint on categories (id, shop_id)
-- This is safe because categories.id is already a primary key
CREATE UNIQUE INDEX IF NOT EXISTS categories_id_shopid_uniq
ON categories (id, shop_id);

-- Step 4: Composite foreign key enforces same-tenant integrity
ALTER TABLE products
ADD CONSTRAINT fk_products_category_shop
FOREIGN KEY (category_id, shop_id)
REFERENCES categories (id, shop_id)
ON DELETE RESTRICT;

-- Step 5: Case-insensitive unique expression index (ALL categories)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_shopid_name_ci
ON categories (shop_id, lower(name));

-- Step 6: Database trigger for atomic dual-write
CREATE OR REPLACE FUNCTION sync_category_id_from_string()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.category IS DISTINCT FROM COALESCE(OLD.category, '') THEN
    IF NEW.category IS NULL OR NEW.category = '' THEN
      NEW.category_id := NULL;
    ELSE
      SELECT c.id INTO NEW.category_id
      FROM public.categories c
      WHERE c.shop_id = NEW.shop_id
        AND lower(c.name) = lower(NEW.category)
      LIMIT 1;

      IF NEW.category_id IS NULL THEN
        -- No matching category yet; allow insert/update but leave FK null
        NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION sync_category_id_from_string() FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_category_id_from_string() FROM anon;
REVOKE ALL ON FUNCTION sync_category_id_from_string() FROM authenticated;
GRANT EXECUTE ON FUNCTION sync_category_id_from_string() TO service_role;

DROP TRIGGER IF EXISTS trg_products_sync_category_id ON products;
CREATE TRIGGER trg_products_sync_category_id
BEFORE INSERT OR UPDATE OF category ON products
FOR EACH ROW
EXECUTE FUNCTION sync_category_id_from_string();

-- Step 7: Backfill existing products with matching categories
DO $$
BEGIN
  -- 1) Exact string match within same shop
  UPDATE products p
  SET category_id = c.id
  FROM categories c
  WHERE p.shop_id = c.shop_id
    AND p.category = c.name
    AND p.category_id IS DISTINCT FROM c.id;

  -- 2) Case-insensitive match within same shop (only rows still unmapped)
  UPDATE products p
  SET category_id = c.id
  FROM categories c
  WHERE p.shop_id = c.shop_id
    AND lower(p.category) = lower(c.name)
    AND p.category_id IS DISTINCT FROM c.id;

  -- 3) Create unmapped categories (preserve display casing)
  WITH unmapped AS (
    SELECT DISTINCT ON (p.shop_id, p.category)
           p.shop_id,
           p.category AS original_name
    FROM products p
    LEFT JOIN categories c
           ON p.shop_id = c.shop_id
          AND lower(p.category) = lower(c.name)
    WHERE p.category IS NOT NULL
      AND p.category <> ''
      AND c.id IS NULL
      AND p.category_id IS NULL
  )
  INSERT INTO categories (id, shop_id, name, description, active, created_at, updated_at)
  SELECT gen_random_uuid(),
         u.shop_id,
         u.original_name,
         NULL,
         TRUE,
         NOW(),
         NOW()
  FROM unmapped u
  ON CONFLICT (shop_id, lower(name)) DO NOTHING;

  -- 4) Link products to newly created categories
  UPDATE products p
  SET category_id = c.id
  FROM categories c
  WHERE p.shop_id = c.shop_id
    AND lower(p.category) = lower(c.name)
    AND p.category_id IS DISTINCT FROM c.id;
END;
$$;

COMMIT;