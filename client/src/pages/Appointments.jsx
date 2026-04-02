import { useState, useEffect, useMemo } from 'react';
import { formatINR } from '../utils/formatCurrency';
import { getBookableTimeOptions, formatAppointmentTimeDisplay } from '../utils/appointmentSlots';
import { Calendar, Clock, UserRound } from 'lucide-react';
import {
  istDateStr,
  formatAppointmentDateDisplay,
  appointmentDateToYmd,
  isAppointmentUpcomingInIST,
} from '../utils/ist';
import { formatAppointmentServiceSummary } from '../utils/appointmentDisplay';

const API = '/api';
const HISTORY_DAYS_BACK = 90;
const FUTURE_DAYS_AHEAD = 30;

const ROW_STYLES = {
  upcoming: {
    card: 'bg-white border-slate-100',
    iconWrap: 'bg-amber-50 border-amber-100',
    icon: 'text-amber-700',
    name: 'text-slate-800',
    scheduled: 'bg-amber-100 text-amber-900',
    other: 'bg-slate-100 text-slate-700',
  },
  today: {
    card: 'bg-sky-50/95 border-sky-200',
    iconWrap: 'bg-sky-100 border-sky-200',
    icon: 'text-sky-700',
    name: 'text-slate-800',
    scheduled: 'bg-sky-200 text-sky-900',
    other: 'bg-sky-100 text-sky-800',
  },
  history: {
    card: 'bg-slate-50/90 border-slate-200',
    iconWrap: 'bg-slate-100 border-slate-200',
    icon: 'text-slate-500',
    name: 'text-slate-700',
    scheduled: 'bg-slate-200 text-slate-700',
    other: 'bg-slate-100 text-slate-600',
  },
};

function AppointmentRow({ a, variant }) {
  const st = ROW_STYLES[variant];
  const statusCls = a.status === 'scheduled' ? st.scheduled : st.other;
  return (
    <div
      className={`rounded-xl p-4 shadow-sm border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 ${st.card}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${st.iconWrap}`}
        >
          <Calendar className={st.icon} size={20} />
        </div>
        <div>
          <p className={`font-medium ${st.name}`}>{a.customer_name}</p>
          <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-0.5">
            <Clock className="shrink-0 text-slate-400" size={14} />
            <span>
              {formatAppointmentDateDisplay(a.appointment_date)} · {formatAppointmentTimeDisplay(a.appointment_time)}
            </span>
          </p>
          <p className="text-sm text-slate-600 flex items-start gap-1.5 mt-1">
            <UserRound className="shrink-0 text-slate-400 mt-0.5" size={14} />
            <span className="text-xs sm:text-sm">{formatAppointmentServiceSummary(a)}</span>
          </p>
        </div>
      </div>
      <span className={`self-start sm:self-center px-2.5 py-1 rounded-lg text-xs font-medium ${statusCls}`}>
        {a.status}
      </span>
    </div>
  );
}

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [bookError, setBookError] = useState('');
  const [form, setForm] = useState({
    customerId: '',
    appointmentDate: '',
    appointmentTime: '',
    lines: [],
    totalAmount: 0,
    notes: '',
  });

  const load = () => {
    const from = istDateStr(new Date(Date.now() - HISTORY_DAYS_BACK * 86400000));
    const to = istDateStr(new Date(Date.now() + FUTURE_DAYS_AHEAD * 86400000));
    fetch(`${API}/appointments?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => d.success && setAppointments(d.data));
  };

  const bookableTimeOptions = useMemo(() => getBookableTimeOptions(form.appointmentDate), [form.appointmentDate]);

  const [sectionClockTick, setSectionClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSectionClockTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { upcomingList, todayList, historyList } = useMemo(() => {
    const today = istDateStr();
    const sortKey = (a) => {
      const ymd = appointmentDateToYmd(a.appointment_date);
      const t = String(a.appointment_time || '00:00:00').slice(0, 8);
      return `${ymd} ${t}`;
    };
    const ymdOf = (a) => appointmentDateToYmd(a.appointment_date);

    const upcomingList = appointments.filter((a) => isAppointmentUpcomingInIST(a));
    const todayList = appointments.filter(
      (a) => !isAppointmentUpcomingInIST(a) && ymdOf(a) === today
    );
    const historyList = appointments.filter(
      (a) => !isAppointmentUpcomingInIST(a) && ymdOf(a) < today
    );

    upcomingList.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    todayList.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
    historyList.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

    return { upcomingList, todayList, historyList };
  }, [appointments, sectionClockTick]);

  useEffect(() => {
    setForm((f) => {
      const opts = getBookableTimeOptions(f.appointmentDate);
      if (f.appointmentTime && !opts.some((o) => o.value === f.appointmentTime)) {
        return { ...f, appointmentTime: '' };
      }
      return f;
    });
  }, [form.appointmentDate]);

  useEffect(() => {
    load();
    fetch(`${API}/customers`)
      .then((r) => r.json())
      .then((d) => d.success && setCustomers(d.data));
    fetch(`${API}/staff`)
      .then((r) => r.json())
      .then((d) => d.success && setStaff(d.data || []));
    fetch(`${API}/services`)
      .then((r) => r.json())
      .then((d) => d.success && setServices(d.data));
  }, []);

  const addService = (e) => {
    const sel = e.target;
    const serviceId = sel.value;
    if (!serviceId) return;
    const s = services.find((x) => String(x.id) === String(serviceId));
    if (!s) return;
    const price = Number(s.price) || 0;
    const key =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `l-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { key, catalogId: s.id, name: s.name, price, staffId: '' }],
      totalAmount: f.totalAmount + price,
    }));
    sel.selectedIndex = 0;
  };

  const removeLine = (key) => {
    setForm((f) => {
      const line = f.lines.find((l) => l.key === key);
      const sub = line?.price || 0;
      return {
        ...f,
        lines: f.lines.filter((l) => l.key !== key),
        totalAmount: Math.max(0, f.totalAmount - sub),
      };
    });
  };

  const setLineStaff = (key, staffId) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.key === key ? { ...l, staffId } : l)),
    }));
  };

  const emptyForm = () => ({
    customerId: '',
    appointmentDate: '',
    appointmentTime: '',
    lines: [],
    totalAmount: 0,
    notes: '',
  });

  const submit = (e) => {
    e.preventDefault();
    setBookError('');
    if (!form.customerId || !form.appointmentDate || !form.appointmentTime) return;
    if (form.lines.length === 0) {
      setBookError('Add at least one service');
      return;
    }
    fetch(`${API}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: Number(form.customerId),
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime,
        services: form.lines.map((l) => l.name),
        serviceLines: form.lines.map((l) => ({
          name: l.name,
          staffId: l.staffId ? Number(l.staffId) : null,
        })),
        totalAmount: form.totalAmount,
        notes: form.notes || undefined,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setForm(emptyForm());
          setShowForm(false);
          load();
        } else {
          setBookError(d.error || 'Could not book appointment');
        }
      })
      .catch(() => setBookError('Network error'));
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Appointments</h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm font-medium shrink-0"
        >
          {showForm ? 'Cancel' : '+ Book'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-8 p-6 bg-white rounded-xl shadow border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">New appointment</h3>
          {bookError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{bookError}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Customer *</label>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                required
              >
                <option value="">Select</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} – {c.phone}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Date *</label>
              <input
                type="date"
                value={form.appointmentDate}
                min={istDateStr()}
                onChange={(e) => setForm({ ...form, appointmentDate: e.target.value, appointmentTime: '' })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Time *</label>
              <select
                value={form.appointmentTime}
                onChange={(e) => setForm({ ...form, appointmentTime: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                required
                disabled={!form.appointmentDate || bookableTimeOptions.length === 0}
              >
                <option value="">
                  {!form.appointmentDate
                    ? 'Choose date first'
                    : bookableTimeOptions.length === 0
                      ? 'No slots left for this date'
                      : 'Select time'}
                </option>
                {bookableTimeOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">Add service</label>
              <select onChange={addService} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Select a service to add</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} – {formatINR(s.price)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {form.lines.length > 0 && (
            <div className="mb-4 space-y-2">
              {form.lines.map((line) => (
                <div
                  key={line.key}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-amber-50/80 border border-amber-100"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-800">{line.name}</span>
                    <span className="text-slate-600 text-sm ml-2">{formatINR(line.price)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={line.staffId}
                      onChange={(e) => setLineStaff(line.key, e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm min-w-[140px]"
                      aria-label={`Staff for ${line.name}`}
                    >
                      <option value="">Staff</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="text-red-600 font-bold px-2 py-1 rounded hover:bg-red-50 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-sm font-medium mt-2 text-slate-700">Est. total: {formatINR(form.totalAmount)}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={form.lines.length === 0}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Book
          </button>
        </form>
      )}

      {appointments.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-100 shadow-sm">
          <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-4" strokeWidth={1.25} />
          <p className="text-slate-600 font-medium">No appointments</p>
          <p className="text-sm text-slate-500 mt-1">
            Nothing in the last {HISTORY_DAYS_BACK} days or the next {FUTURE_DAYS_AHEAD} days.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {upcomingList.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Upcoming</h3>
              <div className="space-y-2">
                {upcomingList.map((a) => (
                  <AppointmentRow key={a.id} a={a} variant="upcoming" />
                ))}
              </div>
            </div>
          )}
          {todayList.length > 0 && (
            <div className={upcomingList.length > 0 ? 'mt-10' : ''}>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Today</h3>
              <div className="space-y-2">
                {todayList.map((a) => (
                  <AppointmentRow key={a.id} a={a} variant="today" />
                ))}
              </div>
            </div>
          )}
          {historyList.length > 0 && (
            <div className={upcomingList.length + todayList.length > 0 ? 'mt-10' : ''}>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">History</h3>
              <div className="space-y-2">
                {historyList.map((a) => (
                  <AppointmentRow key={a.id} a={a} variant="history" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
