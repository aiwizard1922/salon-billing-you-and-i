const PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
const API_URL = PHONE_ID ? `https://graph.facebook.com/v21.0/${PHONE_ID}/messages` : null;

function isConfigured() {
  return !!(PHONE_ID && ACCESS_TOKEN);
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
    return { ok: false };
  }
  const to = formatPhone(toPhone); // Must include country code (e.g. 919876543210 for India)
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
    if (!res.ok) return { ok: false, error: data.error?.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Send a template message. Required for business-initiated conversations
 * (when customer hasn't messaged you in 24h). Text messages only work within session window.
 */
async function sendTemplate(toPhone, templateName, components = [], languageCode = 'en_US') {
  if (!isConfigured() || !API_URL) return { ok: false };
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
    if (!res.ok) return { ok: false, error: data.error?.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function sendAppointmentConfirmation({ customerPhone, customerName, date, time, services }) {
  const svc = Array.isArray(services) ? services.join(', ') : services || 'Service';
  return sendText(customerPhone, `Hi ${customerName || 'Customer'}! Your appointment is confirmed.\n\n📅 ${date}\n⏰ ${time}\n💇 ${svc}\n\nWe look forward to seeing you!`);
}

async function sendPaymentReceipt({ customerPhone, customerName, invoiceNumber, amount }) {
  return sendText(customerPhone, `Thank you for your payment, ${customerName || 'Customer'}!\n\n✅ Invoice: ${invoiceNumber}\n💰 Amount: ₹${Number(amount).toFixed(2)}\n\nThank you for choosing us!`);
}

/**
 * Send invoice bill. Uses TEMPLATE message (required for business-initiated - customer hasn't
 * messaged in 24h). Set WA_BILL_TEMPLATE in .env:
 * - hello_world: test template (no params)
 * - invoice_bill: custom "Hi {{1}}, your bill from {{2}}. Invoice: {{3}}. Total: ₹{{4}}"
 * - payment_successful: Meta's Utility › Payments template (4 params: case_code, case_title, payment_amount, order_id)
 */
async function sendInvoiceBill({ customerPhone, customerName, invoiceNumber, items, total, businessName }) {
  const templateName = process.env.WA_BILL_TEMPLATE || 'hello_world';
  const biz = businessName || process.env.BUSINESS_NAME || 'Salon';
  const totalFormatted = `₹${Number(total || 0).toFixed(2)}`;
  const serviceSummary = (items || [])
    .map((i) => `${i.description || i.service_name || 'Service'} ×${i.quantity || 1}`)
    .join(', ')
    .slice(0, 100) || 'Salon services';

  if (templateName === 'payment_successful') {
    return sendTemplate(customerPhone, 'payment_successful', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: String(invoiceNumber).slice(0, 50) },
          { type: 'text', text: `${biz} – ${serviceSummary}`.slice(0, 100) },
          { type: 'text', text: totalFormatted },
          { type: 'text', text: String(invoiceNumber).slice(0, 50) },
        ],
      },
    ]);
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

  // Default: hello_world (no params)
  return sendTemplate(customerPhone, 'hello_world', []);
}

async function sendMembershipExpiryReminder({ customerPhone, customerName, planName, endDate, daysLeft }) {
  return sendText(
    customerPhone,
    `Hi ${customerName || 'Valued Customer'}!\n\n⏰ Your *${planName || 'membership'}* is expiring in ${daysLeft} days (${endDate}).\n\nRenew or upgrade now to continue enjoying your benefits. Visit us or contact us to renew easily!\n\nWe look forward to serving you. 💇`
  );
}

/** Personalize message: replaces {{name}} with customer name */
function personalizeMessage(template, customerName) {
  const name = customerName || 'Valued Customer';
  return template.replace(/\{\{name\}\}/gi, name);
}

/** Send bulk marketing messages. Returns { sent, failed, errors } */
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
  sendText,
  sendAppointmentConfirmation,
  sendPaymentReceipt,
  sendInvoiceBill,
  sendMembershipExpiryReminder,
  sendBulkMarketing,
  personalizeMessage,
};
