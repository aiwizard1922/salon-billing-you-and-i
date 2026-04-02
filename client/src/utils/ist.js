/** IST (Asia/Kolkata) timezone for Indian business context */

/** Current date in IST as YYYY-MM-DD */
export function istDateStr(d = new Date()) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Current month in IST as YYYY-MM */
export function istMonthStr(d = new Date()) {
  return istDateStr(d).slice(0, 7);
}

/**
 * Format a calendar date for display in Asia/Kolkata (en-IN).
 * Plain YYYY-MM-DD is anchored at noon IST so it never shifts to the wrong day.
 * ISO instants (e.g. from JSON APIs) are shown in the IST calendar.
 */
export function formatDateIST(dateOrStr, options = {}) {
  if (dateOrStr == null || dateOrStr === '') return '–';
  if (typeof dateOrStr === 'string') {
    const t = dateOrStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const d = new Date(`${t}T12:00:00+05:30`);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...options });
      }
    }
  }
  const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
  if (!d || isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...options });
}

/** Format a datetime for display in IST */
export function formatDateTimeIST(dateOrStr) {
  const d = dateOrStr ? new Date(dateOrStr) : null;
  if (!d || isNaN(d.getTime())) return '–';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Normalise appointment_date to YYYY-MM-DD in Asia/Kolkata (same calendar as bookings & filters).
 * Plain "YYYY-MM-DD" from `<input type="date">` or Postgres DATE text is returned as-is.
 * ISO instants use IST calendar (e.g. UTC evening of "previous" UTC day can still be "today" in India).
 */
export function appointmentDateToYmd(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const t = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (!isNaN(d.getTime())) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }
  const str = String(value);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** Short date label for appointments (IST). */
export function formatAppointmentDateDisplay(value) {
  const ymd = appointmentDateToYmd(value);
  if (!ymd) return '–';
  return formatDateIST(`${ymd}T12:00:00+05:30`, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Minutes since midnight in Asia/Kolkata (0–1439). */
export function getISTMinutesNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const m = parseInt(parts.find((p) => p.type === 'minute').value, 10);
  return h * 60 + m;
}

/** Postgres TIME or "HH:mm" / "HH:mm:ss" → minutes since midnight. */
export function appointmentTimeToMinutes(t) {
  if (t == null || t === '') return null;
  const s = String(t);
  const hm = s.length >= 5 ? s.slice(0, 5) : s;
  const parts = hm.split(':');
  if (parts.length < 2) return null;
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

/**
 * True if the booking is still in the future in IST: future calendar days always;
 * today only if the slot start (minute) is strictly after the current IST clock.
 */
export function isAppointmentUpcomingInIST(a) {
  const ymd = appointmentDateToYmd(a.appointment_date);
  const today = istDateStr();
  if (!ymd) return false;
  if (ymd > today) return true;
  if (ymd < today) return false;
  const apptMin = appointmentTimeToMinutes(a.appointment_time);
  if (apptMin == null) return false;
  return apptMin > getISTMinutesNow();
}
