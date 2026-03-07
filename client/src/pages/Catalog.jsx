import { useState, useEffect } from 'react';
import { Scissors, Tag, Plus } from 'lucide-react';
import { formatINR } from '../utils/formatCurrency';
import { istDateStr } from '../utils/ist';

const API = '/api';

export default function Catalog() {
  const [services, setServices] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('services');
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editingPromo, setEditingPromo] = useState(null);
  const [serviceForm, setServiceForm] = useState({ name: '', category: 'General', price: 0, durationMins: 30, description: '' });
  const [promoForm, setPromoForm] = useState({ name: '', description: '', discountType: 'percent', discountValue: 0, minPurchase: 0, startDate: '', endDate: '' });

  const load = () => {
    Promise.all([
      fetch(`${API}/catalog/services?active=false`).then((r) => r.json()),
      fetch(`${API}/catalog/promotions?active=false`).then((r) => r.json()),
      fetch(`${API}/catalog/services/categories`).then((r) => r.json()).catch(() => ({ success: false, data: [] })),
    ])
      .then(([sRes, pRes, cRes]) => {
        if (sRes.success) setServices(sRes.data);
        if (pRes.success) setPromotions(pRes.data);
        if (cRes.success && cRes.data?.length) setCategories(cRes.data);
        else setCategories([...new Set((sRes.data || []).map((s) => s.category).filter(Boolean))].sort());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, []);

  const handleServiceSubmit = (e) => {
    e.preventDefault();
    if (!serviceForm.name?.trim()) return;
    const payload = { ...serviceForm, price: parseFloat(serviceForm.price) || 0, durationMins: parseInt(serviceForm.durationMins, 10) || 30 };
    if (editingService) {
      fetch(`${API}/catalog/services/${editingService.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => d.success && (setShowServiceForm(false), setEditingService(null), load()));
    } else {
      fetch(`${API}/catalog/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => d.success && (setShowServiceForm(false), load()));
    }
  };

  const handlePromoSubmit = (e) => {
    e.preventDefault();
    if (!promoForm.name?.trim() || !promoForm.startDate || !promoForm.endDate) return;
    const payload = {
      ...promoForm,
      discountValue: parseFloat(promoForm.discountValue) || 0,
      minPurchase: parseFloat(promoForm.minPurchase) || 0,
    };
    if (editingPromo) {
      fetch(`${API}/catalog/promotions/${editingPromo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => d.success && (setShowPromoForm(false), setEditingPromo(null), load()));
    } else {
      fetch(`${API}/catalog/promotions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => d.success && (setShowPromoForm(false), load()));
    }
  };

  const isPromoActive = (p) => {
    const today = istDateStr();
    return p.start_date <= today && p.end_date >= today && p.is_active !== false;
  };

  if (loading && services.length === 0) return <div className="text-slate-600">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Digital Catalog</h2>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('services')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'services' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Services
        </button>
        <button
          onClick={() => setActiveTab('promotions')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'promotions' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Promotions
        </button>
      </div>

      {activeTab === 'services' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-slate-600">Manage your services, pricing, and categories.</p>
            <button
              onClick={() => { setEditingService(null); setServiceForm({ name: '', category: 'General', price: 0, durationMins: 30, description: '' }); setShowServiceForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
            >
              <Plus size={18} /> Add Service
            </button>
          </div>

          {showServiceForm && (
            <form onSubmit={handleServiceSubmit} className="mb-6 p-6 bg-white rounded-xl border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">{editingService ? 'Edit Service' : 'New Service'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Name *</label>
                  <input type="text" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Category</label>
                  <input type="text" list="categories" value={serviceForm.category} onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                  <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Price (₹)</label>
                  <input type="number" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })} className="w-full border rounded-lg px-3 py-2" min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Duration (mins)</label>
                  <input type="number" value={serviceForm.durationMins} onChange={(e) => setServiceForm({ ...serviceForm, durationMins: e.target.value })} className="w-full border rounded-lg px-3 py-2" min="0" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-slate-600 mb-1">Description</label>
                  <input type="text" value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg">Save</button>
                <button type="button" onClick={() => { setShowServiceForm(false); setEditingService(null); }} className="px-4 py-2 border rounded-lg">Cancel</button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s) => (
              <div key={s.id} className="bg-white rounded-xl p-4 border border-slate-200 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <Scissors className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold text-slate-800">{s.name}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{s.category} · {s.duration_mins || 30} mins</p>
                  <p className="font-medium text-slate-700 mt-1">{formatINR(s.price)}</p>
                </div>
                <button
                  onClick={() => { setEditingService(s); setServiceForm({ name: s.name, category: s.category || 'General', price: s.price, durationMins: s.duration_mins || 30, description: s.description || '' }); setShowServiceForm(true); }}
                  className="text-amber-600 hover:underline text-sm"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'promotions' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-slate-600">Create and manage special offers.</p>
            <button
              onClick={() => { setEditingPromo(null); setPromoForm({ name: '', description: '', discountType: 'percent', discountValue: 0, minPurchase: 0, startDate: '', endDate: '' }); setShowPromoForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
            >
              <Plus size={18} /> Add Promotion
            </button>
          </div>

          {showPromoForm && (
            <form onSubmit={handlePromoSubmit} className="mb-6 p-6 bg-white rounded-xl border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">{editingPromo ? 'Edit Promotion' : 'New Promotion'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Name *</label>
                  <input type="text" value={promoForm.name} onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Discount Type</label>
                  <select value={promoForm.discountType} onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                    <option value="percent">Percent (%)</option>
                    <option value="fixed">Fixed (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Discount Value</label>
                  <input type="number" value={promoForm.discountValue} onChange={(e) => setPromoForm({ ...promoForm, discountValue: e.target.value })} className="w-full border rounded-lg px-3 py-2" min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Min Purchase (₹)</label>
                  <input type="number" value={promoForm.minPurchase} onChange={(e) => setPromoForm({ ...promoForm, minPurchase: e.target.value })} className="w-full border rounded-lg px-3 py-2" min="0" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Start Date *</label>
                  <input type="date" value={promoForm.startDate} onChange={(e) => setPromoForm({ ...promoForm, startDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">End Date *</label>
                  <input type="date" value={promoForm.endDate} onChange={(e) => setPromoForm({ ...promoForm, endDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-slate-600 mb-1">Description</label>
                  <input type="text" value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg">Save</button>
                <button type="button" onClick={() => { setShowPromoForm(false); setEditingPromo(null); }} className="px-4 py-2 border rounded-lg">Cancel</button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promotions.map((p) => (
              <div key={p.id} className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-green-500" />
                  <span className="font-semibold text-slate-800">{p.name}</span>
                  {isPromoActive(p) && <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">Active</span>}
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  {p.discount_type === 'percent' ? `${p.discount_value}% off` : `${formatINR(p.discount_value)} off`}
                  {p.min_purchase > 0 && ` · Min ${formatINR(p.min_purchase)}`}
                </p>
                <p className="text-xs text-slate-500 mt-1">{p.start_date} to {p.end_date}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
