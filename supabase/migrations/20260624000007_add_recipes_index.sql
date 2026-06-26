-- Add partial index for the deduction trigger's recipe lookup
-- The trigger does: SELECT * FROM recipes WHERE product_id = ? AND is_active = true
-- Without an index this is a sequential scan on every sale INSERT.

CREATE INDEX idx_recipes_product_active
  ON recipes(product_id)
  WHERE is_active = true;
