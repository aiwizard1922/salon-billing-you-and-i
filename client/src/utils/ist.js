/** IST (Asia/Kolkata) timezone for Indian business context */

/** Current date in IST as YYYY-MM-DD */
export function istDateStr(d = new Date()) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Current month in IST as YYYY-MM */
export function istMonthStr(d = new Date()) {
  return istDateStr(d).slice(0, 7);
}

/** Format a date for display in IST (en-IN locale) */
export function formatDateIST(dateOrStr, options = {}) {
  const d = dateOrStr ? new Date(dateOrStr) : null;
  if (!d || isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...options });
}

/** Format a datetime for display in IST */
export function formatDateTimeIST(dateOrStr) {
  const d = dateOrStr ? new Date(dateOrStr) : null;
  if (!d || isNaN(d.getTime())) return '–';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}
