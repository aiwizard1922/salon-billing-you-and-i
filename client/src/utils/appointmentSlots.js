import { appointmentDateToYmd, getISTMinutesNow, istDateStr } from './ist';

/** 12-hour display like "8:30 AM" (not locale-dependent). */
export function formatTime12h(hours24, minutes) {
  const h24 = Number(hours24);
  const m = Number(minutes);
  if (!Number.isFinite(h24) || !Number.isFinite(m)) return '';
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const mm = String(m).padStart(2, '0');
  return `${h12}:${mm} ${period}`;
}

/** 30-minute bookable start times from 8:30 AM through 10:00 PM; labels are always 12-hour. */
export function getAppointmentTimeOptions() {
  const options = [];
  let minutes = 8 * 60 + 30;
  const end = 22 * 60;
  while (minutes <= end) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    options.push({ value, label: formatTime12h(h, m) });
    minutes += 30;
  }
  return options;
}

/** Format Postgres/saved TIME (e.g. "14:30:00") for 12-hour display. */
export function formatAppointmentTimeDisplay(t) {
  if (t == null || t === '') return '';
  const s = String(t);
  const hm = s.length >= 5 ? s.slice(0, 5) : s;
  const parts = hm.split(':');
  if (parts.length < 2) return s;
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return s;
  return formatTime12h(hh, mm);
}

/**
 * Time slots allowed for a given appointment date (YYYY-MM-DD): future dates = all slots;
 * today (IST) = only times strictly after current IST clock; past dates = none.
 */
export function getBookableTimeOptions(appointmentDateYmd) {
  const all = getAppointmentTimeOptions();
  const ymd =
    appointmentDateToYmd(appointmentDateYmd) ||
    (typeof appointmentDateYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(appointmentDateYmd) ? appointmentDateYmd : '');
  const today = istDateStr();
  if (!ymd) return [];
  if (ymd < today) return [];
  if (ymd > today) return all;
  const nowM = getISTMinutesNow();
  return all.filter(({ value }) => {
    const [hh, mm] = value.split(':').map(Number);
    return hh * 60 + mm > nowM;
  });
}
