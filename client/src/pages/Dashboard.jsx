import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, DollarSign, Plus, BarChart3 } from 'lucide-react';
import { formatINR } from '../utils/formatCurrency';

const API = '/api';

export default function Dashboard() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/invoices`)
      .then((r) => r.json())
      .then((d) => (d.success ? setInvoices(d.data) : setError(d.error)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const pending = invoices.filter((i) => i.status === 'pending');
  const paid = invoices.filter((i) => i.status === 'paid');
  const pendingAmt = pending.reduce((s, i) => s + Number(i.total), 0);
  const paidAmt = paid.reduce((s, i) => s + Number(i.total), 0);

  if (loading) return <div className="text-slate-600">Loading...</div>;
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h2>
      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          {error}. Ensure PostgreSQL is running and DATABASE_URL is set.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Pending</span>
            <FileText className="w-8 h-8 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{formatINR(pendingAmt)}</p>
          <p className="text-sm text-slate-500">{pending.length} invoices</p>
          {pending.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-2">Quick access:</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {pending.map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/invoices/${inv.id}`}
                    className="text-sm text-amber-600 hover:underline font-medium"
                  >
                    {inv.invoice_number}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Paid</span>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{formatINR(paidAmt)}</p>
          <p className="text-sm text-slate-500">{paid.length} invoices</p>
        </div>
        <Link
          to="/reports"
          className="bg-white rounded-xl shadow p-6 border border-slate-200 flex items-center justify-center gap-3 hover:bg-slate-50"
        >
          <BarChart3 className="w-8 h-8 text-amber-500" />
          <span className="font-semibold text-slate-800">Reports</span>
        </Link>
        <Link
          to="/invoices/new"
          className="bg-slate-800 text-white rounded-xl shadow p-6 flex items-center justify-center gap-3 hover:bg-slate-700"
        >
          <Plus className="w-8 h-8" />
          <span className="font-semibold">New Invoice</span>
        </Link>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between">
          <h3 className="font-semibold text-slate-800">Recent Invoices</h3>
          <Link to="/invoices/new" className="text-amber-600 hover:underline">+ Add</Link>
        </div>
        {invoices.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No invoices yet.</p>
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
              {invoices.slice(0, 10).map((inv) => (
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
