import { useState, useEffect } from 'react';
import { Plus, Users, Phone, Mail, Briefcase, Calendar, Clock, Target, UserCheck } from 'lucide-react';

const API = '/api';

const TABS = ['Staff', 'Shifts', 'Attendance', 'Goals'];

export default function Staff() {
  const [activeTab, setActiveTab] = useState('Staff');
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [goals, setGoals] = useState([]);
  const [shiftForm, setShiftForm] = useState({ staffId: '', shiftDate: '', startTime: '09:00', endTime: '18:00', breakMinutes: 0 });
  const [attendanceForm, setAttendanceForm] = useState({ staffId: '', attendanceDate: '', checkIn: '', checkOut: '', status: 'present' });
  const [goalForm, setGoalForm] = useState({ staffId: '', periodValue: new Date().toISOString().slice(0, 7), targetAmount: 0, targetCount: 0 });
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

  const loadShifts = () => {
    const from = new Date();
    from.setDate(1);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    to.setDate(0);
    fetch(`${API}/staff/shifts?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`)
      .then((r) => r.json())
      .then((d) => d.success && setShifts(d.data));
  };

  const loadAttendance = () => {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    fetch(`${API}/staff/attendance?from=${from.toISOString().slice(0, 10)}`)
      .then((r) => r.json())
      .then((d) => d.success && setAttendance(d.data));
  };

  const loadGoals = () => {
    fetch(`${API}/staff/goals`).then((r) => r.json()).then((d) => d.success && setGoals(d.data));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, []);

  useEffect(() => {
    if (activeTab === 'Shifts') loadShifts();
    if (activeTab === 'Attendance') loadAttendance();
    if (activeTab === 'Goals') loadGoals();
  }, [activeTab]);

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

  const addShift = (e) => {
    e.preventDefault();
    if (!shiftForm.staffId || !shiftForm.shiftDate) return;
    fetch(`${API}/staff/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shiftForm),
    })
      .then((r) => r.json())
      .then((d) => d.success && (setShiftForm({ staffId: '', shiftDate: '', startTime: '09:00', endTime: '18:00', breakMinutes: 0 }), loadShifts()));
  };

  const addAttendance = (e) => {
    e.preventDefault();
    if (!attendanceForm.staffId || !attendanceForm.attendanceDate) return;
    fetch(`${API}/staff/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendanceForm),
    })
      .then((r) => r.json())
      .then((d) => d.success && (setAttendanceForm({ staffId: '', attendanceDate: new Date().toISOString().slice(0, 10), checkIn: '', checkOut: '', status: 'present' }), loadAttendance()));
  };

  const addGoal = (e) => {
    e.preventDefault();
    if (!goalForm.staffId || !goalForm.periodValue) return;
    fetch(`${API}/staff/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...goalForm, periodType: 'monthly' }),
    })
      .then((r) => r.json())
      .then((d) => d.success && (setGoalForm({ staffId: '', periodValue: new Date().toISOString().slice(0, 7), targetAmount: 0, targetCount: 0 }), loadGoals()));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Staff Management</h2>
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

      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg ${activeTab === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'Staff' && showForm && (
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

      {activeTab === 'Shifts' && (
        <>
          <form onSubmit={addShift} className="mb-6 p-4 bg-white rounded-xl border border-slate-200 flex flex-wrap gap-4">
            <div><label className="block text-xs text-slate-500">Staff</label><select value={shiftForm.staffId} onChange={(e) => setShiftForm({ ...shiftForm, staffId: e.target.value })} className="border rounded px-2 py-1" required><option value="">Select</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="block text-xs text-slate-500">Date</label><input type="date" value={shiftForm.shiftDate} onChange={(e) => setShiftForm({ ...shiftForm, shiftDate: e.target.value })} className="border rounded px-2 py-1" required /></div>
            <div><label className="block text-xs text-slate-500">Start</label><input type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} className="border rounded px-2 py-1" /></div>
            <div><label className="block text-xs text-slate-500">End</label><input type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} className="border rounded px-2 py-1" /></div>
            <div className="flex items-end"><button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg">Add Shift</button></div>
          </form>
          <div className="space-y-2">
            {shifts.map((s) => (
              <div key={s.id} className="bg-white rounded-lg p-3 border flex justify-between">
                <span>{s.staff_name} · {s.shift_date} {s.start_time}-{s.end_time}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'Attendance' && (
        <>
          <form onSubmit={addAttendance} className="mb-6 p-4 bg-white rounded-xl border border-slate-200 flex flex-wrap gap-4">
            <div><label className="block text-xs text-slate-500">Staff</label><select value={attendanceForm.staffId} onChange={(e) => setAttendanceForm({ ...attendanceForm, staffId: e.target.value })} className="border rounded px-2 py-1" required><option value="">Select</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="block text-xs text-slate-500">Date</label><input type="date" value={attendanceForm.attendanceDate || new Date().toISOString().slice(0, 10)} onChange={(e) => setAttendanceForm({ ...attendanceForm, attendanceDate: e.target.value })} className="border rounded px-2 py-1" required /></div>
            <div><label className="block text-xs text-slate-500">Check-in</label><input type="time" value={attendanceForm.checkIn} onChange={(e) => setAttendanceForm({ ...attendanceForm, checkIn: e.target.value })} className="border rounded px-2 py-1" /></div>
            <div><label className="block text-xs text-slate-500">Check-out</label><input type="time" value={attendanceForm.checkOut} onChange={(e) => setAttendanceForm({ ...attendanceForm, checkOut: e.target.value })} className="border rounded px-2 py-1" /></div>
            <div><label className="block text-xs text-slate-500">Status</label><select value={attendanceForm.status} onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value })} className="border rounded px-2 py-1"><option value="present">Present</option><option value="absent">Absent</option><option value="leave">Leave</option><option value="half-day">Half-day</option></select></div>
            <div className="flex items-end"><button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg">Log Attendance</button></div>
          </form>
          <div className="space-y-2">
            {attendance.map((a) => (
              <div key={a.id} className="bg-white rounded-lg p-3 border flex justify-between">
                <span>{a.staff_name} · {a.attendance_date} {a.check_in && `${a.check_in}`} {a.check_out && `- ${a.check_out}`}</span>
                <span className="text-slate-500">{a.status}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'Goals' && (
        <>
          <form onSubmit={addGoal} className="mb-6 p-4 bg-white rounded-xl border border-slate-200 flex flex-wrap gap-4">
            <div><label className="block text-xs text-slate-500">Staff</label><select value={goalForm.staffId} onChange={(e) => setGoalForm({ ...goalForm, staffId: e.target.value })} className="border rounded px-2 py-1" required><option value="">Select</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="block text-xs text-slate-500">Month (YYYY-MM)</label><input type="month" value={goalForm.periodValue} onChange={(e) => setGoalForm({ ...goalForm, periodValue: e.target.value })} className="border rounded px-2 py-1" required /></div>
            <div><label className="block text-xs text-slate-500">Target Amount (₹)</label><input type="number" value={goalForm.targetAmount} onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })} className="border rounded px-2 py-1" min="0" /></div>
            <div><label className="block text-xs text-slate-500">Target Count</label><input type="number" value={goalForm.targetCount} onChange={(e) => setGoalForm({ ...goalForm, targetCount: e.target.value })} className="border rounded px-2 py-1" min="0" /></div>
            <div className="flex items-end"><button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg">Set Goal</button></div>
          </form>
          <div className="space-y-2">
            {goals.map((g) => (
              <div key={g.id} className="bg-white rounded-lg p-3 border flex justify-between">
                <span>{g.staff_name} · {g.period_value}</span>
                <span>₹{g.target_amount} / {g.target_count} services</span>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'Staff' && loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : activeTab === 'Staff' && staff.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No staff yet. Add your first team member.</p>
        </div>
      ) : activeTab === 'Staff' ? (
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
      ) : null}
    </div>
  );
}
