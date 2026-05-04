const { amountInWords, formatINR, formatDateIST } = require('./indianInvoiceFormat');

const HSN_SAC = '998316';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shouldShowMembershipBundleHint(invoice) {
  const items = invoice.items || [];
  const lineItemsGross = items.reduce((sum, it) => sum + Number(it.total || 0), 0);
  const subtotal = Number(invoice.subtotal);
  const hasMembershipLine = items.some((it) =>
    String(it.service_name || it.description || '').toLowerCase().startsWith('[membership]'),
  );
  return hasMembershipLine && Math.round(lineItemsGross * 100) > Math.round(subtotal * 100) + 1;
}

function tenderMethodLabel(m) {
  const x = String(m || '').toLowerCase();
  if (x === 'upi') return 'UPI';
  if (x === 'card') return 'Card';
  return 'Cash';
}

function computeDisplayTotals(invoice) {
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
  const invoiceTotalExact = Math.round(Number(invoice.total) * 100) / 100;
  const totalDisplayDecimals = Math.round(invoiceTotalExact * 100) % 100 === 0 ? 0 : 2;
  return {
    subtotal,
    taxAmountTotal,
    hasStoredTaxBreakdown,
    cgstRate,
    sgstRate,
    igstRate,
    serviceTaxRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    serviceTaxAmount,
    invoiceTotalExact,
    totalDisplayDecimals,
  };
}

function paidLineHtml(invoice) {
  if (invoice.status !== 'paid' || !invoice.paid_at) return '';
  let methodNote = '';
  const pm = String(invoice.payment_method || '').toLowerCase();
  if (pm.startsWith('membership')) {
    const afm = Number(invoice.amount_from_membership) || 0;
    const sec = invoice.secondary_payment_method;
    const total = Number(invoice.total) || 0;
    if (afm > 0 && sec) {
      methodNote = ` (Membership ₹${afm.toFixed(0)} + ${tenderMethodLabel(sec)} ₹${(total - afm).toFixed(0)})`;
    } else {
      methodNote = ' (Membership)';
    }
  } else if (invoice.payment_split && typeof invoice.payment_split === 'object') {
    const keys = Object.keys(invoice.payment_split).sort();
    if (keys.length >= 2) {
      methodNote = ` (${keys.map((m) => `${tenderMethodLabel(m)} ₹${Number(invoice.payment_split[m]).toFixed(0)}`).join(' + ')})`;
    } else if (invoice.payment_method) {
      methodNote = ` (${tenderMethodLabel(invoice.payment_method)})`;
    }
  } else if (invoice.payment_method) {
    methodNote = ` (${tenderMethodLabel(invoice.payment_method)})`;
  }
  return `
    <div class="paid-box">
      Paid on ${esc(formatDateIST(invoice.paid_at))}${methodNote}
    </div>`;
}

/**
 * Printable HTML aligned with the on-screen / print invoice (InvoiceView).
 */
function buildInvoicePdfHtml(invoice, shop) {
  const shopName = esc(shop?.name || 'Salon');
  const shopAddr = esc(shop?.address || '');
  const rawPhone = shop?.phone || '';
  const rawEmail = shop?.email || '';
  const shopGst = esc(shop?.gstin || '');
  const shopState = esc(shop?.state || '');
  const phoneEmailLine =
    rawPhone || rawEmail
      ? esc([rawPhone, rawEmail].filter(Boolean).join(' · '))
      : '';
  const gstParts = [];
  if (shop?.gstin) gstParts.push(`GSTIN: ${shop.gstin}`);
  if (shop?.state) gstParts.push(shop.state);
  const gstStateLine = gstParts.map(esc).join(' · ');

  const t = computeDisplayTotals(invoice);

  const rows = (invoice.items || [])
    .map((item) => {
      const desc = esc(item.description || item.service_name || item.serviceName || '—');
      const qty = item.quantity ?? 1;
      const rate = formatINR(item.unit_price);
      const amt = formatINR(item.total);
      return `<tr>
        <td>${HSN_SAC}</td>
        <td class="desc">${desc}</td>
        <td class="c">${qty}</td>
        <td class="r">${rate}</td>
        <td class="r">${amt}</td>
      </tr>`;
    })
    .join('');

  const discountAmt = Number(invoice.discount_amount) || 0;
  const discountPct = Number(invoice.discount_percent) || 0;
  let discountRow = '';
  if (discountAmt > 0) {
    discountRow = `<div class="row"><span>${discountPct > 0 ? `Discount (${discountPct}%)` : 'Discount (₹)'}</span><span class="disc">-${formatINR(discountAmt)}</span></div>`;
  }

  let taxRows = '';
  if (t.cgstRate > 0) {
    taxRows += `<div class="row"><span>CGST @ ${t.cgstRate}%</span><span>${formatINR(t.cgstAmount)}</span></div>`;
  }
  if (t.sgstRate > 0) {
    taxRows += `<div class="row"><span>SGST @ ${t.sgstRate}%</span><span>${formatINR(t.sgstAmount)}</span></div>`;
  }
  if (t.igstRate > 0) {
    taxRows += `<div class="row"><span>IGST @ ${t.igstRate}%</span><span>${formatINR(t.igstAmount)}</span></div>`;
  }
  if (t.serviceTaxRate > 0) {
    taxRows += `<div class="row"><span>Service tax @ ${t.serviceTaxRate}%</span><span>${formatINR(t.serviceTaxAmount)}</span></div>`;
  }

  const words = esc(amountInWords(t.invoiceTotalExact));
  const membershipBundleHintHtml = shouldShowMembershipBundleHint(invoice)
    ? `<p style="font-size:10px;color:#64748b;margin:0 0 12px 0;padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">Service and product lines are covered from the new membership balance (deducted when this invoice was created). Only the membership plan amount (plus tax) was collected — see Taxable Value below.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      font-size: 11px;
      line-height: 1.45;
      margin: 0;
      padding: 8px;
    }
    h1 {
      text-align: center;
      font-size: 18px;
      margin: 0 0 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .grid {
      display: table;
      width: 100%;
      margin-bottom: 18px;
    }
    .grid-row { display: table-row; }
    .cell {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-bottom: 8px;
    }
    .cell-right { text-align: right; }
    .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 11px; }
    table.inv {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    table.inv th {
      background: #f1f5f9;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
    }
    table.inv th.c, table.inv td.c { text-align: center; }
    table.inv th.r, table.inv td.r { text-align: right; }
    table.inv td {
      padding: 8px 6px;
      border-bottom: 1px solid #f1f5f9;
    }
    table.inv td.desc { font-weight: 500; }
    .tot-wrap { display: flex; justify-content: flex-end; }
    .tot {
      width: 280px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 11px;
    }
    .row .disc { color: #15803d; }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      font-size: 14px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 2px solid #e2e8f0;
    }
    .words {
      margin-top: 14px;
      padding: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .words .wl { font-size: 9px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
    .paid-box {
      margin-top: 14px;
      padding: 10px;
      background: #f0fdf4;
      border-radius: 6px;
      color: #166534;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <h1>TAX INVOICE</h1>
  <div class="grid">
    <div class="grid-row">
      <div class="cell">
        <div class="label">From</div>
        <div><strong>${shopName}</strong></div>
        ${shopAddr ? `<div>${shopAddr}</div>` : ''}
        ${phoneEmailLine ? `<div>${phoneEmailLine}</div>` : ''}
        ${gstStateLine ? `<div>${gstStateLine}</div>` : ''}
      </div>
      <div class="cell cell-right">
        <div class="label">Bill to</div>
        <div><strong>${esc(invoice.customer_name)}</strong></div>
        ${invoice.customer_phone ? `<div>${esc(invoice.customer_phone)}</div>` : ''}
        ${invoice.customer_email ? `<div>${esc(invoice.customer_email)}</div>` : ''}
      </div>
    </div>
  </div>
  <div class="meta">
    <div><span style="color:#64748b">Invoice No:</span> <strong>${esc(invoice.invoice_number)}</strong></div>
    <div><span style="color:#64748b">Date:</span> <strong>${esc(formatDateIST(invoice.invoice_date))}</strong></div>
  </div>
  <table class="inv">
    <thead>
      <tr>
        <th>HSN/SAC</th>
        <th>Description (Service)</th>
        <th class="c">Qty</th>
        <th class="r">Rate (₹)</th>
        <th class="r">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#64748b">No line items</td></tr>'}</tbody>
  </table>
  ${membershipBundleHintHtml}
  <div class="tot-wrap">
    <div class="tot">
      <div class="row"><span style="color:#475569">Taxable Value</span><span>${formatINR(t.subtotal)}</span></div>
      ${taxRows}
      ${discountRow}
      <div class="total-row"><span>Total</span><span>${formatINR(t.invoiceTotalExact, t.totalDisplayDecimals)}</span></div>
    </div>
  </div>
  <div class="words">
    <div class="wl">Amount in words</div>
    <div>${words}</div>
  </div>
  ${paidLineHtml(invoice)}
</body>
</html>`;
}

module.exports = { buildInvoicePdfHtml, computeDisplayTotals };
