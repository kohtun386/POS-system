ALTER TABLE sales ADD CONSTRAINT chk_sales_cashier_role
  CHECK (cashier_role IS NULL OR cashier_role IN
    ('platform_admin', 'admin', 'manager', 'cashier'));
