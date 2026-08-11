-- Add notification-channel fields to app_settings
-- Shop owners choose a channel (none / whatsapp / discord) for the daily sales report.
-- No new tables, no new RLS policies: app_settings already has shop-scoped RLS;
-- column-level access inherits from the existing row-level policies.
--
-- Migration-safety checklist:
--   [x] Existing tenant-scoped table (app_settings already has shop_id + RLS)
--   [x] No new policy using current_shop_ids() (none added)
--   [x] Timestamps: N/A (no new timestamp columns)
--   [x] CHECK constraint is a lock on the allowed channel set; a new channel
--       requires a future migration (acceptable — channels are a small, curated set)

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS notification_channel TEXT NOT NULL DEFAULT 'none'
    CHECK (notification_channel IN ('none', 'whatsapp', 'discord')),
  ADD COLUMN IF NOT EXISTS whatsapp_recipient_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_report_time TEXT NOT NULL DEFAULT '18:00'
    CHECK (whatsapp_report_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
