import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { formatINR } from '../utils/formatCurrency';

const API = '/api';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | pending | paid | membership

  const load = () => {
    setLoading(true);
    let url = `${API}/invoices`;
    if (filter === 'membership') url += '?membership=true';
    else if (filter !== 'all') url += `?status=${filter}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => (d.success ? setInvoices(d.data) : setError(d.error)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), [filter]);

  const pending = invoices.filter((i) => i.status === 'pending');
  const paid = invoices.filter((i) => i.status === 'paid');
  const membershipInvoices = invoices.filter(
    (i) => (i.payment_method || '').toLowerCase().startsWith('membership') || Number(i.amount_from_membership || 0) > 0
  );
  const displayList =
    filter === 'all' ? invoices : filter === 'pending' ? pending : filter === 'paid' ? paid : membershipInvoices;

  if (loading && invoices.length === 0) return <div className="text-slate-600">Loading...</div>;
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Invoices</h2>
        <Link to="/invoices/new" className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
          <Plus size={18} /> New Invoice
        </Link>
      </div>
      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">{error}</div>
      )}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'paid', label: 'Paid' },
          { key: 'membership', label: 'Membership' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg ${filter === key ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {displayList.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No invoices found.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Invoice</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Customer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Date</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Amount</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((inv) => (
                <tr key={inv.id} className="border-t hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <Link to={`/invoices/${inv.id}`} className="text-amber-600 hover:underline font-medium">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{inv.customer_name}</td>
                  <td className="py-3 px-4 text-slate-600">{inv.invoice_date}</td>
                  <td className="py-3 px-4 text-right font-medium">{formatINR(inv.total)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {inv.status}
                    </span>
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
