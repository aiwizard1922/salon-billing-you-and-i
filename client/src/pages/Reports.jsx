import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { formatINR } from '../utils/formatCurrency';
import { istDateStr, istMonthStr, formatDateIST, monthRangeIST } from '../utils/ist';
import {
  ReportsSalesView,
  ReportsDailyView,
  ReportsStaffView,
  ReportsTrendsView,
  ReportsProfitView,
} from './reports/ReportViews';

const API = '/api';

/** Inclusive IST calendar range for "last N days" ending today in Asia/Kolkata. */
function rangeLastNDaysIST(n) {
  const end = istDateStr();
  const endAnchor = new Date(`${end}T12:00:00+05:30`);
  const startAnchor = new Date(endAnchor.getTime() - (n - 1) * 86400000);
  const from = startAnchor.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return { from, to: end };
}

function istWeekdayMon0(ymd) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
  }).formatToParts(new Date(`${ymd}T12:00:00+05:30`));
  const w = parts.find((p) => p.type === 'weekday')?.value;
  const map = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  };
  return map[w] ?? 0;
}

function buildMonthCalendarCells(ym) {
  const { from, to } = monthRangeIST(ym);
  const last = Number(to.slice(-2));
  const pad = istWeekdayMon0(from);
  const cells = [];
  for (let i = 0; i < pad; i++) cells.push({ kind: 'pad' });
  for (let d = 1; d <= last; d++) {
    const dd = String(d).padStart(2, '0');
    cells.push({ kind: 'day', ymd: `${ym}-${dd}`, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ kind: 'pad' });
  return cells;
}

function formatCount(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return '0';
  if (Math.abs(x - Math.round(x)) < 1e-6) return Math.round(x).toLocaleString('en-IN');
  return x.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const REPORT_TABS = [
  { path: '/reports/sales', label: 'Services and products' },
  { path: '/reports/daily', label: 'Daily sales' },
  { path: '/reports/staff', label: 'Staff' },
  { path: '/reports/profit', label: 'Profit & loss' },
  { path: '/reports/trends', label: 'Monthly trends' },
];

export default function Reports() {
  const location = useLocation();
  const [daily, setDaily] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [dailyByMethod, setDailyByMethod] = useState([]);
  const [monthlyByMethod, setMonthlyByMethod] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyReports, setDailyReports] = useState([]);
  const [dailyReportMonth, setDailyReportMonth] = useState(() => istMonthStr());
  const [dailyReportRange, setDailyReportRange] = useState({ from: '', to: '' });
  const [dailyReportLoading, setDailyReportLoading] = useState(true);
  const [dailyReportShowEmpty, setDailyReportShowEmpty] = useState(false);

  const [perfPreset, setPerfPreset] = useState('7');
  const [perfMonth, setPerfMonth] = useState(() => istMonthStr());
  const [perfLoading, setPerfLoading] = useState(true);
  const [perfData, setPerfData] = useState(null);
  const [perfRange, setPerfRange] = useState({ from: '', to: '' });

  const [staffMonth, setStaffMonth] = useState(() => istMonthStr());
  const [staffData, setStaffData] = useState(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffSelectedYmd, setStaffSelectedYmd] = useState(() => istDateStr());
  const [staffRange, setStaffRange] = useState({ from: '', to: '' });

  const [profitMonth, setProfitMonth] = useState(() => istMonthStr());
  const [profitLoading, setProfitLoading] = useState(true);
  const [profitData, setProfitData] = useState(null);
  const [profitRange, setProfitRange] = useState({ from: '', to: '' });
  const [profitMonthly, setProfitMonthly] = useState([]);

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

  useEffect(() => {
    const r = monthRangeIST(dailyReportMonth);
    setDailyReportRange(r);
    if (!r.from || !r.to) return;
    setDailyReportLoading(true);
    const q = new URLSearchParams({ from: r.from, to: r.to });
    fetch(`${API}/analytics/daily-reports?${q}`)
      .then((res) => res.json())
      .then((drRes) => {
        if (drRes.success) setDailyReports(drRes.data || []);
        else setDailyReports([]);
      })
      .catch(() => setDailyReports([]))
      .finally(() => setDailyReportLoading(false));
  }, [dailyReportMonth]);

  useEffect(() => {
    const r = monthRangeIST(profitMonth);
    setProfitRange(r);
    if (!r.from || !r.to) return;
    setProfitLoading(true);
    const q = new URLSearchParams({ from: r.from, to: r.to });
    Promise.all([
      fetch(`${API}/analytics/profit?${q}`).then((res) => res.json()),
      fetch(`${API}/analytics/profit/monthly?months=12`).then((res) => res.json()),
    ])
      .then(([profitRes, monthlyRes]) => {
        setProfitData(profitRes.success ? profitRes.data : null);
        setProfitMonthly(monthlyRes.success ? monthlyRes.data || [] : []);
      })
      .catch(() => {
        setProfitData(null);
        setProfitMonthly([]);
      })
      .finally(() => setProfitLoading(false));
  }, [profitMonth]);

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
      .then((perfRes) => {
        if (perfRes.success && perfRes.data) setPerfData(perfRes.data);
        else setPerfData(null);
      })
      .catch(() => setPerfData(null))
      .finally(() => setPerfLoading(false));
  }, [perfPreset, perfMonth]);

  useEffect(() => {
    const r = monthRangeIST(staffMonth);
    setStaffRange(r);
    setStaffLoading(true);
    const q = new URLSearchParams({ from: r.from, to: r.to, limit: '40' });
    fetch(`${API}/analytics/sales-performance?${q}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) setStaffData(res.data);
        else setStaffData(null);
      })
      .catch(() => setStaffData(null))
      .finally(() => setStaffLoading(false));
  }, [staffMonth]);

  useEffect(() => {
    const today = istDateStr();
    if (today.startsWith(staffMonth)) setStaffSelectedYmd(today);
    else setStaffSelectedYmd(`${staffMonth}-01`);
  }, [staffMonth]);

  useEffect(() => {
    const id = (location.hash || '').replace(/^#/, '');
    if (!id) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(t);
  }, [location.pathname, location.hash]);

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
    const rows = staffData?.staffSales || [];
    return [...rows]
      .map((s) => ({
        ...s,
        rankingTotal:
          Math.round(((Number(s.serviceSales) || 0) + (Number(s.productSales) || 0)) * 100) / 100,
      }))
      .filter(
        (s) =>
          s.rankingTotal > 0 || (Number(s.membershipLineCount) || 0) > 0,
      )
      .sort((a, b) => {
        if (b.rankingTotal !== a.rankingTotal) return b.rankingTotal - a.rankingTotal;
        return (Number(b.membershipLineCount) || 0) - (Number(a.membershipLineCount) || 0);
      })
      .map((s) => ({
        name: s.staffName.length > 14 ? `${s.staffName.slice(0, 12)}…` : s.staffName,
        fullName: s.staffName,
        total: s.rankingTotal,
        totalAll: Math.round(Number(s.totalSales) * 100) / 100,
        services: Math.round(Number(s.serviceSales) * 100) / 100,
        products: Math.round(Number(s.productSales) * 100) / 100,
        membership: Math.round(Number(s.membershipSales) * 100) / 100,
        membershipLineCount: Number(s.membershipLineCount) || 0,
      }));
  }, [staffData?.staffSales]);

  const staffCalByDate = useMemo(() => {
    const rows = staffData?.staffDailyRows || [];
    const m = new Map();
    for (const row of rows) {
      const d = row.date;
      if (!d) continue;
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(row);
    }
    const rankDay = (a, b) => {
      const sa = (Number(a.serviceSales) || 0) + (Number(a.productSales) || 0);
      const sb = (Number(b.serviceSales) || 0) + (Number(b.productSales) || 0);
      if (sb !== sa) return sb - sa;
      return (
        (Number(b.membershipLineCount) || 0) - (Number(a.membershipLineCount) || 0)
      );
    };
    m.forEach((list, k) => {
      m.set(k, [...list].sort(rankDay));
    });
    return m;
  }, [staffData?.staffDailyRows]);

  const staffCalTotalsByYmd = useMemo(() => {
    const out = new Map();
    staffCalByDate.forEach((list, ymd) => {
      out.set(
        ymd,
        list.reduce((s, r) => s + (Number(r.totalSales) || 0), 0),
      );
    });
    return out;
  }, [staffCalByDate]);

  const staffCalGridCells = useMemo(() => buildMonthCalendarCells(staffMonth), [staffMonth]);

  const staffCalSelectedRows = staffCalByDate.get(staffSelectedYmd) || [];

  const dailyReportDisplayRows = useMemo(() => {
    const rows = [...(dailyReports || [])].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
    if (dailyReportShowEmpty) return rows;
    return rows.filter(
      (r) => (Number(r.revenue) || 0) > 0 || (Number(r.expenses) || 0) > 0
    );
  }, [dailyReports, dailyReportShowEmpty]);

  const dailyReportTotals = useMemo(() => {
    const rows = dailyReports || [];
    return rows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + (Number(r.revenue) || 0),
        expenses: acc.expenses + (Number(r.expenses) || 0),
        net: acc.net + (Number(r.net) || 0),
      }),
      { revenue: 0, expenses: 0, net: 0 }
    );
  }, [dailyReports]);

  if (loading) return <div className="text-slate-600 text-sm">Loading reports…</div>;

  const formatDate = (d) => {
    if (!d) return '';
    return formatDateIST(d, { day: '2-digit', month: '2-digit' });
  };
  const formatMonth = (m) => {
    if (!m) return '';
    const [y, mo] = String(m).split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(mo, 10) - 1]} ${y}`;
  };
  const formatRupee = (v) => formatINR(v, v >= 1000 ? 0 : 2);

  const thisMonth = monthlyByMethod.find((m) => m.month === istMonthStr());
  const monthTotal = thisMonth ? thisMonth.cash + thisMonth.upi + thisMonth.card : 0;

  const ctx = {
    perfPreset,
    setPerfPreset,
    perfMonth,
    setPerfMonth,
    perfRange,
    perfLoading,
    perfData,
    topServicesBar,
    topProductsBar,
    formatCount,
    staffPerfChart,
    staffMonth,
    setStaffMonth,
    staffRange,
    staffLoading,
    staffData,
    staffCalGridCells,
    staffCalTotalsByYmd,
    staffSelectedYmd,
    setStaffSelectedYmd,
    staffCalSelectedRows,
    dailyReports,
    dailyReportMonth,
    setDailyReportMonth,
    dailyReportRange,
    dailyReportLoading,
    dailyReportShowEmpty,
    setDailyReportShowEmpty,
    dailyReportDisplayRows,
    dailyReportTotals,
    thisMonth,
    monthTotal,
    dailyByMethod,
    daily,
    monthlyByMethod,
    monthly,
    formatDate,
    formatMonth,
    formatRupee,
    istMonthStr,
    profitMonth,
    setProfitMonth,
    profitRange,
    profitLoading,
    profitData,
    profitMonthly,
  };

  return (
    <div className="max-w-[1600px] mx-auto w-full pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports</h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl">
          Open each section for a full-width view — services and products, daily payments, staff, and long-run trends.
        </p>
      </div>

      <nav
        className="flex flex-wrap gap-1 sm:gap-2 mb-8 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80"
        aria-label="Report sections"
      >
        {REPORT_TABS.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            end
            className={({ isActive }) =>
              `px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                isActive
                  ? 'bg-white text-amber-900 shadow-sm ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* basename required: otherwise path="trends" matches /trends, not /reports/trends */}
      <Routes basename="/reports">
        <Route index element={<Navigate to="/reports/sales" replace />} />
        <Route path="sales" element={<ReportsSalesView ctx={ctx} />} />
        <Route path="daily" element={<ReportsDailyView ctx={ctx} />} />
        <Route path="staff" element={<ReportsStaffView ctx={ctx} />} />
        <Route path="profit" element={<ReportsProfitView ctx={ctx} />} />
        <Route path="trends" element={<ReportsTrendsView ctx={ctx} />} />
        <Route path="*" element={<Navigate to="/reports/sales" replace />} />
      </Routes>
    </div>
  );
}
