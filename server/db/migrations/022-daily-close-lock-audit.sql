-- Lock a day once it's closed; keep a full audit trail of close/reopen/amend actions.
-- Run: psql salon_db < server/db/migrations/022-daily-close-lock-audit.sql

ALTER TABLE daily_closes ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing saved closes represent a closed day → treat them as locked.
UPDATE daily_closes SET locked = TRUE WHERE locked = FALSE;

CREATE TABLE IF NOT EXISTS daily_close_audits (
  id SERIAL PRIMARY KEY,
  close_date DATE NOT NULL,
  action VARCHAR(20) NOT NULL,           -- 'close' | 'reopen'
  opening_float DECIMAL(10,2),
  counted_cash DECIMAL(10,2),
  expected_cash DECIMAL(10,2),
  variance DECIMAL(10,2),
  notes TEXT,
  reason TEXT,                            -- required on reopen
  changed_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_close_audits_date ON daily_close_audits(close_date, created_at DESC);

COMMENT ON TABLE daily_close_audits IS 'Audit trail of every end-of-day close and reopen.';
