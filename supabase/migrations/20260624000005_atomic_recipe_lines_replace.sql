-- Atomic recipe lines replacement
-- Wraps DELETE + INSERT in a single transaction so partial failures
-- cannot leave a recipe with zero lines.

CREATE OR REPLACE FUNCTION replace_recipe_lines(
  p_recipe_id UUID,
  p_lines JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete existing lines
  DELETE FROM recipe_lines WHERE recipe_id = p_recipe_id;

  -- Insert new lines (skip if empty array)
  IF jsonb_array_length(p_lines) > 0 THEN
    INSERT INTO recipe_lines (
      shop_id,
      recipe_id,
      raw_material_id,
      raw_material_name,
      quantity,
      recipe_unit,
      recipe_quantity,
      wastage_percent,
      is_optional,
      notes
    )
    SELECT
      (line->>'shop_id')::UUID,
      p_recipe_id,
      (line->>'raw_material_id')::UUID,
      line->>'raw_material_name',
      (line->>'quantity')::NUMERIC,
      line->>'recipe_unit',
      CASE WHEN line->>'recipe_quantity' IS NOT NULL
        THEN (line->>'recipe_quantity')::NUMERIC
        ELSE NULL
      END,
      COALESCE((line->>'wastage_percent')::NUMERIC, 0),
      COALESCE((line->>'is_optional')::BOOLEAN, false),
      line->>'notes'
    FROM jsonb_array_elements(p_lines) AS line;
  END IF;
END;
$$;
