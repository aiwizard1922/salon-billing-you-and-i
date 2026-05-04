const nodemailer = require('nodemailer');
const dns = require('dns');

try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (_) {
  /* ignore */
}

function trimEnv(val) {
  if (val == null || val === '') return '';
  let s = String(val).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

function getRecipients() {
  const raw = process.env.INVOICE_NOTIFY_EMAIL || '';
  return raw
    .split(/[,;]/)
    .map((s) => trimEnv(s))
    .filter(Boolean);
}

function smtpCredentials() {
  const host = trimEnv(process.env.SMTP_HOST);
  let pass = trimEnv(process.env.SMTP_PASS);
  if (/gmail\.com$/i.test(host || '')) {
    pass = pass.replace(/\s+/g, '');
  }
  return {
    host,
    user: trimEnv(process.env.SMTP_USER),
    pass,
  };
}

function isNotifyReady() {
  if (getRecipients().length === 0) return false;
  const { host, user, pass } = smtpCredentials();
  return !!(host && user && pass);
}

function buildTransporter() {
  const { host, user, pass } = smtpCredentials();
  const configuredPort = Number(process.env.SMTP_PORT) || 587;
  let port = configuredPort;
  let secure = process.env.SMTP_SECURE === 'true' || port === 465;

  const isGmailHost = /gmail\.com$/i.test(host || '');
  const forceStartTls =
    trimEnv(process.env.SMTP_GMAIL_FORCE_STARTTLS).toLowerCase() === 'true';
  if (isGmailHost && configuredPort === 587 && !forceStartTls) {
    port = 465;
    secure = true;
  }

  const opts = {
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 60000,
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
      servername: host,
    },
  };
  return nodemailer.createTransport(opts);
}

function formatMoney(n) {
  return `₹${Number(n || 0).toFixed(2)}`;
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tenderLabel(m) {
  const x = String(m || '').toLowerCase();
  if (x === 'upi') return 'UPI';
  if (x === 'card') return 'Card';
  if (x === 'cash') return 'Cash';
  if (x === 'membership') return 'Membership balance';
  return String(m || 'Cash');
}

/** Human-readable payment line for paid invoices (cash/upi/card, splits, membership). */
function paymentMethodPhrase(inv) {
  const split = inv.payment_split && typeof inv.payment_split === 'object' ? inv.payment_split : null;
  if (split && Object.keys(split).length >= 2) {
    return Object.keys(split)
      .sort()
      .map((k) => `${tenderLabel(k)} (${formatMoney(Number(split[k]) || 0)})`)
      .join(' + ');
  }

  const pmRaw = String(inv.payment_method || '');
  const pm = pmRaw.toLowerCase();
  if (pm.startsWith('membership+')) {
    const sec = pm.split('+')[1] || inv.secondary_payment_method || '';
    const afm = Number(inv.amount_from_membership) || 0;
    const total = Number(inv.total) || 0;
    const rest = Math.max(0, Math.round((total - afm) * 100) / 100);
    return `${tenderLabel('membership')} (${formatMoney(afm)}) + ${tenderLabel(sec)} (${formatMoney(rest)})`;
  }
  if (pm === 'membership') {
    return 'Membership balance';
  }
  return tenderLabel(pmRaw);
}

function buildAdminPaidBody(inv, bizName) {
  const brand = (bizName || 'your salon').trim() || 'your salon';
  const name = (inv.customer_name || 'Customer').trim() || 'Customer';
  const total = formatMoney(inv.total);
  const via = paymentMethodPhrase(inv);
  const thankYou =
    `Thank you for keeping ${brand} running smoothly — here's to happy clients and another great day.`;

  const coreText = [
    'Hello admin,',
    '',
    `${name} just visited your salon.`,
    '',
    `The total amount of the bill is ${total}.`,
    '',
    `It has been paid via ${via}.`,
  ].join('\n');

  const coreHtml = `<p>Hello admin,</p>
<p><strong>${escHtml(name)}</strong> just visited your salon.</p>
<p>The total amount of the bill is <strong>${escHtml(total)}</strong>.</p>
<p>It has been paid via <strong>${escHtml(via)}</strong>.</p>`;

  const thankYouHtml = `<p style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;color:#475569">${escHtml(thankYou)}</p>`;

  return { coreText, thankYou, coreHtml, thankYouHtml };
}

function buildPdfNoteHtml(inv) {
  return `<p style="margin-top:16px;font-size:13px;color:#64748b">Invoice <strong>${escHtml(inv.invoice_number)}</strong> — detailed tax invoice is attached as PDF.</p>`;
}

/**
 * Notify admin after an invoice is marked paid (cash/UPI/card/membership/split).
 * Optional PDF attachment matches the printed tax invoice.
 * @returns {{ ok: true } | { ok: false, skipped: true } | { ok: false, error: string }}
 */
async function sendPaidInvoiceAdminNotify(invoice) {
  const recipients = getRecipients();
  if (recipients.length === 0) return { ok: false, skipped: true };
  const { host, user, pass } = smtpCredentials();
  if (!host || !user || !pass) {
    return {
      ok: false,
      error:
        'Missing SMTP settings: set SMTP_HOST, SMTP_USER, and SMTP_PASS in server/.env.',
    };
  }

  const biz = process.env.BUSINESS_NAME || 'Salon';
  const from =
    process.env.SMTP_FROM || process.env.SMTP_USER || process.env.BUSINESS_EMAIL || 'noreply@localhost';
  const invNo = invoice.invoice_number || '';
  const subject = `[${biz}] Payment — ${invNo} — ${formatMoney(invoice.total)}`;

  const { coreText, thankYou, coreHtml, thankYouHtml } = buildAdminPaidBody(invoice, biz);

  const attachPdf = trimEnv(process.env.INVOICE_EMAIL_ATTACH_PDF).toLowerCase() !== 'false';
  const attachments = [];
  if (attachPdf) {
    try {
      const { invoiceToPdfBuffer, shopFromEnv } = require('./invoicePdf');
      const pdfBuffer = await invoiceToPdfBuffer(invoice, shopFromEnv());
      const safeName = `${String(invoice.invoice_number || 'invoice').replace(/[^\w.-]+/g, '_')}.pdf`;
      attachments.push({
        filename: safeName,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    } catch (pdfErr) {
      console.error('[Invoice email] PDF attachment skipped:', pdfErr.message);
    }
  }

  let htmlOut = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#334155">${coreHtml}`;
  if (attachments.length > 0) {
    htmlOut += buildPdfNoteHtml(invoice);
  }
  htmlOut += thankYouHtml + '</body></html>';

  let textOut = coreText;
  if (attachments.length > 0) {
    textOut += `\n\n(Tax invoice PDF attached: ${invoice.invoice_number || 'invoice'}.pdf)`;
  }
  textOut += `\n\n${thankYou}`;

  const transporter = buildTransporter();
  try {
    await transporter.sendMail({
      from,
      to: recipients.join(', '),
      subject,
      text: textOut,
      html: htmlOut,
      attachments,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  getRecipients,
  isNotifyReady,
  sendPaidInvoiceAdminNotify,
};
