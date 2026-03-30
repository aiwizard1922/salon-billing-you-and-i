import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FileText,
  DollarSign,
  Plus,
  BarChart3,
  Users,
  Gift,
  Calendar,
  TrendingUp,
  PiggyBank,
  UserCog,
  ArrowUpRight,
  Receipt,
  MinusCircle,
  Scissors,
  Package,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { formatINR } from '../utils/formatCurrency';
import { formatAppointmentTimeDisplay } from '../utils/appointmentSlots';
import {
  istDateStr,
  istMonthStr,
  appointmentDateToYmd,
  formatAppointmentDateDisplay,
  formatDateIST,
  isAppointmentUpcomingInIST,
} from '../utils/ist';
import { formatAppointmentServiceSummary } from '../utils/appointmentDisplay';

const API = '/api';

const CHART_COLORS = {
  revenue: '#3B82F6',
  expenses: '#E11D48',
  cash: '#F59E0B',
  upi: '#2563EB',
  card: '#8B5CF6',
  membership: '#64748B',
};

function safeJson(res) {
  return res.ok ? res.json() : Promise.resolve({ success: false });
}

/** Dashboard top lists: quantity × with tabular alignment in a fixed grid column. */
function dashQtyTimes(q) {
  const n = Number(q) || 0;
  if (Math.abs(n - Math.round(n)) < 1e-6) return `${Math.round(n)}×`;
  return `${n.toFixed(2).replace(/\.?0+$/, '')}×`;
}

/** Recharts tooltip: show net only here to avoid a third line on the chart. */
function TrendChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const rev = Number(row.revenue) || 0;
  const exp = Number(row.expenses) || 0;
  const net = Math.round((rev - exp) * 100) / 100;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-md text-xs min-w-[190px]">
      <p className="font-semibold text-slate-800 mb-1.5 border-b border-slate-100 pb-1">
        {formatDateIST(row.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
      <div className="space-y-1 text-slate-600">
        <p className="flex justify-between gap-6">
          <span>Revenue</span>
          <span className="font-medium text-slate-900 tabular-nums">{formatINR(rev)}</span>
        </p>
        <p className="flex justify-between gap-6">
          <span>Expenses</span>
          <span className="font-medium text-slate-900 tabular-nums">{formatINR(exp)}</span>
        </p>
      </div>
      <p className="flex justify-between gap-6 font-medium text-emerald-700 mt-2 pt-2 border-t border-slate-100">
        <span>Net</span>
        <span className="tabular-nums">{formatINR(net)}</span>
      </p>
    </div>
  );
}

export default function Dashboard() {
  const location = useLocation();
  const [invoices, setInvoices] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [dailyByMethod, setDailyByMethod] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [customerCount, setCustomerCount] = useState(null);
  const [staffCount, setStaffCount] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [lineItemTop, setLineItemTop] = useState({ services: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    const from = istDateStr();
    const to = istDateStr(new Date(Date.now() + 14 * 86400000));
    Promise.all([
      fetch(`${API}/invoices`).then(safeJson),
      fetch(`${API}/analytics/daily-reports?days=14`).then(safeJson),
      fetch(`${API}/analytics/daily-by-method?days=14`).then(safeJson),
      fetch(`${API}/analytics/monthly?months=6`).then(safeJson),
      fetch(`${API}/customer-memberships?status=active`).then(safeJson),
      fetch(`${API}/customers`).then(safeJson),
      fetch(`${API}/staff`).then(safeJson),
      fetch(`${API}/appointments?from=${from}&to=${to}`).then(safeJson),
      fetch(`${API}/analytics/line-items?days=30&limit=5`).then(safeJson),
    ])
      .then(([inv, dr, dm, mo, mem, cust, st, ap, li]) => {
        if (inv.success) setInvoices(inv.data || []);
        if (dr.success) setDailyReports(dr.data || []);
        if (dm.success) setDailyByMethod(dm.data || []);
        if (mo.success) setMonthly(mo.data || []);
        if (mem.success) setMemberships(mem.data || []);
        if (cust.success) setCustomerCount((cust.data || []).length);
        if (st.success) setStaffCount((st.data || []).length);
        if (ap.success) setAppointments(ap.data || []);
        if (li.success && li.data) {
          setLineItemTop({
            services: li.data.services || [],
            products: li.data.products || [],
          });
        }

        const failed = [inv, dr].filter((x) => !x.success);
        if (failed.length && !inv.success) {
          setError(inv.error || dr.error || 'Could not load dashboard data');
        } else {
          setError(null);
        }
      })
      .catch((e) => setError(e.message || 'Network error – try again'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [location.pathname]);

  const [upcomingClockTick, setUpcomingClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setUpcomingClockTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayYmd = istDateStr();
  const monthKey = istMonthStr();

  const pending = invoices.filter((i) => i.status === 'pending');
  const paid = invoices.filter((i) => i.status === 'paid');
  const pendingAmt = pending.reduce((s, i) => s + Number(i.total), 0);
  const paidAmt = paid.reduce((s, i) => s + Number(i.total), 0);

  const chartDaily = useMemo(() => {
    const rows = [...(dailyReports || [])].sort(
      (a, b) => String(a.date).localeCompare(String(b.date))
    );
    return rows.map((r) => ({
      date: String(r.date).slice(0, 10),
      label: formatDayLabel(r.date),
      revenue: Number(r.revenue) || 0,
      net: Number(r.net) || 0,
      expenses: Number(r.expenses) || 0,
    }));
  }, [dailyReports]);

  const todayPulse = useMemo(() => {
    const row = chartDaily.find((r) => r.date === todayYmd);
    const rev = row?.revenue ?? 0;
    const net = row?.net ?? 0;
    const exp = row?.expenses ?? 0;
    return { revenue: rev, net, expenses: exp };
  }, [chartDaily, todayYmd]);

  const last7Net = useMemo(() => {
    const tail = chartDaily.slice(-7);
    return tail.reduce((s, r) => s + r.net, 0);
  }, [chartDaily]);

  const last7Revenue = useMemo(() => {
    const tail = chartDaily.slice(-7);
    return tail.reduce((s, r) => s + r.revenue, 0);
  }, [chartDaily]);

  const last7Expenses = useMemo(() => {
    const tail = chartDaily.slice(-7);
    return tail.reduce((s, r) => s + r.expenses, 0);
  }, [chartDaily]);

  /** Paid invoices whose payment date falls on one of the last 7 days in the trend chart (matches backend daily buckets). */
  const paidBillsLast7ChartDays = useMemo(() => {
    const ymds = new Set(chartDaily.slice(-7).map((r) => r.date));
    return invoices.filter((i) => {
      if (i.status !== 'paid' || !i.paid_at) return false;
      return ymds.has(String(i.paid_at).slice(0, 10));
    }).length;
  }, [invoices, chartDaily]);

  const paymentMix7d = useMemo(() => {
    const tail = chartDaily.slice(-7);
    const mix = { cash: 0, upi: 0, card: 0, membership: 0 };
    const byDate = Object.fromEntries(
      (dailyByMethod || []).map((r) => [String(r.date).slice(0, 10), r])
    );
    for (const d of tail) {
      const m = byDate[d.date];
      if (m) {
        mix.cash += Number(m.cash) || 0;
        mix.upi += Number(m.upi) || 0;
        mix.card += Number(m.card) || 0;
      }
    }
    for (const r of tail) {
      const dr = (dailyReports || []).find((x) => String(x.date).slice(0, 10) === r.date);
      if (dr) mix.membership += Number(dr.membership) || 0;
    }
    const total = mix.cash + mix.upi + mix.card + mix.membership;
    return { ...mix, total };
  }, [chartDaily, dailyByMethod, dailyReports]);

  const mixChartData = useMemo(() => {
    const { cash, upi, card, membership } = paymentMix7d;
    return [
      { name: 'Cash', value: cash, fill: CHART_COLORS.cash },
      { name: 'UPI', value: upi, fill: CHART_COLORS.upi },
      { name: 'Card', value: card, fill: CHART_COLORS.card },
      { name: 'Membership', value: membership, fill: CHART_COLORS.membership },
    ].filter((x) => x.value > 0);
  }, [paymentMix7d]);

  const thisMonthRow = monthly.find((m) => m.month === monthKey);
  const monthRevenue = thisMonthRow ? Number(thisMonthRow.revenue) || 0 : 0;

  const activeWithBalance = memberships.filter(
    (m) => m.status === 'active' && Number(m.remaining_balance ?? m.initial_balance ?? 0) > 0
  );
  const membershipCreditOut = activeWithBalance.reduce(
    (s, m) => s + Number(m.remaining_balance ?? m.initial_balance ?? 0),
    0
  );

  const upcomingAppointments = useMemo(() => {
    return [...appointments]
      .filter((a) => isAppointmentUpcomingInIST(a))
      .sort((a, b) => {
        const da = appointmentDateToYmd(a.appointment_date).localeCompare(appointmentDateToYmd(b.appointment_date));
        if (da !== 0) return da;
        return String(a.appointment_time || '').localeCompare(String(b.appointment_time || ''));
      })
      .slice(0, 8);
  }, [appointments, upcomingClockTick]);

  const formatRupeeAxis = (v) => {
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
    return formatINR(v, 0);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="h-72 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Today · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })} (IST)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <Link
            to="/reports"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600"
          >
            <BarChart3 className="w-4 h-4" />
            Full reports
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button onClick={load} className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 rounded text-sm font-medium shrink-0">
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl shadow p-4 md:p-5 col-span-2 lg:col-span-1 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-blue-100 text-sm font-medium">Today — collected</span>
            <TrendingUp className="w-5 h-5 text-blue-200 shrink-0" />
          </div>
          <p className="text-2xl md:text-3xl font-bold mt-2 tabular-nums">{formatINR(todayPulse.revenue)}</p>
          <p className="text-blue-100 text-xs mt-2 leading-relaxed">
            <span className="text-blue-200/90">Expenses logged today:</span>{' '}
            <span className="font-semibold text-white tabular-nums">{formatINR(todayPulse.expenses)}</span>
          </p>
          <p className="text-blue-100 text-xs mt-1">
            Same calendar-day <span className="font-semibold text-white">net</span> (revenue − those expenses):{' '}
            <span className="font-semibold text-white tabular-nums">{formatINR(todayPulse.net)}</span>
          </p>
          <p className="text-blue-100/80 text-xs mt-2 pt-2 border-t border-white/10">
            Paid bills in chart window (last 7 days):{' '}
            <span className="font-semibold text-white">{paidBillsLast7ChartDays}</span>
            {last7Revenue > 0 && (
              <>
                {' · '}
                Avg collected/day:{' '}
                <span className="font-semibold text-white tabular-nums">
                  {formatINR(Math.round((last7Revenue / 7) * 100) / 100)}
                </span>
              </>
            )}
          </p>
        </div>
        <StatCard
          icon={PiggyBank}
          label="7-day net"
          sub="Sum of (daily revenue − daily expenses); see note below chart"
          value={formatINR(last7Net)}
          accent="text-emerald-600"
          iconBg="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          icon={MinusCircle}
          label="7-day expenses"
          value={formatINR(last7Expenses)}
          sub="Total from Expenses, same 7 days as net"
          accent="text-rose-700"
          iconBg="bg-rose-100 text-rose-700"
        />
        <StatCard
          icon={BarChart3}
          label="This month (paid)"
          value={formatINR(monthRevenue)}
          sub="Sum of paid invoice totals (GST incl.), by paid date"
          accent="text-violet-700"
          iconBg="bg-violet-100 text-violet-700"
        />
        <Link
          to="/clients"
          className="bg-white rounded-xl shadow border border-slate-200 p-4 md:p-5 hover:border-amber-300 hover:shadow-md transition group"
        >
          <div className="flex justify-between items-start">
            <span className="text-slate-500 text-sm font-medium">Client insights</span>
            <Users className={`w-8 h-8 ${customerCount != null ? 'text-amber-500' : 'text-slate-300'}`} />
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2 tabular-nums">{customerCount ?? '–'}</p>
          <p className="text-xs text-amber-600 font-medium mt-2 flex items-center gap-1">
            Visit insights <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </p>
        </Link>
        <Link
          to="/memberships"
          className="bg-white rounded-xl shadow border border-slate-200 p-4 md:p-5 hover:border-amber-300 hover:shadow-md transition group"
        >
          <div className="flex justify-between items-start">
            <span className="text-slate-500 text-sm font-medium">Active memberships</span>
            <Gift className="w-8 h-8 text-pink-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2 tabular-nums">{activeWithBalance.length}</p>
          <p className="text-xs text-slate-500 mt-1">₹{membershipCreditOut.toLocaleString('en-IN')} credit outstanding</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-600" />
                Top services
              </h3>
            </div>
            <Link to="/reports#reports-top-services" className="text-xs text-amber-600 hover:underline shrink-0">
              Reports
            </Link>
          </div>
          {lineItemTop.services.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No service lines in this window yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lineItemTop.services.map((row, idx) => (
                <li
                  key={`${row.name}-${idx}`}
                  className="py-2.5 grid grid-cols-[minmax(0,1fr)_3.5rem_9rem] gap-x-3 items-center text-sm"
                >
                  <span className="text-slate-600 truncate min-w-0" title={row.name}>
                    <span className="text-slate-400 font-medium tabular-nums inline-block w-6 text-left">{idx + 1}.</span>
                    {row.name}
                  </span>
                  <span className="text-slate-600 tabular-nums text-right font-semibold whitespace-nowrap">
                    {dashQtyTimes(row.qty)}
                  </span>
                  <span className="font-semibold text-slate-800 tabular-nums text-right whitespace-nowrap">
                    {formatINR(row.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-violet-600" />
                Top products
              </h3>
            </div>
            <Link to="/reports#reports-top-products" className="text-xs text-amber-600 hover:underline shrink-0">
              Reports
            </Link>
          </div>
          {lineItemTop.products.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No product lines in this window yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lineItemTop.products.map((row, idx) => (
                <li
                  key={`${row.name}-${idx}`}
                  className="py-2.5 grid grid-cols-[minmax(0,1fr)_3.5rem_9rem] gap-x-3 items-center text-sm"
                >
                  <span className="text-slate-600 truncate min-w-0" title={row.name}>
                    <span className="text-slate-400 font-medium tabular-nums inline-block w-6 text-left">{idx + 1}.</span>
                    {row.name}
                  </span>
                  <span className="text-slate-600 tabular-nums text-right font-semibold whitespace-nowrap">
                    {dashQtyTimes(row.qty)}
                  </span>
                  <span className="font-semibold text-slate-800 tabular-nums text-right whitespace-nowrap">
                    {formatINR(row.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold text-slate-800">Team & ops</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/staff"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition"
            >
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                <UserCog className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Staff</p>
                <p className="text-xs text-slate-500">{staffCount ?? '–'} on roster</p>
              </div>
            </Link>
            <Link
              to="/expenses"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition"
            >
              <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Expenses</p>
                <p className="text-xs text-slate-500">Today: {formatINR(todayPulse.expenses)}</p>
              </div>
            </Link>
            <Link
              to="/appointments"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition col-span-2"
            >
              <div className="p-2 rounded-lg bg-cyan-100 text-cyan-700">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">Appointments</p>
                  <p className="text-xs text-slate-500">{upcomingAppointments.length} upcoming (next 2 weeks)</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </div>
            </Link>
          </div>
          <Link
            to="/invoices/new"
            className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700"
          >
            <Plus className="w-5 h-5" />
            Quick Sales
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold text-slate-800">Pending vs paid</h3>
            </div>
            <Link to="/invoices" className="text-sm text-amber-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
                <FileText className="w-4 h-4" />
                Pending
              </div>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatINR(pendingAmt)}</p>
              <p className="text-xs text-amber-700/80">{pending.length} invoice(s)</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-100 p-4">
              <div className="flex items-center gap-2 text-green-800 text-sm font-medium">
                <DollarSign className="w-4 h-4" />
                Paid (total)
              </div>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatINR(paidAmt)}</p>
              <p className="text-xs text-green-700/80">{paid.length} invoice(s)</p>
            </div>
          </div>
          {pending.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex flex-wrap gap-2">
                {pending.slice(0, 6).map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/invoices/${inv.id}`}
                    className="text-xs px-2 py-1 rounded-md bg-amber-100 text-amber-900 hover:bg-amber-200 font-medium"
                  >
                    {inv.invoice_number}
                  </Link>
                ))}
                {pending.length > 6 && (
                  <span className="text-xs text-slate-400 py-1">+{pending.length - 6} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white rounded-xl shadow border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Revenue vs expenses</h3>
          <p className="text-xs text-slate-500 mb-2">Last 14 days</p>
          <div className="h-72 w-full">
            {chartDaily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartDaily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.revenue} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tickFormatter={formatRupeeAxis} tick={{ fontSize: 11 }} stroke="#94a3b8" width={56} />
                  <Tooltip content={<TrendChartTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue (collected)"
                    stroke={CHART_COLORS.revenue}
                    fill="url(#dashRev)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses (logged)"
                    stroke={CHART_COLORS.expenses}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_COLORS.expenses }}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm py-16 text-center">No data in this window yet.</p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Payment mix</h3>
          <div className="h-72 w-full">
            {mixChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mixChartData} layout="vertical" margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={formatRupeeAxis} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="value" name="Amount" radius={[0, 4, 4, 0]}>
                    {mixChartData.map((e) => (
                      <Cell key={e.name} fill={e.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm py-16 text-center">No payments in the last week.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Upcoming appointments</h3>
            <Link to="/appointments" className="text-sm text-amber-600 hover:underline">
              Calendar
            </Link>
          </div>
          {upcomingAppointments.length === 0 ? (
            <p className="p-8 text-center text-slate-500 text-sm">No bookings in the next two weeks.</p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
              {upcomingAppointments.map((a) => (
                <li key={a.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{a.customer_name}</p>
                    <p className="text-xs text-slate-500">
                      {formatAppointmentDateDisplay(a.appointment_date)} ·{' '}
                      {formatAppointmentTimeDisplay(a.appointment_time) || '—'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{formatAppointmentServiceSummary(a)}</p>
                  </div>
                  <div className="text-right text-sm text-slate-600">
                    {(a.total_amount != null && Number(a.total_amount) > 0) ? formatINR(a.total_amount) : '—'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-200">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Recent invoices</h3>
            <Link to="/invoices/new" className="text-amber-600 hover:underline text-sm">
              + Add
            </Link>
          </div>
          {invoices.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Invoice</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Date</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 8).map((inv) => (
                    <tr key={inv.id} className="border-t hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <Link to={`/invoices/${inv.id}`} className="text-amber-600 hover:underline font-medium">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{inv.customer_name}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDateIST(inv.invoice_date)}</td>
                      <td className="py-3 px-4 text-right font-medium">{formatINR(inv.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent, iconBg }) {
  return (
    <div className="bg-white rounded-xl shadow border border-slate-200 p-4 md:p-5">
      <div className="flex justify-between items-start gap-2">
        <span className="text-slate-500 text-sm font-medium leading-tight">{label}</span>
        <div className={`p-2 rounded-lg shrink-0 ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className={`text-xl md:text-2xl font-bold mt-2 tabular-nums ${accent || 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1 leading-snug">{sub}</p>}
    </div>
  );
}

function formatDayLabel(dateVal) {
  const ymd = appointmentDateToYmd(dateVal);
  if (!ymd) return String(dateVal).slice(0, 10);
  return formatDateIST(`${ymd}T12:00:00+05:30`, { weekday: 'short', day: 'numeric', month: 'short' });
}

