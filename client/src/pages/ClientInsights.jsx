import { useState, useEffect } from 'react';
import { Users, UserPlus, RefreshCw, User, UserCheck } from 'lucide-react';
import { istMonthStr, formatDateIST } from '../utils/ist';

const API = '/api';

const COLORS = {
  total: '#3B82F6',
  new: '#10B981',
  returning: '#8B5CF6',
  male: '#6366F1',
  female: '#EC4899',
  other: '#F59E0B',
  unknown: '#94A3B8',
};

export default function ClientInsights() {
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(istMonthStr());
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`${API}/analytics/clients?month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [month]);

  if (loading && !data) return <div className="text-slate-600">Loading...</div>;

  const formatMonth = (m) => {
    if (!m) return '';
    const [y, mo] = String(m).split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(mo, 10) - 1]} ${y}`;
  };

  const d = data || {
    month: month,
    totalVisited: 0,
    newClients: 0,
    returningClients: 0,
    dailyStats: [],
    male: 0,
    female: 0,
    other: 0,
    unknownGender: 0,
    invoiceDateRange: null,
  };

  const totalGender = d.male + d.female + d.other + d.unknown;
  const dailyStats = d.dailyStats || [];
  const range = d.invoiceDateRange;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Client Insights</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Month:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
      </div>

      <p className="text-sm text-slate-500 mb-6">
        Based on <strong>invoices created</strong> only. &quot;New&quot; = first invoice ever for that customer. &quot;Returning&quot; = customer had an invoice before. Daily table shows counts per day; monthly totals are unique customers.
      </p>

      {d.totalVisited === 0 && d.invoiceDateRange && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex flex-col gap-2">
          <span>
            No invoices for {formatMonth(d.month)}. Your {d.invoiceDateRange.totalInvoices} invoice(s) are from{' '}
            {d.invoiceDateRange.min && d.invoiceDateRange.max
              ? `${formatDateIST(d.invoiceDateRange.min, { month: 'short', year: 'numeric' })} to ${formatDateIST(d.invoiceDateRange.max, { month: 'short', year: 'numeric' })}`
              : 'other months'}
            .
          </span>
          {d.invoiceDateRange.min && (
            <button
              type="button"
              onClick={() => setMonth(String(d.invoiceDateRange.min).slice(0, 7))}
              className="self-start px-3 py-1.5 bg-amber-200 hover:bg-amber-300 rounded-lg text-sm font-medium"
            >
              View {formatDateIST(d.invoiceDateRange.min, { month: 'long', year: 'numeric' })}
            </button>
          )}
        </div>
      )}

      {d.totalVisited === 0 && data && !data.invoiceDateRange && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-sm">
          No invoices in the database yet. Create invoices to see client insights.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Total clients visited</span>
            <Users className="w-8 h-8" style={{ color: COLORS.total }} />
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2" style={{ color: COLORS.total }}>
            {d.totalVisited}
          </p>
          <p className="text-sm text-slate-500">{formatMonth(d.month)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">New clients</span>
            <UserPlus className="w-8 h-8" style={{ color: COLORS.new }} />
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2" style={{ color: COLORS.new }}>
            {d.newClients}
          </p>
          <p className="text-sm text-slate-500">
            {d.totalVisited > 0 ? Math.round((d.newClients / d.totalVisited) * 100) : 0}% of total
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Returning clients</span>
            <RefreshCw className="w-8 h-8" style={{ color: COLORS.returning }} />
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2" style={{ color: COLORS.returning }}>
            {d.returningClients}
          </p>
          <p className="text-sm text-slate-500">
            {d.totalVisited > 0 ? Math.round((d.returningClients / d.totalVisited) * 100) : 0}% of total
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-4">Gender breakdown</h3>
        <p className="text-xs text-slate-500 mb-4">
          Based on gender set in customer profile. Add gender when creating/editing customers.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border" style={{ borderColor: COLORS.male }}>
            <div className="flex items-center gap-2 mb-1">
              <User size={20} style={{ color: COLORS.male }} />
              <span className="font-medium text-slate-800">Men</span>
            </div>
            <p className="text-xl font-bold" style={{ color: COLORS.male }}>{d.male}</p>
            {totalGender > 0 && (
              <p className="text-xs text-slate-500">{Math.round((d.male / totalGender) * 100)}%</p>
            )}
          </div>
          <div className="p-4 rounded-lg border" style={{ borderColor: COLORS.female }}>
            <div className="flex items-center gap-2 mb-1">
              <UserCheck size={20} style={{ color: COLORS.female }} />
              <span className="font-medium text-slate-800">Women</span>
            </div>
            <p className="text-xl font-bold" style={{ color: COLORS.female }}>{d.female}</p>
            {totalGender > 0 && (
              <p className="text-xs text-slate-500">{Math.round((d.female / totalGender) * 100)}%</p>
            )}
          </div>
          <div className="p-4 rounded-lg border" style={{ borderColor: COLORS.other }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-slate-800">Other</span>
            </div>
            <p className="text-xl font-bold" style={{ color: COLORS.other }}>{d.other}</p>
            {totalGender > 0 && (
              <p className="text-xs text-slate-500">{Math.round((d.other / totalGender) * 100)}%</p>
            )}
          </div>
          <div className="p-4 rounded-lg border" style={{ borderColor: COLORS.unknown }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-slate-800">Not set</span>
            </div>
            <p className="text-xl font-bold" style={{ color: COLORS.unknown }}>{d.unknownGender}</p>
            {totalGender > 0 && (
              <p className="text-xs text-slate-500">{Math.round((d.unknownGender / totalGender) * 100)}%</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
