-- Staff, Memberships, Client Analytics
-- Run: psql salon_db < server/db/migrations/001-staff-memberships-clients.sql

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  role VARCHAR(100),
  join_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add gender to customers (for client analytics: men/women)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
COMMENT ON COLUMN customers.gender IS 'male, female, other, or null';

-- Membership plans (e.g. Gold, Silver, Monthly)
CREATE TABLE IF NOT EXISTS membership_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  benefits TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer membership assignments
CREATE TABLE IF NOT EXISTS customer_memberships (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_memberships_customer ON customer_memberships(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_plan ON customer_memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_end ON customer_memberships(end_date);

-- Optional: link staff to appointments and invoices for future payroll/commission
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES staff(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES staff(id);
