-- Create kitchen_orders and print_jobs tables

CREATE TABLE IF NOT EXISTS kitchen_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  order_id UUID REFERENCES kitchen_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  config_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE kitchen_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- kitchen_orders policies
CREATE POLICY "Allow authenticated users to SELECT kitchen_orders" ON kitchen_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to INSERT kitchen_orders" ON kitchen_orders
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to UPDATE kitchen_orders" ON kitchen_orders
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow admin/manager to DELETE kitchen_orders" ON kitchen_orders
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM shop_memberships
      WHERE shop_memberships.shop_id = kitchen_orders.shop_id
      AND shop_memberships.user_id = auth.uid()
      AND shop_memberships.role IN ('admin', 'manager')
    )
  );

-- print_jobs policies (Service-layer access only, restrict to shop_id)
CREATE POLICY "Allow authenticated users to SELECT print_jobs" ON print_jobs
  FOR SELECT TO authenticated USING (shop_id = (SELECT shop_id FROM shop_memberships WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Allow authenticated users to INSERT print_jobs" ON print_jobs
  FOR INSERT TO authenticated WITH CHECK (shop_id = (SELECT shop_id FROM shop_memberships WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Allow authenticated users to UPDATE print_jobs" ON print_jobs
  FOR UPDATE TO authenticated USING (shop_id = (SELECT shop_id FROM shop_memberships WHERE user_id = auth.uid() LIMIT 1));
