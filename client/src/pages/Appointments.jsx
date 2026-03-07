import { useState, useEffect } from 'react';
import { formatINR } from '../utils/formatCurrency';
import { Calendar, Clock } from 'lucide-react';
import { istDateStr } from '../utils/ist';

const API = '/api';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerId: '', appointmentDate: '', appointmentTime: '', services: [], totalAmount: 0, notes: '' });

  const load = () => {
    const from = istDateStr();
    const to = istDateStr(new Date(Date.now() + 30 * 86400000));
    fetch(`${API}/appointments?from=${from}&to=${to}`).then((r) => r.json()).then((d) => d.success && setAppointments(d.data));
  };

  useEffect(() => {
    load();
    fetch(`${API}/customers`).then((r) => r.json()).then((d) => d.success && setCustomers(d.data));
    fetch(`${API}/services`).then((r) => r.json()).then((d) => d.success && setServices(d.data));
  }, []);

  const addService = (e) => {
    const sel = e.target;
    const name = sel.options[sel.selectedIndex]?.text?.split(' – ')[0];
    const price = Number(sel.value) || 0;
    if (!name) return;
    setForm((f) => ({ ...f, services: [...f.services, name], totalAmount: f.totalAmount + price }));
    sel.selectedIndex = 0;
  };

  const removeService = (i) => {
    const s = services.find((x) => x.name === form.services[i]);
    setForm((f) => ({ ...f, services: f.services.filter((_, j) => j !== i), totalAmount: Math.max(0, f.totalAmount - (s?.price || 0)) }));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.customerId || !form.appointmentDate || !form.appointmentTime) return;
    fetch(`${API}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: Number(form.customerId),
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime,
        services: form.services,
        totalAmount: form.totalAmount,
        notes: form.notes,
      }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.success) { setForm({ customerId: '', appointmentDate: '', appointmentTime: '', services: [], totalAmount: 0, notes: '' }); setShowForm(false); load(); } });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Appointments</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
          {showForm ? 'Cancel' : '+ Book'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={submit} className="mb-8 p-6 bg-white rounded-xl shadow border">
          <h3 className="font-semibold text-slate-800 mb-4">New Appointment (WhatsApp confirmation sent)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Customer *</label>
              <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="w-full border rounded px-3 py-2" required>
                <option value="">Select</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} – {c.phone}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Date *</label>
              <input type="date" value={form.appointmentDate} onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })} className="w-full border rounded px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Time *</label>
              <input type="time" value={form.appointmentTime} onChange={(e) => setForm({ ...form, appointmentTime: e.target.value })} className="w-full border rounded px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Add Service</label>
              <select onChange={addService} className="w-full border rounded px-3 py-2">
                <option value="">Select</option>
                {services.map((s) => <option key={s.id} value={s.price}>{s.name} – {formatINR(s.price)}</option>)}
              </select>
            </div>
          </div>
          {form.services.length > 0 && (
            <div className="mb-4">
              {form.services.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 mr-2 mb-2 px-2 py-1 bg-amber-100 rounded">
                  {s} <button type="button" onClick={() => removeService(i)} className="text-red-500">×</button>
                </span>
              ))}
              <p className="text-sm font-medium mt-2">Est. Total: {formatINR(form.totalAmount)}</p>
            </div>
          )}
          <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg">Book</button>
        </form>
      )}
      {appointments.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No upcoming appointments.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => (
            <div key={a.id} className="bg-white rounded-xl p-4 shadow flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Calendar className="text-slate-700" size={20} />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{a.customer_name}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1"><Clock size={12} /> {a.appointment_date} {a.appointment_time}</p>
                  <p className="text-xs text-slate-400">{a.services?.join(', ') || '–'}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${a.status === 'scheduled' ? 'bg-amber-100' : 'bg-slate-100'}`}>{a.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
