import { useState, useEffect } from 'react';
import { Plus, Users, Phone, Mail, Briefcase, Calendar } from 'lucide-react';

const API = '/api';

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', role: '', joinDate: '', notes: '' });

  const load = () => {
    fetch(`${API}/staff?active=false`)
      .then((r) => r.json())
      .then((d) => d.success && setStaff(d.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    const payload = { ...form, joinDate: form.joinDate || null };
    if (editingId) {
      fetch(`${API}/staff/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setForm({ name: '', phone: '', email: '', role: '', joinDate: '', notes: '' });
            setShowForm(false);
            setEditingId(null);
            load();
          }
        });
    } else {
      fetch(`${API}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setForm({ name: '', phone: '', email: '', role: '', joinDate: '', notes: '' });
            setShowForm(false);
            load();
          }
        });
    }
  };

  const startEdit = (s) => {
    setForm({
      name: s.name || '',
      phone: s.phone || '',
      email: s.email || '',
      role: s.role || '',
      joinDate: s.join_date ? s.join_date.slice(0, 10) : '',
      notes: s.notes || '',
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const toggleActive = (s) => {
    fetch(`${API}/staff/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: s.name,
        phone: s.phone,
        email: s.email,
        role: s.role,
        joinDate: s.join_date ? s.join_date.slice(0, 10) : null,
        notes: s.notes,
        isActive: !s.is_active,
      }),
    })
      .then((r) => r.json())
      .then((d) => d.success && load());
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Staff</h2>
        <button
          onClick={() => {
            setForm({ name: '', phone: '', email: '', role: '', joinDate: '', notes: '' });
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
        >
          <Plus size={18} /> Add Staff
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 bg-white rounded-xl shadow border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">{editingId ? 'Edit Staff' : 'New Staff'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="e.g. 9876543210"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Role</label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="e.g. Hairstylist, Colorist"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Join Date</label>
              <input
                type="date"
                value={form.joinDate}
                onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                rows={2}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg">
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No staff yet. Add your first team member.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((s) => (
            <div
              key={s.id}
              className={`bg-white rounded-xl p-4 shadow border ${s.is_active ? 'border-slate-200' : 'border-slate-200 opacity-75 bg-slate-50'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-slate-700 font-semibold text-lg">{s.name[0]}</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{s.name}</p>
                    {s.role && (
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Briefcase size={12} /> {s.role}
                      </p>
                    )}
                    {s.phone && (
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Phone size={12} /> {s.phone}
                      </p>
                    )}
                    {s.email && (
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Mail size={12} /> {s.email}
                      </p>
                    )}
                    {s.join_date && (
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Calendar size={12} /> Joined {new Date(s.join_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(s)} className="text-amber-600 hover:underline text-sm">
                    Edit
                  </button>
                  <button onClick={() => toggleActive(s)} className="text-slate-500 hover:underline text-sm">
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
