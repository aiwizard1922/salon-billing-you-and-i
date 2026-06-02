import { useState, useEffect, useCallback } from 'react';
import { Printer, Lock, Unlock, CheckCircle2, History } from 'lucide-react';
import { formatINR } from '../utils/formatCurrency';
import { useAuth } from '../contexts/AuthContext';

const API = '/api';
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const num = (v) => Number(v) || 0;
const money = (v) => num(v).toFixed(2);

export default function EndOfDay() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayIST());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openingFloat, setOpeningFloat] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [audits, setAudits] = useState([]);
  const [showReopen, setShowReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/eod?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setData(d.data);
        setAudits(d.data.audits || []);
        const c = d.data.close;
        setOpeningFloat(c ? String(num(c.opening_float)) : '');
        setCountedCash(c ? String(num(c.counted_cash)) : '');
        setNotes(c?.notes || '');
        setSavedAt(c?.updated_at || null);
      })
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const footer = data?.sheet?.footer || {};
  const rows = data?.sheet?.rows || [];
  const cash = num(footer.cash);
  const upi = num(footer.upi);
  const card = num(footer.card);
  const totalReceived = num(footer.collectedNewMoney ?? footer.totalReceived);
  const prepaid = num(footer.walletUsed ?? footer.prepaid);
  const expenses = num(footer.expenses);
  const billCount = num(footer.billCount);
  const billAverage = num(footer.billAverage);
  const totalExclExpenses = Math.round((totalReceived - expenses) * 100) / 100;

  const floatN = num(openingFloat);
  const countedN = num(countedCash);
  const expectedCash = Math.round((floatN + cash - expenses) * 100) / 100;
  const variance = Math.round((countedN - expectedCash) * 100) / 100;
  const counted = countedCash !== '';
  const isClosed = !!data?.close;
  const locked = !!data?.close?.locked;

  const save = () => {
    setSaving(true);
    fetch(`${API}/eod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, openingFloat: floatN, countedCash: countedN,
        notes: notes || null, closedBy: user?.username || null,
      }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.success) { setSavedAt(d.data.updated_at); load(); } })
      .finally(() => setSaving(false));
  };

  const reopen = () => {
    if (!reopenReason.trim()) { setReopenError('Please enter a reason.'); return; }
    setReopening(true);
    setReopenError('');
    fetch(`${API}/eod/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, reason: reopenReason.trim(), reopenedBy: user?.username || null }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setShowReopen(false); setReopenReason(''); load(); }
        else setReopenError(d.error || 'Could not reopen.');
      })
      .finally(() => setReopening(false));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6 no-print">
        <h1 className="text-3xl font-bold text-slate-900">End of Day</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={todayIST()}
            onChange={(e) => setDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
          />
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {isClosed && locked && (
        <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex flex-wrap items-center gap-2 no-print">
          <Lock size={16} />
          <span>
            Day closed &amp; locked{data.close.closed_by ? ` by ${data.close.closed_by}` : ''}
            {savedAt ? ` · ${new Date(savedAt).toLocaleString()}` : ''}.
          </span>
          <button onClick={() => { setShowReopen(true); setReopenError(''); }} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-700 font-medium hover:bg-emerald-50">
            <Unlock size={14} /> Reopen to edit
          </button>
        </div>
      )}
      {isClosed && !locked && (
        <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2 no-print">
          <Unlock size={16} /> Reopened for editing — close the day again when you&apos;re done.
        </div>
      )}

      {showReopen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print" onClick={() => setShowReopen(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-1">Reopen {date}?</h3>
            <p className="text-sm text-slate-500 mb-4">This unlocks a closed day. The reason is saved to the audit trail.</p>
            <textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              rows={3}
              placeholder="Reason (e.g. miscounted cash, missed an expense)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-2"
            />
            {reopenError && <p className="text-sm text-red-600 mb-2">{reopenError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReopen(false)} className="px-4 py-2 border rounded-lg text-slate-700">Cancel</button>
              <button onClick={reopen} disabled={reopening} className="px-4 py-2 bg-slate-900 text-white rounded-lg disabled:opacity-50">
                {reopening ? 'Reopening…' : 'Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Title banner */}
          <div className="bg-slate-900 text-white px-8 py-6 flex flex-wrap items-center justify-between gap-6">
            <h2 className="text-2xl font-bold tracking-wide">DAILY SHEET</h2>
            <div className="flex gap-8 text-right">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-slate-400">Total Bills</p>
                <p className="text-2xl font-semibold tabular-nums">{billCount}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-slate-400">Bill Average</p>
                <p className="text-2xl font-semibold tabular-nums">{formatINR(billAverage)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-slate-400">Date</p>
                <p className="text-2xl font-semibold">{date}</p>
              </div>
            </div>
          </div>

          {/* Item details */}
          <div className="px-8 pt-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Item Details</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-600">
                <th className="text-left font-semibold py-3 px-8">Item Name</th>
                <th className="text-center font-semibold py-3 px-4">Item Count</th>
                <th className="text-right font-semibold py-3 px-4">Received</th>
                <th className="text-right font-semibold py-3 px-8">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const val = num(r.total);
                const neg = val < 0;
                return (
                  <tr key={r.key} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="py-3.5 px-8 text-slate-800">{r.label}</td>
                    <td className="py-3.5 px-4 text-center tabular-nums text-slate-600">{r.itemCount}</td>
                    <td className={`py-3.5 px-4 text-right tabular-nums ${neg ? 'text-red-600' : 'text-slate-700'}`}>{money(r.received)}</td>
                    <td className={`py-3.5 px-8 text-right tabular-nums font-medium ${neg ? 'text-red-600' : 'text-slate-800'}`}>{money(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Payment summary band */}
          <div className="border-t-2 border-slate-200 bg-slate-50/70">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Expenses', expenses, true],
                ['Cash', cash, false],
                ['UPI', upi, false],
                ['Card', card, false],
                ['Prepaid / Wallet', prepaid, false],
                ['Excl. expenses', totalExclExpenses, false],
              ].map(([label, value, isExp]) => (
                <div key={label} className="px-4 py-4 border-r border-b border-slate-200 last:border-r-0">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-rose-700/80">{label}</p>
                  <p className={`text-lg font-semibold tabular-nums mt-1 ${isExp ? 'text-red-600' : 'text-slate-800'}`}>
                    {isExp ? '−' : ''}{money(value)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-stretch justify-end">
              <div className="bg-slate-900 text-white px-10 py-5 text-right min-w-[260px]">
                <p className="text-[11px] uppercase tracking-widest text-slate-400">Total Received</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{formatINR(totalReceived)}</p>
              </div>
            </div>
            <p className="px-8 py-3 text-xs text-slate-500">
              Note: Prepaid, wallet & membership-settled amounts are not counted in <strong>Total Received</strong> (only cash + UPI + card is new money).
            </p>
          </div>
        </div>
      )}

      {/* Cash drawer reconciliation */}
      {!loading && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Lock size={18} className="text-slate-500" />
            <h3 className="text-lg font-semibold text-slate-800">Cash Drawer — close the day</h3>
          </div>
          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="block">
                <span className="block text-sm font-medium text-slate-600 mb-1">Opening float (starting cash)</span>
                <input type="number" min={0} step="0.01" disabled={locked} value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} placeholder="e.g. 2000" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 no-print disabled:bg-slate-100 disabled:text-slate-500" />
              </label>
              <div className="flex justify-between text-sm text-slate-600 pt-1"><span>+ Cash collected today</span><span className="tabular-nums">{formatINR(cash)}</span></div>
              <div className="flex justify-between text-sm text-slate-600"><span>− Expenses (paid from drawer)</span><span className="tabular-nums">−{formatINR(expenses)}</span></div>
              <div className="flex justify-between text-base font-semibold text-slate-900 border-t border-slate-200 pt-3">
                <span>Expected cash in drawer</span><span className="tabular-nums">{formatINR(expectedCash)}</span>
              </div>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="block text-sm font-medium text-slate-600 mb-1">Counted cash (actual)</span>
                <input type="number" min={0} step="0.01" disabled={locked} value={countedCash} onChange={(e) => setCountedCash(e.target.value)} placeholder="Count the drawer" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 no-print disabled:bg-slate-100 disabled:text-slate-500" />
              </label>
              {counted && (
                <div className={`flex justify-between items-center text-lg font-bold rounded-xl px-4 py-3 ${variance === 0 ? 'bg-emerald-50 text-emerald-800' : variance > 0 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
                  <span>{variance === 0 ? 'Balanced ✓' : variance > 0 ? 'Over' : 'Short'}</span>
                  <span className="tabular-nums">{variance > 0 ? '+' : ''}{formatINR(variance)}</span>
                </div>
              )}
              <label className="block">
                <span className="block text-sm font-medium text-slate-600 mb-1">Notes</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} disabled={locked} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 no-print disabled:bg-slate-100 disabled:text-slate-500" />
              </label>
              {locked ? (
                <button onClick={() => { setShowReopen(true); setReopenError(''); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 no-print">
                  <Unlock size={16} /> Reopen to edit
                </button>
              ) : (
                <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50 no-print">
                  <Lock size={16} /> {saving ? 'Saving…' : 'Close day'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audit trail */}
      {!loading && audits.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <History size={18} className="text-slate-500" />
            <h3 className="text-lg font-semibold text-slate-800">History — {date}</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="text-left font-semibold py-2.5 px-6">When</th>
                <th className="text-left font-semibold py-2.5 px-4">Action</th>
                <th className="text-left font-semibold py-2.5 px-4">By</th>
                <th className="text-right font-semibold py-2.5 px-4">Counted</th>
                <th className="text-right font-semibold py-2.5 px-4">Expected</th>
                <th className="text-left font-semibold py-2.5 px-6">Reason / notes</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-2.5 px-6 text-slate-500 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.action === 'reopen' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {a.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-700">{a.changed_by || '—'}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{formatINR(num(a.counted_cash))}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{formatINR(num(a.expected_cash))}</td>
                  <td className="py-2.5 px-6 text-slate-600">{a.reason || a.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
