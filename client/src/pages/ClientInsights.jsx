import { useState, useEffect } from 'react';
import { Users, UserPlus, RefreshCw, User, UserCheck } from 'lucide-react';
import { istMonthStr, formatDateIST, appointmentDateToYmd } from '../utils/ist';

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

const SUMMARY_PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7Days', label: 'Last 7 days' },
  { key: 'last30Days', label: 'Last 30 days' },
  { key: 'monthToDate', label: 'This month (so far)' },
];

function formatPeriodRange(p) {
  if (!p?.startDate) return '–';
  const short = { day: 'numeric', month: 'short' };
  const full = { ...short, year: 'numeric' };
  if (p.startDate === p.endDate) {
    return formatDateIST(p.startDate, full);
  }
  return `${formatDateIST(p.startDate, short)} – ${formatDateIST(p.endDate, full)}`;
}

export default function ClientInsights() {
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [month, setMonth] = useState(istMonthStr());
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const loadMonth = () => {
    setLoading(true);
    fetch(`${API}/analytics/clients?month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMonth();
  }, [month]);

  useEffect(() => {
    setSummaryLoading(true);
    fetch(`${API}/analytics/clients/summary`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSummary(d.data);
      })
      .finally(() => setSummaryLoading(false));
  }, []);

  if (loading && !data && summaryLoading && !summary) {
    return <div className="text-slate-600">Loading...</div>;
  }

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

  const totalGender = d.male + d.female + d.other + d.unknownGender;
  const dailyStats = [...(d.dailyStats || [])].sort((a, b) =>
    String(b.date).localeCompare(String(a.date))
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Client Insights</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
      </div>

      <section className="mb-10">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">At a glance</h3>

        {summaryLoading && !summary && (
          <div className="text-sm text-slate-500 py-4">Loading summary…</div>
        )}

        {summary && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow">
            <table className="min-w-[960px] w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600 border-b border-slate-200">
                  <th className="px-3 py-3 font-semibold">Period</th>
                  <th className="px-3 py-3 font-semibold">Dates</th>
                  <th className="px-3 py-3 font-semibold text-right">Clients</th>
                  <th className="px-3 py-3 font-semibold text-right">New</th>
                  <th className="px-3 py-3 font-semibold text-right">Returning</th>
                  <th className="px-3 py-3 font-semibold text-right">Men</th>
                  <th className="px-3 py-3 font-semibold text-right">Women</th>
                  <th className="px-3 py-3 font-semibold text-right">Other</th>
                  <th className="px-3 py-3 font-semibold text-right">Not set</th>
                </tr>
              </thead>
              <tbody>
                {SUMMARY_PERIODS.map(({ key, label }) => {
                  const p = summary[key];
                  if (!p) return null;
                  return (
                    <tr key={key} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-3 py-3 font-medium text-slate-800 whitespace-nowrap">{label}</td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{formatPeriodRange(p)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium text-slate-800">{p.totalVisited}</td>
                      <td className="px-3 py-3 text-right tabular-nums" style={{ color: COLORS.new }}>
                        {p.newClients}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums" style={{ color: COLORS.returning }}>
                        {p.returningClients}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums" style={{ color: COLORS.male }}>
                        {p.male}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums" style={{ color: COLORS.female }}>
                        {p.female}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-amber-700">{p.other}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-500">{p.unknownGender}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {d.totalVisited === 0 && d.invoiceDateRange && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex flex-col gap-2">
          <span>
            No activity in {formatMonth(d.month)}
            {d.invoiceDateRange.min && d.invoiceDateRange.max
              ? ` (${d.invoiceDateRange.totalInvoices} invoice(s) elsewhere: ${formatDateIST(d.invoiceDateRange.min, { month: 'short', year: 'numeric' })}–${formatDateIST(d.invoiceDateRange.max, { month: 'short', year: 'numeric' })})`
              : ''}
            .
          </span>
          {d.invoiceDateRange.min && (
            <button
              type="button"
              onClick={() => setMonth((appointmentDateToYmd(d.invoiceDateRange.min) || '').slice(0, 7))}
              className="self-start px-3 py-1.5 bg-amber-200 hover:bg-amber-300 rounded-lg text-sm font-medium"
            >
              View {formatDateIST(d.invoiceDateRange.min, { month: 'long', year: 'numeric' })}
            </button>
          )}
        </div>
      )}

      {d.totalVisited === 0 && data && !data.invoiceDateRange && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-sm">No invoices yet.</div>
      )}

      <h3 className="text-lg font-semibold text-slate-800 mb-4">{formatMonth(d.month)}</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Total clients visited</span>
            <Users className="w-8 h-8" style={{ color: COLORS.total }} />
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2" style={{ color: COLORS.total }}>
            {d.totalVisited}
          </p>
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

      <div className="bg-white rounded-xl shadow p-6 border border-slate-200 mb-8">
        <h3 className="font-semibold text-slate-800 mb-4">Gender</h3>
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

      {dailyStats.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">By day</h3>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="min-w-[480px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-slate-600">
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold text-right">New</th>
                  <th className="px-3 py-2 font-semibold text-right">Returning</th>
                  <th className="px-3 py-2 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.map((row) => (
                  <tr key={row.date} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800 whitespace-nowrap">
                      {formatDateIST(row.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: COLORS.new }}>
                      {row.newCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: COLORS.returning }}>
                      {row.returningCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-800">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
