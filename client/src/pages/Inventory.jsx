import { useState, useEffect } from 'react';
import { Package, Plus, AlertTriangle, TrendingDown, Edit2, Trash2 } from 'lucide-react';
import { formatINR } from '../utils/formatCurrency';

const API = '/api';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showAdjustModal, setShowAdjustModal] = useState(null);
  const [form, setForm] = useState({
    name: '', sku: '', category: '', unit: 'pcs', costPrice: 0, sellingPrice: 0,
    quantity: 0, lowStockThreshold: 5, supplierId: '',
  });
  const [adjustForm, setAdjustForm] = useState({ quantityChange: 0, reason: '' });
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '', email: '', phone: '', address: '' });

  const load = () => {
    Promise.all([
      fetch(`${API}/inventory/products?search=${search}&lowStock=${filterLowStock}`).then((r) => r.json()),
      fetch(`${API}/inventory/products/low-stock`).then((r) => r.json()),
      fetch(`${API}/inventory/suppliers`).then((r) => r.json()),
    ])
      .then(([pRes, lRes, sRes]) => {
        if (pRes.success) setProducts(pRes.data);
        if (lRes.success) setLowStock(lRes.data);
        if (sRes.success) setSuppliers(sRes.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [search, filterLowStock]);

  const handleProductSubmit = (e) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    const payload = {
      name: form.name,
      sku: form.sku || null,
      category: form.category || null,
      unit: form.unit,
      costPrice: form.costPrice ? parseFloat(form.costPrice) : 0,
      sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : 0,
      quantity: form.quantity ? parseInt(form.quantity, 10) : 0,
      lowStockThreshold: form.lowStockThreshold ? parseInt(form.lowStockThreshold, 10) : 5,
      supplierId: form.supplierId ? Number(form.supplierId) : null,
    };
    if (editingProduct) {
      fetch(`${API}/inventory/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            resetForm();
            load();
          }
        });
    } else {
      fetch(`${API}/inventory/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            resetForm();
            load();
          }
        });
    }
  };

  const resetForm = () => {
    setForm({ name: '', sku: '', category: '', unit: 'pcs', costPrice: 0, sellingPrice: 0, quantity: 0, lowStockThreshold: 5, supplierId: '' });
    setShowProductForm(false);
    setEditingProduct(null);
  };

  const startEdit = (p) => {
    setForm({
      name: p.name,
      sku: p.sku || '',
      category: p.category || '',
      unit: p.unit || 'pcs',
      costPrice: p.cost_price ?? 0,
      sellingPrice: p.selling_price ?? 0,
      quantity: p.quantity ?? 0,
      lowStockThreshold: p.low_stock_threshold ?? 5,
      supplierId: p.supplier_id || '',
    });
    setEditingProduct(p);
    setShowProductForm(true);
  };

  const addSupplier = (e) => {
    e.preventDefault();
    if (!supplierForm.name?.trim()) return;
    fetch(`${API}/inventory/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplierForm),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSupplierForm({ name: '', contact: '', email: '', phone: '', address: '' });
          setShowSupplierForm(false);
          load();
        }
      });
  };

  const handleAdjust = () => {
    if (!showAdjustModal || adjustForm.quantityChange === 0) return;
    fetch(`${API}/inventory/products/${showAdjustModal.id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantityChange: Number(adjustForm.quantityChange), reason: adjustForm.reason }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setShowAdjustModal(null);
          setAdjustForm({ quantityChange: 0, reason: '' });
          load();
        }
      });
  };

  if (loading && products.length === 0) return <div className="text-slate-600">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Inventory</h2>
        <button
          onClick={() => { resetForm(); setShowProductForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
        >
          <Plus size={18} /> Add Product
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-4">
          <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">Low Stock Alert</p>
            <p className="text-sm text-amber-700">{lowStock.length} product(s) at or below threshold</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.slice(0, 5).map((p) => (
              <span key={p.id} className="px-2 py-1 bg-amber-100 rounded text-sm text-amber-800">
                {p.name}: {p.quantity} {p.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      <details className="mb-4">
        <summary className="cursor-pointer text-slate-600 font-medium">Manage Suppliers</summary>
        <div className="mt-2 p-4 bg-slate-50 rounded-lg">
          {showSupplierForm ? (
            <form onSubmit={addSupplier} className="flex flex-wrap gap-4">
              <input type="text" placeholder="Name *" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className="border rounded px-2 py-1" required />
              <input type="text" placeholder="Contact" value={supplierForm.contact} onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })} className="border rounded px-2 py-1" />
              <input type="email" placeholder="Email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} className="border rounded px-2 py-1" />
              <input type="tel" placeholder="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="border rounded px-2 py-1" />
              <button type="submit" className="px-3 py-1 bg-slate-800 text-white rounded">Add</button>
              <button type="button" onClick={() => setShowSupplierForm(false)} className="px-3 py-1 border rounded">Cancel</button>
            </form>
          ) : (
            <button onClick={() => setShowSupplierForm(true)} className="text-amber-600 hover:underline">+ Add supplier</button>
          )}
          {suppliers.length > 0 && <p className="text-sm text-slate-500 mt-2">Suppliers: {suppliers.map((s) => s.name).join(', ')}</p>}
        </div>
      </details>

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
        />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filterLowStock} onChange={(e) => setFilterLowStock(e.target.checked)} />
          <span className="text-sm text-slate-600">Low stock only</span>
        </label>
      </div>

      {showProductForm && (
        <form onSubmit={handleProductSubmit} className="mb-8 p-6 bg-white rounded-xl shadow border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">{editingProduct ? 'Edit Product' : 'New Product'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">SKU</label>
              <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Category</label>
              <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Hair, Skincare" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="pcs">pcs</option>
                <option value="ml">ml</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="kg">kg</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Cost Price (₹)</label>
              <input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Selling Price (₹) *</label>
              <input type="number" step="0.01" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Quantity</label>
              <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full border rounded-lg px-3 py-2" min="0" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Low Stock Threshold</label>
              <input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="w-full border rounded-lg px-3 py-2" min="0" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">Supplier</label>
              <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg">{editingProduct ? 'Update' : 'Save'}</button>
            <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {products.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No products yet. Add your first product to track inventory.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-slate-600">Product</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">SKU</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">Quantity</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">Cost</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">Price</th>
                <th className="text-center py-3 px-4 font-medium text-slate-600">Status</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium">{p.name}</td>
                  <td className="py-3 px-4 text-slate-600">{p.sku || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={p.quantity <= p.low_stock_threshold ? 'text-amber-600 font-medium' : ''}>
                      {p.quantity} {p.unit}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">{formatINR(p.cost_price)}</td>
                  <td className="py-3 px-4 text-right">{formatINR(p.selling_price)}</td>
                  <td className="py-3 px-4 text-center">
                    {p.quantity <= p.low_stock_threshold ? (
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">Low</span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">OK</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right flex gap-2 justify-end">
                    <button onClick={() => { setShowAdjustModal(p); setAdjustForm({ quantityChange: 0, reason: '' }); }} className="text-blue-600 hover:underline text-sm">Adjust</button>
                    <button onClick={() => startEdit(p)} className="text-amber-600 hover:underline text-sm">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdjustModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-4">Adjust Stock: {showAdjustModal.name}</h3>
            <p className="text-sm text-slate-500 mb-4">Current: {showAdjustModal.quantity} {showAdjustModal.unit}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Change (+ to add, - to remove)</label>
                <input
                  type="number"
                  value={adjustForm.quantityChange || ''}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantityChange: parseInt(e.target.value, 10) || 0 })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g. 10 or -5"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Reason</label>
                <input
                  type="text"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g. Received shipment"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={handleAdjust} className="px-4 py-2 bg-slate-800 text-white rounded-lg">Apply</button>
              <button onClick={() => setShowAdjustModal(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
