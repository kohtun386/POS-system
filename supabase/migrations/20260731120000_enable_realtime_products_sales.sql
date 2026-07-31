-- Enable Realtime for products and sales tables
-- Products: stock updates across POS terminals
-- Sales: new transaction sync across terminals
-- Both tables already have shop_id for tenant isolation (RLS enforced)

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
