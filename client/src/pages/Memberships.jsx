import { useState, useEffect } from 'react';
import { formatINR } from '../utils/formatCurrency';
import { Gift, Plus, Users, ArrowUpCircle, Wallet } from 'lucide-react';

const API = '/api';

export default function Memberships() {
  const [plans, setPlans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', price: 0, benefits: '', specialPrice: '' });
  const [assignForm, setAssignForm] = useState({ customerId: '', planId: '' });
  const [assignError, setAssignError] = useState('');

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

  const upgrade = (id, planId) => {
    fetch(`${API}/membership/upgrade/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: Number(planId) }),
    })
      .then((r) => r.json())
      .then((d) => d.success && (setActionModal(null), load()));
  };

  const topUp = (id, amount) => {
    fetch(`${API}/membership/top-up/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount) }),
    })
      .then((r) => r.json())
      .then((d) => d.success && (setActionModal(null), load()));
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
      body: JSON.stringify({
        ...planForm,
        price: parseFloat(planForm.price) || 0,
        specialPrice: planForm.specialPrice ? parseFloat(planForm.specialPrice) : null,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setPlanForm({ name: '', price: 0, benefits: '', specialPrice: '' });
          setShowPlanForm(false);
          load();
        }
      });
  };

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (!assignForm.customerId || !assignForm.planId) {
      setAssignError('Please select both a customer and a plan.');
      return;
    }
    setAssignError('');
    const payload = {
      customerId: Number(assignForm.customerId),
      planId: Number(assignForm.planId),
      startDate: new Date().toISOString().slice(0, 10),
    };
    fetch(`${API}/customer-memberships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setAssignForm({ customerId: '', planId: '' });
          setShowAssignForm(false);
          setAssignError('');
          load();
        } else {
          setAssignError(d.error || 'Failed to assign membership');
        }
      })
      .catch((err) => setAssignError(err.message || 'Request failed'));
  };

  // Same effective balance for display and status - Active when balance > 0, Expired when 0
  const effectiveBalance = (a) => Number(a.remaining_balance ?? a.initial_balance ?? a.plan_price ?? 0);
  const isActive = (a) => effectiveBalance(a) > 0;

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
                  placeholder="e.g. 5K Membership"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Price / Credit (₹) *</label>
                <input
                  type="number"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-lg px-3 py-2"
                  min={0}
                  step={0.01}
                  placeholder="Amount customer pays = credit they get"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Special Price (₹)</label>
                <input
                  type="number"
                  value={planForm.specialPrice}
                  onChange={(e) => setPlanForm({ ...planForm, specialPrice: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  min="0"
                  step="0.01"
                  placeholder="Optional (credit if different)"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Benefits</label>
                <input
                  type="text"
                  value={planForm.benefits}
                  onChange={(e) => setPlanForm({ ...planForm, benefits: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g. Pay from balance at checkout"
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
                {formatINR(p.special_price ?? p.price)} credit · Pay from balance at checkout
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
            {assignError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{assignError}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {p.name} – {formatINR(p.special_price ?? p.price)} credit
                    </option>
                  ))}
                </select>
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
            <div className="px-4 py-2 bg-slate-50 border-b text-sm text-slate-600">
              Total: <strong>{assignments.length}</strong> membership(s)
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-center py-3 px-4 font-medium text-slate-600 w-14">Sl No</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Membership ID (Phone)</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Plan</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Uses</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Balance</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a, i) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-center text-slate-600">{i + 1}</td>
                    <td className="py-3 px-4 font-mono text-sm font-medium">{a.customer_phone || `MEM-${a.id}`}</td>
                    <td className="py-3 px-4">{a.customer_name}</td>
                    <td className="py-3 px-4">{a.plan_name}</td>
                    <td className="py-3 px-4 text-center">{a.usage_count || 0}</td>
                    <td className="py-3 px-4 text-right">
                      {formatINR(effectiveBalance(a))}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs ${isActive(a) ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {isActive(a) ? 'Active' : 'Expired'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isActive(a) && (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => setActionModal({ type: 'upgrade', id: a.id, plans })}
                            className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                            title="Upgrade"
                          >
                            <ArrowUpCircle size={12} />
                          </button>
                          <button
                            onClick={() => setActionModal({ type: 'topup', id: a.id })}
                            className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                            title="Top-up balance"
                          >
                            <Wallet size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            {actionModal.type === 'upgrade' && (
              <>
                <h3 className="font-semibold text-slate-800 mb-4">Upgrade Membership</h3>
                <select
                  id="upgradePlan"
                  className="w-full border rounded-lg px-3 py-2 mb-4"
                >
                  {actionModal.plans?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} – {formatINR(p.price)}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => upgrade(actionModal.id, document.getElementById('upgradePlan')?.value)}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg"
                  >
                    Upgrade
                  </button>
                  <button onClick={() => setActionModal(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
                </div>
              </>
            )}
            {actionModal.type === 'topup' && (
              <>
                <h3 className="font-semibold text-slate-800 mb-4">Top-up Balance</h3>
                <input
                  id="topupAmount"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="Amount (₹)"
                  className="w-full border rounded-lg px-3 py-2 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => topUp(actionModal.id, document.getElementById('topupAmount')?.value)}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg"
                  >
                    Top-up
                  </button>
                  <button onClick={() => setActionModal(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
