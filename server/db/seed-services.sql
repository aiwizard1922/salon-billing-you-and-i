-- Seed services table from default catalog (run after 003-digital-catalog.sql)
-- Run: psql salon_db < server/db/seed-services.sql

INSERT INTO services (name, category, price, duration_mins, sort_order) VALUES
  ('Eye Brow', 'Threading', 50, 15, 1),
  ('Upper Lip', 'Threading', 30, 10, 2),
  ('Chin', 'Threading', 30, 10, 3),
  ('Full Face Threading', 'Threading', 350, 45, 4),
  ('Hair Cut', 'Hair', 800, 45, 5),
  ('Child Haircut', 'Hair', 400, 30, 6),
  ('Shampoo + Blow Dry', 'Hair', 500, 45, 7),
  ('Hair Spa', 'Hair', 1200, 60, 8),
  ('Essential Clean Up', 'Clean Up', 650, 45, 9),
  ('Acne Clean Up', 'Clean Up', 800, 45, 10),
  ('Dead Sea Mineral Facial', 'Facials', 2500, 60, 11),
  ('Gold Moroccan Facial', 'Facials', 2800, 60, 12),
  ('Full Arms Wax', 'Waxing', 550, 30, 13),
  ('Full Legs Wax', 'Waxing', 650, 45, 14),
  ('Organic Manicure', 'Manicure', 650, 45, 15),
  ('Organic Pedicure', 'Pedicure', 650, 45, 16),
  ('Gel Polish Application', 'Nails', 900, 60, 17),
  ('Body Polishing', 'Body', 4000, 90, 18),
  ('Other (Custom)', 'Other', 0, 30, 19)
ON CONFLICT (name, category) DO NOTHING;
