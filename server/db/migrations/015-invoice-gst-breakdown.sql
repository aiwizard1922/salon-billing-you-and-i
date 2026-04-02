-- Optional per-component GST rates (INR). When set, print/view can show CGST/SGST/IGST/Service tax separately.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_percent DECIMAL(5,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_percent DECIMAL(5,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_percent DECIMAL(5,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_tax_percent DECIMAL(5,2);
