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

function getResendApiKey() {
  return trimEnv(process.env.RESEND_API_KEY);
}

function getFromAddress() {
  const explicit =
    trimEnv(process.env.EMAIL_FROM) ||
    trimEnv(process.env.RESEND_FROM) ||
    trimEnv(process.env.SMTP_FROM);
  if (explicit) return explicit;

  const user = trimEnv(process.env.SMTP_USER);
  if (user) return user;

  const bizEmail = trimEnv(process.env.BUSINESS_EMAIL);
  if (bizEmail) {
    const biz = trimEnv(process.env.BUSINESS_NAME) || 'Salon';
    return `${biz} <${bizEmail}>`;
  }
  return '';
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

function isSmtpReady() {
  const { host, user, pass } = smtpCredentials();
  return !!(host && user && pass);
}

function isResendReady() {
  return !!(getResendApiKey() && getFromAddress());
}

function getEmailProvider() {
  if (getResendApiKey()) return 'resend';
  if (isSmtpReady()) return 'smtp';
  return null;
}

function isNotifyReady() {
  if (getRecipients().length === 0) return false;
  return isResendReady() || isSmtpReady();
}

function getNotifyStatus() {
  const recipients = getRecipients();
  const resendKey = !!getResendApiKey();
  const resend = isResendReady();
  const smtp = isSmtpReady();
  const ready = recipients.length > 0 && (resend || smtp);
  let provider = null;
  if (ready) provider = resend ? 'resend' : 'smtp';

  const missing = [];
  if (recipients.length === 0) missing.push('INVOICE_NOTIFY_EMAIL');
  if (!resend && !smtp) {
    if (resendKey) missing.push('EMAIL_FROM (verified sender, e.g. Salon <billing@yourdomain.com>)');
    else {
      missing.push(
        'RESEND_API_KEY + EMAIL_FROM (Render/production) or SMTP_HOST + SMTP_USER + SMTP_PASS (local)',
      );
    }
  }

  return {
    ready,
    provider,
    recipients,
    resendConfigured: resendKey,
    smtpConfigured: smtp,
    missing,
  };
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

async function buildPaidInvoiceMail(invoice) {
  const biz = process.env.BUSINESS_NAME || 'Salon';
  const from = getFromAddress();
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

  return { from, subject, text: textOut, html: htmlOut, attachments };
}

async function sendViaResend({ from, to, subject, text, html, attachments }) {
  const apiKey = getResendApiKey();
  const body = { from, to, subject, text, html };
  if (attachments.length > 0) {
    body.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : String(a.content),
    }));
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let data = {};
  try {
    data = await res.json();
  } catch (_) {
    /* ignore */
  }

  if (!res.ok) {
    const msg =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      `Resend request failed (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function sendViaSmtp({ from, to, subject, text, html, attachments }) {
  const transporter = buildTransporter();
  await transporter.sendMail({
    from,
    to: to.join(', '),
    subject,
    text,
    html,
    attachments,
  });
}

/**
 * Notify admin after an invoice is marked paid (cash/UPI/card/membership/split).
 * Uses Resend HTTPS API when RESEND_API_KEY is set (Render Free); otherwise Gmail SMTP.
 * @returns {{ ok: true } | { ok: false, skipped: true } | { ok: false, error: string }}
 */
async function sendPaidInvoiceAdminNotify(invoice) {
  const recipients = getRecipients();
  if (recipients.length === 0) return { ok: false, skipped: true };

  const useResend = !!getResendApiKey();
  if (useResend && !isResendReady()) {
    return {
      ok: false,
      error:
        'Resend is partially configured: set RESEND_API_KEY and EMAIL_FROM (verified sender, e.g. You and I Salon <billing@yourdomain.com>).',
    };
  }
  if (!useResend && !isSmtpReady()) {
    return {
      ok: false,
      error:
        'Missing email settings: set RESEND_API_KEY + EMAIL_FROM (production) or SMTP_HOST, SMTP_USER, SMTP_PASS (local).',
    };
  }

  const mail = await buildPaidInvoiceMail(invoice);
  if (!mail.from) {
    return {
      ok: false,
      error: 'Missing sender: set EMAIL_FROM (Resend) or SMTP_USER / SMTP_FROM.',
    };
  }

  try {
    if (useResend) {
      await sendViaResend({
        from: mail.from,
        to: recipients,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments,
      });
    } else {
      await sendViaSmtp({
        from: mail.from,
        to: recipients,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments,
      });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  getRecipients,
  isNotifyReady,
  getNotifyStatus,
  getEmailProvider,
  sendPaidInvoiceAdminNotify,
};
