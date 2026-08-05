-- Drop redundant triggers that survived their intended removal.
-- checkout_complete() RPC handles invoice generation and customer stats atomically.
-- trigger_update_customer_stats caused double-counting of customer purchase totals.
-- Phase 0 gate confirmed: no code path depends on these triggers after PR #68.

DROP TRIGGER IF EXISTS trigger_auto_generate_invoice_number ON sales;
DROP TRIGGER IF EXISTS trigger_update_customer_stats ON sales;
