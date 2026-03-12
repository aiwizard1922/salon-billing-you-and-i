import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { amountInWords } from '../utils/amountInWords';
import { formatINR } from '../utils/formatCurrency';
import { formatDateIST } from '../utils/ist';

const API = '/api';
const HSN_SAC = '998316'; // Beauty treatment services (Indian GST)

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const whatsappFromCreate = location.state?.whatsappSent !== undefined ? location.state : null;
  const [invoice, setInvoice] = useState(null);
  const [shop, setShop] = useState(null);
  const [activeMembership, setActiveMembership] = useState(null);
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [secondaryPaymentMethod, setSecondaryPaymentMethod] = useState('cash');

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
    setPayError('');
    setPaying(true);
    const body = { paymentMethod };
    if (paymentMethod === 'membership' && membershipId) {
      body.membershipId = membershipId;
      if (isSplitPayment) body.secondaryPaymentMethod = secondaryPaymentMethod;
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

  const taxPercent = Number(invoice.tax_percent) || 18;
  const cgstRate = taxPercent / 2;
  const sgstRate = taxPercent / 2;
  const cgstAmount = Number(invoice.tax_amount) / 2;
  const sgstAmount = Number(invoice.tax_amount) / 2;
  const subtotal = Number(invoice.subtotal);
  const total = Math.round(Number(invoice.total));
  const membershipBalance = activeMembership
    ? (Number(activeMembership.remaining_balance) || Number(activeMembership.initial_balance)) ||
      ((activeMembership.usage_count ?? 0) === 0 ? (Number(activeMembership.plan_price) || Number(activeMembership.special_price) || 0) : 0)
    : 0;
  const canPayPartialFromMembership = invoice.status === 'pending' && activeMembership && membershipBalance > 0;
  const splitAmountFromMembership = Math.min(membershipBalance, total);
  const splitRemainder = Math.max(0, total - membershipBalance);
  const amountFromMembership = paymentMethod === 'membership' ? splitAmountFromMembership : 0;
  const remainderToPay = paymentMethod === 'membership' ? splitRemainder : 0;
  const isSplitPayment = paymentMethod === 'membership' && splitRemainder > 0;

  return (
    <div>
      {whatsappFromCreate && (
        <div className={`mb-4 p-4 rounded-lg no-print ${whatsappFromCreate.whatsappSent ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
          {whatsappFromCreate.whatsappSent ? (
            <p className="text-sm">Bill sent to customer via WhatsApp.</p>
          ) : (
            <p className="text-sm">
              WhatsApp not sent. {whatsappFromCreate.whatsappError || 'Customer may have no phone, or WhatsApp is not configured.'}
            </p>
          )}
        </div>
      )}
      <div className="mb-6 flex gap-2 no-print">
        <button onClick={() => navigate('/invoices')} className="px-4 py-2 border rounded-lg hover:bg-slate-100">← Back to Invoices</button>
        <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-lg">Print</button>
        {invoice.status === 'pending' && (
          <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-sm font-medium text-slate-700">Mark as Paid</p>
            {activeMembership ? (
              <>
                <p className="text-sm text-slate-600">
                  Customer has membership <strong>{activeMembership.customer_phone || `MEM-${activeMembership.id}`}</strong> · Balance: {formatINR(membershipBalance)} · Uses: {activeMembership.usage_count ?? 0}
                </p>
                <p className="text-xs text-amber-700">
                  {membershipBalance >= total
                    ? `Select Pay from Membership to deduct full ${formatINR(total)} (incl. GST) from balance.`
                    : membershipBalance > 0
                    ? `Use ${formatINR(splitAmountFromMembership)} from membership + pay remaining ${formatINR(splitRemainder)} by Cash/UPI/Card.`
                    : 'Select payment method and click Mark Paid.'}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500">Select payment method and click Mark Paid.</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={paymentMethod}
                onChange={(e) => { setPaymentMethod(e.target.value); setPayError(''); }}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                {activeMembership && canPayPartialFromMembership && (
                  <option value="membership">
                    Pay from Membership ({activeMembership.customer_phone || `MEM-${activeMembership.id}`}) – ₹{membershipBalance.toFixed(0)} available
                  </option>
                )}
                <option value="cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
              </select>
              {isSplitPayment && (
                <select
                  value={secondaryPaymentMethod}
                  onChange={(e) => { setSecondaryPaymentMethod(e.target.value); setPayError(''); }}
                  className="px-3 py-2 border rounded-lg text-sm"
                  title="Pay remaining amount by"
                >
                  <option value="cash">+ Cash (₹{remainderToPay.toFixed(0)})</option>
                  <option value="UPI">+ UPI (₹{remainderToPay.toFixed(0)})</option>
                  <option value="Card">+ Card (₹{remainderToPay.toFixed(0)})</option>
                </select>
              )}
              <button
                onClick={markPaid}
                disabled={paying || (paymentMethod === 'membership' && !canPayPartialFromMembership)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
              >
                {paying ? '...' : 'Mark Paid'}
              </button>
              {payError && <span className="text-red-600 text-sm">{payError}</span>}
            </div>
          </div>
        )}
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
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">CGST @ {cgstRate}%</span>
              <span>{formatINR(cgstAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">SGST @ {sgstRate}%</span>
              <span>{formatINR(sgstAmount)}</span>
            </div>
            {(Number(invoice.discount_percent) || 0) > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount ({Number(invoice.discount_percent)}%)</span>
                <span>-{formatINR(Number(invoice.discount_amount) || 0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t-2 border-slate-200">
              <span>Total</span>
              <span>{formatINR(total, 0)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Amount in words</p>
          <p className="text-sm font-medium text-slate-700">{amountInWords(total)}</p>
        </div>

        {invoice.status === 'paid' && (
          <div className="mt-6 p-3 bg-green-50 rounded-lg text-green-800 text-sm">
            Paid on {formatDateIST(invoice.paid_at)}
            {invoice.payment_method && (
              <span>
                {' '}
                {String(invoice.payment_method).toLowerCase().startsWith('membership')
                  ? invoice.amount_from_membership > 0 && invoice.secondary_payment_method
                    ? `(Membership ₹${Number(invoice.amount_from_membership).toFixed(0)} + ${invoice.secondary_payment_method} ₹${(Number(invoice.total) - Number(invoice.amount_from_membership)).toFixed(0)})`
                    : `(Membership)`
                  : `(${invoice.payment_method})`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
