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
  const to = formatPhone(toPhone).replace(/^91/, '');
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

async function sendAppointmentConfirmation({ customerPhone, customerName, date, time, services }) {
  const svc = Array.isArray(services) ? services.join(', ') : services || 'Service';
  return sendText(customerPhone, `Hi ${customerName || 'Customer'}! Your appointment is confirmed.\n\n📅 ${date}\n⏰ ${time}\n💇 ${svc}\n\nWe look forward to seeing you!`);
}

async function sendPaymentReceipt({ customerPhone, customerName, invoiceNumber, amount }) {
  return sendText(customerPhone, `Thank you for your payment, ${customerName || 'Customer'}!\n\n✅ Invoice: ${invoiceNumber}\n💰 Amount: ₹${Number(amount).toFixed(2)}\n\nThank you for choosing us!`);
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
  sendBulkMarketing,
  personalizeMessage,
};
