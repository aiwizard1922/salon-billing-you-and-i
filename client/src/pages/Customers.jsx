import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Pencil, User, Search, Mail } from 'lucide-react';

const API = '/api';

const inputClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', gender: '', notes: '' });
  const [search, setSearch] = useState('');
  const [saveError, setSaveError] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = () => {
    setLoadError('');
    fetch(`${API}/customers`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCustomers(d.data || []);
        else setLoadError(d.error || 'Failed to load customers');
      })
      .catch((e) => setLoadError(e.message || 'Network error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, []);

  const searchLower = String(search || '').trim().toLowerCase();
  const searchDigits = searchLower.replace(/\D/g, '');

  const filteredCustomers = useMemo(() => {
    const list = !searchLower
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
    return [...list].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
    );
  }, [customers, searchLower, searchDigits]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.phone?.trim()) return;
    setSaveError('');
    const payload = { ...form, gender: form.gender || null };
    const url = editingId ? `${API}/customers/${editingId}` : `${API}/customers`;
    const method = editingId ? 'PUT' : 'POST';
    fetch(url, {
      method,
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
        } else {
          setSaveError(d.error || 'Failed to save. Check database connection.');
        }
      })
      .catch((err) => setSaveError(err.message || 'Request failed. Is the server running?'));
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Customers</h2>
        <button
          type="button"
          onClick={() => {
            setForm({ name: '', phone: '', email: '', gender: '', notes: '' });
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 w-full sm:w-auto"
        >
          <Plus size={18} /> {showForm && !editingId ? 'Close' : 'Add customer'}
        </button>
      </div>

      {loadError && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex flex-wrap items-center gap-2">
          {loadError}
          <button type="button" onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-6 bg-white rounded-xl shadow border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">{editingId ? 'Edit customer' : 'New customer'}</h3>
          {saveError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{saveError}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Phone * (WhatsApp)</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
                placeholder="e.g. 9876543210"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className={`${inputClass} bg-white`}
              >
                <option value="">Not set</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass}
                rows={2}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
        {!loading && customers.length > 0 && (
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 min-w-0 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search name, phone, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
              />
            </div>
            <p className="text-sm text-slate-500 tabular-nums shrink-0">
              {filteredCustomers.length === customers.length
                ? `${customers.length} total`
                : `${filteredCustomers.length} of ${customers.length}`}
            </p>
          </div>
        )}

        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="w-8 h-4 bg-slate-100 rounded shrink-0" />
                <div className="flex-1 space-y-2 max-w-md">
                  <div className="h-4 bg-slate-100 rounded w-2/5" />
                  <div className="h-3 bg-slate-100 rounded w-3/5 sm:hidden" />
                </div>
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <Users className="w-14 h-14 text-slate-200 mx-auto mb-3" strokeWidth={1.25} />
            <p className="text-slate-600 font-medium">No customers yet</p>
            <p className="text-sm text-slate-500 mt-1">Add a customer to get started.</p>
            <button
              type="button"
              onClick={() => {
                setForm({ name: '', phone: '', email: '', gender: '', notes: '' });
                setEditingId(null);
                setShowForm(true);
              }}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700"
            >
              <Plus size={18} /> Add customer
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-14 px-6 text-center text-slate-600">
            <p>No matches for &quot;{search}&quot;</p>
            <button type="button" onClick={() => setSearch('')} className="mt-3 text-sm text-amber-700 hover:underline font-medium">
              Clear search
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm sm:min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-center py-3 px-2 w-10 font-medium text-slate-600 tabular-nums">#</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 w-[9.5rem] hidden sm:table-cell">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 min-w-[10rem]">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 w-24">Gender</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 w-[11rem]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-2 text-center text-slate-500 tabular-nums text-xs sm:text-sm">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="min-w-0">
                        <Link
                          to={`/customers/${c.id}`}
                          className="font-medium text-slate-900 hover:text-amber-700 truncate block"
                          title={c.name}
                        >
                          {c.name || 'Unnamed'}
                        </Link>
                        <p className="text-slate-500 text-xs mt-0.5 sm:hidden tabular-nums truncate">{c.phone || '—'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 tabular-nums align-middle hidden sm:table-cell">{c.phone || '—'}</td>
                    <td className="py-3 px-4 text-slate-600 align-middle">
                      {c.email ? (
                        <span className="inline-flex items-center gap-1.5 min-w-0 max-w-[14rem]">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate" title={c.email}>
                            {c.email}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 capitalize align-middle">{c.gender || '—'}</td>
                    <td className="py-3 px-4 align-middle">
                      <div className="flex items-center justify-end gap-1 flex-nowrap">
                        <Link
                          to={`/customers/${c.id}`}
                          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                          title="Profile"
                        >
                          <User size={16} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <Link
                          to={`/invoices/new?customer=${c.id}`}
                          className="ml-1 text-amber-700 hover:text-amber-800 font-medium text-xs sm:text-sm whitespace-nowrap"
                        >
                          Quick sale
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
