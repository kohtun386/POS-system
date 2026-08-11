-- Fix stale upstream `store_name` default in app_settings.
-- 'sekaLabs 2025 POS' came from the upstream repo's init.sql; this project is CoffeeShop POS (MMK).
-- ALTER fixes the default for future inserts; scoped UPDATE backfills rows still holding the old default.

ALTER TABLE public.app_settings ALTER COLUMN store_name SET DEFAULT 'CoffeeShop POS';

UPDATE public.app_settings
SET store_name = 'CoffeeShop POS'
WHERE store_name = 'sekaLabs 2025 POS';
