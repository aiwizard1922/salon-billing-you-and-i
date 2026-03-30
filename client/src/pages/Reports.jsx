import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { formatINR } from '../utils/formatCurrency';
import { istDateStr, istMonthStr, formatDateIST } from '../utils/ist';

const API = '/api';

const COLORS = {
  cash: '#F59E0B',
  upi: '#3B82F6',
  card: '#8B5CF6',
  membership: '#64748B',
  revenue: '#3B82F6',
  profit: '#10B981',
  serviceSales: '#D97706',
  productSales: '#7C3AED',
};

const PIE_PALETTE = [
  '#D97706', '#2563EB', '#059669', '#7C3AED', '#DB2777', '#0D9488', '#CA8A04', '#4F46E5',
  '#EA580C', '#16A34A', '#9333EA', '#E11D48',
];

const PRODUCT_PIE_PALETTE = [
  '#7C3AED', '#A78BFA', '#5B21B6', '#C4B5FD', '#6D28D9', '#8B5CF6', '#4C1D95', '#9333EA',
  '#A855F7', '#7E22CE',
];

/** Inclusive IST calendar range for "last N days" ending today in Asia/Kolkata. */
function rangeLastNDaysIST(n) {
  const end = istDateStr();
  const endAnchor = new Date(`${end}T12:00:00+05:30`);
  const startAnchor = new Date(endAnchor.getTime() - (n - 1) * 86400000);
  const from = startAnchor.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return { from, to: end };
}

function monthRangeIST(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const from = `${ym}-01`;
  const to = `${ym}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

/** Counts / qty for aligned numeric columns (Indian grouping, no stray decimals). */
function formatCount(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return '0';
  if (Math.abs(x - Math.round(x)) < 1e-6) return Math.round(x).toLocaleString('en-IN');
  return x.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function periodLabel(preset, monthYm, from, to) {
  if (preset === 'month') {
    const [y, mo] = monthYm.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(mo, 10) - 1]} ${y}`;
  }
  if (preset === '7') return 'Last 7 days';
  if (preset === '15') return 'Last 15 days';
  if (preset === '30') return 'Last 30 days';
  return `${from} → ${to}`;
}

export default function Reports() {
  const location = useLocation();
  const [daily, setDaily] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [dailyByMethod, setDailyByMethod] = useState([]);
  const [monthlyByMethod, setMonthlyByMethod] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyReports, setDailyReports] = useState([]);
  const [dailyReportDays, setDailyReportDays] = useState(30);

  const [perfPreset, setPerfPreset] = useState('7');
  const [perfMonth, setPerfMonth] = useState(() => istMonthStr());
  const [perfLoading, setPerfLoading] = useState(true);
  const [perfData, setPerfData] = useState(null);
  const [perfRange, setPerfRange] = useState({ from: '', to: '' });

  useEffect(() => {
    Promise.all([
      fetch(`${API}/analytics/daily?days=30`).then((r) => r.json()),
      fetch(`${API}/analytics/monthly?months=12`).then((r) => r.json()),
      fetch(`${API}/analytics/daily-by-method?days=30`).then((r) => r.json()),
      fetch(`${API}/analytics/monthly-by-method?months=12`).then((r) => r.json()),
      fetch(`${API}/analytics/daily-reports?days=${dailyReportDays}`).then((r) => r.json()),
    ])
      .then(([dRes, mRes, dmRes, mmRes, drRes]) => {
        if (dRes.success) setDaily(dRes.data.map((r) => ({ ...r, revenue: Number(r.revenue) })));
        if (mRes.success) setMonthly(mRes.data);
        if (dmRes.success) setDailyByMethod(dmRes.data);
        if (mmRes.success) setMonthlyByMethod(mmRes.data);
        if (drRes.success) setDailyReports(drRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dailyReportDays]);

  useEffect(() => {
    const r =
      perfPreset === 'month'
        ? monthRangeIST(perfMonth)
        : rangeLastNDaysIST(perfPreset === '15' ? 15 : perfPreset === '30' ? 30 : 7);
    setPerfRange(r);
    setPerfLoading(true);
    const q = new URLSearchParams({ from: r.from, to: r.to, limit: '40' });
    fetch(`${API}/analytics/sales-performance?${q}`)
      .then((res) => res.json())
      .then((d) => {
        if (d.success && d.data) setPerfData(d.data);
        else setPerfData(null);
      })
      .catch(() => setPerfData(null))
      .finally(() => setPerfLoading(false));
  }, [perfPreset, perfMonth]);

  useEffect(() => {
    const id = (location.hash || '').replace(/^#/, '');
    if (!id) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    return () => clearTimeout(t);
  }, [location.pathname, location.hash]);

  const servicePieData = useMemo(() => {
    const list = perfData?.services || [];
    const fullTotal = Number(perfData?.revenueTotals?.serviceRevenue);
    const fallbackTotal = [...list].reduce((s, r) => s + (Number(r.revenue) || 0), 0);
    const total = Number.isFinite(fullTotal) && fullTotal > 0 ? fullTotal : fallbackTotal;
    if (!list.length && total <= 0) return [];
    const topN = 8;
    const sorted = [...list].sort((a, b) => Number(b.revenue) - Number(a.revenue));
    const topRows = sorted.slice(0, topN);
    const top = topRows.map((r) => ({
      name: r.name.length > 22 ? `${r.name.slice(0, 20)}…` : r.name,
      fullName: r.name,
      value: Number(r.revenue) || 0,
      qty: Number(r.qty) || 0,
    }));
    const topSum = top.reduce((s, r) => s + r.value, 0);
    const otherVal = Math.max(0, total - topSum);
    const otherQty = sorted.slice(topN).reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const restCount = Math.max(0, sorted.length - topN);
    if (otherVal > 0) {
      top.push({
        name: 'Other services',
        fullName: restCount > 0 ? `${restCount} more named services (and any beyond the top list)` : 'Additional service revenue',
        value: otherVal,
        qty: otherQty,
      });
    }
    return top;
  }, [perfData?.services, perfData?.revenueTotals?.serviceRevenue]);

  const productPieData = useMemo(() => {
    const list = perfData?.products || [];
    const fullTotal = Number(perfData?.revenueTotals?.productRevenue);
    const fallbackTotal = [...list].reduce((s, r) => s + (Number(r.revenue) || 0), 0);
    const total = Number.isFinite(fullTotal) && fullTotal > 0 ? fullTotal : fallbackTotal;
    if (!list.length && total <= 0) return [];
    const topN = 8;
    const sorted = [...list].sort((a, b) => Number(b.revenue) - Number(a.revenue));
    const topRows = sorted.slice(0, topN);
    const top = topRows.map((r) => ({
      name: r.name.length > 22 ? `${r.name.slice(0, 20)}…` : r.name,
      fullName: r.name,
      value: Number(r.revenue) || 0,
      qty: Number(r.qty) || 0,
    }));
    const topSum = top.reduce((s, r) => s + r.value, 0);
    const otherVal = Math.max(0, total - topSum);
    const otherQty = sorted.slice(topN).reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const restCount = Math.max(0, sorted.length - topN);
    if (otherVal > 0) {
      top.push({
        name: 'Other products',
        fullName: restCount > 0 ? `${restCount} more products (and any beyond the top list)` : 'Additional product revenue',
        value: otherVal,
        qty: otherQty,
      });
    }
    return top;
  }, [perfData?.products, perfData?.revenueTotals?.productRevenue]);

  const topServicesBar = useMemo(() => {
    const list = perfData?.services || [];
    return [...list]
      .sort((a, b) => Number(b.revenue) - Number(a.revenue))
      .slice(0, 10)
      .map((r) => ({
        label: r.name.length > 26 ? `${r.name.slice(0, 24)}…` : r.name,
        fullName: r.name,
        revenue: Number(r.revenue) || 0,
        qty: Number(r.qty) || 0,
      }));
  }, [perfData?.services]);

  const topProductsBar = useMemo(() => {
    const list = perfData?.products || [];
    return [...list]
      .sort((a, b) => Number(b.revenue) - Number(a.revenue))
      .slice(0, 10)
      .map((r) => ({
        label: r.name.length > 26 ? `${r.name.slice(0, 24)}…` : r.name,
        fullName: r.name,
        revenue: Number(r.revenue) || 0,
        qty: Number(r.qty) || 0,
      }));
  }, [perfData?.products]);

  const staffPerfChart = useMemo(() => {
    const rows = perfData?.staffSales || [];
    return [...rows]
      .filter((s) => s.totalSales > 0)
      .sort((a, b) => b.totalSales - a.totalSales)
      .map((s) => ({
        name: s.staffName.length > 14 ? `${s.staffName.slice(0, 12)}…` : s.staffName,
        fullName: s.staffName,
        total: Math.round(Number(s.totalSales) * 100) / 100,
        services: Math.round(Number(s.serviceSales) * 100) / 100,
        products: Math.round(Number(s.productSales) * 100) / 100,
        membership: Math.round(Number(s.membershipSales) * 100) / 100,
      }));
  }, [perfData?.staffSales]);

  if (loading) return <div className="text-slate-600">Loading...</div>;

  const formatDate = (d) => {
    if (!d) return '';
    return formatDateIST(d, { day: '2-digit', month: '2-digit' });
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

      <div className="mb-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Sales performance</h3>
            <p className="text-xs text-slate-500 mt-1">
              {periodLabel(perfPreset, perfMonth, perfRange.from, perfRange.to)}
              {perfRange.from && perfRange.to ? ` · ${perfRange.from}–${perfRange.to}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={perfPreset}
              onChange={(e) => setPerfPreset(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="7">Last 7 days</option>
              <option value="15">Last 15 days</option>
              <option value="30">Last 30 days</option>
              <option value="month">Single month</option>
            </select>
            {perfPreset === 'month' && (
              <input
                type="month"
                value={perfMonth}
                onChange={(e) => setPerfMonth(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            )}
          </div>
        </div>

        {perfLoading ? (
          <div className="text-slate-500 py-16 text-center rounded-xl border border-slate-200 bg-white">Loading performance…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div id="reports-top-services" className="space-y-6 scroll-mt-6">
                <div className="bg-white rounded-xl shadow border border-slate-200 p-5 border-l-4 border-l-amber-500">
                  <h4 className="text-sm font-semibold text-slate-800">Complete service sales</h4>
                  <p className="text-2xl font-bold text-slate-900 mt-3 tabular-nums">
                    {formatINR(perfData?.revenueTotals?.serviceRevenue ?? 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
                  <h4 className="text-sm font-semibold text-slate-800 mb-4">Service mix</h4>
                  {servicePieData.length === 0 ? (
                    <p className="text-slate-500 py-16 text-center text-sm">No service sales in this period.</p>
                  ) : (
                    <div className="h-[min(20rem,50vh)] w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={servicePieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="48%"
                            outerRadius="78%"
                            paddingAngle={1}
                          >
                            {servicePieData.map((_, i) => (
                              <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} stroke="#fff" strokeWidth={1} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null;
                              const p = payload[0].payload;
                              return (
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow text-xs">
                                  <p className="font-semibold text-slate-800">{p.fullName}</p>
                                  <p className="text-slate-600 tabular-nums">Times: <span className="font-medium">{formatCount(p.qty)}</span></p>
                                  <p className="font-medium text-slate-800">{formatINR(p.value)}</p>
                                </div>
                              );
                            }}
                          />
                          <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
                  <h4 className="text-sm font-semibold text-slate-800 mb-4">Top services</h4>
                  {topServicesBar.length === 0 ? (
                    <p className="text-slate-500 text-sm py-10 text-center">No data.</p>
                  ) : (
                    <div className="h-[min(20rem,50vh)] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={topServicesBar}
                          layout="vertical"
                          margin={{ left: 4, right: 12, top: 8, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                          <XAxis type="number" tickFormatter={(v) => formatINR(v, v >= 1000 ? 0 : 2)} fontSize={11} stroke="#94a3b8" />
                          <YAxis type="category" dataKey="label" width={168} tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} />
                          <Tooltip
                            content={({ active, payload: pl }) => {
                              if (!active || !pl?.[0]) return null;
                              const row = pl[0].payload;
                              return (
                                <div className="rounded-lg border bg-white px-3 py-2 shadow text-xs tabular-nums">
                                  <p className="font-semibold">{row.fullName}</p>
                                  <p className="text-slate-600">Times: <span className="font-medium">{formatCount(row.qty)}</span></p>
                                  <p className="font-medium text-slate-900">{formatINR(row.revenue)}</p>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                            {topServicesBar.map((_, i) => (
                              <Cell key={i} fill={COLORS.serviceSales} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              <div id="reports-top-products" className="space-y-6 scroll-mt-6">
                <div className="bg-white rounded-xl shadow border border-slate-200 p-5 border-l-4 border-l-violet-500">
                  <h4 className="text-sm font-semibold text-slate-800">Complete product sales</h4>
                  <p className="text-2xl font-bold text-slate-900 mt-3 tabular-nums">
                    {formatINR(perfData?.revenueTotals?.productRevenue ?? 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
                  <h4 className="text-sm font-semibold text-slate-800 mb-4">Product mix</h4>
                  {productPieData.length === 0 ? (
                    <p className="text-slate-500 py-16 text-center text-sm">No retail product sales in this period.</p>
                  ) : (
                    <div className="h-[min(20rem,50vh)] w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={productPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="48%"
                            outerRadius="78%"
                            paddingAngle={1}
                          >
                            {productPieData.map((_, i) => (
                              <Cell key={i} fill={PRODUCT_PIE_PALETTE[i % PRODUCT_PIE_PALETTE.length]} stroke="#fff" strokeWidth={1} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null;
                              const p = payload[0].payload;
                              return (
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow text-xs">
                                  <p className="font-semibold text-slate-800">{p.fullName}</p>
                                  <p className="text-slate-600 tabular-nums">Times: <span className="font-medium">{formatCount(p.qty)}</span></p>
                                  <p className="font-medium text-slate-800">{formatINR(p.value)}</p>
                                </div>
                              );
                            }}
                          />
                          <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
                  <h4 className="text-sm font-semibold text-slate-800 mb-4">Top products</h4>
                  {topProductsBar.length === 0 ? (
                    <p className="text-slate-500 text-sm py-10 text-center">No retail products in this period.</p>
                  ) : (
                    <div className="h-[min(20rem,50vh)] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={topProductsBar}
                          layout="vertical"
                          margin={{ left: 4, right: 12, top: 8, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                          <XAxis type="number" tickFormatter={(v) => formatINR(v, v >= 1000 ? 0 : 2)} fontSize={11} stroke="#94a3b8" />
                          <YAxis type="category" dataKey="label" width={168} tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} />
                          <Tooltip
                            content={({ active, payload: pl }) => {
                              if (!active || !pl?.[0]) return null;
                              const row = pl[0].payload;
                              return (
                                <div className="rounded-lg border bg-white px-3 py-2 shadow text-xs tabular-nums">
                                  <p className="font-semibold">{row.fullName}</p>
                                  <p className="text-slate-600">Times: <span className="font-medium">{formatCount(row.qty)}</span></p>
                                  <p className="font-medium text-slate-900">{formatINR(row.revenue)}</p>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                            {topProductsBar.map((_, i) => (
                              <Cell key={i} fill={COLORS.productSales} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(Number(perfData?.revenueTotals?.membershipRevenue) || 0) > 0 && (
              <p className="text-xs text-slate-500 text-center -mt-2">
                Membership:{' '}
                <strong className="text-slate-700 tabular-nums">{formatINR(perfData?.revenueTotals?.membershipRevenue)}</strong>
              </p>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-800 mb-4">Staff performance</h4>
                {staffPerfChart.length === 0 ? (
                  <p className="text-slate-500 text-sm py-10 text-center">No staff-attributed sales in this period.</p>
                ) : (
                  <div className="h-[min(20rem,50vh)] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={staffPerfChart} margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => formatINR(v, v >= 1000 ? 0 : 2)} fontSize={11} stroke="#94a3b8" />
                        <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <Tooltip
                          content={({ active, payload: pl }) => {
                            if (!active || !pl?.[0]) return null;
                            const row = pl[0].payload;
                            return (
                              <div className="rounded-lg border bg-white px-3 py-2 shadow text-xs">
                                <p className="font-semibold">{row.fullName}</p>
                                <p>Services: {formatINR(row.services)}</p>
                                <p>Products: {formatINR(row.products)}</p>
                                {row.membership > 0 && <p>Membership: {formatINR(row.membership)}</p>}
                                <p className="font-medium border-t border-slate-100 pt-1.5 mt-1.5">Total: {formatINR(row.total)}</p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="total" fill="#1e293b" name="Total" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-amber-50 via-white to-slate-50 rounded-xl shadow border border-amber-200/60 p-5 flex flex-col">
                <h4 className="text-sm font-semibold text-slate-800 mb-4">Top performer</h4>
                {!perfData?.topPerformer ? (
                  <p className="text-slate-500 text-sm flex-1 flex items-center">No staff-attributed sales this period.</p>
                ) : (
                  <>
                    <p className="text-xl font-bold text-slate-900">{perfData.topPerformer.staffName}</p>
                    <p className="text-2xl font-bold text-amber-700 mt-2">{formatINR(perfData.topPerformer.totalSales)}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Services {formatINR(perfData.topPerformer.serviceSales)} · Products{' '}
                      {formatINR(perfData.topPerformer.productSales)}
                      {(Number(perfData.topPerformer.membershipSales) || 0) > 0 && (
                        <> · Membership {formatINR(perfData.topPerformer.membershipSales)}</>
                      )}
                    </p>
                    <ul className="mt-3 space-y-2 text-xs text-slate-700 leading-relaxed flex-1">
                      {(perfData.topPerformer.feedback || []).map((line, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h4 className="text-sm font-semibold text-slate-800">Staff sales</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Staff</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">Service sales</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">Product sales</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">Membership</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(perfData?.staffSales || []).map((row) => (
                      <tr key={row.staffId} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-medium text-slate-800">{row.staffName}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{formatINR(row.serviceSales)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{formatINR(row.productSales)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{formatINR(row.membershipSales)}</td>
                        <td className="py-2.5 px-4 text-right font-medium tabular-nums">{formatINR(row.totalSales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </>
        )}
      </div>

      {/* End of Day Report – each day's values */}
      <div className="bg-white rounded-xl shadow p-6 border border-slate-200 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">End of day</h3>
          </div>
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Show</span>
            <select
              value={dailyReportDays}
              onChange={(e) => setDailyReportDays(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        </div>
        {dailyReports.length === 0 ? (
          <p className="text-slate-500 py-8 text-center">No data for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Date</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600">Cash</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600">UPI</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600">Card</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600">Member</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600">Revenue</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600">Expenses</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600">Net</th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.map((row) => (
                  <tr key={row.date} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium">{formatDate(row.date)}</td>
                    <td className="py-2 px-3 text-right" style={{ color: COLORS.cash }}>{formatINR(row.cash)}</td>
                    <td className="py-2 px-3 text-right" style={{ color: COLORS.upi }}>{formatINR(row.upi)}</td>
                    <td className="py-2 px-3 text-right" style={{ color: COLORS.card }}>{formatINR(row.card)}</td>
                    <td className="py-2 px-3 text-right" style={{ color: COLORS.membership }}>{formatINR(row.membership)}</td>
                    <td className="py-2 px-3 text-right font-medium">{formatINR(row.revenue)}</td>
                    <td className="py-2 px-3 text-right text-red-600">{formatINR(row.expenses)}</td>
                    <td className="py-2 px-3 text-right font-medium" style={{ color: row.net >= 0 ? '#059669' : '#dc2626' }}>{formatINR(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
          <h3 className="font-semibold text-slate-800 mb-4">Last 7 days</h3>
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
          <h3 className="font-semibold text-slate-800 mb-4">Monthly sales &amp; profit (12 months)</h3>
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
