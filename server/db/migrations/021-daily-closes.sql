-- End-of-day cash close: one saved record per business day (re-closing updates the row).
-- expected_cash = opening_float + cash_collected - expenses (expenses assumed paid from drawer).
-- variance = counted_cash - expected_cash.
-- Run: psql salon_db < server/db/migrations/021-daily-closes.sql

CREATE TABLE IF NOT EXISTS daily_closes (
  id SERIAL PRIMARY KEY,
  close_date DATE NOT NULL UNIQUE,
  opening_float DECIMAL(10,2) NOT NULL DEFAULT 0,
  counted_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
  cash_collected DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_collected DECIMAL(10,2) NOT NULL DEFAULT 0,
  expenses DECIMAL(10,2) NOT NULL DEFAULT 0,
  expected_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
  variance DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  closed_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_closes_date ON daily_closes(close_date DESC);

COMMENT ON TABLE daily_closes IS 'End-of-day cash reconciliation, one row per business day.';
