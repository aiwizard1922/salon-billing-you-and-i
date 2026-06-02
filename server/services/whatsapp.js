const PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
const API_URL = PHONE_ID ? `https://graph.facebook.com/v21.0/${PHONE_ID}/messages` : null;

function trimEnv(val) {
  if (val == null || val === '') return '';
  return String(val).trim();
}

function isConfigured() {
  return !!(PHONE_ID && ACCESS_TOKEN);
}

function billTemplateName() {
  return trimEnv(process.env.WA_BILL_TEMPLATE) || 'hello_world';
}

function paymentTemplateName() {
  return trimEnv(process.env.WA_PAYMENT_TEMPLATE) || 'payment_successful';
}

function getWhatsAppStatus() {
  const configured = isConfigured();
  const missing = [];
  if (!trimEnv(PHONE_ID)) missing.push('WA_PHONE_NUMBER_ID');
  if (!trimEnv(ACCESS_TOKEN)) missing.push('WA_ACCESS_TOKEN');
  return {
    configured,
    billTemplate: billTemplateName(),
    paymentTemplate: paymentTemplateName(),
    appointmentTemplate: trimEnv(process.env.WA_APPOINTMENT_TEMPLATE) || null,
    missing,
    notes: {
      invoiceBill: 'Uses template (WA_BILL_TEMPLATE). Default hello_world works for testing.',
      paymentReceipt:
        'Uses template (WA_PAYMENT_TEMPLATE). Default payment_successful — must be approved in Meta.',
      appointment:
        trimEnv(process.env.WA_APPOINTMENT_TEMPLATE)
          ? `Uses template ${trimEnv(process.env.WA_APPOINTMENT_TEMPLATE)}.`
          : 'Uses plain text — only works if customer messaged you in the last 24 hours.',
      marketing: 'Plain text only — customer must have messaged you in the last 24 hours.',
    },
    productionHint: configured
      ? null
      : 'Add WA_PHONE_NUMBER_ID and WA_ACCESS_TOKEN on Render (web service), not Postgres.',
  };
}

function formatPhone(phone) {
  let n = String(phone).replace(/\D/g, '');
  if (n.startsWith('0')) n = n.slice(1);
  if (n.length === 10) n = '91' + n;
  return n;
}

async function sendText(toPhone, text) {
  if (!isConfigured() || !API_URL) {
    console.log('[WhatsApp] Not configured. Would send:', text?.slice(0, 50) + '...');
    return { ok: false, error: 'WhatsApp not configured' };
  }
  const to = formatPhone(toPhone);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Send a template message. Required for business-initiated conversations
 * (when customer hasn't messaged you in 24h).
 */
async function sendTemplate(toPhone, templateName, components = [], languageCode = 'en_US') {
  if (!isConfigured() || !API_URL) return { ok: false, error: 'WhatsApp not configured' };
  const to = formatPhone(toPhone);
  const template = {
    name: templateName,
    language: { code: languageCode },
    ...(components.length > 0 && { components }),
  };
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Body params for Meta payment_successful (Utility › Payments). */
function paymentSuccessfulComponents(invoiceNumber, lineDescription, amount) {
  const totalFormatted = `₹${Number(amount || 0).toFixed(2)}`;
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: String(invoiceNumber).slice(0, 50) },
        { type: 'text', text: String(lineDescription).slice(0, 100) },
        { type: 'text', text: totalFormatted },
        { type: 'text', text: String(invoiceNumber).slice(0, 50) },
      ],
    },
  ];
}

async function sendAppointmentConfirmation({
  customerPhone,
  customerName,
  date,
  time,
  services,
  serviceLines,
  staffName,
}) {
  const tpl = trimEnv(process.env.WA_APPOINTMENT_TEMPLATE);
  let svcSummary;
  if (Array.isArray(serviceLines) && serviceLines.length > 0) {
    svcSummary = serviceLines
      .map((L) => {
        const n = L.name || 'Service';
        const st = L.staffName ? ` – ${L.staffName}` : '';
        return `${n}${st}`;
      })
      .join(', ');
  } else {
    const svc = Array.isArray(services) ? services.join(', ') : services || 'Service';
    svcSummary = staffName ? `${svc} (${staffName})` : svc;
  }

  if (tpl) {
    return sendTemplate(customerPhone, tpl, [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: (customerName || 'Customer').slice(0, 100) },
          { type: 'text', text: String(date).slice(0, 50) },
          { type: 'text', text: String(time).slice(0, 50) },
          { type: 'text', text: svcSummary.slice(0, 100) },
        ],
      },
    ]);
  }

  let svcBlock;
  if (Array.isArray(serviceLines) && serviceLines.length > 0) {
    svcBlock = serviceLines
      .map((L) => {
        const n = L.name || 'Service';
        const st = L.staffName ? ` – ${L.staffName}` : '';
        return `💇 ${n}${st}`;
      })
      .join('\n');
  } else {
    const svc = Array.isArray(services) ? services.join(', ') : services || 'Service';
    const stylist = staffName ? `\n👤 Stylist: ${staffName}` : '';
    svcBlock = `💇 ${svc}${stylist}`;
  }
  return sendText(
    customerPhone,
    `Hi ${customerName || 'Customer'}! Your appointment is confirmed.\n\n📅 ${date}\n⏰ ${time}\n${svcBlock}\n\nWe look forward to seeing you!`,
  );
}

async function sendPaymentReceipt({ customerPhone, customerName, invoiceNumber, amount }) {
  const templateName = paymentTemplateName();
  const biz = process.env.BUSINESS_NAME || 'Salon';

  if (templateName === 'payment_successful') {
    return sendTemplate(
      customerPhone,
      'payment_successful',
      paymentSuccessfulComponents(
        invoiceNumber,
        `${biz} – payment from ${customerName || 'Customer'}`.slice(0, 100),
        amount,
      ),
    );
  }

  if (templateName === 'hello_world') {
    return sendTemplate(customerPhone, 'hello_world', []);
  }

  // Custom template name with same 4 body slots as payment_successful
  return sendTemplate(
    customerPhone,
    templateName,
    paymentSuccessfulComponents(invoiceNumber, `${biz} – payment received`, amount),
  );
}

/**
 * Send invoice bill. Uses TEMPLATE message (required for business-initiated).
 * WA_BILL_TEMPLATE: hello_world | payment_successful | invoice_bill | your_approved_name
 */
async function sendInvoiceBill({
  customerPhone,
  customerName,
  invoiceNumber,
  items,
  total,
  businessName,
}) {
  const templateName = billTemplateName();
  const biz = businessName || process.env.BUSINESS_NAME || 'Salon';
  const totalFormatted = `₹${Number(total || 0).toFixed(2)}`;
  const serviceSummary = (items || [])
    .map((i) => `${i.description || i.service_name || 'Service'} ×${i.quantity || 1}`)
    .join(', ')
    .slice(0, 100) || 'Salon services';

  if (templateName === 'payment_successful') {
    return sendTemplate(
      customerPhone,
      'payment_successful',
      paymentSuccessfulComponents(invoiceNumber, `${biz} – ${serviceSummary}`, total),
    );
  }

  if (templateName === 'invoice_bill') {
    return sendTemplate(customerPhone, 'invoice_bill', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: (customerName || 'Customer').slice(0, 100) },
          { type: 'text', text: biz.slice(0, 100) },
          { type: 'text', text: String(invoiceNumber).slice(0, 50) },
          { type: 'text', text: totalFormatted },
        ],
      },
    ]);
  }

  if (templateName !== 'hello_world') {
    return sendTemplate(customerPhone, templateName, [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: (customerName || 'Customer').slice(0, 100) },
          { type: 'text', text: biz.slice(0, 100) },
          { type: 'text', text: String(invoiceNumber).slice(0, 50) },
          { type: 'text', text: totalFormatted },
        ],
      },
    ]);
  }

  return sendTemplate(customerPhone, 'hello_world', []);
}

async function sendMembershipExpiryReminder({ customerPhone, customerName, planName, endDate, daysLeft }) {
  return sendText(
    customerPhone,
    `Hi ${customerName || 'Valued Customer'}!\n\n⏰ Your *${planName || 'membership'}* is expiring in ${daysLeft} days (${endDate}).\n\nRenew or upgrade now to continue enjoying your benefits. Visit us or contact us to renew easily!\n\nWe look forward to serving you. 💇`,
  );
}

function personalizeMessage(template, customerName) {
  const name = customerName || 'Valued Customer';
  return template.replace(/\{\{name\}\}/gi, name);
}

/** Send bulk marketing messages. Plain text — only within 24h customer session window. */
async function sendBulkMarketing(customers, messageTemplate, onEach, logFn) {
  const results = { sent: 0, failed: 0, errors: [] };
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const c of customers) {
    if (!c.phone?.trim()) {
      results.failed++;
      results.errors.push({ name: c.name, error: 'No phone number' });
      if (onEach) onEach(c, false, 'No phone number');
      continue;
    }
    const text = personalizeMessage(messageTemplate, c.name);
    const r = await sendText(c.phone, text);
    if (logFn) await logFn(c.phone, 'marketing', r.ok ? 'sent' : 'failed', r.error);
    if (r.ok) {
      results.sent++;
      if (onEach) onEach(c, true);
    } else {
      results.failed++;
      results.errors.push({ name: c.name, phone: c.phone, error: r.error || 'Unknown error' });
      if (onEach) onEach(c, false, r.error);
    }
    await delay(800);
  }
  return results;
}

module.exports = {
  isConfigured,
  getWhatsAppStatus,
  sendText,
  sendTemplate,
  sendAppointmentConfirmation,
  sendPaymentReceipt,
  sendInvoiceBill,
  sendMembershipExpiryReminder,
  sendBulkMarketing,
  personalizeMessage,
};
