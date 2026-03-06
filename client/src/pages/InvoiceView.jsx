import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { amountInWords } from '../utils/amountInWords';
import { formatINR } from '../utils/formatCurrency';

const API = '/api';
const HSN_SAC = '998316'; // Beauty treatment services (Indian GST)

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [shop, setShop] = useState(null);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  useEffect(() => {
    fetch(`${API}/invoices/${id}`)
      .then((r) => r.json())
      .then((d) => d.success && setInvoice(d.data));
    fetch(`${API}/shop`)
      .then((r) => r.json())
      .then((d) => d.success && setShop(d.data));
  }, [id]);

  const markPaid = () => {
    setPaying(true);
    fetch(`${API}/invoices/${id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentMethod }) })
      .then((r) => r.json())
      .then((d) => d.success && setInvoice(d.data))
      .finally(() => setPaying(false));
  };

  if (!invoice) return <div className="text-slate-500">Loading...</div>;

  const taxPercent = Number(invoice.tax_percent) || 18;
  const cgstRate = taxPercent / 2;
  const sgstRate = taxPercent / 2;
  const cgstAmount = Number(invoice.tax_amount) / 2;
  const sgstAmount = Number(invoice.tax_amount) / 2;
  const subtotal = Number(invoice.subtotal);
  const total = Number(invoice.total);

  return (
    <div>
      <div className="mb-6 flex gap-2 no-print">
        <button onClick={() => navigate('/')} className="px-4 py-2 border rounded-lg hover:bg-slate-100">← Back</button>
        <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-lg">Print</button>
        {invoice.status === 'pending' && (
          <div className="flex items-center gap-2">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </select>
            <button onClick={markPaid} disabled={paying} className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">
              {paying ? '...' : 'Mark Paid'}
            </button>
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl shadow p-8 max-w-3xl print:shadow-none">
        <div className="text-center border-b border-slate-200 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">TAX INVOICE</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Sold by</p>
            <p className="font-bold text-slate-800">{shop?.name || 'Salon'}</p>
            {shop?.address && <p className="text-sm text-slate-600">{shop.address}</p>}
            {shop?.gstin && <p className="text-sm text-slate-600 mt-1">GSTIN: {shop.gstin}</p>}
            {shop?.state && <p className="text-sm text-slate-600">State: {shop.state}</p>}
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
            <span className="font-semibold ml-2">{invoice.invoice_date}</span>
          </div>
        </div>

        <table className="w-full mb-6 border-collapse">
          <thead>
            <tr className="bg-slate-100 border-y border-slate-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">HSN/SAC</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Description</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Qty</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Rate (₹)</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-3 px-4 text-slate-600">{HSN_SAC}</td>
                <td className="py-3 px-4">{item.service_name}</td>
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
            <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t-2 border-slate-200">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Amount in words</p>
          <p className="text-sm font-medium text-slate-700">{amountInWords(total)}</p>
        </div>

        {invoice.status === 'paid' && (
          <div className="mt-6 p-3 bg-green-50 rounded-lg text-green-800 text-sm">
            Paid on {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString('en-IN') : '–'}
            {invoice.payment_method && ` (${invoice.payment_method})`}
          </div>
        )}
      </div>
    </div>
  );
}
