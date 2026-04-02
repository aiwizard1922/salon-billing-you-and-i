-- Per-service staff and multiple distinct catalog lines (services TEXT[] stays as ordered names)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_lines JSONB NOT NULL DEFAULT '[]'::jsonb;
