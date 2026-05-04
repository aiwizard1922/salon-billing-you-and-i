import { useState, useEffect, useMemo, useRef } from 'react';
import { formatINR } from '../utils/formatCurrency';
import { getBookableTimeOptions, formatAppointmentTimeDisplay } from '../utils/appointmentSlots';
import { Calendar, Clock, UserRound, Search } from 'lucide-react';
import {
  istDateStr,
  formatAppointmentDateDisplay,
  appointmentDateToYmd,
  isAppointmentUpcomingInIST,
} from '../utils/ist';
import { formatAppointmentServiceSummary } from '../utils/appointmentDisplay';
import { SearchableCatalogPicker } from '../components/SearchableCatalogPicker';

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
  const [bookingInfo, setBookingInfo] = useState('');
  const [customerMode, setCustomerMode] = useState('existing');
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', gender: '' });
  const [servicePickerKey, setServicePickerKey] = useState(0);
  const [form, setForm] = useState({
    appointmentDate: '',
    appointmentTime: '',
    lines: [],
    totalAmount: 0,
    notes: '',
  });

  const servicePickerOptions = useMemo(
    () =>
      services.map((s) => ({
        value: String(s.id),
        label: s.name,
        sublabel: `${s.category || 'General'} · ${formatINR(Number(s.price) || 0)}`,
      })),
    [services]
  );

  const staffPickerOptions = useMemo(
    () => staff.map((s) => ({ value: String(s.id), label: s.name })),
    [staff]
  );

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

  const reloadCustomers = () => {
    fetch(`${API}/customers`)
      .then((r) => r.json())
      .then((d) => d.success && setCustomers(d.data));
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const customerSearchLower = String(customerSearch || '').trim().toLowerCase();
  const customerSearchDigits = customerSearchLower.replace(/\D/g, '');
  const filteredCustomersForSelect =
    customerMode !== 'existing'
      ? []
      : !customerSearchLower
        ? customers
        : customers.filter((c) => {
            const name = String(c.name || '').toLowerCase();
            const phone = String(c.phone || '').replace(/\D/g, '');
            return (
              name.includes(customerSearchLower) ||
              (customerSearchDigits.length > 0 && phone.includes(customerSearchDigits))
            );
          });

  useEffect(() => {
    load();
    reloadCustomers();
    fetch(`${API}/staff`)
      .then((r) => r.json())
      .then((d) => d.success && setStaff(d.data || []));
    fetch(`${API}/services`)
      .then((r) => r.json())
      .then((d) => d.success && setServices(d.data));
  }, []);

  const addServiceById = (serviceId) => {
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
    setServicePickerKey((k) => k + 1);
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
    appointmentDate: '',
    appointmentTime: '',
    lines: [],
    totalAmount: 0,
    notes: '',
  });

  const resetCustomerFields = () => {
    setCustomerMode('existing');
    setCustomerId('');
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    setNewCustomer({ name: '', phone: '', gender: '' });
  };

  const submit = (e) => {
    e.preventDefault();
    setBookError('');
    setBookingInfo('');
    if (customerMode === 'existing') {
      if (!customerId) {
        setBookError('Select a customer');
        return;
      }
    } else if (!newCustomer.name?.trim() || !newCustomer.phone?.trim()) {
      setBookError('Enter name and phone for the new customer');
      return;
    }
    if (!form.appointmentDate || !form.appointmentTime) return;
    if (form.lines.length === 0) {
      setBookError('Add at least one service');
      return;
    }
    const payload = {
      appointmentDate: form.appointmentDate,
      appointmentTime: form.appointmentTime,
      services: form.lines.map((l) => l.name),
      serviceLines: form.lines.map((l) => ({
        name: l.name,
        staffId: l.staffId ? Number(l.staffId) : null,
      })),
      totalAmount: form.totalAmount,
      notes: form.notes || undefined,
    };
    if (customerMode === 'existing') {
      payload.customerId = Number(customerId);
    } else {
      payload.customer = {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        gender: newCustomer.gender || undefined,
      };
    }
    fetch(`${API}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setForm(emptyForm());
          setServicePickerKey((k) => k + 1);
          resetCustomerFields();
          setShowForm(false);
          setBookingInfo(d.customerMatchNotice || '');
          load();
          reloadCustomers();
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
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) {
              setBookError('');
              setBookingInfo('');
            } else {
              resetCustomerFields();
              setForm(emptyForm());
              setServicePickerKey((k) => k + 1);
            }
          }}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm font-medium shrink-0"
        >
          {showForm ? 'Cancel' : '+ Book'}
        </button>
      </div>

      {bookingInfo && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm flex justify-between gap-3 items-start">
          <span>{bookingInfo}</span>
          <button type="button" className="text-amber-800 hover:underline shrink-0 text-xs" onClick={() => setBookingInfo('')}>
            Dismiss
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="mb-8 p-6 bg-white rounded-xl shadow border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">New appointment</h3>
          {bookError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{bookError}</div>
          )}
          <div className="mb-4 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="radio"
                name="apptCustomerMode"
                checked={customerMode === 'existing'}
                onChange={() => {
                  setCustomerMode('existing');
                  setBookError('');
                }}
              />
              Existing customer
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="radio"
                name="apptCustomerMode"
                checked={customerMode === 'new'}
                onChange={() => {
                  setCustomerMode('new');
                  setCustomerId('');
                  setCustomerSearch('');
                  setShowCustomerDropdown(false);
                  setBookError('');
                }}
              />
              New customer
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {customerMode === 'existing' ? (
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-600 mb-1">Customer *</label>
                <div className="relative max-w-xl" ref={customerDropdownRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                  <input
                    type="text"
                    placeholder="Search by name or phone…"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCustomerId('');
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full pl-9 pr-8 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    autoComplete="off"
                  />
                  {customerId && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      title="Clear"
                      onClick={() => {
                        setCustomerId('');
                        setCustomerSearch('');
                        setShowCustomerDropdown(false);
                      }}
                    >
                      ×
                    </button>
                  )}
                  {showCustomerDropdown && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                      {filteredCustomersForSelect.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-slate-500">No customers match</div>
                      ) : (
                        filteredCustomersForSelect.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCustomerId(String(c.id));
                              setCustomerSearch(`${c.name} – ${c.phone}`);
                              setShowCustomerDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${String(customerId) === String(c.id) ? 'bg-amber-50 text-amber-900' : ''}`}
                          >
                            {c.name} – {c.phone}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Customer name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Mobile number"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Gender (optional)</label>
                  <select
                    value={newCustomer.gender}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, gender: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full sm:w-48"
                  >
                    <option value="">Not set</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <p className="sm:col-span-2 text-xs text-slate-500">
                  They will be added to your customer list when you book. If the phone already exists, we link to that profile.
                </p>
              </div>
            )}
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
              <SearchableCatalogPicker
                key={servicePickerKey}
                value=""
                onChange={(v) => {
                  if (v) addServiceById(v);
                }}
                options={servicePickerOptions}
                emptyLabel="Search service to add…"
              />
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
                  <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                    <div className="min-w-[10rem] sm:w-44 flex-1 sm:flex-initial">
                      <SearchableCatalogPicker
                        className="w-full"
                        value={line.staffId ? String(line.staffId) : ''}
                        onChange={(v) => setLineStaff(line.key, v)}
                        options={staffPickerOptions}
                        emptyLabel="Staff"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="text-red-600 font-bold px-2 py-1 rounded hover:bg-red-50 text-sm shrink-0"
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
