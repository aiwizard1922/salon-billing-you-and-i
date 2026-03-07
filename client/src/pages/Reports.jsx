import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatINR } from '../utils/formatCurrency';
import { istMonthStr } from '../utils/ist';

const API = '/api';

const COLORS = {
  cash: '#F59E0B',
  upi: '#3B82F6',
  card: '#8B5CF6',
  revenue: '#3B82F6',
  profit: '#10B981',
};

export default function Reports() {
  const [daily, setDaily] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [dailyByMethod, setDailyByMethod] = useState([]);
  const [monthlyByMethod, setMonthlyByMethod] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/analytics/daily?days=30`).then((r) => r.json()),
      fetch(`${API}/analytics/monthly?months=12`).then((r) => r.json()),
      fetch(`${API}/analytics/daily-by-method?days=30`).then((r) => r.json()),
      fetch(`${API}/analytics/monthly-by-method?months=12`).then((r) => r.json()),
    ])
      .then(([dRes, mRes, dmRes, mmRes]) => {
        if (dRes.success) setDaily(dRes.data.map((r) => ({ ...r, revenue: Number(r.revenue) })));
        if (mRes.success) setMonthly(mRes.data);
        if (dmRes.success) setDailyByMethod(dmRes.data);
        if (mmRes.success) setMonthlyByMethod(mmRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-600">Loading...</div>;

  const formatDate = (d) => {
    if (!d) return '';
    const s = String(d).slice(0, 10);
    const [y, m, day] = s.split('-');
    return day && m ? `${day}/${m}` : s;
  };
  const formatMonth = (m) => {
    if (!m) return '';
    const [y, mo] = String(m).split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(mo, 10) - 1]} ${y}`;
  };
  const formatRupee = (v) => formatINR(v, v >= 1000 ? 0 : 2);

  const thisMonth = monthlyByMethod.find((m) => m.month === istMonthStr());
  const monthTotal = thisMonth ? thisMonth.cash + thisMonth.upi + thisMonth.card : 0;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Sales & Reports</h2>

      {thisMonth && monthTotal > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-4 border border-slate-200">
            <p className="text-xs text-slate-500 uppercase">This Month Total</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{formatINR(monthTotal)}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-slate-200">
            <p className="text-xs text-slate-500 uppercase">Cash</p>
            <p className="text-xl font-bold mt-1" style={{ color: COLORS.cash }}>{formatINR(thisMonth.cash)}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-slate-200">
            <p className="text-xs text-slate-500 uppercase">UPI</p>
            <p className="text-xl font-bold mt-1" style={{ color: COLORS.upi }}>{formatINR(thisMonth.upi)}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-slate-200">
            <p className="text-xs text-slate-500 uppercase">Card</p>
            <p className="text-xl font-bold mt-1" style={{ color: COLORS.card }}>{formatINR(thisMonth.card)}</p>
          </div>
        </div>
      )}

      <div className="space-y-8">
        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Monthly Sales by Payment Method (Last 12 months)</h3>
          {monthlyByMethod.length === 0 ? (
            <p className="text-slate-500 py-8 text-center">No paid invoices in this period.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyByMethod} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickFormatter={formatMonth} fontSize={11} />
                  <YAxis tickFormatter={formatRupee} fontSize={11} />
                  <Tooltip
                    formatter={(v) => [formatINR(v), '']}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="cash" stackId="a" fill={COLORS.cash} name="Cash" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="upi" stackId="a" fill={COLORS.upi} name="UPI" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="card" stackId="a" fill={COLORS.card} name="Card" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Daily Sales by Payment Method (Last 30 days)</h3>
          {dailyByMethod.length === 0 ? (
            <p className="text-slate-500 py-8 text-center">No paid invoices in this period.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyByMethod} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} />
                  <YAxis tickFormatter={formatRupee} fontSize={11} />
                  <Tooltip
                    formatter={(v) => [formatINR(v), '']}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="cash" stackId="a" fill={COLORS.cash} name="Cash" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="upi" stackId="a" fill={COLORS.upi} name="UPI" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="card" stackId="a" fill={COLORS.card} name="Card" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Daily Breakdown – Last 7 Days</h3>
          <p className="text-xs text-slate-500 mb-4">Quick reference for end-of-day totals by payment method.</p>
          {dailyByMethod.length === 0 ? (
            <p className="text-slate-500 py-4 text-center">No paid invoices in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Date</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Cash</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">UPI</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Card</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyByMethod.slice(-7).reverse().map((row) => (
                    <tr key={row.date} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3">{formatDate(row.date)}</td>
                      <td className="py-2 px-3 text-right font-medium" style={{ color: COLORS.cash }}>{formatINR(row.cash)}</td>
                      <td className="py-2 px-3 text-right font-medium" style={{ color: COLORS.upi }}>{formatINR(row.upi)}</td>
                      <td className="py-2 px-3 text-right font-medium" style={{ color: COLORS.card }}>{formatINR(row.card)}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatINR(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Daily Sales Total (Last 30 days)</h3>
          {daily.length === 0 ? (
            <p className="text-slate-500 py-8 text-center">No paid invoices in this period.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} />
                  <YAxis tickFormatter={formatRupee} fontSize={11} />
                  <Tooltip
                    formatter={(v) => [formatINR(v), 'Revenue']}
                    labelFormatter={formatDate}
                  />
                  <Bar dataKey="revenue" fill={COLORS.revenue} name="Revenue" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Monthly Sales & Profit (Last 12 months)</h3>
          <p className="text-xs text-slate-500 mb-4">
            Profit is estimated at 30% of revenue. Set PROFIT_MARGIN_PERCENT in server/.env to change.
          </p>
          {monthly.length === 0 ? (
            <p className="text-slate-500 py-8 text-center">No paid invoices in this period.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickFormatter={formatMonth} fontSize={11} />
                  <YAxis tickFormatter={formatRupee} fontSize={11} />
                  <Tooltip
                    formatter={(v) => [formatINR(v), '']}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill={COLORS.revenue} name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" fill={COLORS.profit} name="Est. Profit" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
