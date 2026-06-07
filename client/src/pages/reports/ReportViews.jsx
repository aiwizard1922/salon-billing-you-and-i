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
    dailyReportMonth,
    setDailyReportMonth,
    dailyReportRange,
    dailyReportLoading,
    dailyReportShowEmpty,
    setDailyReportShowEmpty,
    dailyReportDisplayRows,
    dailyReportTotals,
    formatMonth,
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
          <div>
            <h3 className="text-base font-semibold text-slate-900">End of day</h3>
            {dailyReportRange.from && (
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {formatMonth(dailyReportMonth)} · {dailyReportRange.from} → {dailyReportRange.to}
                {dailyReportMonth === istMonthStr() && (
                  <span className="text-amber-700"> (month to date)</span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-600 font-medium">Month</span>
              <input
                type="month"
                value={dailyReportMonth}
                onChange={(e) => e.target.value && setDailyReportMonth(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[11rem]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={dailyReportShowEmpty}
                onChange={(e) => setDailyReportShowEmpty(e.target.checked)}
                className="rounded border-slate-300"
              />
              Show days with no sales or expenses
            </label>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
            <p className="text-xs text-slate-500">Revenue</p>
            <p className="text-lg font-bold tabular-nums text-slate-900">{formatINR(dailyReportTotals.revenue)}</p>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-2">
            <p className="text-xs text-slate-500">Expenses</p>
            <p className="text-lg font-bold tabular-nums text-red-700">{formatINR(dailyReportTotals.expenses)}</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2">
            <p className="text-xs text-slate-500">Net</p>
            <p className={`text-lg font-bold tabular-nums ${dailyReportTotals.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatINR(dailyReportTotals.net)}
            </p>
          </div>
        </div>

        {dailyReportLoading ? (
          <p className="text-slate-500 py-8 text-center text-sm">Loading daily report…</p>
        ) : dailyReportDisplayRows.length === 0 ? (
          <p className="text-slate-500 py-8 text-center text-sm">No sales or expenses in this period.</p>
        ) : (
          <>
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
                {dailyReportDisplayRows.map((row) => (
                  <tr key={row.date} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">
                      {formatDateIST(row.date, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
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
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-semibold text-slate-900">
                  <td className="py-2.5 px-3">Month total</td>
                  <td colSpan={4} />
                  <td className="py-2.5 px-3 text-right tabular-nums">{formatINR(dailyReportTotals.revenue)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-red-600">{formatINR(dailyReportTotals.expenses)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: dailyReportTotals.net >= 0 ? '#059669' : '#dc2626' }}>
                    {formatINR(dailyReportTotals.net)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              <strong>Revenue</strong> = <strong>cash + UPI + card</strong> collected that day (new money in the drawer).
              <strong> Expenses</strong> = amounts logged on the Expenses page for that calendar date. Month total should match
              Profit &amp; loss and the Expenses page for the same month.
              <strong> Member</strong> = amount settled from membership / wallet on invoices. Staff reports use{' '}
              <strong>line list totals</strong> (full price on each line), so if part of the bill was paid from wallet,
              staff amounts can add up to <em>more</em> than Revenue—that is expected, not a bug.
            </p>
          </>
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

/** Staff performance total = services + products (membership ₹ tracked separately). */
function staffPerformanceTotal(row) {
  return Math.round(((Number(row?.serviceSales) || 0) + (Number(row?.productSales) || 0)) * 100) / 100;
}

export function ReportsStaffView({ ctx }) {
  const {
    staffLoading,
    staffData,
    staffPerfChart,
    staffMonth,
    setStaffMonth,
    staffRange,
    staffCalGridCells,
    staffCalTotalsByYmd,
    staffSelectedYmd,
    setStaffSelectedYmd,
    staffCalSelectedRows,
    formatCount,
    formatMonth,
  } = ctx;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Staff reports</h2>
        <p className="text-sm text-slate-600 mt-1">
          Calendar month view (IST). Amounts are <strong>attributed invoice line totals</strong> (services + products for
          rankings and daily totals). Membership lines show count and ₹ in their column but are not added into{' '}
          <strong>Total</strong>. This is not the same as cash collected when customers pay from wallet—see{' '}
          <strong>Daily sales</strong>.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Month</p>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {staffRange.from && staffRange.to
              ? `${staffRange.from} → ${staffRange.to}`
              : '—'}
            {staffMonth ? ` · ${formatMonth(staffMonth)}` : ''}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="month"
            value={staffMonth}
            onChange={(e) => e.target.value && setStaffMonth(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white min-w-[11rem]"
          />
        </label>
      </div>

      {staffLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-500">
          Loading staff reports…
        </div>
      ) : !staffData ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-500">
          Could not load staff performance for this period.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-base font-semibold text-slate-900">Staff performance</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Bar = services + products for the month. Ties broken by membership line count.
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
                              {row.membership > 0 && <p>Membership ₹ (line amounts): {formatINR(row.membership)}</p>}
                              <p className="font-medium border-t border-slate-100 pt-1.5 mt-1.5">
                                Total (bar): {formatINR(row.total)}
                              </p>
                              {row.totalAll > row.total && (
                                <p className="text-xs text-slate-500">
                                  All lines incl. membership: {formatINR(row.totalAll)} — list totals, not cash collected.
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
                const tp = staffData?.topPerformer;
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
                            All attributed lines (incl. membership rows): {formatINR(tp.totalSales)} —{' '}
                            <span className="text-slate-600">
                              these are <strong>line amounts</strong>, not the same as cash + UPI + card in the daily sheet
                              when customers use wallet.
                            </span>
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
              <h3 className="text-base font-semibold text-slate-900">Staff sales (month)</h3>
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
                      title="Services + products line amounts for the month (membership ₹ excluded)."
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
                  {[...(staffData?.staffSales || [])]
                    .sort((a, b) => {
                      const sa = staffPerformanceTotal(a);
                      const sb = staffPerformanceTotal(b);
                      if (sb !== sa) return sb - sa;
                      return (
                        (Number(b.membershipLineCount) || 0) -
                        (Number(a.membershipLineCount) || 0)
                      );
                    })
                    .map((row) => {
                      const sp = staffPerformanceTotal(row);
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
            <p className="px-5 py-3 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/40">
              <strong>Total</strong> = services + products. Membership <strong># sales</strong> and <strong>Amount</strong>{' '}
              are shown separately. Daily breakdown below uses the same rules for each day in this month.
            </p>
          </div>

          <div id="reports-daily-staff" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden scroll-mt-6">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-slate-50/80">
              <h3 className="text-base font-semibold text-slate-900">Daily breakdown</h3>
              <p className="text-xs text-slate-500 mt-1">Same month as above — tap a day for per-staff detail.</p>
            </div>

            {staffLoading ? (
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
                          onClick={() => setStaffSelectedYmd(cell.ymd)}
                          className={`min-h-[4.25rem] sm:min-h-[5rem] rounded-lg border p-1.5 sm:p-2 text-left transition flex flex-col justify-between ${
                            staffSelectedYmd === cell.ymd
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
                      {formatDateIST(staffSelectedYmd, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{staffSelectedYmd}</p>
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
                      title="Services + products line amounts for this day (membership ₹ excluded). Membership column shows count only for scoring; amount is ₹0 in daily view."
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
                            const sp = staffPerformanceTotal(row);
                            return (
                              <tr
                                key={`${staffSelectedYmd}-${row.staffId ?? 'u'}-${row.staffName}-${idx}`}
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
                                <td className="py-2.5 px-2 text-right tabular-nums text-slate-400">
                                  {(row.membershipLineCount ?? 0) > 0 ? '—' : formatINR(0)}
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

function PlLine({ label, amount, bold, negative, indent }) {
  const n = Number(amount) || 0;
  const color = negative ? 'text-red-600' : bold ? 'text-slate-900' : 'text-slate-700';
  return (
    <div
      className={`flex justify-between gap-4 py-2 border-b border-slate-100 text-sm ${bold ? 'font-semibold' : ''} ${indent ? 'pl-4' : ''}`}
    >
      <span className={color}>{label}</span>
      <span className={`tabular-nums ${color}`}>{formatINR(n)}</span>
    </div>
  );
}

function ProfitMonthlyTooltip({ active, payload, label, formatMonth }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-900 mb-1.5">{formatMonth(label)}</p>
      <p className="text-slate-600">Revenue: <span className="font-medium text-blue-700">{formatINR(row.revenue)}</span></p>
      <p className="text-slate-600">COGS: <span className="font-medium text-red-600">{formatINR(row.cogs)}</span></p>
      <p className="text-slate-600">Expenses: <span className="font-medium text-orange-600">{formatINR(row.expenses)}</span></p>
      <p className="text-slate-800 mt-1 pt-1 border-t border-slate-100">
        Net profit:{' '}
        <span className={`font-semibold ${(row.netProfit ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
          {formatINR(row.netProfit)}
        </span>
      </p>
    </div>
  );
}

export function ReportsProfitView({ ctx }) {
  const {
    profitMonth,
    setProfitMonth,
    profitRange,
    profitLoading,
    profitData,
    profitMonthly,
    formatMonth,
    formatRupee,
    istMonthStr,
  } = ctx;

  const p = profitData;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Profit &amp; loss</h2>
        <p className="text-sm text-slate-600 mt-1">
          Money collected minus product costs and expenses. COGS is optional — set cost prices in Inventory to track product margins.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Month</p>
          {profitRange.from && (
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {formatMonth(profitMonth)} · {profitRange.from} → {profitRange.to}
              {profitMonth === istMonthStr() && (
                <span className="text-amber-700"> (month to date)</span>
              )}
            </p>
          )}
        </div>
        <input
          type="month"
          value={profitMonth}
          onChange={(e) => e.target.value && setProfitMonth(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[11rem]"
        />
      </div>

      {profitLoading ? (
        <p className="text-slate-500 py-12 text-center text-sm">Loading profit report…</p>
      ) : !p ? (
        <p className="text-slate-500 py-12 text-center text-sm">Could not load profit data.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Revenue', value: p.revenue, color: 'text-blue-700' },
              { label: 'COGS', value: p.cogs?.totalCogs, color: 'text-red-600' },
              { label: 'Gross profit', value: p.grossProfit, color: 'text-emerald-700' },
              { label: 'Expenses', value: p.expenses?.total, color: 'text-red-600' },
              {
                label: 'Net profit',
                value: p.netProfit,
                color: (p.netProfit ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                <p className={`text-xl font-bold mt-1 tabular-nums ${color}`}>{formatINR(value)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
              <h3 className="text-base font-semibold text-slate-900 mb-3">P&amp;L statement</h3>
              <PlLine label="Revenue (cash + UPI + card)" amount={p.revenue} bold />
              <p className="text-xs text-slate-500 py-1 pl-0">Sales mix on invoices (informational — may differ when customers pay from membership wallet):</p>
              <PlLine label="Services" amount={p.revenueBreakdown?.services} indent />
              <PlLine label="Products sold" amount={p.revenueBreakdown?.products} indent />
              <PlLine label="Memberships sold" amount={p.revenueBreakdown?.memberships} indent />
              <PlLine label="Cost of goods sold (COGS)" amount={-p.cogs?.totalCogs} negative />
              <PlLine label="Products sold (at cost)" amount={-p.cogs?.productSalesCogs} indent negative />
              <PlLine label="Back-bar consumption" amount={-p.cogs?.consumedCogs} indent negative />
              <PlLine label="Gross profit" amount={p.grossProfit} bold />
              <PlLine label="Operating expenses" amount={-p.expenses?.total} negative />
              <PlLine label="Fixed expenses" amount={-p.expenses?.fixed} indent negative />
              <PlLine label="Daily expenses" amount={-p.expenses?.daily} indent negative />
              <PlLine label="Net profit" amount={p.netProfit} bold />
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
                <h3 className="text-base font-semibold text-slate-900 mb-3">Expense breakdown</h3>
                {(p.expenses?.rows || []).length === 0 ? (
                  <p className="text-slate-500 text-sm py-4 text-center">No expenses in this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="text-left py-2 font-medium">Category</th>
                          <th className="text-left py-2 font-medium">Type</th>
                          <th className="text-right py-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.expenses.rows.map((row) => (
                          <tr key={`${row.type}-${row.category}`} className="border-b border-slate-50">
                            <td className="py-2 text-slate-800">{row.category}</td>
                            <td className="py-2 text-slate-500 capitalize">{row.type}</td>
                            <td className="py-2 text-right tabular-nums text-red-600">{formatINR(row.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-950 leading-relaxed">
                <p className="font-medium mb-1">How this is calculated</p>
                <ul className="list-disc pl-4 space-y-1 text-amber-900/90">
                  <li>
                    <strong>Revenue</strong> = new money collected (cash, UPI, card). Wallet/membership redemptions are not counted.
                  </li>
                  <li>
                    <strong>COGS</strong> (Cost of Goods Sold) = what you paid for products that were sold retail or used in services (from Inventory → cost price). Not required — if cost prices are ₹0, COGS is ₹0 and net profit = revenue − expenses.
                  </li>
                  <li>
                    <strong>Net profit</strong> = revenue − COGS − all expenses logged under Expenses.
                  </li>
                  <li>
                    <strong>Cash surplus</strong> this period (no COGS): {formatINR(p.cashSurplus)} — matches daily “Net” in reports.
                  </li>
                  {(p.cogs?.totalCogs ?? 0) === 0 && (
                    <li>
                      COGS is ₹0 this period — add <strong>cost price</strong> on products in Inventory if you want product margin tracked.
                    </li>
                  )}
                  {p.expenses?.productPayments > 0 && (
                    <li>
                      You logged {formatINR(p.expenses.productPayments)} under “Product payment”. If those are stock purchases,
                      COGS already counts product use — avoid double-counting by tracking purchases in inventory only.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
        <h3 className="text-base font-semibold text-slate-900 mb-1">Monthly revenue vs net profit (12 months)</h3>
        <p className="text-xs text-slate-500 mb-3">Hover a month for COGS and expense breakdown. Net profit = revenue − COGS − expenses.</p>
        {(profitMonthly || []).length === 0 ? (
          <p className="text-slate-500 py-8 text-center text-sm">No data yet.</p>
        ) : (
          <div className={`${CHART_WRAP} ${CHART_H} w-full`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitMonthly} margin={{ top: 8, right: 12, left: -4, bottom: 4 }} barCategoryGap="18%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} strokeOpacity={0.7} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  fontSize={11}
                  tickLine={false}
                  stroke="#94a3b8"
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={48}
                />
                <YAxis tickFormatter={formatRupee} fontSize={11} width={56} tickLine={false} stroke="#94a3b8" />
                <Tooltip content={<ProfitMonthlyTooltip formatMonth={formatMonth} />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                <Bar dataKey="revenue" fill={COLORS.revenue} name="Revenue" radius={[3, 3, 0, 0]} maxBarSize={36} />
                <Bar dataKey="netProfit" name="Net profit" radius={[3, 3, 0, 0]} maxBarSize={36}>
                  {(profitMonthly || []).map((row) => (
                    <Cell
                      key={row.month}
                      fill={(row.netProfit ?? 0) >= 0 ? COLORS.profit : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
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
        <p className="text-sm text-slate-600 mt-1">Last 12 months — payment mix and revenue vs net profit.</p>
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
                  <Bar dataKey="netProfit" fill={COLORS.profit} name="Net profit" radius={[0, 0, 3, 3]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
