-- Seed retail inventory: hair colors (manual stock sheet), hair care (manual sheet),
-- and Siri Enterprises invoice Sale_1150 (01-02-2026) treatment/shampoo lines.
-- Safe to re-run: skips rows where SKU already exists.

INSERT INTO products (name, sku, category, unit, cost_price, selling_price, quantity, low_stock_threshold, is_active)
VALUES
  -- Hair color (quantities from salon colors sheet)
  ('Innova 1', 'CLR-INNOVA-01', 'Hair color', 'pcs', 0, 0, 10, 3, TRUE),
  ('Innova 2', 'CLR-INNOVA-02', 'Hair color', 'pcs', 0, 0, 15, 3, TRUE),
  ('Innova 3', 'CLR-INNOVA-03', 'Hair color', 'pcs', 0, 0, 25, 5, TRUE),
  ('Innova 4', 'CLR-INNOVA-04', 'Hair color', 'pcs', 0, 0, 10, 3, TRUE),
  ('Innova 5', 'CLR-INNOVA-05', 'Hair color', 'pcs', 0, 0, 10, 3, TRUE),
  ('Majirel 3', 'CLR-MAJIREL-03', 'Hair color', 'pcs', 0, 0, 15, 3, TRUE),
  ('Majirel 1', 'CLR-MAJIREL-01', 'Hair color', 'pcs', 0, 0, 10, 3, TRUE),
  ('Majirel 4.26', 'CLR-MAJIREL-426', 'Hair color', 'pcs', 0, 0, 10, 3, TRUE),
  ('Majirel 5.20', 'CLR-MAJIREL-520', 'Hair color', 'pcs', 0, 0, 10, 3, TRUE),
  ('Majirel 4.20', 'CLR-MAJIREL-420', 'Hair color', 'pcs', 0, 0, 8, 3, TRUE),
  ('Majirel 12.3', 'CLR-MAJIREL-123', 'Hair color', 'pcs', 0, 0, 5, 2, TRUE),
  ('Majirel 20 vol developer', 'CLR-MAJIREL-20VOL', 'Hair color', 'pcs', 0, 0, 4, 2, TRUE),
  ('Majirel 30 vol developer', 'CLR-MAJIREL-30VOL', 'Hair color', 'pcs', 0, 0, 2, 1, TRUE),
  ('Innova 20 vol developer', 'CLR-INNOVA-20VOL', 'Hair color', 'pcs', 0, 0, 4, 2, TRUE),
  -- Hair care (quantities from salon sheet; spellings normalized lightly)
  ('Liss unlimited shampoo', 'CARE-LISS-SH', 'Hair care', 'pcs', 0, 0, 10, 3, TRUE),
  ('Liss unlimited mask', 'CARE-LISS-MSK', 'Hair care', 'pcs', 0, 0, 10, 3, TRUE),
  ('Liss unlimited serum', 'CARE-LISS-SER', 'Hair care', 'pcs', 0, 0, 10, 3, TRUE),
  ('X-Tenso care blue shampoo', 'CARE-XTENSO-BL-SH', 'Hair care', 'pcs', 0, 0, 4, 2, TRUE),
  ('X-Tenso care blue mask', 'CARE-XTENSO-BL-MSK', 'Hair care', 'pcs', 0, 0, 6, 2, TRUE),
  ('Clay wax', 'CARE-CLAY-WAX', 'Hair care', 'pcs', 0, 0, 5, 2, TRUE),
  ('Absolut repair shampoo', 'CARE-ABSOLUT-SH', 'Hair care', 'pcs', 0, 0, 5, 2, TRUE),
  ('Absolut repair mask', 'CARE-ABSOLUT-MSK', 'Hair care', 'pcs', 0, 0, 5, 2, TRUE),
  ('Absolut repair serum', 'CARE-ABSOLUT-SER', 'Hair care', 'pcs', 0, 0, 5, 2, TRUE),
  -- Siri Enterprises invoice 1150 — unit rates from invoice; cost unknown → 0 (edit in app)
  ('Dandruff treatment kit', 'SIRI-DAND-KIT', 'Hair treatment', 'pcs', 0, 425.00, 24, 5, TRUE),
  ('Hair fall treatment', 'SIRI-HAIRFALL-TRT', 'Hair treatment', 'pcs', 0, 425.00, 24, 5, TRUE),
  ('Dandruff shampoo', 'SIRI-DAND-SH', 'Hair treatment', 'pcs', 0, 575.00, 9, 3, TRUE),
  ('Dandruff mask', 'SIRI-DAND-MSK', 'Hair treatment', 'pcs', 0, 445.00, 15, 5, TRUE),
  ('Hair fall mask', 'SIRI-HAIRFALL-MSK', 'Hair treatment', 'pcs', 0, 445.00, 6, 3, TRUE)
ON CONFLICT (sku) DO NOTHING;
