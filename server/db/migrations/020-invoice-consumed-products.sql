-- Track products CONSUMED while delivering a service (back-bar usage), not sold to the customer.
-- These rows do NOT affect the invoice total. Stock is deducted when the invoice is marked paid.
-- Run: psql salon_db < server/db/migrations/020-invoice-consumed-products.sql

CREATE TABLE IF NOT EXISTS invoice_consumed_products (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  service_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consumed_products_invoice ON invoice_consumed_products(invoice_id);
CREATE INDEX IF NOT EXISTS idx_consumed_products_product ON invoice_consumed_products(product_id);

COMMENT ON TABLE invoice_consumed_products IS 'Products used up delivering a service (not billed). Stock deducted on invoice payment.';
COMMENT ON COLUMN invoice_consumed_products.service_name IS 'Label of the service the product was used for (for reporting).';
