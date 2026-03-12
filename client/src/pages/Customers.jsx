import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Phone, Pencil, User, Search } from 'lucide-react';

const API = '/api';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', gender: '', notes: '' });
  const [search, setSearch] = useState('');

  const load = () => {
    fetch(`${API}/customers`)
      .then((r) => r.json())
      .then((d) => d.success && setCustomers(d.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); load(); }, []);

  const searchLower = String(search || '').trim().toLowerCase();
  const searchDigits = searchLower.replace(/\D/g, '');
  const filteredCustomers = !searchLower
    ? customers
    : customers.filter((c) => {
        const name = String(c.name || c.customer_name || '').toLowerCase();
        const phone = String(c.phone || '').replace(/\D/g, '');
        const email = String(c.email || '').toLowerCase();
        return (
          name.includes(searchLower) ||
          (searchDigits.length > 0 && phone.includes(searchDigits)) ||
          email.includes(searchLower)
        );
      });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.phone?.trim()) return;
    const payload = { ...form, gender: form.gender || null };
    if (editingId) {
      fetch(`${API}/customers/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setForm({ name: '', phone: '', email: '', gender: '', notes: '' });
            setShowForm(false);
            setEditingId(null);
            load();
          }
        });
    } else {
      fetch(`${API}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setForm({ name: '', phone: '', email: '', gender: '', notes: '' });
            setShowForm(false);
            load();
          }
        });
    }
  };

  const startEdit = (c) => {
    setForm({
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      gender: c.gender || '',
      notes: c.notes || '',
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Customers</h2>
        <button
          onClick={() => {
            setForm({ name: '', phone: '', email: '', gender: '', notes: '' });
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
        >
          <Plus size={18} /> Add Customer
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 bg-white rounded-xl shadow border">
          <h3 className="font-semibold text-slate-800 mb-4">{editingId ? 'Edit Customer' : 'New Customer'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Phone * (for WhatsApp)</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. 9876543210" required />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">Not set</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={2} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg">{editingId ? 'Update' : 'Save'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border rounded-lg">Cancel</button>
          </div>
        </form>
      )}
      {!loading && customers.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-300 focus:border-slate-400 bg-white"
          />
        </div>
      )}
      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No customers yet.</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No customers match &quot;{search}&quot;.</p>
          <button onClick={() => setSearch('')} className="mt-2 text-amber-600 hover:underline text-sm">Clear search</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCustomers.map((c) => (
            <div key={c.id} className="bg-white rounded-xl p-4 shadow flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="text-slate-700 font-semibold">{c.name[0]}</span>
                </div>
                <div>
                  <p className="font-medium text-slate-800">{c.name}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1"><Phone size={12} /> {c.phone}</p>
                  {c.gender && <p className="text-xs text-slate-400 capitalize">{c.gender}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/customers/${c.id}`} className="p-1.5 text-slate-500 hover:text-blue-600" title="View profile">
                  <User size={16} />
                </Link>
                <button onClick={() => startEdit(c)} className="p-1.5 text-slate-500 hover:text-amber-600" title="Edit">
                  <Pencil size={16} />
                </button>
                <Link to={`/invoices/new?customer=${c.id}`} className="text-amber-600 hover:underline text-sm">Create invoice</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
