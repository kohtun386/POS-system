-- Set database timezone to Asia/Yangon per VISION.md §18.2.
-- Currently UTC. This fixes checkout_complete()'s daily-order-limit check
-- which uses CURRENT_DATE — with UTC it resets at 06:30 Myanmar time
-- instead of midnight Yangon time.
--
-- NOTE: ALTER DATABASE cannot run inside a transaction block.
-- If supabase db push fails, apply directly via:
--   supabase db query "ALTER DATABASE postgres SET timezone = 'Asia/Yangon';"

DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone = %L',
                 current_database(), 'Asia/Yangon');
END $$;
