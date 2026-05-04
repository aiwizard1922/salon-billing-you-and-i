import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { formatINR } from '../utils/formatCurrency';
import { formatDateIST, appointmentDateToYmd } from '../utils/ist';
import { formatInvoicePaymentLabel } from '../utils/invoiceListDisplay';

const API = '/api';

const MONTH_LONG = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Lowercase string: invoice #, customer, and many date spellings for search (IST calendar day). */
function invoiceSearchBlob(inv) {
  const parts = [inv.invoice_number || '', inv.customer_name || ''];
  const ymd = appointmentDateToYmd(inv.invoice_date);
  if (!ymd) return parts.join(' ').toLowerCase();
  const [Y, M, D] = ymd.split('-');
  const mi = parseInt(M, 10) - 1;
  const dNum = parseInt(D, 10);
  parts.push(ymd, `${Y}-${M}`, `${D}/${M}/${Y}`, `${D}/${M}/${Y.slice(2)}`);
  parts.push(MONTH_LONG[mi], MONTH_SHORT[mi]);
  parts.push(`${MONTH_LONG[mi]} ${dNum}`, `${dNum} ${MONTH_LONG[mi]}`, `${MONTH_SHORT[mi]} ${dNum}`, `${dNum} ${MONTH_SHORT[mi]}`);
  parts.push(
    `${MONTH_LONG[mi]} ${dNum} ${Y}`,
    `${dNum} ${MONTH_LONG[mi]} ${Y}`,
    `${MONTH_LONG[mi]} ${Y}`,
    `${Y} ${MONTH_LONG[mi]}`
  );
  const ord = dNum % 10 === 1 && dNum !== 11 ? 'st' : dNum % 10 === 2 && dNum !== 12 ? 'nd' : dNum % 10 === 3 && dNum !== 13 ? 'rd' : 'th';
  parts.push(`${dNum}${ord}`, `${dNum}${ord} ${MONTH_LONG[mi]}`, `${MONTH_LONG[mi]} ${dNum}${ord}`);
  parts.push(formatDateIST(`${ymd}T12:00:00+05:30`).toLowerCase());
  return parts.join(' ').toLowerCase();
}

/**
 * If the query is an unambiguous date / month filter, return structured match; else null (use substring on blob).
 */
function matchSearchQuery(inv, raw) {
  const q = raw.trim();
  if (!q) return true;
  const qLower = q.toLowerCase();
  const invYmd = appointmentDateToYmd(inv.invoice_date);
  if (!invYmd) return invoiceSearchBlob(inv).includes(qLower);

  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return invYmd === q;
  if (/^\d{4}-\d{2}$/.test(q)) return invYmd.startsWith(q);
  const slash = q.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const day = String(slash[1]).padStart(2, '0');
    const mo = String(slash[2]).padStart(2, '0');
    const yr = slash[3];
    return invYmd === `${yr}-${mo}-${day}`;
  }

  return invoiceSearchBlob(inv).includes(qLower);
}

export default function Invoices() {
  const location = useLocation();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | pending | paid | membership
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    let url = `${API}/invoices`;
    if (filter === 'membership') url += '?membership=true';
    else if (filter !== 'all') url += `?status=${filter}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => (d.success ? setInvoices(d.data) : setError(d.error || 'Could not load invoices')))
      .catch((e) => setError(e.message || 'Network error'))
      .finally(() => setLoading(false));
  };

  // Reload when filter changes or when you navigate here again (e.g. after Quick Sales).
  useEffect(() => {
    load();
  }, [filter, location.key]);

  const pending = invoices.filter((i) => i.status === 'pending');
  const paid = invoices.filter((i) => i.status === 'paid');
  const membershipInvoices = invoices.filter(
    (i) => (i.payment_method || '').toLowerCase().startsWith('membership') || Number(i.amount_from_membership || 0) > 0
  );
  const filteredByStatus =
    filter === 'all' ? invoices : filter === 'pending' ? pending : filter === 'paid' ? paid : membershipInvoices;
  const searchTrim = (search || '').trim();
  const displayList = searchTrim
    ? filteredByStatus.filter((inv) => matchSearchQuery(inv, searchTrim))
    : filteredByStatus;

  if (loading && invoices.length === 0) return <div className="text-slate-600">Loading...</div>;
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Invoices</h2>
        <Link to="/invoices/new" className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
          <Plus size={18} /> Quick Sales
        </Link>
      </div>
      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">{error}</div>
      )}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'paid', label: 'Paid' },
            { key: 'membership', label: 'Membership' },
          ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg ${filter === key ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
          </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder=""
            aria-label="Search invoices by number, customer, or date"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
          />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {displayList.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p>No invoices match{searchTrim ? ' your search' : ''}.</p>
            {searchTrim ? (
              <button type="button" onClick={() => setSearch('')} className="mt-3 text-sm text-amber-700 hover:underline">
                Clear search
              </button>
            ) : null}
          </div>
        ) : (
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Invoice</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Customer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Staff</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Payment</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((inv) => (
                <tr key={inv.id} className="border-t hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap tabular-nums">{formatDateIST(inv.invoice_date)}</td>
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
                  <td className="py-3 px-4 text-right font-medium">{formatINR(inv.total)}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm whitespace-nowrap">
                    {formatInvoicePaymentLabel(inv)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
