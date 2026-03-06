-- Staff Management: shifts, attendance, goals, incentives
-- Run: psql salon_db < server/db/migrations/005-staff-management.sql

-- Staff shifts
CREATE TABLE IF NOT EXISTS staff_shifts (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staff_id, shift_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff ON staff_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_date ON staff_shifts(shift_date);

-- Staff attendance (check-in/out)
CREATE TABLE IF NOT EXISTS staff_attendance (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'leave', 'half-day')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staff_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff ON staff_attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(attendance_date);

-- Staff goals (sales/service targets)
CREATE TABLE IF NOT EXISTS staff_goals (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
  period_value VARCHAR(20) NOT NULL,
  target_amount DECIMAL(10,2) DEFAULT 0,
  target_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staff_id, period_type, period_value)
);

CREATE INDEX IF NOT EXISTS idx_staff_goals_staff ON staff_goals(staff_id);

-- Commission rules (per service category or service)
CREATE TABLE IF NOT EXISTS staff_commission_rules (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_category VARCHAR(100),
  service_id INTEGER REFERENCES services(id),
  commission_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_commission_staff ON staff_commission_rules(staff_id);

-- Calculated incentives (commission, bonuses)
CREATE TABLE IF NOT EXISTS staff_incentives (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period_type VARCHAR(20) NOT NULL,
  period_value VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  type VARCHAR(20) DEFAULT 'commission' CHECK (type IN ('commission', 'bonus', 'target')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_incentives_staff ON staff_incentives(staff_id);
