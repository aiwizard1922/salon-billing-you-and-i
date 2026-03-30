import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { amountInWords } from '../utils/amountInWords';
import { formatINR } from '../utils/formatCurrency';
import { formatDateIST } from '../utils/ist';

const API = '/api';
const HSN_SAC = '998316'; // Beauty treatment services (Indian GST)

function tenderMethodLabel(m) {
  const s = String(m || '').toLowerCase();
  if (s === 'upi') return 'UPI';
  if (s === 'card') return 'Card';
  return 'Cash';
}

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state || {};
  const whatsappFromCreate = (navState.whatsappSent !== undefined || navState.whatsappError) ? navState : null;
  const customerMatchNotice = navState.customerMatchNotice || null;
  const [invoice, setInvoice] = useState(null);
  const [shop, setShop] = useState(null);
  const [activeMembership, setActiveMembership] = useState(null);
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [secondaryPaymentMethod, setSecondaryPaymentMethod] = useState('cash');
  const [splitTender, setSplitTender] = useState(false);
  const [splitPrimaryAmount, setSplitPrimaryAmount] = useState('');
  const [splitSecondaryAmount, setSplitSecondaryAmount] = useState('');

  useEffect(() => {
    fetch(`${API}/invoices/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setInvoice(d.data);
          if (d.data.status === 'pending' && d.data.customer_id) {
            fetch(`${API}/membership/for-customer?customerId=${d.data.customer_id}`)
              .then((r2) => r2.json())
              .then((d2) => setActiveMembership(d2.data || null));
          } else {
            setActiveMembership(null);
          }
        } else {
          setInvoice({ notFound: true });
        }
      })
      .catch(() => setInvoice({ notFound: true }));
    fetch(`${API}/shop`)
      .then((r) => r.json())
      .then((d) => d.success && setShop(d.data));
  }, [id]);

  useEffect(() => {
    if (invoice?.status === 'pending' && activeMembership) {
      const bal = (Number(activeMembership.remaining_balance) ?? Number(activeMembership.initial_balance)) ||
        ((activeMembership.usage_count ?? 0) === 0 ? (Number(activeMembership.plan_price) || Number(activeMembership.special_price) || 0) : 0);
      if (bal > 0) setPaymentMethod('membership');
    }
  }, [invoice, activeMembership]);

  const membershipId = activeMembership?.id;

  const markPaid = () => {
    if (!invoice) return;
    setPayError('');
    if (splitTender && paymentMethod !== 'membership') {
      if (paymentMethod === secondaryPaymentMethod) {
        setPayError('Choose two different methods for split payment.');
        return;
      }
      const aPaise = Math.round(Number(splitPrimaryAmount) * 100);
      const bPaise = Math.round(Number(splitSecondaryAmount) * 100);
      if (!Number.isFinite(aPaise) || !Number.isFinite(bPaise) || aPaise <= 0 || bPaise <= 0) {
        setPayError('Enter both amounts (each part must be greater than zero).');
        return;
      }
      const totalPaise = Math.round(Number(invoice.total) * 100);
      if (aPaise + bPaise !== totalPaise) {
        const need = totalPaise / 100;
        const got = (aPaise + bPaise) / 100;
        setPayError(
          `Both parts must total ${formatINR(need, 2)} (bill amount). Yours add up to ${formatINR(got, 2)} — use “Set second amount to remainder” after entering the first part.`,
        );
        return;
      }
    }
    setPaying(true);
    const body = { paymentMethod };
    if (paymentMethod === 'membership' && membershipId) {
      body.membershipId = membershipId;
      if (isSplitPayment) body.secondaryPaymentMethod = secondaryPaymentMethod;
    } else if (splitTender) {
      body.secondaryPaymentMethod = secondaryPaymentMethod;
      body.primaryAmount = Math.round(Number(splitPrimaryAmount) * 100) / 100;
      body.secondaryAmount = Math.round(Number(splitSecondaryAmount) * 100) / 100;
    }
    fetch(`${API}/invoices/${id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setInvoice(d.data);
        else setPayError(d.error || 'Payment failed');
      })
      .finally(() => setPaying(false));
  };

  if (!invoice) return <div className="text-slate-500">Loading...</div>;
  if (invoice.notFound) return (
    <div className="text-center py-12">
      <p className="text-slate-600 mb-4">Invoice not found.</p>
      <button onClick={() => navigate('/invoices')} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">← Back to Invoices</button>
    </div>
  );

  const subtotal = Number(invoice.subtotal);
  const taxAmountTotal = Number(invoice.tax_amount) || 0;
  const hasStoredTaxBreakdown =
    invoice.cgst_percent != null ||
    invoice.sgst_percent != null ||
    invoice.igst_percent != null ||
    invoice.service_tax_percent != null;
  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let serviceTaxRate = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let serviceTaxAmount = 0;
  if (hasStoredTaxBreakdown) {
    cgstRate = Number(invoice.cgst_percent) || 0;
    sgstRate = Number(invoice.sgst_percent) || 0;
    igstRate = Number(invoice.igst_percent) || 0;
    serviceTaxRate = Number(invoice.service_tax_percent) || 0;
    cgstAmount = Math.round((subtotal * cgstRate) / 100 * 100) / 100;
    sgstAmount = Math.round((subtotal * sgstRate) / 100 * 100) / 100;
    igstAmount = Math.round((subtotal * igstRate) / 100 * 100) / 100;
    serviceTaxAmount = Math.round((subtotal * serviceTaxRate) / 100 * 100) / 100;
  } else {
    const taxPercent = Number(invoice.tax_percent) || 5;
    cgstRate = taxPercent / 2;
    sgstRate = taxPercent / 2;
    cgstAmount = taxAmountTotal / 2;
    sgstAmount = taxAmountTotal / 2;
  }
  /** Stored invoice total to the paisa (source of truth for payment & split). */
  const invoiceTotalExact = Math.round(Number(invoice.total) * 100) / 100;
  const totalDisplayDecimals = Math.round(invoiceTotalExact * 100) % 100 === 0 ? 0 : 2;
  const membershipBalance = activeMembership
    ? (Number(activeMembership.remaining_balance) || Number(activeMembership.initial_balance)) ||
      ((activeMembership.usage_count ?? 0) === 0 ? (Number(activeMembership.plan_price) || Number(activeMembership.special_price) || 0) : 0)
    : 0;
  const canPayPartialFromMembership = invoice.status === 'pending' && activeMembership && membershipBalance > 0;
  const splitAmountFromMembership = Math.min(membershipBalance, invoiceTotalExact);
  const splitRemainder = Math.max(0, invoiceTotalExact - membershipBalance);
  const amountFromMembership = paymentMethod === 'membership' ? splitAmountFromMembership : 0;
  const remainderToPay = paymentMethod === 'membership' ? splitRemainder : 0;
  const isSplitPayment = paymentMethod === 'membership' && splitRemainder > 0;

  return (
    <div>
      {whatsappFromCreate && (
        <div className={`mb-4 p-4 rounded-lg no-print ${
          whatsappFromCreate.whatsappSent ? 'bg-green-50 border border-green-200 text-green-800' :
          'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          {whatsappFromCreate.whatsappSent ? (
            <p className="text-sm">Bill sent to customer via WhatsApp.</p>
          ) : (
            <p className="text-sm">
              WhatsApp not sent. {whatsappFromCreate.whatsappError || 'Customer may have no phone, or WhatsApp is not configured.'}
            </p>
          )}
        </div>
      )}
      {customerMatchNotice && (
        <div className="mb-4 p-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 text-sm no-print">
          <p className="font-medium">Customer profile used</p>
          <p className="mt-1">{customerMatchNotice}</p>
        </div>
      )}
      <div className="mb-6 flex gap-2 flex-wrap no-print">
        <button type="button" onClick={() => navigate('/invoices')} className="px-4 py-2 border rounded-lg hover:bg-slate-100">← Back to Invoices</button>
        <button type="button" onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">Print</button>
      </div>
      <div className="bg-white rounded-xl shadow p-8 max-w-3xl print:shadow-none">
        <div className="text-center border-b border-slate-200 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">TAX INVOICE</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">From</p>
            <p className="font-bold text-slate-800 text-sm">{shop?.name || 'Salon'}</p>
            {shop?.address && <p className="text-xs text-slate-600 leading-tight">{shop.address}</p>}
            {(shop?.phone || shop?.email) && (
              <p className="text-xs text-slate-600 mt-0.5">
                {[shop?.phone, shop?.email].filter(Boolean).join(' · ')}
              </p>
            )}
            {(shop?.gstin || shop?.state) && (
              <p className="text-xs text-slate-600 mt-0.5">
                {[shop?.gstin && `GSTIN: ${shop.gstin}`, shop?.state].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="text-right md:text-left">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Bill to</p>
            <p className="font-semibold text-slate-800">{invoice.customer_name}</p>
            {invoice.customer_phone && <p className="text-sm text-slate-600">{invoice.customer_phone}</p>}
            {invoice.customer_email && <p className="text-sm text-slate-600">{invoice.customer_email}</p>}
          </div>
        </div>

        <div className="flex justify-between mb-6 text-sm">
          <div>
            <span className="text-slate-500">Invoice No:</span>
            <span className="font-semibold ml-2">{invoice.invoice_number}</span>
          </div>
          <div>
            <span className="text-slate-500">Date:</span>
            <span className="font-semibold ml-2">{formatDateIST(invoice.invoice_date)}</span>
          </div>
        </div>

        <table className="w-full mb-6 border-collapse">
          <thead>
            <tr className="bg-slate-100 border-y border-slate-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">HSN/SAC</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 min-w-[160px]">Description (Service)</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Qty</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Rate (₹)</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-3 px-4 text-slate-600">{HSN_SAC}</td>
                <td className="py-3 px-4 font-medium text-slate-800">{item.description || item.service_name || item.serviceName || '—'}</td>
                <td className="py-3 px-4 text-center">{item.quantity}</td>
                <td className="py-3 px-4 text-right">{formatINR(item.unit_price)}</td>
                <td className="py-3 px-4 text-right">{formatINR(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-80 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Taxable Value</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            {cgstRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">CGST @ {cgstRate}%</span>
                <span>{formatINR(cgstAmount)}</span>
              </div>
            )}
            {sgstRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">SGST @ {sgstRate}%</span>
                <span>{formatINR(sgstAmount)}</span>
              </div>
            )}
            {igstRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">IGST @ {igstRate}%</span>
                <span>{formatINR(igstAmount)}</span>
              </div>
            )}
            {serviceTaxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Service tax @ {serviceTaxRate}%</span>
                <span>{formatINR(serviceTaxAmount)}</span>
              </div>
            )}
            {(Number(invoice.discount_amount) || 0) > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>
                  {(Number(invoice.discount_percent) || 0) > 0
                    ? `Discount (${Number(invoice.discount_percent)}%)`
                    : `Discount (₹)`}
                </span>
                <span>-{formatINR(Number(invoice.discount_amount) || 0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t-2 border-slate-200">
              <span>Total</span>
              <span>{formatINR(invoiceTotalExact, totalDisplayDecimals)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Amount in words</p>
          <p className="text-sm font-medium text-slate-700">{amountInWords(invoiceTotalExact)}</p>
        </div>

        {invoice.status === 'paid' && (
          <div className="mt-6 p-3 bg-green-50 rounded-lg text-green-800 text-sm">
            Paid on {formatDateIST(invoice.paid_at)}
            {invoice.payment_method && (
              <span>
                {' '}
                {String(invoice.payment_method).toLowerCase().startsWith('membership')
                  ? invoice.amount_from_membership > 0 && invoice.secondary_payment_method
                    ? `(Membership ₹${Number(invoice.amount_from_membership).toFixed(0)} + ${tenderMethodLabel(invoice.secondary_payment_method)} ₹${Number(
                        Number(invoice.total) - Number(invoice.amount_from_membership),
                      ).toFixed(0)})`
                    : `(Membership)`
                  : invoice.payment_split && Object.keys(invoice.payment_split).length >= 2
                    ? `(${Object.keys(invoice.payment_split)
                        .sort()
                        .map((m) => `${tenderMethodLabel(m)} ₹${Number(invoice.payment_split[m]).toFixed(0)}`)
                        .join(' + ')})`
                    : `(${tenderMethodLabel(invoice.payment_method)})`}
              </span>
            )}
          </div>
        )}
      </div>

      {invoice.status === 'pending' && (
        <div className="no-print mt-10 w-full max-w-3xl">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Record payment</p>
            <h3 className="text-base font-semibold text-slate-800 tracking-tight mb-2">Mark as paid</h3>
            <p className="text-sm text-slate-600 mb-6">Record how the customer settled this invoice.</p>
            {activeMembership ? (
              <>
                <p className="text-sm text-slate-700 mb-1">
                  Customer has membership <strong>{activeMembership.customer_phone || `MEM-${activeMembership.id}`}</strong>
                  {' · '}Balance: {formatINR(membershipBalance)}
                  {' · '}Uses: {activeMembership.usage_count ?? 0}
                </p>
                <p className="text-xs text-amber-800 mb-6 leading-relaxed">
                  {membershipBalance >= invoiceTotalExact
                    ? `You can deduct the full ${formatINR(invoiceTotalExact, totalDisplayDecimals)} (including GST) from the membership balance.`
                    : membershipBalance > 0
                    ? `Use ${formatINR(splitAmountFromMembership)} from membership and collect ${formatINR(splitRemainder)} by cash, UPI, or card.`
                    : 'Choose a payment method below, then confirm.'}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500 mb-6">Choose payment method and confirm.</p>
            )}
            {paymentMethod !== 'membership' && (
              <label className="flex items-center gap-2 cursor-pointer mb-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={splitTender}
                  onChange={(e) => {
                    const on = e.target.checked;
                    if (on) {
                      setPaymentMethod('cash');
                      setSecondaryPaymentMethod('upi');
                      setSplitPrimaryAmount('');
                      setSplitSecondaryAmount('');
                    }
                    setSplitTender(on);
                    setPayError('');
                  }}
                  className="rounded border-slate-300"
                />
                Split payment (e.g. part cash, part UPI)
              </label>
            )}

            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:flex-wrap">
              {splitTender && paymentMethod !== 'membership' ? (
                <div className="w-full space-y-4">
                  <p className="text-xs text-slate-600">
                    Both amounts must add up to the bill total <strong>{formatINR(invoiceTotalExact, totalDisplayDecimals)}</strong> (same as above).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">First payment</span>
                      <select
                        value={paymentMethod}
                        onChange={(e) => { setPaymentMethod(e.target.value); setPayError(''); }}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 shadow-sm text-sm"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Amount ₹"
                        value={splitPrimaryAmount}
                        onChange={(e) => setSplitPrimaryAmount(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">Second payment</span>
                      <select
                        value={secondaryPaymentMethod}
                        onChange={(e) => { setSecondaryPaymentMethod(e.target.value); setPayError(''); }}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white shadow-sm text-sm"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Amount ₹"
                        value={splitSecondaryAmount}
                        onChange={(e) => setSplitSecondaryAmount(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-amber-700 hover:underline"
                    onClick={() => {
                      const aPaise = Math.round(Number(splitPrimaryAmount) * 100);
                      if (!Number.isFinite(aPaise) || aPaise <= 0) return;
                      const totalPaise = Math.round(Number(invoice.total) * 100);
                      const restPaise = totalPaise - aPaise;
                      if (restPaise >= 0) setSplitSecondaryAmount(String(restPaise / 100));
                    }}
                  >
                    Set second amount to remainder after first
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Payment method</span>
                    <select
                      value={paymentMethod}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPaymentMethod(v);
                        if (v === 'membership') setSplitTender(false);
                        setPayError('');
                      }}
                      className="min-w-[260px] w-full sm:w-auto px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 shadow-sm text-sm"
                    >
                      {activeMembership && canPayPartialFromMembership && (
                        <option value="membership">
                          Pay from membership ({activeMembership.customer_phone || `MEM-${activeMembership.id}`}) — ₹{membershipBalance.toFixed(0)} available
                        </option>
                      )}
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                    </select>
                  </div>
                  {isSplitPayment && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">Remainder</span>
                      <select
                        value={secondaryPaymentMethod}
                        onChange={(e) => { setSecondaryPaymentMethod(e.target.value); setPayError(''); }}
                        className="min-w-[220px] px-3 py-2.5 border border-slate-300 rounded-lg bg-white shadow-sm text-sm"
                        title="Pay remaining amount by"
                      >
                        <option value="cash">Cash (₹{remainderToPay.toFixed(0)})</option>
                        <option value="upi">UPI (₹{remainderToPay.toFixed(0)})</option>
                        <option value="card">Card (₹{remainderToPay.toFixed(0)})</option>
                      </select>
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={markPaid}
                disabled={
                  paying ||
                  (paymentMethod === 'membership' && !canPayPartialFromMembership) ||
                  (splitTender && paymentMethod !== 'membership' && paymentMethod === secondaryPaymentMethod)
                }
                className="group inline-flex items-center justify-center gap-2.5 w-full sm:w-auto px-7 py-3 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 border border-slate-700/80 shadow-md shadow-slate-900/15 ring-1 ring-white/10 disabled:opacity-45 disabled:shadow-none disabled:hover:bg-slate-800 transition-colors sm:ml-auto"
              >
                <CheckCircle2 className="w-5 h-5 text-amber-400/95 group-hover:text-amber-300 shrink-0" strokeWidth={2.25} aria-hidden />
                {paying ? 'Saving…' : 'Mark paid'}
              </button>
            </div>
            {payError && <p className="mt-4 text-sm text-red-600 font-medium">{payError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
