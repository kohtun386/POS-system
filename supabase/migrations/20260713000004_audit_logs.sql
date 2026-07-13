-- ================================================================
-- Migration: Audit Logs — Platform Admin Action Audit Trail
-- Date: July 13, 2026
-- Description:
--   Creates the audit_logs table for recording platform admin
--   actions performed via Edge Functions. All writes go through
--   service_role (bypasses RLS). No client-side access.
--
--   VISION.md §17: Platform admin operations are audited via
--   Edge Functions that insert into this table after each action.
-- ================================================================

-- ================================================================
-- 1. TABLE: audit_logs
-- ================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  shop_id UUID REFERENCES shops(id),
  details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_logs IS 'Platform admin action audit trail. service_role only — no RLS access for client users.';
COMMENT ON COLUMN audit_logs.actor_id IS 'The platform_admin user who performed the action';
COMMENT ON COLUMN audit_logs.action IS 'Action name, e.g. approve_shop, reject_shop, update_subscription';
COMMENT ON COLUMN audit_logs.target_type IS 'Entity type: shop, user, feature, subscription, etc.';
COMMENT ON COLUMN audit_logs.target_id IS 'UUID of the target entity (nullable for global actions)';
COMMENT ON COLUMN audit_logs.shop_id IS 'Shop context (nullable for cross-tenant actions)';
COMMENT ON COLUMN audit_logs.details IS 'JSONB payload: old/new values, reason, metadata';
COMMENT ON COLUMN audit_logs.ip_address IS 'Caller IP from X-Forwarded-For header';

-- ================================================================
-- 2. RLS POLICIES
-- ================================================================
-- VISION.md §18.2: platform_admin never appears in RLS policies.
-- Only service_role can access this table via Edge Functions.
-- No SELECT/INSERT/UPDATE/DELETE policies = implicit deny for all
-- authenticated/anonymous roles.

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 3. INDEXES
-- ================================================================

CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_shop_id ON audit_logs(shop_id) WHERE shop_id IS NOT NULL;
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Verify table exists:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'audit_logs' ORDER BY ordinal_position;

-- Verify RLS is enabled (should return 1 row):
-- SELECT relname, relrowsecurity FROM pg_class
-- WHERE relname = 'audit_logs' AND relrowsecurity = true;

-- Verify no RLS policies exist (implicit deny):
-- SELECT count(*) FROM pg_policies WHERE tablename = 'audit_logs';
-- Expected: 0

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
