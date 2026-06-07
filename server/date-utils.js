/** IST calendar date helpers — avoid UTC shift from node-pg DATE / toISOString().slice(0,10). */
const TZ = 'Asia/Kolkata';

/** PostgreSQL DATE (or ISO string) → YYYY-MM-DD in Asia/Kolkata calendar. */
function ymdFromDbDate(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'string') {
    const t = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toLocaleDateString('en-CA', { timeZone: TZ });
  }
  const s = String(val);
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function todayIST(d = new Date()) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
}

function istMonthStr(d = new Date()) {
  return todayIST(d).slice(0, 7);
}

/**
 * Last calendar day of month YYYY-MM as YYYY-MM-DD (pure calendar math, no UTC drift).
 */
function lastDayOfMonthYmd(targetMonth) {
  const [ys, ms] = String(targetMonth).split('-');
  const y = parseInt(ys, 10);
  const m = parseInt(ms, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  const d = new Date(y, m, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Add days to a YYYY-MM-DD string (calendar arithmetic). */
function addDaysToYmd(ymd, days) {
  const parts = String(ymd || '').split('-').map(Number);
  if (parts.length < 3 || !parts.every(Number.isFinite)) return null;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + (Number(days) || 0)));
  return dt.toISOString().slice(0, 10);
}

function mapRowDates(row, fields) {
  if (!row) return row;
  const out = { ...row };
  for (const f of fields) {
    if (f in out && out[f] != null) out[f] = ymdFromDbDate(out[f]);
  }
  return out;
}

function mapRowsDates(rows, fields) {
  return (rows || []).map((r) => mapRowDates(r, fields));
}

module.exports = {
  TZ,
  ymdFromDbDate,
  todayIST,
  istMonthStr,
  lastDayOfMonthYmd,
  addDaysToYmd,
  mapRowDates,
  mapRowsDates,
};
