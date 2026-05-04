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
} from 'recharts';
import { formatINR } from '../../utils/formatCurrency';
import { formatDateIST } from '../../utils/ist';
import { COLORS, CHART_H, CHART_WRAP } from './reportConstants';

/** Services & products — service and retail mix, two columns */
export function ReportsSalesView({ ctx }) {
  const {
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
  } = ctx;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Services and products</h2>
        <p className="text-sm text-slate-600 mt-1">
          Service and product revenue for the period you select.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-slate-800 tabular-nums">
          {perfRange.from && perfRange.to ? (
            <>
              {perfRange.from} to {perfRange.to}
            </>
          ) : (
            <span className="text-slate-500 font-normal">—</span>
          )}
        </p>
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
        <div className="text-slate-500 py-16 text-center rounded-xl border border-slate-200 bg-white text-sm">
          Loading performance…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div id="reports-top-services" className="space-y-6 scroll-mt-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 border-l-4 border-l-amber-500">
                <h3 className="text-base font-semibold text-slate-900">Complete service sales</h3>
                <p className="text-2xl font-bold text-slate-900 mt-3 tabular-nums">
                  {formatINR(perfData?.revenueTotals?.serviceRevenue ?? 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-base font-semibold text-slate-900 mb-1">Top services</h3>
                <p className="text-sm text-slate-500 mb-4">By revenue (top 10 for this period).</p>
                {topServicesBar.length === 0 ? (
                  <p className="text-slate-500 text-sm py-10 text-center">No data.</p>
                ) : (
                  <div className={`${CHART_WRAP} ${CHART_H} w-full`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topServicesBar}
                        layout="vertical"
                        margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} strokeOpacity={0.6} />
                        <XAxis type="number" tickFormatter={(v) => formatINR(v, v >= 1000 ? 0 : 2)} fontSize={11} stroke="#94a3b8" tickLine={false} />
                        <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} stroke="#94a3b8" interval={0} tickLine={false} />
                        <Tooltip
                          content={({ active, payload: pl }) => {
                            if (!active || !pl?.[0]) return null;
                            const row = pl[0].payload;
                            return (
                              <div className="rounded-lg border bg-white px-3 py-2 shadow text-sm tabular-nums">
                                <p className="font-semibold">{row.fullName}</p>
                                <p className="text-slate-600">
                                  Times: <span className="font-medium">{formatCount(row.qty)}</span>
                                </p>
                                <p className="font-medium text-slate-900">{formatINR(row.revenue)}</p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22}>
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
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 border-l-4 border-l-violet-500">
                <h3 className="text-base font-semibold text-slate-900">Complete product sales</h3>
                <p className="text-2xl font-bold text-slate-900 mt-3 tabular-nums">
                  {formatINR(perfData?.revenueTotals?.productRevenue ?? 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-base font-semibold text-slate-900 mb-1">Top products</h3>
                <p className="text-sm text-slate-500 mb-4">By revenue (top 10).</p>
                {topProductsBar.length === 0 ? (
                  <p className="text-slate-500 text-sm py-10 text-center">No retail products in this period.</p>
                ) : (
                  <div className={`${CHART_WRAP} ${CHART_H} w-full`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topProductsBar}
                        layout="vertical"
                        margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} strokeOpacity={0.6} />
                        <XAxis type="number" tickFormatter={(v) => formatINR(v, v >= 1000 ? 0 : 2)} fontSize={11} stroke="#94a3b8" tickLine={false} />
                        <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} stroke="#94a3b8" interval={0} tickLine={false} />
                        <Tooltip
                          content={({ active, payload: pl }) => {
                            if (!active || !pl?.[0]) return null;
                            const row = pl[0].payload;
                            return (
                              <div className="rounded-lg border bg-white px-3 py-2 shadow text-sm tabular-nums">
                                <p className="font-semibold">{row.fullName}</p>
                                <p className="text-slate-600">
                                  Times: <span className="font-medium">{formatCount(row.qty)}</span>
                                </p>
                                <p className="font-medium text-slate-900">{formatINR(row.revenue)}</p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22}>
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
            <p className="text-sm text-slate-600 text-center -mt-2">
              Membership:{' '}
              <strong className="text-slate-800 tabular-nums">{formatINR(perfData?.revenueTotals?.membershipRevenue)}</strong>
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function ReportsDailyView({ ctx }) {
  const {
    dailyReports,
    dailyReportDays,
    setDailyReportDays,
    thisMonth,
    monthTotal,
    dailyByMethod,
    daily,
    formatDate,
    formatRupee,
    istMonthStr,
  } = ctx;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Daily sales &amp; payments</h2>
        <p className="text-sm text-slate-600 mt-1">
          End-of-day totals, payment mix, and revenue by day (IST).
        </p>
      </header>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-base font-semibold text-slate-900">End of day</h3>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Show</span>
            <select
              value={dailyReportDays}
              onChange={(e) => setDailyReportDays(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
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
          <p className="text-slate-500 py-8 text-center text-sm">No data for this period.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-700">Date</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-700">Cash</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-700">UPI</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-700">Card</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-700">Member</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-700">Revenue</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-700">Expenses</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-700">Net</th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.map((row) => (
                  <tr key={row.date} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="py-2 px-3 font-medium text-slate-800">{formatDate(row.date)}</td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: COLORS.cash }}>{formatINR(row.cash)}</td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: COLORS.upi }}>{formatINR(row.upi)}</td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: COLORS.card }}>{formatINR(row.card)}</td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: COLORS.membership }}>{formatINR(row.membership)}</td>
                    <td className="py-2 px-3 text-right font-medium tabular-nums">{formatINR(row.revenue)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-red-600">{formatINR(row.expenses)}</td>
                    <td className="py-2 px-3 text-right font-medium tabular-nums" style={{ color: row.net >= 0 ? '#059669' : '#dc2626' }}>{formatINR(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {thisMonth && monthTotal > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">This month total</p>
            <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{formatINR(monthTotal)}</p>
            <p className="text-xs text-slate-500 mt-1">{istMonthStr()}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cash</p>
            <p className="text-xl font-bold mt-1 tabular-nums" style={{ color: COLORS.cash }}>{formatINR(thisMonth.cash)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">UPI</p>
            <p className="text-xl font-bold mt-1 tabular-nums" style={{ color: COLORS.upi }}>{formatINR(thisMonth.upi)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Card</p>
            <p className="text-xl font-bold mt-1 tabular-nums" style={{ color: COLORS.card }}>{formatINR(thisMonth.card)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Daily sales by payment method (last 30 days)</h3>
        {dailyByMethod.length === 0 ? (
          <p className="text-slate-500 py-8 text-center text-sm">No paid invoices in this period.</p>
        ) : (
          <div className={`${CHART_WRAP} ${CHART_H} w-full`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyByMethod} margin={{ top: 8, right: 12, left: -4, bottom: 4 }} barCategoryGap="12%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} strokeOpacity={0.7} />
                <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} tickLine={false} stroke="#94a3b8" interval="preserveStartEnd" />
                <YAxis tickFormatter={formatRupee} fontSize={11} width={56} tickLine={false} stroke="#94a3b8" />
                <Tooltip formatter={(v) => [formatINR(v), '']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                <Bar dataKey="cash" stackId="a" fill={COLORS.cash} name="Cash" radius={[2, 2, 0, 0]} maxBarSize={36} />
                <Bar dataKey="upi" stackId="a" fill={COLORS.upi} name="UPI" radius={[0, 0, 0, 0]} maxBarSize={36} />
                <Bar dataKey="card" stackId="a" fill={COLORS.card} name="Card" radius={[0, 0, 2, 2]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Last 7 days (by method)</h3>
        {dailyByMethod.length === 0 ? (
          <p className="text-slate-500 py-4 text-center text-sm">No paid invoices in this period.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-700">Date</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-700">Cash</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-700">UPI</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-700">Card</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {dailyByMethod.slice(-7).reverse().map((row) => (
                  <tr key={row.date} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="py-2 px-3 text-slate-800">{formatDate(row.date)}</td>
                    <td className="py-2 px-3 text-right font-medium tabular-nums" style={{ color: COLORS.cash }}>{formatINR(row.cash)}</td>
                    <td className="py-2 px-3 text-right font-medium tabular-nums" style={{ color: COLORS.upi }}>{formatINR(row.upi)}</td>
                    <td className="py-2 px-3 text-right font-medium tabular-nums" style={{ color: COLORS.card }}>{formatINR(row.card)}</td>
                    <td className="py-2 px-3 text-right font-medium tabular-nums">{formatINR(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Daily revenue total (last 30 days)</h3>
        {daily.length === 0 ? (
          <p className="text-slate-500 py-8 text-center text-sm">No paid invoices in this period.</p>
        ) : (
          <div className={`${CHART_WRAP} ${CHART_H} w-full`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 8, right: 12, left: -4, bottom: 4 }} barCategoryGap="14%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} strokeOpacity={0.7} />
                <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} tickLine={false} stroke="#94a3b8" interval="preserveStartEnd" />
                <YAxis tickFormatter={formatRupee} fontSize={11} width={56} tickLine={false} stroke="#94a3b8" />
                <Tooltip
                  formatter={(v) => [formatINR(v), 'Revenue']}
                  labelFormatter={formatDate}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="revenue" fill={COLORS.revenue} name="Revenue" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReportsStaffView({ ctx }) {
  const {
    perfLoading,
    perfData,
    staffPerfChart,
    staffCalMonth,
    setStaffCalMonth,
    staffCalLoading,
    staffCalGridCells,
    staffCalTotalsByYmd,
    staffCalSelectedYmd,
    setStaffCalSelectedYmd,
    staffCalSelectedRows,
    perfPreset,
    setPerfPreset,
    perfMonth,
    setPerfMonth,
    perfRange,
    formatCount,
  } = ctx;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Staff reports</h2>
        <p className="text-sm text-slate-600 mt-1">
          Performance for the same period as <span className="font-medium text-slate-800">Services and products</span> (use the controls below).
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">Sales period</span>
          <span className="text-slate-500"> — same period as Services and products</span>
        </p>
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
      <p className="text-sm text-slate-700 tabular-nums -mt-2">
        {perfRange.from && perfRange.to ? `${perfRange.from} to ${perfRange.to}` : '—'}
      </p>

      {perfLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-500">
          Loading staff reports…
        </div>
      ) : !perfData ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-500">
          Could not load staff performance for this period.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-base font-semibold text-slate-900">Staff performance</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Bar length = Total (service + product ₹ only). Ties: higher membership sale count. Calendar day cells use the
                same Total (no membership ₹ in the number).
              </p>
              {staffPerfChart.length === 0 ? (
                <p className="text-slate-500 text-sm py-10 text-center">
                  No attributed service, product, or membership lines for staff in this period.
                </p>
              ) : (
                <div className={`${CHART_WRAP} ${CHART_H} w-full`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={staffPerfChart} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} strokeOpacity={0.6} />
                      <XAxis type="number" tickFormatter={(v) => formatINR(v, v >= 1000 ? 0 : 2)} fontSize={11} stroke="#94a3b8" tickLine={false} />
                      <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11 }} stroke="#94a3b8" tickLine={false} />
                      <Tooltip
                        content={({ active, payload: pl }) => {
                          if (!active || !pl?.[0]) return null;
                          const row = pl[0].payload;
                          return (
                            <div className="rounded-lg border bg-white px-3 py-2 shadow text-sm max-w-xs">
                              <p className="font-semibold">{row.fullName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Bar = Total (service + product)</p>
                              <p>Services: {formatINR(row.services)}</p>
                              <p>Products: {formatINR(row.products)}</p>
                              {(row.membershipLineCount || 0) > 0 && (
                                <p className="text-slate-600">
                                  Membership lines (tiebreak): {formatCount(row.membershipLineCount)}
                                </p>
                              )}
                              {row.membership > 0 && <p>Membership ₹: {formatINR(row.membership)}</p>}
                              <p className="font-medium border-t border-slate-100 pt-1.5 mt-1.5">
                                Total: {formatINR(row.total)}
                              </p>
                              {row.totalAll > row.total && (
                                <p className="text-xs text-slate-500">
                                  Including membership: {formatINR(row.totalAll)}
                                </p>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="total" fill="#334155" name="Total" radius={[0, 4, 4, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-amber-50 via-white to-slate-50 rounded-xl shadow-sm border border-amber-200/60 p-5 flex flex-col min-h-[220px]">
              <h3 className="text-base font-semibold text-slate-900">Staff recognitions</h3>
              {(() => {
                const tp = perfData?.topPerformer;
                const rankTotal =
                  tp != null
                    ? Number(tp.rankingTotal) ||
                      (Number(tp.serviceSales) || 0) + (Number(tp.productSales) || 0)
                    : 0;
                return (
                  <div className="space-y-4 flex-1 flex flex-col mt-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Top performer</h4>
                      {tp ? (
                        <>
                          <p className="text-xl font-bold text-slate-900 mt-2">{tp.staffName}</p>
                          <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{formatINR(rankTotal)}</p>
                          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                            <li>
                              Services: {formatCount(tp.serviceLineCount ?? 0)} sales · {formatINR(tp.serviceSales)}
                            </li>
                            <li>
                              Products: {formatCount(tp.productLineCount ?? 0)} sales · {formatINR(tp.productSales)}
                            </li>
                            <li>
                              Membership: {formatCount(tp.membershipLineCount ?? 0)} sales · {formatINR(tp.membershipSales)}
                            </li>
                          </ul>
                          <p className="text-xs text-slate-500 mt-2">
                            Including membership on attributed lines: {formatINR(tp.totalSales)}
                          </p>
                        </>
                      ) : (
                        <p className="text-slate-500 text-sm mt-2">
                          No attributed service, product, or membership lines for staff in this period.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80">
              <h3 className="text-base font-semibold text-slate-900">Staff sales (period)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th rowSpan={2} className="align-bottom text-left py-3 px-4 font-medium text-slate-700">
                      Staff
                    </th>
                    <th
                      colSpan={2}
                      className="text-center py-2 px-2 font-medium text-slate-700 border-l border-slate-200"
                    >
                      Services
                    </th>
                    <th colSpan={2} className="text-center py-2 px-2 font-medium text-slate-700 border-l border-slate-200">
                      Products
                    </th>
                    <th colSpan={2} className="text-center py-2 px-2 font-medium text-slate-700 border-l border-slate-200">
                      Membership
                    </th>
                    <th
                      rowSpan={2}
                      className="align-bottom text-right py-3 px-4 font-medium text-slate-700 border-l border-slate-200"
                      title="Service + product amount (excludes membership)"
                    >
                      Total
                    </th>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-normal text-slate-600">
                    <th className="text-right py-2 px-2 border-l border-slate-200"># sales</th>
                    <th className="text-right py-2 px-2">Amount</th>
                    <th className="text-right py-2 px-2 border-l border-slate-200"># sales</th>
                    <th className="text-right py-2 px-2">Amount</th>
                    <th className="text-right py-2 px-2 border-l border-slate-200"># sales</th>
                    <th className="text-right py-2 px-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(perfData?.staffSales || [])]
                    .sort((a, b) => {
                      const sa =
                        (Number(a.serviceSales) || 0) + (Number(a.productSales) || 0);
                      const sb =
                        (Number(b.serviceSales) || 0) + (Number(b.productSales) || 0);
                      if (sb !== sa) return sb - sa;
                      return (
                        (Number(b.membershipLineCount) || 0) -
                        (Number(a.membershipLineCount) || 0)
                      );
                    })
                    .map((row) => {
                      const sp =
                        (Number(row.serviceSales) || 0) + (Number(row.productSales) || 0);
                      return (
                        <tr key={row.staffId} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="py-2.5 px-4 font-medium text-slate-800">{row.staffName}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums border-l border-slate-100">
                            {formatCount(row.serviceLineCount ?? 0)}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-amber-900/90">
                            {formatINR(row.serviceSales)}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums border-l border-slate-100">
                            {formatCount(row.productLineCount ?? 0)}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-violet-800">
                            {formatINR(row.productSales)}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums border-l border-slate-100">
                            {formatCount(row.membershipLineCount ?? 0)}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-slate-700">
                            {formatINR(row.membershipSales)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold tabular-nums border-l border-slate-100">
                            {formatINR(sp)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div id="reports-daily-staff" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden scroll-mt-6">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-base font-semibold text-slate-900">Daily staff sales (calendar)</h3>
              <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span className="font-medium">Month</span>
                <input
                  type="month"
                  value={staffCalMonth}
                  onChange={(e) => e.target.value && setStaffCalMonth(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white min-w-[11rem]"
                />
              </label>
            </div>

            {staffCalLoading ? (
              <div className="p-8 animate-pulse space-y-4">
                <div className="h-48 bg-slate-100 rounded-xl" />
                <div className="h-24 bg-slate-100 rounded-xl" />
              </div>
            ) : (
              <div className="p-4 sm:p-5 space-y-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4">
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center text-[0.7rem] sm:text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                      <div key={d} className="py-1">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                    {staffCalGridCells.map((cell, idx) =>
                      cell.kind === 'pad' ? (
                        <div key={`pad-${idx}`} className="min-h-[4.25rem] sm:min-h-[5rem]" />
                      ) : (
                        <button
                          key={cell.ymd}
                          type="button"
                          onClick={() => setStaffCalSelectedYmd(cell.ymd)}
                          className={`min-h-[4.25rem] sm:min-h-[5rem] rounded-lg border p-1.5 sm:p-2 text-left transition flex flex-col justify-between ${
                            staffCalSelectedYmd === cell.ymd
                              ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400/40 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/30'
                          }`}
                        >
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">{cell.day}</span>
                          <span className="text-[0.7rem] sm:text-xs font-medium tabular-nums text-slate-600 truncate leading-tight">
                            {(staffCalTotalsByYmd.get(cell.ymd) || 0) > 0
                              ? formatINR(staffCalTotalsByYmd.get(cell.ymd), 0)
                              : '—'}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-amber-50/50 border-b border-amber-100/80">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDateIST(staffCalSelectedYmd, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{staffCalSelectedYmd}</p>
                  </div>
                  {staffCalSelectedRows.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-500">No staff-attributed line sales for this day.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[820px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-white">
                            <th rowSpan={2} className="align-bottom text-left py-2.5 px-4 font-medium text-slate-700">
                              Staff
                            </th>
                            <th
                              colSpan={2}
                              className="text-center py-2 px-2 font-medium text-slate-700 border-l border-slate-200"
                            >
                              Services
                            </th>
                            <th
                              colSpan={2}
                              className="text-center py-2 px-2 font-medium text-slate-700 border-l border-slate-200"
                            >
                              Products
                            </th>
                            <th
                              colSpan={2}
                              className="text-center py-2 px-2 font-medium text-slate-700 border-l border-slate-200"
                            >
                              Membership
                            </th>
                            <th
                              rowSpan={2}
                              className="align-bottom text-right py-2.5 px-4 font-medium text-slate-700 border-l border-slate-200"
                              title="Service + product amount (excludes membership)"
                            >
                              Total
                            </th>
                          </tr>
                          <tr className="border-b border-slate-200 bg-white text-xs font-normal text-slate-600">
                            <th className="text-right py-2 px-2 border-l border-slate-200"># sales</th>
                            <th className="text-right py-2 px-2">Amount</th>
                            <th className="text-right py-2 px-2 border-l border-slate-200"># sales</th>
                            <th className="text-right py-2 px-2">Amount</th>
                            <th className="text-right py-2 px-2 border-l border-slate-200"># sales</th>
                            <th className="text-right py-2 px-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffCalSelectedRows.map((row, idx) => {
                            const sp =
                              (Number(row.serviceSales) || 0) + (Number(row.productSales) || 0);
                            return (
                              <tr
                                key={`${staffCalSelectedYmd}-${row.staffId ?? 'u'}-${row.staffName}-${idx}`}
                                className="border-b border-slate-100 hover:bg-slate-50/80"
                              >
                                <td className="py-2.5 px-4 font-medium text-slate-800">
                                  {row.staffName}
                                  {row.staffName === 'Unassigned' && (
                                    <span className="ml-1.5 text-xs font-normal text-amber-700">(no staff on line)</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-2 text-right tabular-nums border-l border-slate-100">
                                  {formatCount(row.serviceLineCount ?? 0)}
                                </td>
                                <td className="py-2.5 px-2 text-right tabular-nums text-amber-900/90">
                                  {formatINR(row.serviceSales)}
                                </td>
                                <td className="py-2.5 px-2 text-right tabular-nums border-l border-slate-100">
                                  {formatCount(row.productLineCount ?? 0)}
                                </td>
                                <td className="py-2.5 px-2 text-right tabular-nums text-violet-800">
                                  {formatINR(row.productSales)}
                                </td>
                                <td className="py-2.5 px-2 text-right tabular-nums border-l border-slate-100">
                                  {formatCount(row.membershipLineCount ?? 0)}
                                </td>
                                <td className="py-2.5 px-2 text-right tabular-nums text-slate-700">
                                  {formatINR(row.membershipSales)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-semibold tabular-nums border-l border-slate-100">
                                  {formatINR(sp)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function ReportsTrendsView({ ctx }) {
  const { formatMonth, formatRupee } = ctx;
  const monthlyByMethod = Array.isArray(ctx.monthlyByMethod) ? ctx.monthlyByMethod : [];
  const monthly = Array.isArray(ctx.monthly) ? ctx.monthly : [];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Monthly trends</h2>
        <p className="text-sm text-slate-600 mt-1">Last 12 months — payment mix and revenue vs estimated profit.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 items-start">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-3">Payment method (12 months)</h3>
          {monthlyByMethod.length === 0 ? (
            <p className="text-slate-500 py-8 text-center text-sm">No paid invoices in this period.</p>
          ) : (
            <div className={`${CHART_WRAP} ${CHART_H} w-full`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyByMethod} margin={{ top: 8, right: 12, left: -4, bottom: 4 }} barCategoryGap="14%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} strokeOpacity={0.7} />
                  <XAxis dataKey="month" tickFormatter={formatMonth} fontSize={11} tickLine={false} stroke="#94a3b8" interval={0} angle={-12} textAnchor="end" height={48} />
                  <YAxis tickFormatter={formatRupee} fontSize={11} width={56} tickLine={false} stroke="#94a3b8" />
                  <Tooltip formatter={(v) => [formatINR(v), '']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                  <Bar dataKey="cash" stackId="a" fill={COLORS.cash} name="Cash" radius={[2, 2, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="upi" stackId="a" fill={COLORS.upi} name="UPI" radius={[0, 0, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="card" stackId="a" fill={COLORS.card} name="Card" radius={[0, 0, 2, 2]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-3">Sales &amp; profit (12 months)</h3>
          {monthly.length === 0 ? (
            <p className="text-slate-500 py-8 text-center text-sm">No paid invoices in this period.</p>
          ) : (
            <div className={`${CHART_WRAP} ${CHART_H} w-full`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 8, right: 12, left: -4, bottom: 4 }} barCategoryGap="14%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} strokeOpacity={0.7} />
                  <XAxis dataKey="month" tickFormatter={formatMonth} fontSize={11} tickLine={false} stroke="#94a3b8" interval={0} angle={-12} textAnchor="end" height={48} />
                  <YAxis tickFormatter={formatRupee} fontSize={11} width={56} tickLine={false} stroke="#94a3b8" />
                  <Tooltip formatter={(v) => [formatINR(v), '']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                  <Bar dataKey="revenue" fill={COLORS.revenue} name="Revenue" radius={[3, 3, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="profit" fill={COLORS.profit} name="Est. Profit" radius={[0, 0, 3, 3]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
