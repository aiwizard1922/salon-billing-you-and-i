import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, FileText, Calendar, Tag, MessageSquare, Plus, DollarSign } from 'lucide-react';
import { formatINR } from '../utils/formatCurrency';

const API = '/api';

export default function CustomerProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newPrefKey, setNewPrefKey] = useState('');
  const [newPrefValue, setNewPrefValue] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`${API}/crm/customers/${id}`)
      .then((r) => r.json())
      .then((d) => d.success && setData(d.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const addNote = (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    fetch(`${API}/crm/customers/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: newNote.trim() }),
    })
      .then((r) => r.json())
      .then((d) => d.success && (setNewNote(''), load()));
  };

  const addTag = (e) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    fetch(`${API}/crm/customers/${id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: newTag.trim() }),
    })
      .then((r) => r.json())
      .then((d) => d.success && (setNewTag(''), load()));
  };

  const removeTag = (tag) => {
    fetch(`${API}/crm/customers/${id}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' })
      .then((r) => r.json())
      .then((d) => d.success && load());
  };

  const setPref = (e) => {
    e.preventDefault();
    if (!newPrefKey.trim()) return;
    fetch(`${API}/crm/customers/${id}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newPrefKey.trim(), value: newPrefValue }),
    })
      .then((r) => r.json())
      .then((d) => d.success && (setNewPrefKey(''), setNewPrefValue(''), load()));
  };

  if (loading && !data) return <div className="text-slate-600">Loading...</div>;
  if (!data) return <div className="text-slate-500">Customer not found.</div>;

  const { customer, invoices, appointments, preferences, tags, notes, totalSpent, visitCount, lastVisit } = data;

  return (
    <div>
      <div className="mb-6">
        <Link to="/customers" className="text-amber-600 hover:underline text-sm">← Back to Customers</Link>
      </div>

      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-wrap gap-6">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-2xl font-bold text-slate-700">{customer.name[0]}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{customer.name}</h2>
            <p className="text-slate-600">{customer.phone}</p>
            {customer.email && <p className="text-slate-500 text-sm">{customer.email}</p>}
          </div>
          <div className="flex flex-wrap gap-4 ml-auto">
            <div className="text-center">
              <p className="text-xs text-slate-500">Total Spent</p>
              <p className="font-bold text-slate-800">{formatINR(totalSpent)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Visits</p>
              <p className="font-bold text-slate-800">{visitCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Last Visit</p>
              <p className="font-bold text-slate-800">{lastVisit ? new Date(lastVisit).toLocaleDateString() : '-'}</p>
            </div>
            <Link
              to={`/invoices/new?customer=${customer.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 self-center"
            >
              <Plus size={18} /> New Invoice
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
          <div className="lg:col-span-2 p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <FileText size={18} /> Recent Invoices
              </h3>
              {invoices.length === 0 ? (
                <p className="text-slate-500 text-sm">No invoices yet.</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <Link key={inv.id} to={`/invoices/${inv.id}`} className="flex justify-between items-center p-3 rounded-lg hover:bg-slate-50">
                      <span className="font-medium">{inv.invoice_number}</span>
                      <span className={inv.status === 'paid' ? 'text-green-600' : 'text-amber-600'}>{formatINR(inv.total)} · {inv.status}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Calendar size={18} /> Appointments
              </h3>
              {appointments.length === 0 ? (
                <p className="text-slate-500 text-sm">No appointments yet.</p>
              ) : (
                <div className="space-y-2">
                  {appointments.map((a) => (
                    <div key={a.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-50">
                      <span>{a.appointment_date} {a.appointment_time}</span>
                      <span className="text-slate-600">{Array.isArray(a.services) ? a.services.join(', ') : a.services}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <MessageSquare size={18} /> Notes
              </h3>
              <form onSubmit={addNote} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 border rounded-lg px-3 py-2"
                />
                <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg">Add</button>
              </form>
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="p-3 rounded-lg bg-slate-50 text-sm">
                    <p>{n.note}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(n.created_at).toLocaleString()}{n.staff_name && ` · ${n.staff_name}`}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 border-l border-slate-200 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Tag size={18} /> Tags
              </h3>
              <form onSubmit={addTag} className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag..."
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <button type="submit" className="px-3 py-2 bg-slate-100 rounded-lg text-sm">Add</button>
              </form>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="px-2 py-1 bg-slate-100 rounded text-sm flex items-center gap-1">
                    {t}
                    <button onClick={() => removeTag(t)} className="text-slate-400 hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Preferences</h3>
              <form onSubmit={setPref} className="flex gap-2 mb-3">
                <input type="text" value={newPrefKey} onChange={(e) => setNewPrefKey(e.target.value)} placeholder="Key (e.g. preferred_stylist)" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                <input type="text" value={newPrefValue} onChange={(e) => setNewPrefValue(e.target.value)} placeholder="Value" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                <button type="submit" className="px-3 py-2 bg-slate-100 rounded-lg text-sm">Set</button>
              </form>
              <div className="space-y-1 text-sm">
                {Object.entries(preferences || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="text-slate-600">{k}</span><span>{v || '-'}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
