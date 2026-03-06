import { useState, useEffect } from 'react';
import { formatINR } from '../utils/formatCurrency';
import { Gift, Plus, Users } from 'lucide-react';

const API = '/api';

export default function Memberships() {
  const [plans, setPlans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', durationDays: 30, price: 0, benefits: '' });
  const [assignForm, setAssignForm] = useState({ customerId: '', planId: '', startDate: new Date().toISOString().slice(0, 10) });

  const load = () => {
    Promise.all([
      fetch(`${API}/membership-plans?active=false`).then((r) => r.json()),
      fetch(`${API}/customers`).then((r) => r.json()),
      fetch(`${API}/customer-memberships`).then((r) => r.json()),
    ])
      .then(([pRes, cRes, aRes]) => {
        if (pRes.success) setPlans(pRes.data);
        if (cRes.success) setCustomers(cRes.data);
        if (aRes.success) setAssignments(aRes.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, []);

  const handlePlanSubmit = (e) => {
    e.preventDefault();
    if (!planForm.name?.trim()) return;
    fetch(`${API}/membership-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planForm),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setPlanForm({ name: '', durationDays: 30, price: 0, benefits: '' });
          setShowPlanForm(false);
          load();
        }
      });
  };

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (!assignForm.customerId || !assignForm.planId || !assignForm.startDate) return;
    fetch(`${API}/customer-memberships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignForm),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setAssignForm({ customerId: '', planId: '', startDate: new Date().toISOString().slice(0, 10) });
          setShowAssignForm(false);
          load();
        }
      });
  };

  const isActive = (a) => a.status === 'active' && new Date(a.end_date) >= new Date();

  if (loading) return <div className="text-slate-600">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Memberships</h2>

      {/* Plans */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800">Membership Plans</h3>
          <button
            onClick={() => setShowPlanForm(!showPlanForm)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm"
          >
            <Plus size={16} /> Add Plan
          </button>
        </div>
        {showPlanForm && (
          <form onSubmit={handlePlanSubmit} className="mb-4 p-4 bg-white rounded-xl border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Plan name *</label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g. Gold, Monthly"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Duration (days)</label>
                <input
                  type="number"
                  value={planForm.durationDays}
                  onChange={(e) => setPlanForm({ ...planForm, durationDays: parseInt(e.target.value, 10) || 30 })}
                  className="w-full border rounded-lg px-3 py-2"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Price (₹)</label>
                <input
                  type="number"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-lg px-3 py-2"
                  min={0}
                  step={0.01}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Benefits</label>
                <input
                  type="text"
                  value={planForm.benefits}
                  onChange={(e) => setPlanForm({ ...planForm, benefits: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g. 20% off services"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg">
                Save Plan
              </button>
              <button type="button" onClick={() => setShowPlanForm(false)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-5 h-5 text-amber-500" />
                <span className="font-semibold text-slate-800">{p.name}</span>
              </div>
              <p className="text-sm text-slate-600">
                {p.duration_days} days · {formatINR(p.price)}
              </p>
              {p.benefits && <p className="text-xs text-slate-500 mt-1">{p.benefits}</p>}
            </div>
          ))}
          {plans.length === 0 && !showPlanForm && (
            <p className="text-slate-500 col-span-full">No plans yet. Add a membership plan.</p>
          )}
        </div>
      </div>

      {/* Assign membership to customer */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800">Assign to Customer</h3>
          <button
            onClick={() => setShowAssignForm(!showAssignForm)}
            className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
          >
            <Plus size={16} /> Assign
          </button>
        </div>
        {showAssignForm && (
          <form onSubmit={handleAssignSubmit} className="mb-4 p-4 bg-white rounded-xl border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Customer *</label>
                <select
                  value={assignForm.customerId}
                  onChange={(e) => setAssignForm({ ...assignForm, customerId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Plan *</label>
                <select
                  value={assignForm.planId}
                  onChange={(e) => setAssignForm({ ...assignForm, planId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Select plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} – {p.duration_days} days
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Start date *</label>
                <input
                  type="date"
                  value={assignForm.startDate}
                  onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded-lg">
                Assign
              </button>
              <button type="button" onClick={() => setShowAssignForm(false)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Active memberships list */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-4">Customer Memberships</h3>
        {assignments.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No membership assignments yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Plan</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Start</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">End</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="py-3 px-4">{a.customer_name}</td>
                    <td className="py-3 px-4">{a.plan_name}</td>
                    <td className="py-3 px-4">{a.start_date}</td>
                    <td className="py-3 px-4">{a.end_date}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs ${isActive(a) ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {isActive(a) ? 'Active' : 'Expired'}
                      </span>
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
