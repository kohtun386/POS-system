INSERT INTO currency_config 
  (code, name, symbol, is_active, is_base_currency, decimal_places)
VALUES 
  ('MMK', 'Myanmar Kyat', 'K', true, false, 0)
ON CONFLICT (code) DO NOTHING;
