require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');
const whatsapp = require('./services/whatsapp');

const JWT_SECRET = process.env.JWT_SECRET || 'salon-billing-secret-change-in-production';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

db.testConnection().catch(() => {});
db.ensureDefaultAdmin().catch(() => {});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }
    try {
      const admin = await db.getAdminByUsername(username);
      if (admin) {
        const valid = await bcrypt.compare(password, admin.password_hash);
        if (valid) {
          const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '7d' });
          return res.json({ success: true, token, username: admin.username });
        }
      }
    } catch {
      // Database not available – use dev fallback (admin/admin123)
      if (username === 'admin' && password === 'admin123') {
        const token = jwt.sign({ id: 0, username: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ success: true, token, username: 'admin' });
      }
    }
    return res.status(401).json({ success: false, error: 'Invalid username or password' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  try {
    const token = auth.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, username: decoded.username });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
});

app.get('/api/analytics/daily', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
    const data = await db.getDailySales(days);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/analytics/monthly', async (req, res) => {
  try {
    const months = Math.min(24, Math.max(3, parseInt(req.query.months, 10) || 12));
    const data = await db.getMonthlySales(months);
    const margin = (parseFloat(process.env.PROFIT_MARGIN_PERCENT) || 30) / 100;
    const withProfit = data.map((r) => ({
      ...r,
      revenue: Number(r.revenue),
      profit: Number((r.revenue * margin).toFixed(2)),
    }));
    res.json({ success: true, data: withProfit });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/analytics/daily-by-method', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
    const data = await db.getDailySalesByMethod(days);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/analytics/monthly-by-method', async (req, res) => {
  try {
    const months = Math.min(24, Math.max(3, parseInt(req.query.months, 10) || 12));
    const data = await db.getMonthlySalesByMethod(months);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/shop', (req, res) => {
  res.json({
    success: true,
    data: {
      name: process.env.BUSINESS_NAME || 'Salon',
      address: process.env.BUSINESS_ADDRESS || '',
      gstin: process.env.BUSINESS_GSTIN || '',
      state: process.env.BUSINESS_STATE || '',
    },
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Salon Billing API',
    endpoints: {
      customers: 'GET/POST /api/customers',
      appointments: 'GET/POST /api/appointments',
      invoices: 'GET/POST /api/invoices',
      'invoices/:id/pay': 'POST /api/invoices/:id/pay',
      services: 'GET /api/services',
      whatsapp: 'GET /api/whatsapp/status',
      marketing: 'POST /api/marketing/send',
    },
  });
});

app.get('/api/customers', async (req, res) => {
  try {
    const data = await db.getCustomers();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/customers/lookup', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone?.trim()) return res.json({ success: true, data: null });
    const customer = await db.getCustomerByPhone(phone);
    res.json({ success: true, data: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, email, gender, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, error: 'Name and phone required' });
    const data = await db.createCustomer({ name, phone, email, gender, notes });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, phone, email, gender, notes } = req.body;
    const data = await db.updateCustomer(Number(req.params.id), { name, phone, email, gender, notes });
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await db.getAppointments({ from, to });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { customerId, appointmentDate, appointmentTime, services, totalAmount, notes } = req.body;
    if (!customerId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ success: false, error: 'customerId, date, time required' });
    }
    const appt = await db.createAppointment({ customerId, appointmentDate, appointmentTime, services, totalAmount, notes });
    const customer = await db.getCustomerById(customerId);
    if (customer?.phone && whatsapp.isConfigured()) {
      const r = await whatsapp.sendAppointmentConfirmation({
        customerPhone: customer.phone,
        customerName: customer.name,
        date: appointmentDate,
        time: appointmentTime,
        services,
      });
      await db.logWhatsApp(customer.phone, 'appointment_confirmation', r.ok ? 'sent' : 'failed', r.error);
    }
    res.status(201).json({ success: true, data: appt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/invoices', async (req, res) => {
  try {
    const { status } = req.query;
    const data = await db.getInvoices({ status });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const data = await db.getInvoiceById(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const { customerId, customer, items, taxPercent, appointmentId, notes } = req.body;
    const hasItems = Array.isArray(items) && items.length > 0 && items.some((i) => i?.service_name?.trim());
    if (!hasItems) {
      return res.status(400).json({ success: false, error: 'Add at least one service with a name (e.g. Hair Cut, Facial)' });
    }
    let resolvedCustomerId = customerId ? Number(customerId) : null;
    if (customer && String(customer.name || '').trim() && String(customer.phone || '').trim()) {
      const c = await db.findOrCreateCustomer({ name: customer.name.trim(), phone: customer.phone.trim() });
      if (!c) return res.status(400).json({ success: false, error: 'Could not create or find customer' });
      resolvedCustomerId = c.id;
    }
    if (!resolvedCustomerId) {
      return res.status(400).json({ success: false, error: 'Select an existing customer or enter name and phone for a new one' });
    }
    const data = await db.createInvoice({
      customerId: Number(resolvedCustomerId),
      items,
      taxPercent: taxPercent ?? 5,
      appointmentId,
      notes,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/invoices/:id/pay', async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const invoice = await db.markInvoicePaid(Number(req.params.id), paymentMethod);
    const customer = await db.getCustomerById(invoice.customer_id);
    if (customer?.phone && whatsapp.isConfigured()) {
      const r = await whatsapp.sendPaymentReceipt({
        customerPhone: customer.phone,
        customerName: invoice.customer_name,
        invoiceNumber: invoice.invoice_number,
        amount: invoice.total,
      });
      await db.logWhatsApp(customer.phone, 'payment_receipt', r.ok ? 'sent' : 'failed', r.error);
    }
    res.json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/services', (req, res) => {
  res.json({ success: true, data: require('./data/services') });
});

// --- Staff ---
app.get('/api/staff', async (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const data = await db.getStaff(activeOnly);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/staff', async (req, res) => {
  try {
    const { name, phone, email, role, joinDate, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Name required' });
    const data = await db.createStaff({ name, phone, email, role, joinDate: joinDate || null, notes });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/staff/:id', async (req, res) => {
  try {
    const { name, phone, email, role, joinDate, notes, isActive } = req.body;
    const data = await db.updateStaff(Number(req.params.id), { name, phone, email, role, joinDate, notes, isActive });
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Membership plans ---
app.get('/api/membership-plans', async (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const data = await db.getMembershipPlans(activeOnly);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/membership-plans', async (req, res) => {
  try {
    const { name, durationDays, price, benefits } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Plan name required' });
    const data = await db.createMembershipPlan({ name, durationDays: durationDays ?? 30, price: price ?? 0, benefits });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/membership-plans/:id', async (req, res) => {
  try {
    const { name, durationDays, price, benefits, isActive } = req.body;
    const data = await db.updateMembershipPlan(Number(req.params.id), { name, durationDays, price, benefits, isActive });
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Customer memberships ---
app.get('/api/customer-memberships', async (req, res) => {
  try {
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    const status = req.query.status || null;
    const data = await db.getCustomerMemberships(customerId, status);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/customer-memberships', async (req, res) => {
  try {
    const { customerId, planId, startDate, endDate, notes } = req.body;
    if (!customerId || !planId || !startDate) {
      return res.status(400).json({ success: false, error: 'customerId, planId, startDate required' });
    }
    let end = endDate;
    if (!end && planId) {
      const plan = await db.getMembershipPlanById(Number(planId));
      if (plan?.duration_days) {
        const start = new Date(startDate);
        start.setDate(start.getDate() + plan.duration_days);
        end = start.toISOString().slice(0, 10);
      }
    }
    const data = await db.assignMembershipToCustomer({ customerId: Number(customerId), planId: Number(planId), startDate, endDate: end, notes });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Client analytics ---
app.get('/api/analytics/clients', async (req, res) => {
  try {
    const month = req.query.month || null;
    const data = await db.getClientAnalytics(month);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/whatsapp/status', (req, res) => {
  res.json({ configured: whatsapp.isConfigured() });
});

app.post('/api/marketing/send', async (req, res) => {
  try {
    const { message, customerIds } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    let customers;
    if (customerIds?.length) {
      customers = await db.getCustomersByIds(customerIds);
    } else {
      customers = await db.getCustomers();
    }
    const withPhone = customers.filter((c) => c.phone?.trim());
    if (withPhone.length === 0) {
      return res.status(400).json({ success: false, error: 'No customers with phone numbers to send to' });
    }
    if (!whatsapp.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp not configured. Add WA_PHONE_NUMBER_ID and WA_ACCESS_TOKEN to server/.env',
      });
    }
    const logFn = async (toPhone, type, status, err) => {
      try {
        await db.logWhatsApp(toPhone, type, status, err);
      } catch {}
    };
    const results = await whatsapp.sendBulkMarketing(withPhone, message, null, logFn);
    res.json({
      success: true,
      data: {
        sent: results.sent,
        failed: results.failed,
        total: withPhone.length,
        errors: results.errors,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Salon Billing API at http://localhost:${PORT}`);
});
