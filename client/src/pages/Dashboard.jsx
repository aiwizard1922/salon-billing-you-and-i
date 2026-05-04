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
  ChevronDown,
  Eye,
  EyeOff,
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
import { formatInvoicePaymentLabel } from '../utils/invoiceListDisplay';

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

function formatSheetItemCount(n) {
  const x = Number(n) || 0;
  if (Math.abs(x - Math.round(x)) < 1e-6) return String(Math.round(x));
  return x.toFixed(2).replace(/\.?0+$/, '');
}

/** Normalize API footer (pg may stringify numerics; reconcile totals vs cash/upi/card). */
function sheetFooterValues(footer) {
  if (!footer || typeof footer !== 'object') return null;
  const num = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
  };
  const cash = num(footer.cash);
  const upi = num(footer.upi);
  const card = num(footer.card);
  const byMethod = num(cash + upi + card);
  const collected = num(footer.collectedNewMoney ?? footer.collected_new_money);
  const totalReceived =
    num(footer.totalReceived ?? footer.total_received) ||
    (collected > 0 ? collected : byMethod);
  const expenses = num(footer.expenses);
  const prepaid = num(footer.prepaid ?? footer.walletUsed ?? footer.wallet_used);
  const totalReceivedExcludingExpenses = num(totalReceived - expenses);
  return {
    cash,
    upi,
    card,
    prepaid,
    expenses,
    totalReceived,
    totalReceivedExcludingExpenses,
  };
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
    <div className="rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur-sm px-3.5 py-3 shadow-lg shadow-slate-300/30 text-xs min-w-[190px]">
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
  const [dailySheet, setDailySheet] = useState(null);
  const [financialOverviewOpen, setFinancialOverviewOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    const from = istDateStr();
    const to = istDateStr(new Date(Date.now() + 14 * 86400000));
    const today = istDateStr();
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
      fetch(`${API}/analytics/daily-sheet?date=${today}`).then(safeJson),
    ])
      .then(([inv, dr, dm, mo, mem, cust, st, ap, li, sheet]) => {
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
        if (sheet.success && sheet.data) setDailySheet(sheet.data);
        else setDailySheet(null);

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
      membershipWallet: Number(r.membership) || 0,
      membershipUseCount: Number(r.membershipUseCount) || 0,
    }));
  }, [dailyReports]);

  const todayPulse = useMemo(() => {
    const row = chartDaily.find((r) => r.date === todayYmd);
    const rev = row?.revenue ?? 0;
    const net = row?.net ?? 0;
    const exp = row?.expenses ?? 0;
    const membershipWallet = row?.membershipWallet ?? 0;
    const membershipUseCount = row?.membershipUseCount ?? 0;
    return { revenue: rev, net, expenses: exp, membershipWallet, membershipUseCount };
  }, [chartDaily, todayYmd]);

  const sheetFooterDisplay = useMemo(() => {
    if (!dailySheet?.footer) return null;
    try {
      return sheetFooterValues(dailySheet.footer);
    } catch {
      return null;
    }
  }, [dailySheet]);

  const dailySheetRows = useMemo(
    () => (Array.isArray(dailySheet?.rows) ? dailySheet.rows : []),
    [dailySheet]
  );

  const collectedTodayAmount = useMemo(() => {
    if (sheetFooterDisplay) return sheetFooterDisplay.totalReceived;
    if (dailySheet?.footer && dailySheet.footer.collectedNewMoney != null) {
      return Number(dailySheet.footer.collectedNewMoney) || 0;
    }
    return todayPulse.revenue;
  }, [sheetFooterDisplay, dailySheet, todayPulse.revenue]);

  const sheetExpenses = useMemo(() => {
    if (sheetFooterDisplay) return sheetFooterDisplay.expenses;
    if (dailySheet?.footer && dailySheet.footer.expenses != null) {
      return Number(dailySheet.footer.expenses) || 0;
    }
    return todayPulse.expenses;
  }, [sheetFooterDisplay, dailySheet, todayPulse.expenses]);

  const sheetNet = useMemo(() => {
    if (sheetFooterDisplay) return sheetFooterDisplay.totalReceivedExcludingExpenses;
    if (dailySheet?.footer && dailySheet.footer.netAfterExpenses != null) {
      return Number(dailySheet.footer.netAfterExpenses) || 0;
    }
    return todayPulse.net;
  }, [sheetFooterDisplay, dailySheet, todayPulse.net]);

  const last7Net = useMemo(() => {
    const tail = chartDaily.slice(-7);
    return tail.reduce((s, r) => s + r.net, 0);
  }, [chartDaily]);

  const last7Expenses = useMemo(() => {
    const tail = chartDaily.slice(-7);
    return tail.reduce((s, r) => s + r.expenses, 0);
  }, [chartDaily]);

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
      { name: 'Membership use', value: membership, fill: CHART_COLORS.membership },
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
      <div className="space-y-8 animate-pulse">
        <div className="h-9 bg-slate-200/90 rounded-lg w-52" />
        <div className="h-44 bg-slate-200/80 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-72 bg-slate-200/70 rounded-2xl" />
          <div className="h-72 bg-slate-200/70 rounded-2xl" />
        </div>
        <div className="h-14 bg-slate-200/70 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">Dashboard</h2>
          <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <span>
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                timeZone: 'Asia/Kolkata',
              })}
            </span>
            <span className="rounded-md bg-slate-100/90 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              IST
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={load}
            className="px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200/90 bg-white/90 text-slate-700 shadow-sm shadow-slate-200/40 backdrop-blur-sm hover:bg-white hover:border-slate-300/90 hover:shadow transition-all duration-200"
          >
            Refresh
          </button>
          <Link
            to="/reports/sales"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30 ring-1 ring-amber-400/30 hover:from-amber-600 hover:to-amber-700 hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200"
          >
            <BarChart3 className="w-4 h-4" />
            Full reports
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-50/90 border border-amber-200/80 rounded-2xl text-amber-900 flex items-center justify-between gap-4 shadow-sm">
          <span className="text-sm">{error}</span>
          <button
            onClick={load}
            className="px-3.5 py-2 bg-amber-200/80 hover:bg-amber-300/90 rounded-xl text-sm font-medium shrink-0 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Operational strip first — no revenue figures */}
      <div className="bg-white rounded-2xl border border-slate-100/90 p-5 md:p-6 shadow-md shadow-slate-200/45 ring-1 ring-slate-900/[0.04]">
        <div className="mb-5 pb-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Quick access</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/staff"
            className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-200/60 hover:shadow-sm transition-all"
          >
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/50">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Staff</p>
              <p className="text-xs text-slate-500">{staffCount ?? '–'} on roster</p>
            </div>
          </Link>
          <Link
            to="/expenses"
            className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-rose-200/60 hover:shadow-sm transition-all"
          >
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 ring-1 ring-rose-200/50">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Expenses</p>
              <p className="text-xs text-slate-500">Log business spends</p>
            </div>
          </Link>
          <Link
            to="/appointments"
            className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-cyan-200/60 hover:shadow-sm transition-all col-span-2"
          >
            <div className="p-2 rounded-xl bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200/50">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex-1 flex items-center justify-between min-w-0">
              <div>
                <p className="text-sm font-semibold text-slate-800">Appointments</p>
                <p className="text-xs text-slate-500">{upcomingAppointments.length} upcoming (2 wks)</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
          </Link>
        </div>
        <Link
          to="/invoices/new"
          className="mt-5 flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white text-sm font-semibold shadow-md shadow-slate-900/20 hover:from-slate-700 hover:to-slate-800 transition-all"
        >
          <Plus className="w-5 h-5" strokeWidth={2.25} />
          Quick Sales
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-100/90 shadow-md shadow-slate-200/45 ring-1 ring-slate-900/[0.04] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-900">Upcoming appointments</h3>
            <Link
              to="/appointments"
              className="text-sm font-medium text-amber-600 hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors"
            >
              Calendar
            </Link>
          </div>
          {upcomingAppointments.length === 0 ? (
            <p className="p-8 text-center text-slate-500 text-sm">No bookings in the next two weeks.</p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
              {upcomingAppointments.map((a) => (
                <li
                  key={a.id}
                  className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 hover:bg-amber-50/40 transition-colors"
                >
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

        <div className="bg-white rounded-2xl border border-slate-100/90 shadow-md shadow-slate-200/45 ring-1 ring-slate-900/[0.04] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-900">Recent invoices</h3>
            <Link
              to="/invoices/new"
              className="text-sm font-medium text-amber-600 hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors"
            >
              + Add
            </Link>
          </div>
          {invoices.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-slate-50/90">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Invoice
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Customer
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Staff
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Payment
                    </th>
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
                      <td
                        className="py-3 px-4 text-slate-600 text-sm max-w-[140px] truncate"
                        title={inv.staff_names || ''}
                      >
                        {inv.staff_names || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatDateIST(inv.invoice_date)}</td>
                      <td className="py-3 px-4 text-right font-medium">{formatINR(inv.total)}</td>
                      <td className="py-3 px-4 text-slate-600 text-sm whitespace-nowrap">
                        {formatInvoicePaymentLabel(inv)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <details
        open={financialOverviewOpen}
        onToggle={(e) => setFinancialOverviewOpen(e.currentTarget.open)}
        className="group rounded-2xl border border-slate-200/90 bg-slate-50/50 open:bg-white shadow-sm open:shadow-md ring-1 ring-slate-900/[0.04] transition-shadow"
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200/80 text-slate-600 ring-1 ring-slate-300/50 transition-colors group-open:bg-emerald-50 group-open:text-emerald-700 group-open:ring-emerald-200/70">
            <EyeOff className="h-5 w-5 group-open:hidden" strokeWidth={2} aria-hidden />
            <Eye className="hidden h-5 w-5 group-open:block" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">Financial overview</p>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-slate-200/80 px-4 pb-6 pt-2 sm:px-5 space-y-8">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-amber-50/25 to-white shadow-lg shadow-slate-300/25 ring-1 ring-slate-900/[0.04]">
            <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-28 -left-16 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden />
            <div className="relative px-5 py-5 md:px-6 md:py-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 shadow-inner shadow-amber-900/5 ring-1 ring-amber-200/60">
                    <TrendingUp className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Collected today</p>
                    <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight text-slate-900 md:text-[2.35rem] md:leading-none">
                      {formatINR(collectedTodayAmount)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-6 lg:justify-end">
                  <div className="rounded-xl border border-slate-100/90 bg-white/60 px-4 py-3 backdrop-blur-sm sm:text-right">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Expenses</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-800">{formatINR(sheetExpenses)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100/80 bg-emerald-50/50 px-4 py-3 backdrop-blur-sm sm:text-right">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-700/80">Net</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-800">{formatINR(sheetNet)}</p>
                  </div>
                </div>
              </div>
              {dailySheet && (
                <div className="relative border-t border-slate-200/60 bg-white/50 -mx-5 md:-mx-6 mt-2 px-5 py-5 md:px-6 space-y-4">
                  {dailySheetRows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <th className="py-3 px-4">Item name</th>
                            <th className="py-3 px-4 text-right">Item count</th>
                            <th className="py-3 px-4 text-right">Received</th>
                            <th className="py-3 px-4 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailySheetRows.map((row) => {
                            const neg = Number(row.total) < 0;
                            const amtCls = neg ? 'text-rose-700' : 'text-slate-900';
                            return (
                              <tr key={row.key} className="border-b border-slate-100 last:border-0">
                                <td className="py-2.5 px-4 text-slate-800">{row.label}</td>
                                <td className="py-2.5 px-4 text-right tabular-nums text-slate-600">
                                  {formatSheetItemCount(row.itemCount)}
                                </td>
                                <td className={`py-2.5 px-4 text-right tabular-nums font-medium ${amtCls}`}>
                                  {formatINR(row.received)}
                                </td>
                                <td className={`py-2.5 px-4 text-right tabular-nums font-medium ${amtCls}`}>
                                  {formatINR(row.total)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {sheetFooterDisplay && (
                    <div className="flex flex-wrap gap-2 sm:gap-3 pt-1 border-t border-slate-200/70">
                      {[
                        { label: 'UPI', value: sheetFooterDisplay.upi },
                        { label: 'Card', value: sheetFooterDisplay.card },
                        { label: 'Cash', value: sheetFooterDisplay.cash },
                        { label: 'Expenses', value: sheetFooterDisplay.expenses, muted: true },
                        { label: 'Prepaid', value: sheetFooterDisplay.prepaid },
                        {
                          label: 'Total received excluding expenses',
                          value: sheetFooterDisplay.totalReceivedExcludingExpenses,
                          wide: true,
                        },
                        {
                          label: 'Total received',
                          value: sheetFooterDisplay.totalReceived,
                          emphasize: true,
                        },
                      ].map((cell) => (
                        <div
                          key={cell.label}
                          className={`min-w-[7.5rem] flex-1 rounded-lg border px-3 py-2.5 sm:min-w-0 ${
                            cell.emphasize
                              ? 'border-slate-800 bg-slate-900 text-white shadow-sm'
                              : cell.muted
                                ? 'border-slate-200/90 bg-rose-50/40 text-slate-800'
                                : 'border-slate-200/80 bg-white text-slate-800'
                          } ${cell.wide ? 'min-w-[12rem] sm:flex-[1.25]' : ''}`}
                        >
                          <p
                            className={`text-[0.65rem] font-semibold uppercase tracking-wide ${
                              cell.emphasize ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {cell.label}
                          </p>
                          <p
                            className={`mt-1 text-sm font-semibold tabular-nums ${
                              cell.emphasize ? 'text-white' : ''
                            }`}
                          >
                            {formatINR(cell.value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            <StatCard
              icon={PiggyBank}
              label="7-day net"
              value={formatINR(last7Net)}
              accent="text-emerald-600"
              iconBg="bg-emerald-100 text-emerald-700"
            />
            <StatCard
              icon={MinusCircle}
              label="7-day expenses"
              value={formatINR(last7Expenses)}
              accent="text-rose-700"
              iconBg="bg-rose-100 text-rose-700"
            />
            <StatCard
              icon={BarChart3}
              label="This month (paid)"
              value={formatINR(monthRevenue)}
              accent="text-violet-700"
              iconBg="bg-violet-100 text-violet-700"
            />
            <Link
              to="/clients"
              className="group flex h-full flex-col rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-sm shadow-slate-200/40 ring-1 ring-slate-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:border-amber-200/90 hover:shadow-md hover:shadow-amber-900/5 md:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-slate-600">Client insights</span>
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 p-1.5 text-amber-600 ring-1 ring-amber-100/80 shadow-sm">
                  <Users className={`h-5 w-5 ${customerCount != null ? '' : 'text-amber-300'}`} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{customerCount ?? '–'}</p>
              <p className="mt-auto pt-3 flex items-center gap-1 text-xs font-medium text-amber-600">
                Open
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </p>
            </Link>
            <Link
              to="/memberships"
              className="group flex h-full flex-col rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-sm shadow-slate-200/40 ring-1 ring-slate-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:border-pink-200/90 hover:shadow-md hover:shadow-pink-900/5 md:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-slate-600">Memberships</span>
                <div className="rounded-xl bg-gradient-to-br from-pink-50 to-pink-100/40 p-1.5 text-pink-600 ring-1 ring-pink-100/80 shadow-sm">
                  <Gift className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{activeWithBalance.length}</p>
              <p className="mt-auto pt-3 text-xs tabular-nums text-slate-500">
                ₹{membershipCreditOut.toLocaleString('en-IN')} outstanding
              </p>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-slate-100/90 p-5 md:p-6 shadow-md shadow-slate-200/45 ring-1 ring-slate-900/[0.04]">
              <div className="flex items-start justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100/80">
                      <Scissors className="w-5 h-5" strokeWidth={2} />
                    </span>
                    Top services
                  </h3>
                </div>
                <Link
                  to="/reports/sales#reports-top-services"
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 shrink-0 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  Reports →
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
            <div className="bg-white rounded-2xl border border-slate-100/90 p-5 md:p-6 shadow-md shadow-slate-200/45 ring-1 ring-slate-900/[0.04]">
              <div className="flex items-start justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100/80">
                      <Package className="w-5 h-5" strokeWidth={2} />
                    </span>
                    Top products
                  </h3>
                </div>
                <Link
                  to="/reports/sales#reports-top-products"
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 shrink-0 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  Reports →
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

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100/90 p-5 md:p-6 shadow-md shadow-slate-200/45 ring-1 ring-slate-900/[0.04]">
              <div className="mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Revenue vs expenses</h3>
                <p className="text-xs text-slate-500 mt-1">Last 14 days · IST</p>
              </div>
              <div className="h-72 w-full min-h-[288px]">
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
            <div className="bg-white rounded-2xl border border-slate-100/90 p-5 md:p-6 shadow-md shadow-slate-200/45 ring-1 ring-slate-900/[0.04]">
              <div className="mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Payment mix</h3>
                <p className="text-xs text-slate-500 mt-1">Last 7 days</p>
              </div>
              <div className="h-72 w-full min-h-[288px]">
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

          <div className="bg-white rounded-2xl border border-slate-100/90 p-5 md:p-6 shadow-md shadow-slate-200/45 ring-1 ring-slate-900/[0.04]">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Pending vs paid</h3>
              <Link to="/invoices" className="text-sm font-medium text-amber-600 hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors">
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50/80 border border-amber-100/80 p-4 ring-1 ring-amber-100/50">
                <div className="flex items-center gap-2 text-amber-900 text-sm font-semibold">
                  <FileText className="w-4 h-4" />
                  Pending
                </div>
                <p className="text-xl font-bold text-slate-900 mt-2 tabular-nums tracking-tight">{formatINR(pendingAmt)}</p>
                <p className="text-xs text-amber-800/75 mt-1">{pending.length} invoice(s)</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50/80 border border-emerald-100/80 p-4 ring-1 ring-emerald-100/50">
                <div className="flex items-center gap-2 text-emerald-900 text-sm font-semibold">
                  <DollarSign className="w-4 h-4" />
                  Paid (total)
                </div>
                <p className="text-xl font-bold text-slate-900 mt-2 tabular-nums tracking-tight">{formatINR(paidAmt)}</p>
                <p className="text-xs text-emerald-800/75 mt-1">{paid.length} invoice(s)</p>
              </div>
            </div>
            {pending.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap gap-2">
                  {pending.slice(0, 6).map((inv) => (
                    <Link
                      key={inv.id}
                      to={`/invoices/${inv.id}`}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-900 ring-1 ring-amber-200/60 hover:bg-amber-100 font-medium transition-colors"
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
      </details>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent, iconBg }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 p-4 shadow-sm shadow-slate-200/35 ring-1 ring-slate-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-md md:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug text-slate-600">{label}</span>
        <div className={`shrink-0 rounded-xl p-1.5 shadow-inner ring-1 ring-slate-900/10 ${iconBg}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>
      <p className={`mt-3 text-xl font-bold tabular-nums tracking-tight md:text-2xl ${accent || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="mt-1.5 text-xs leading-snug text-slate-500">{sub}</p>}
    </div>
  );
}

function formatDayLabel(dateVal) {
  const ymd = appointmentDateToYmd(dateVal);
  if (!ymd) return String(dateVal).slice(0, 10);
  return formatDateIST(`${ymd}T12:00:00+05:30`, { weekday: 'short', day: 'numeric', month: 'short' });
}

