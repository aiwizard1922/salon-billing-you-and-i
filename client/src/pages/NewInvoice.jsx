import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { formatINR } from '../utils/formatCurrency';

const API = '/api';

export default function NewInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preset = searchParams.get('customer');

  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [customerMode, setCustomerMode] = useState(preset ? 'existing' : 'new');
  const [customerId, setCustomerId] = useState(preset || '');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [lookupFound, setLookupFound] = useState(null);
  const [items, setItems] = useState([{ service_name: '', unit_price: 0, quantity: 1 }]);
  const [taxPercent, setTaxPercent] = useState(18);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeMembership, setActiveMembership] = useState(null);
  const [activeMembershipWithBalance, setActiveMembershipWithBalance] = useState(null);

  useEffect(() => {
    fetch(`${API}/customers`).then((r) => r.json()).then((d) => d.success && setCustomers(d.data));
    fetch(`${API}/services`).then((r) => r.json()).then((d) => d.success && setServices(d.data));
  }, []);

  useEffect(() => {
    if (preset) {
      setCustomerMode('existing');
      setCustomerId(preset);
    }
  }, [preset]);

  useEffect(() => {
    if (customerMode === 'existing' && customerId) {
      Promise.all([
        fetch(`${API}/membership/for-customer?customerId=${customerId}`).then((r) => r.json()),
        fetch(`${API}/membership/active?customerId=${customerId}`).then((r) => r.json()),
      ]).then(([fc, ac]) => {
        setActiveMembership(fc.data || null);
        setActiveMembershipWithBalance(ac.data || null);
      });
    } else {
      setActiveMembership(null);
      setActiveMembershipWithBalance(null);
    }
  }, [customerMode, customerId]);

  const lookupByPhone = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 10) {
      setLookupFound(null);
      return;
    }
    fetch(`${API}/customers/lookup?phone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setLookupFound(d.data);
          setNewCustomer((p) => ({ ...p, name: d.data.name }));
        } else {
          setLookupFound(null);
        }
      })
      .catch(() => setLookupFound(null));
  };

  const addRow = () => setItems([...items, { service_name: '', unit_price: 0, quantity: 1 }]);
  const removeRow = (i) => items.length > 1 && setItems(items.filter((_, j) => j !== i));
  const update = (i, f, v) => {
    const next = [...items];
    next[i] = { ...next[i], [f]: v };
    if (f === 'service_name') {
      const s = services.find((x) => x.name === v);
      if (s) next[i].unit_price = s.price;
    }
    setItems(next);
  };

  const rawSubtotal = items.reduce((s, i) => s + Number(i.unit_price || 0) * (i.quantity || 1), 0);
  const tax = (rawSubtotal * taxPercent) / 100;
  const total = rawSubtotal + tax;
  const membershipBalance = activeMembershipWithBalance
    ? (Number(activeMembershipWithBalance.remaining_balance) ?? Number(activeMembershipWithBalance.initial_balance) ?? 0)
    : 0;
  const canPayFromMembership = customerMode === 'existing' && activeMembershipWithBalance && membershipBalance >= total;

  const canSubmit = () => {
    const hasItems = items.some((i) => i.service_name?.trim());
    if (customerMode === 'existing') return customerId && hasItems;
    return newCustomer.name?.trim() && newCustomer.phone?.trim() && hasItems;
  };

  const submit = (e, payFromMembership = false) => {
    e?.preventDefault?.();
    if (!canSubmit()) return;
    setError('');
    setLoading(true);
    const payload = {
      items: items.filter((i) => i.service_name).map((i) => ({ service_name: i.service_name, unit_price: Number(i.unit_price), quantity: Number(i.quantity) || 1 })),
      taxPercent,
      notes: notes || undefined,
    };
    if (customerMode === 'existing') {
      payload.customerId = Number(customerId);
    } else {
      payload.customer = { name: newCustomer.name.trim(), phone: newCustomer.phone.trim() };
    }
    fetch(`${API}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        let d;
        try {
          d = await r.json();
        } catch {
          throw new Error(r.ok ? 'Invalid response' : 'Server error – is the backend running?');
        }
        if (!d.success) {
          setError(d.error || 'Failed to create invoice');
          return;
        }
        const invoiceId = d.data.id;
        if (payFromMembership && activeMembershipWithBalance && membershipBalance >= Number(d.data.total)) {
          return fetch(`${API}/invoices/${invoiceId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentMethod: 'membership', membershipId: activeMembershipWithBalance.id }),
          })
            .then((r2) => r2.json())
            .then((d2) => {
              if (d2.success) {
                navigate(`/invoices/${invoiceId}`);
              } else {
                setError(d2.error || 'Invoice created but payment failed. You can pay from the invoice view.');
                setTimeout(() => navigate(`/invoices/${invoiceId}`), 2000);
              }
            })
            .catch(() => {
              setError('Invoice created. Go to the invoice to mark as paid from membership.');
              setTimeout(() => navigate(`/invoices/${invoiceId}`), 2000);
            });
        }
        navigate(`/invoices/${invoiceId}`);
      })
      .catch((err) => setError(err.message || 'Request failed'))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">New Invoice</h2>
      <form onSubmit={(e) => submit(e, false)} className="bg-white rounded-xl shadow p-6">
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Customer *</label>
          <div className="flex gap-4 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="customerMode"
                checked={customerMode === 'new'}
                onChange={() => { setCustomerMode('new'); setLookupFound(null); }}
              />
              <span>New customer (add while creating invoice)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="customerMode"
                checked={customerMode === 'existing'}
                onChange={() => { setCustomerMode('existing'); setLookupFound(null); }}
              />
              <span>Select existing</span>
            </label>
          </div>
          {customerMode === 'existing' && activeMembership && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Membership {activeMembership.customer_phone || `MEM-${activeMembership.id}`}</strong> · Balance: {formatINR(
                (Number(activeMembership.remaining_balance) || Number(activeMembership.initial_balance)) ||
                ((activeMembership.usage_count ?? 0) === 0 ? (Number(activeMembership.plan_price) || Number(activeMembership.special_price) || 0) : 0)
              )} · Uses: {activeMembership.usage_count ?? 0}
              <br />
              <span className="text-amber-700">Pay from membership when marking invoice as paid.</span>
            </div>
          )}
          {customerMode === 'existing' ? (
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} – {c.phone}</option>
              ))}
            </select>
          ) : (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Customer name *"
                  value={newCustomer.name}
                  onChange={(e) => {
                    setNewCustomer((p) => ({ ...p, name: e.target.value }));
                    setLookupFound(null);
                  }}
                  className="border rounded-lg px-3 py-2"
                />
                <input
                  type="tel"
                  placeholder="Phone * (tab out to lookup)"
                  value={newCustomer.phone}
                  onChange={(e) => {
                    setNewCustomer((p) => ({ ...p, phone: e.target.value }));
                    setLookupFound(null);
                  }}
                  onBlur={() => lookupByPhone(newCustomer.phone)}
                  className="border rounded-lg px-3 py-2"
                />
              </div>
              {lookupFound && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm flex items-center gap-2">
                  <span className="font-medium">✓ Found existing customer:</span>
                  <span>{lookupFound.name}</span>
                  <span className="text-green-600">({lookupFound.phone})</span>
                </div>
              )}
            </div>
          )}
          {customerMode === 'new' && !lookupFound && (
            <p className="text-xs text-slate-500 mt-1">Enter phone and tab out to auto-fill if customer exists. Customer ID is auto-created.</p>
          )}
        </div>
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">Services / Items *</label>
            <button type="button" onClick={addRow} className="text-amber-600 hover:underline flex items-center gap-1"><Plus size={14} /> Add</button>
          </div>
          <p className="text-xs text-slate-500 mb-2">Add at least one service (e.g. Hair Cut, Facial) that you’re billing for.</p>
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <select value={item.service_name} onChange={(e) => update(i, 'service_name', e.target.value)} className="flex-1 border rounded-lg px-3 py-2">
                <option value="">Select service (Hair Cut, Facial, etc.)</option>
                {services.map((s) => <option key={s.id} value={s.name}>{s.name} – {formatINR(s.price)}</option>)}
              </select>
              <input type="number" min={1} value={item.quantity} onChange={(e) => update(i, 'quantity', e.target.value)} className="w-16 border rounded px-2 py-2 text-center" />
              <input type="number" min={0} step={0.01} value={item.unit_price} onChange={(e) => update(i, 'unit_price', e.target.value)} className="w-24 border rounded px-2 py-2" />
              <button type="button" onClick={() => removeRow(i)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
        <div className="mb-6">
          <label className="block text-sm text-slate-700 mb-1">Tax %</label>
          <input type="number" min={0} step={0.5} value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} className="w-24 border rounded px-3 py-2" />
        </div>
        <div className="mb-6">
          <label className="block text-sm text-slate-700 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded px-3 py-2" rows={2} />
        </div>
        <div className="border-t pt-4 mb-6">
          <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatINR(rawSubtotal)}</span></div>
          <div className="flex justify-between text-slate-600"><span>GST ({taxPercent}% – CGST {taxPercent/2}% + SGST {taxPercent/2}%)</span><span>{formatINR(tax)}</span></div>
          <div className="flex justify-between font-bold text-lg mt-2"><span>Total</span><span>{formatINR(total)}</span></div>
          <p className="text-xs text-slate-500 mt-2">
            {canPayFromMembership ? `Membership balance (₹${membershipBalance.toFixed(0)}) will be deducted (includes GST).` : 'Customer can pay from membership when marking invoice as paid.'}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button type="submit" disabled={loading || !canSubmit()} onClick={(e) => submit(e, false)} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50" title={!canSubmit() ? 'Fill customer details and add at least one service' : ''}>{loading ? 'Creating...' : 'Create Invoice'}</button>
          {canPayFromMembership && (
            <button type="button" disabled={loading || !canSubmit()} onClick={(e) => submit(e, true)} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create & Pay from Membership'}
            </button>
          )}
          {!canSubmit() && (newCustomer.name || newCustomer.phone || customerId) && !items.some((i) => i.service_name?.trim()) && (
            <span className="text-sm text-amber-600">Add at least one service below</span>
          )}
          <button type="button" onClick={() => navigate('/')} className="px-6 py-2 border rounded-lg">Cancel</button>
        </div>
      </form>
    </div>
  );
}
