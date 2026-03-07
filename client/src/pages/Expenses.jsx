import { useState, useEffect } from 'react';
import { formatINR } from '../utils/formatCurrency';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { istDateStr } from '../utils/ist';

const API = '/api';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState({ fixed: [], daily: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | fixed | daily
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return istDateStr(d);
  });
  const [toDate, setToDate] = useState(() => istDateStr());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    type: 'daily',
    category: '',
    amount: '',
    expenseDate: istDateStr(),
    notes: '',
  });

  const load = () => {
    setLoading(true);
    let url = `${API}/expenses?fromDate=${fromDate}&toDate=${toDate}`;
    if (filter !== 'all') url += `&type=${filter}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => d.success && setExpenses(d.data))
      .finally(() => setLoading(false));
  };

  const loadCategories = () => {
    fetch(`${API}/expenses/categories`)
      .then((r) => r.json())
      .then((d) => d.success && setCategories(d.data));
  };

  useEffect(() => {
    load();
  }, [filter, fromDate, toDate]);

  useEffect(() => loadCategories(), []);

  const displayList = expenses;
  const totalFixed = displayList.filter((e) => e.type === 'fixed').reduce((s, e) => s + Number(e.amount), 0);
  const totalDaily = displayList.filter((e) => e.type === 'daily').reduce((s, e) => s + Number(e.amount), 0);
  const totalAll = totalFixed + totalDaily;

  const resetForm = () => {
    setForm({
      type: 'daily',
      category: '',
      amount: '',
      expenseDate: istDateStr(),
      notes: '',
    });
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.category?.trim()) return;
    const payload = {
      type: form.type,
      category: form.category.trim(),
      amount: Number(form.amount) || 0,
      expenseDate: form.expenseDate,
      notes: form.notes?.trim() || null,
    };
    if (editing) {
      fetch(`${API}/expenses/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => d.success && (resetForm(), load()));
    } else {
      fetch(`${API}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => d.success && (resetForm(), load()));
    }
  };

  const handleEdit = (exp) => {
    setEditing(exp);
    setForm({
      type: exp.type,
      category: exp.category,
      amount: String(exp.amount),
      expenseDate: exp.expense_date?.slice(0, 10) || istDateStr(),
      notes: exp.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this expense?')) return;
    fetch(`${API}/expenses/${id}`, { method: 'DELETE' })
      .then((r) => r.json())
      .then((d) => d.success && load());
  };

  const catList = form.type === 'fixed' ? categories.fixed : categories.daily;
  const setCategory = (v) => setForm((f) => ({ ...f, category: v }));

  if (loading && expenses.length === 0) return <div className="text-slate-600">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Expenses</h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
        >
          <Plus size={18} /> Add Expense
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {[
          { key: 'all', label: 'All' },
          { key: 'fixed', label: 'Fixed' },
          { key: 'daily', label: 'Daily' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg ${filter === key ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
        <div className="flex gap-2 items-center ml-4">
          <label className="text-sm text-slate-600">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          />
          <label className="text-sm text-slate-600">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          />
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-white rounded-xl shadow border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3">{editing ? 'Edit Expense' : 'Add Expense'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, category: '' }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="fixed">Fixed</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select…</option>
                {catList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Date</label>
              <input
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm text-slate-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. March salary, milk for week"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              {editing ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white rounded-xl shadow border border-slate-200">
          <p className="text-sm text-slate-500">Fixed (Salaries, Bills…)</p>
          <p className="text-xl font-bold text-slate-800">{formatINR(totalFixed)}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow border border-slate-200">
          <p className="text-sm text-slate-500">Daily (Milk, OT, Incentives…)</p>
          <p className="text-xl font-bold text-slate-800">{formatINR(totalDaily)}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow border border-slate-200 bg-amber-50/50">
          <p className="text-sm text-slate-500">Total Expenses</p>
          <p className="text-xl font-bold text-slate-800">{formatINR(totalAll)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {displayList.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No expenses in this period.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Category</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Notes</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((exp) => (
                <tr key={exp.id} className="border-t hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700">{exp.expense_date?.slice(0, 10)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${exp.type === 'fixed' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {exp.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{exp.category}</td>
                  <td className="py-3 px-4 text-right font-medium">{formatINR(exp.amount)}</td>
                  <td className="py-3 px-4 text-slate-500 text-sm">{exp.notes || '–'}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(exp)} className="p-1.5 text-slate-500 hover:text-amber-600" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(exp.id)} className="p-1.5 text-slate-500 hover:text-red-600" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
