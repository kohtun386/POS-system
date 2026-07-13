-- Create cash_shifts table (missing from v3.1.0 local schema)
-- Referenced by services.ts and database.types.ts but never migrated.

CREATE TABLE IF NOT EXISTS cash_shifts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id  uuid NOT NULL REFERENCES users(id),
  shop_id     uuid NOT NULL REFERENCES shops(id),
  status      text NOT NULL DEFAULT 'open',
  opening_cash  numeric NOT NULL,
  closing_cash  numeric,
  expected_cash numeric,
  variance      numeric,
  opened_at   timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_cash_shifts_cashier_id ON cash_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_shop_id ON cash_shifts(shop_id);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_status ON cash_shifts(status);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_opened_at ON cash_shifts(opened_at DESC);

-- RLS policies matching the existing pattern
ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cash shifts viewable by shop members"
  ON cash_shifts FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Cash shifts write by shop admin/manager"
  ON cash_shifts FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );
