const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');
const dbMembership = require('./db-membership');
const dbInventory = require('./db-inventory');
const dbCatalog = require('./db-catalog');
const dbCrm = require('./db-crm');
const dbStaffMgmt = require('./db-staff-management');
const dbExpenses = require('./db-expenses');
const dbEod = require('./db-eod');
const dbProfit = require('./db-profit');
const { todayIST, istMonthStr, lastDayOfMonthYmd } = require('./date-utils');
const whatsapp = require('./services/whatsapp');
const invoiceEmail = require('./services/invoiceEmail');

/** Block past calendar dates and same-day times that are not after “now” in Asia/Kolkata. */
function assertAppointmentNotInPastIST(appointmentDate, appointmentTime) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (appointmentDate < today) {
    const err = new Error('Appointment date cannot be in the past');
    err.code = 400;
    throw err;
  }
  if (appointmentDate > today) return;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const nh = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const nm = parseInt(parts.find((p) => p.type === 'minute').value, 10);
  const nowM = nh * 60 + nm;
  const tt = String(appointmentTime).slice(0, 5);
  const tp = tt.split(':');
  const th = parseInt(tp[0], 10);
  const tm = parseInt(tp[1] || '0', 10);
  if (!Number.isFinite(th) || !Number.isFinite(tm)) {
    const err = new Error('Invalid appointment time');
    err.code = 400;
    throw err;
  }
  if (th * 60 + tm <= nowM) {
    const err = new Error('For today, choose a time after the current time (IST)');
    err.code = 400;
    throw err;
  }
}

function normalizeInvoicePayMethod(m) {
  const s = String(m || '').trim().toLowerCase();
  if (s === 'upi') return 'upi';
  if (s === 'card') return 'card';
  if (s === 'cash') return 'cash';
  return s;
}

const JWT_SECRET = process.env.JWT_SECRET || 'salon-billing-secret-change-in-production';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

db.testConnection().catch(() => {});
db.ensureDefaultAdmin().catch(() => {});

app.get('/api/health', async (req, res) => {
  try {
    await db.pool.query('SELECT 1');
    const r = await db.pool.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices'"
    );
    const invoicesTableExists = Number(r.rows[0]?.count || 0) > 0;
    res.json({
      ok: true,
      db: 'connected',
      tablesReady: invoicesTableExists,
      hint: invoicesTableExists ? null : 'Run migrations. Check Render Start Command is: node server/run-all-migrations.js && node server/server.js',
    });
  } catch (err) {
    res.json({
      ok: false,
      db: 'error',
      error: err.message,
      hint: 'DATABASE_URL may be missing or wrong. Use Internal Database URL from your Render PostgreSQL.',
    });
  }
});

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
    const data = await dbProfit.getMonthlyProfitTrend(months);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Profit & loss for a calendar date range (revenue, COGS, expenses, net profit). */
app.get('/api/analytics/profit', async (req, res) => {
  try {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const { from, to } = req.query;
    if (!from || !to || !re.test(from) || !re.test(to)) {
      return res.status(400).json({ success: false, error: 'from and to required as YYYY-MM-DD' });
    }
    if (from > to) return res.status(400).json({ success: false, error: 'from must be <= to' });
    const data = await dbProfit.getProfitReport(from, to);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Monthly profit trend (revenue, COGS, expenses, net profit). */
app.get('/api/analytics/profit/monthly', async (req, res) => {
  try {
    const months = Math.min(24, Math.max(3, parseInt(req.query.months, 10) || 12));
    const data = await dbProfit.getMonthlyProfitTrend(months);
    res.json({ success: true, data });
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

app.get('/api/analytics/line-items', async (req, res) => {
  try {
    const days = Math.min(730, Math.max(7, parseInt(req.query.days, 10) || 90));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 7));
    const data = await db.getPaidInvoiceLineItemAggregates(days, limit);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Sales performance: services & products by range, staff table, attendance hints, top performer. */
app.get('/api/analytics/sales-performance', async (req, res) => {
  try {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const { from, to } = req.query;
    if (!from || !to || !re.test(from) || !re.test(to)) {
      return res.status(400).json({ success: false, error: 'from and to required as YYYY-MM-DD' });
    }
    if (from > to) return res.status(400).json({ success: false, error: 'from must be <= to' });
    const limit = Math.min(60, Math.max(7, parseInt(req.query.limit, 10) || 40));

    const [lineItems, revenueTotals, staffSales, staffDailyRows, attendance] = await Promise.all([
      db.getPaidLineItemAggregatesByDateRange(from, to, limit),
      db.getLineItemRevenueTotalsByDateRange(from, to),
      db.getStaffSalesByDateRange(from, to),
      db.getStaffDailySalesByDateRange(from, to),
      db.getStaffAttendanceSummaryByDateRange(from, to),
    ]);

    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const withRanking = staffSales.map((s) => ({
      ...s,
      rankingTotal: round2((Number(s.serviceSales) || 0) + (Number(s.productSales) || 0)),
    }));
    /** Sort: higher service+product revenue first; ties broken by membership line count (not membership ₹). */
    const compareStaffRank = (a, b) => {
      const moneyDiff = b.rankingTotal - a.rankingTotal;
      if (moneyDiff !== 0) return moneyDiff;
      const mc =
        (Number(b.membershipLineCount) || 0) - (Number(a.membershipLineCount) || 0);
      if (mc !== 0) return mc;
      return String(a.staffName).localeCompare(String(b.staffName));
    };
    const pool = withRanking.filter(
      (s) =>
        s.rankingTotal > 0 || (Number(s.membershipLineCount) || 0) > 0,
    );
    const sortedByRanking = [...pool].sort(compareStaffRank);
    const leader = sortedByRanking[0] || null;

    let topPerformer = null;
    if (leader) {
      topPerformer = {
        staffId: leader.staffId,
        staffName: leader.staffName,
        rankingTotal: leader.rankingTotal,
        totalSales: leader.totalSales,
        serviceSales: leader.serviceSales,
        productSales: leader.productSales,
        membershipSales: leader.membershipSales ?? 0,
        lineCount: leader.lineCount,
        serviceLineCount: leader.serviceLineCount ?? 0,
        productLineCount: leader.productLineCount ?? 0,
        membershipLineCount: leader.membershipLineCount ?? 0,
      };
    }

    res.json({
      success: true,
      data: {
        from,
        to,
        services: lineItems.services,
        products: lineItems.products,
        revenueTotals,
        staffSales,
        staffDailyRows,
        attendanceByStaff: attendance,
        topPerformer,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Daily breakdown: per date, per staff — service / product / membership sales (attributed lines). */
app.get('/api/analytics/staff-daily-sales', async (req, res) => {
  try {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const { from, to } = req.query;
    if (!from || !to || !re.test(from) || !re.test(to)) {
      return res.status(400).json({ success: false, error: 'from and to required as YYYY-MM-DD' });
    }
    if (from > to) return res.status(400).json({ success: false, error: 'from must be <= to' });
    const rows = await db.getStaffDailySalesByDateRange(from, to);
    res.json({ success: true, data: { from, to, rows } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/analytics/daily-reports', async (req, res) => {
  try {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const { from, to } = req.query;
    let data;
    if (from && to && re.test(from) && re.test(to)) {
      if (from > to) return res.status(400).json({ success: false, error: 'from must be <= to' });
      data = await db.getDailyReportsForDateRange(from, to);
    } else {
      const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
      data = await db.getDailyReports(days);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/analytics/daily-report', async (req, res) => {
  try {
    const date = req.query.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const report = await db.getDailyReport(date);
    if (!report) return res.status(400).json({ success: false, error: 'Invalid date (use YYYY-MM-DD)' });
    const expenses = await dbExpenses.getExpenses({ fromDate: date, toDate: date });
    const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    report.expenses = expensesTotal;
    report.net = Math.round((report.revenue - expensesTotal) * 100) / 100;
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Daily P&L-style line breakdown (services, prepaid uses, products, memberships, discounts, taxes). */
app.get('/api/analytics/daily-sheet', async (req, res) => {
  try {
    const date = req.query.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const data = await db.getDailySheetBreakdown(date);
    if (!data) return res.status(400).json({ success: false, error: 'Invalid date (use YYYY-MM-DD)' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- End of day (cash close) ---
// Returns the day's computed sheet + any saved close, so the screen can prefill.
app.get('/api/eod', async (req, res) => {
  try {
    const date = req.query.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const sheet = await db.getDailySheetBreakdown(date);
    if (!sheet) return res.status(400).json({ success: false, error: 'Invalid date (use YYYY-MM-DD)' });
    const close = await dbEod.getDailyClose(date);
    const audits = await dbEod.getCloseAudits(date);
    res.json({ success: true, data: { date, sheet, close, audits } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/eod/history', async (req, res) => {
  try {
    const data = await dbEod.getRecentDailyCloses(req.query.limit);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Close a day (locks it). A locked day must be reopened before it can change again.
// Money figures are recomputed server-side from the authoritative daily sheet.
app.post('/api/eod', async (req, res) => {
  try {
    const { date, openingFloat, countedCash, notes, closedBy } = req.body;
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!date || !re.test(date)) return res.status(400).json({ success: false, error: 'date required as YYYY-MM-DD' });
    const existing = await dbEod.getDailyClose(date);
    if (existing && existing.locked) {
      return res.status(409).json({ success: false, error: 'This day is closed and locked. Reopen it to make changes.' });
    }
    const sheet = await db.getDailySheetBreakdown(date);
    if (!sheet) return res.status(400).json({ success: false, error: 'Invalid date' });
    const f = sheet.footer || {};
    const saved = await dbEod.closeDay({
      closeDate: date,
      openingFloat: Number(openingFloat) || 0,
      countedCash: Number(countedCash) || 0,
      cashCollected: Number(f.cash) || 0,
      totalCollected: Number(f.collectedNewMoney ?? f.totalReceived) || 0,
      expenses: Number(f.expenses) || 0,
      notes,
      closedBy,
    });
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reopen a locked day for editing. Requires a reason; logged to the audit trail.
app.post('/api/eod/reopen', async (req, res) => {
  try {
    const { date, reason, reopenedBy } = req.body;
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!date || !re.test(date)) return res.status(400).json({ success: false, error: 'date required as YYYY-MM-DD' });
    if (!reason || !String(reason).trim()) return res.status(400).json({ success: false, error: 'A reason is required to reopen a closed day.' });
    const result = await dbEod.reopenDay({ closeDate: date, reason: String(reason).trim(), reopenedBy });
    if (result.error) return res.status(400).json({ success: false, error: result.error });
    res.json({ success: true, data: result.close });
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
      phone: process.env.BUSINESS_PHONE || '',
      email: process.env.BUSINESS_EMAIL || '',
      gstin: process.env.BUSINESS_GSTIN || '',
      state: process.env.BUSINESS_STATE || '',
    },
  });
});

// Resolve client build path (works for both local and Render)
const fs = require('fs');
const clientDistCandidates = [
  path.join(process.cwd(), 'client', 'dist'), // when started from repo root (Render)
  path.join(__dirname, '..', 'client', 'dist'),
  path.join(process.cwd(), '..', 'client', 'dist'),
];
const clientDist = clientDistCandidates.find((p) => fs.existsSync(p));

if (!clientDist) {
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
        email: 'GET /api/email/status',
        marketing: 'POST /api/marketing/send',
      },
    });
  });
}

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
    const {
      customerId,
      customer: newCustomerBody,
      appointmentDate,
      appointmentTime,
      services,
      serviceLines,
      totalAmount,
      notes,
      staffId,
    } = req.body;

    let resolvedCustomerId = null;
    const cid = customerId;
    if (cid != null && cid !== '' && Number.isFinite(Number(cid)) && Number(cid) > 0) {
      resolvedCustomerId = Number(cid);
    }

    let customerMatchNotice = null;
    if (
      !resolvedCustomerId &&
      newCustomerBody &&
      String(newCustomerBody.name || '').trim() &&
      String(newCustomerBody.phone || '').trim()
    ) {
      const requestedName = newCustomerBody.name.trim();
      const c = await db.findOrCreateCustomer({
        name: requestedName,
        phone: newCustomerBody.phone.trim(),
        gender: newCustomerBody.gender || null,
      });
      if (!c) {
        return res.status(400).json({
          success: false,
          error: 'Could not create customer. Enter name and a phone number with digits (e.g. 10-digit mobile).',
        });
      }
      resolvedCustomerId = c.id;
      const savedName = (c.name || '').trim();
      if (savedName.toLowerCase() !== requestedName.toLowerCase()) {
        customerMatchNotice =
          `This phone is already on file as "${savedName}". This appointment is linked to that customer. ` +
          `Update the name under Customers, or use a different phone for a new profile.`;
      }
    }

    if (!resolvedCustomerId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        error: 'Select an existing customer or enter name and phone for a new one; date and time are required',
      });
    }
    const hasServices =
      (Array.isArray(serviceLines) && serviceLines.some((L) => String(L?.name || '').trim())) ||
      (Array.isArray(services) && services.some((s) => String(s || '').trim()));
    if (!hasServices) {
      return res.status(400).json({ success: false, error: 'At least one service is required' });
    }
    try {
      assertAppointmentNotInPastIST(appointmentDate, appointmentTime);
    } catch (e) {
      if (e.code === 400) return res.status(400).json({ success: false, error: e.message });
      throw e;
    }
    const appt = await db.createAppointment({
      customerId: resolvedCustomerId,
      appointmentDate,
      appointmentTime,
      services,
      serviceLines,
      totalAmount,
      notes,
      staffId,
    });
    const customer = await db.getCustomerById(resolvedCustomerId);
    let staffName = null;
    if (staffId) {
      const st = await db.getStaffById(Number(staffId));
      staffName = st?.name || null;
    }
    let whatsappServiceLines = null;
    if (Array.isArray(appt.service_lines) && appt.service_lines.length > 0) {
      const ids = appt.service_lines.map((L) => L.staffId).filter(Boolean);
      const smap = await db.getStaffNameMap(ids);
      whatsappServiceLines = appt.service_lines.map((L) => ({
        name: L.name,
        staffName: L.staffId ? smap[Number(L.staffId)] ?? null : null,
      }));
    }
    if (customer?.phone && whatsapp.isConfigured()) {
      const r = await whatsapp.sendAppointmentConfirmation({
        customerPhone: customer.phone,
        customerName: customer.name,
        date: appointmentDate,
        time: appointmentTime,
        services: appt.services,
        serviceLines: whatsappServiceLines,
        staffName,
      });
      await db.logWhatsApp(customer.phone, 'appointment_confirmation', r.ok ? 'sent' : 'failed', r.error);
    }
    res.status(201).json({
      success: true,
      data: appt,
      ...(customerMatchNotice ? { customerMatchNotice } : {}),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/invoices', async (req, res) => {
  try {
    const { status, membership } = req.query;
    const filters = { status: status || undefined };
    if (membership === 'true' || membership === '1') filters.membershipOnly = true;
    const data = await db.getInvoices(filters);
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

app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    if (!Number.isFinite(invoiceId)) return res.status(400).json({ success: false, error: 'Invalid id' });
    const invoice = await db.getInvoiceById(invoiceId);
    if (!invoice) return res.status(404).json({ success: false, error: 'Not found' });
    const { invoiceToPdfBuffer, shopFromEnv } = require('./services/invoicePdf');
    const buf = await invoiceToPdfBuffer(invoice, shopFromEnv());
    const name = `${String(invoice.invoice_number || `invoice-${invoice.id}`).replace(/[^\w.-]+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const {
      customerId,
      customer,
      items,
      taxPercent,
      cgstPercent,
      sgstPercent,
      igstPercent,
      serviceTaxPercent,
      discountPercent,
      discountType,
      discountFixed,
      appointmentId,
      notes,
      staffId,
      sendWhatsApp,
      consumedProducts,
    } = req.body;
    const hasItems = Array.isArray(items) && items.length > 0 && items.some((i) => i?.service_name?.trim());
    if (!hasItems) {
      return res.status(400).json({ success: false, error: 'Add at least one service with a name (e.g. Hair Cut, Facial)' });
    }
    let resolvedCustomerId = customerId ? Number(customerId) : null;
    let customerMatchNotice = null;
    if (customer && String(customer.name || '').trim() && String(customer.phone || '').trim()) {
      const requestedName = customer.name.trim();
      const c = await db.findOrCreateCustomer({
        name: requestedName,
        phone: customer.phone.trim(),
        gender: customer.gender || null,
      });
      if (!c) return res.status(400).json({ success: false, error: 'Could not create or find customer. Enter name and a phone number with digits (e.g. 10-digit mobile).' });
      resolvedCustomerId = c.id;
      const savedName = (c.name || '').trim();
      if (savedName.toLowerCase() !== requestedName.toLowerCase()) {
        customerMatchNotice =
          `This phone is already on file as "${savedName}". This invoice is linked to that customer — you will not see "${requestedName}" as a separate person. ` +
          `Update the name under Customers, or use a different phone for a new profile.`;
      }
    }
    if (!resolvedCustomerId) {
      return res.status(400).json({ success: false, error: 'Select an existing customer or enter name and phone for a new one' });
    }
    const data = await db.createInvoice({
      customerId: Number(resolvedCustomerId),
      items,
      taxPercent: taxPercent ?? 5,
      cgstPercent,
      sgstPercent,
      igstPercent,
      serviceTaxPercent,
      discountPercent: discountPercent ?? 0,
      discountType: discountType === 'fixed' ? 'fixed' : 'percent',
      discountFixed: discountFixed ?? 0,
      appointmentId,
      notes,
      staffId: staffId ? Number(staffId) : null,
    });

    for (const item of items || []) {
      const name = String(item.service_name || '').trim();
      if (!name) continue;
      try {
        const lineKind = item.lineKind || '';
        const serviceMode = item.serviceMode || '';
        const productMode = item.productMode || '';
        const syncCustomProduct =
          lineKind === 'product' && productMode === 'custom' && /^\[Product\]/i.test(name);
        const syncPackage = lineKind === 'package';
        const syncCustomService =
          lineKind === 'service' &&
          serviceMode === 'custom' &&
          !name.startsWith('[') &&
          !/^gift\s*card$/i.test(name);
        const legacy =
          item.syncNewToCatalog === true &&
          (item.syncTarget === 'product' || item.syncTarget === 'package' || item.syncTarget === 'service');
        const legacyProduct = legacy && item.syncTarget === 'product';
        const legacyPackage = legacy && item.syncTarget === 'package';
        const legacyService =
          legacy &&
          item.syncTarget === 'service' &&
          !name.startsWith('[') &&
          !/^gift\s*card$/i.test(name);

        if (syncCustomProduct || legacyProduct) {
          await dbInventory.upsertProductFromInvoiceLine(item.service_name, item.unit_price);
        } else if (syncPackage || legacyPackage) {
          await dbCatalog.upsertServiceFromInvoiceLine({
            name,
            price: item.unit_price,
            category: 'Package',
          });
        } else if (syncCustomService || legacyService) {
          await dbCatalog.upsertServiceFromInvoiceLine({
            name,
            price: item.unit_price,
            category: 'Combo',
          });
        }
      } catch (syncErr) {
        console.error('[Invoice] Catalog sync failed:', name, syncErr.message);
      }
    }

    if (Array.isArray(consumedProducts) && consumedProducts.length > 0) {
      try {
        await dbInventory.addConsumedProducts(data.id, consumedProducts);
      } catch (consumeErr) {
        console.error('[Invoice] Saving consumed products failed:', consumeErr.message);
      }
    }

    const membershipAssignWarnings = [];
    const assignedMembershipRows = [];
    const cid = Number(resolvedCustomerId);
    for (const item of items) {
      const rawPid = item?.membership_plan_id;
      const pid = rawPid != null && rawPid !== '' ? Number(rawPid) : NaN;
      if (!Number.isFinite(pid) || pid <= 0) continue;
      const plan = await db.getMembershipPlanById(pid);
      if (!plan) {
        membershipAssignWarnings.push({ planId: pid, error: 'Plan not found' });
        continue;
      }
      const qty = Number(item.quantity) || 1;
      const lineTotal = Math.round(Number(item.unit_price || 0) * qty * 100) / 100;
      const catalogCredit = Number(plan.special_price ?? plan.price) || 0;
      const creditAmount = lineTotal > 0 ? lineTotal : catalogCredit;
      try {
        const membershipRow = await db.assignMembershipToCustomer({
          customerId: cid,
          planId: pid,
          startDate: null,
          endDate: null,
          notes: `Purchased on invoice ${data.invoice_number}`,
          creditAmount,
        });
        assignedMembershipRows.push(membershipRow);
      } catch (assignErr) {
        console.error('[Invoice] Membership assignment failed:', assignErr.message);
        membershipAssignWarnings.push({ planId: pid, error: assignErr.message });
      }
    }

    // Same invoice: pay membership only; today's services/products consume from the newly credited wallet.
    if (assignedMembershipRows.length > 0 && db.isMembershipBundleInvoiceItems(items)) {
      let remainingToRedeem = Math.round(db.getNonMembershipLinesTotal(items) * 100) / 100;
      if (remainingToRedeem > 0) {
        let firstServiceStaffId = null;
        for (const it of items) {
          if (db.isInvoiceItemMembershipLine(it)) continue;
          const sid = it.staff_id != null && it.staff_id !== '' ? Number(it.staff_id) : null;
          if (Number.isFinite(sid) && sid > 0) {
            firstServiceStaffId = sid;
            break;
          }
        }
        let staffForRedemption = null;
        if (firstServiceStaffId) {
          const st = await db.getStaffById(firstServiceStaffId);
          if (st) staffForRedemption = firstServiceStaffId;
        }
        for (const m of assignedMembershipRows) {
          if (remainingToRedeem <= 0) break;
          const bal = Math.round(Number(m.remaining_balance) * 100) / 100;
          const take = Math.min(remainingToRedeem, bal);
          if (take <= 0) continue;
          const runRedemption = async (sid) => {
            await dbMembership.recordMembershipRedemption({
              customerMembershipId: m.id,
              invoiceId: data.id,
              amountRedeemed: take,
              discountPercent: 0,
              staffId: sid,
            });
          };
          try {
            await runRedemption(staffForRedemption);
            remainingToRedeem = Math.round((remainingToRedeem - take) * 100) / 100;
          } catch (redeemErr) {
            if (staffForRedemption) {
              try {
                await runRedemption(null);
                remainingToRedeem = Math.round((remainingToRedeem - take) * 100) / 100;
              } catch (redeemErr2) {
                console.error('[Invoice] Bundle membership redemption failed:', redeemErr2.message);
                membershipAssignWarnings.push({ planId: m.plan_id, error: `Redemption: ${redeemErr2.message}` });
              }
            } else {
              console.error('[Invoice] Bundle membership redemption failed:', redeemErr.message);
              membershipAssignWarnings.push({ planId: m.plan_id, error: `Redemption: ${redeemErr.message}` });
            }
          }
        }
      }
    }

    const userWantedWhatsApp = sendWhatsApp !== false;
    let whatsappSent = null;
    let whatsappError = null;

    if (data.customer_phone && whatsapp.isConfigured() && userWantedWhatsApp) {
      try {
        const r = await whatsapp.sendInvoiceBill({
          customerPhone: data.customer_phone,
          customerName: data.customer_name,
          invoiceNumber: data.invoice_number,
          items: data.items || [],
          total: data.total,
          businessName: process.env.BUSINESS_NAME,
        });
        await db.logWhatsApp(data.customer_phone, 'invoice_bill', r.ok ? 'sent' : 'failed', r.error);
        whatsappSent = r.ok;
        whatsappError = r.ok ? null : (r.error || 'Failed');
        if (!r.ok) console.log('[WhatsApp] Invoice bill failed:', r.error, '| to:', data.customer_phone);
        else console.log('[WhatsApp] Invoice bill sent to', data.customer_phone);
      } catch (err) {
        await db.logWhatsApp(data.customer_phone, 'invoice_bill', 'failed', err.message);
        whatsappSent = false;
        whatsappError = err.message;
        console.log('[WhatsApp] Invoice bill error:', err.message);
      }
    } else if (userWantedWhatsApp && !data.customer_phone) {
      whatsappError = 'No phone number';
    } else if (userWantedWhatsApp && data.customer_phone && !whatsapp.isConfigured()) {
      whatsappError = 'WhatsApp not configured';
    }

    const whatsappFeedback = userWantedWhatsApp
      ? { whatsappSent, whatsappError }
      : {};

    res.status(201).json({
      success: true,
      data: {
        ...data,
        ...whatsappFeedback,
        ...(customerMatchNotice ? { customerMatchNotice } : {}),
        ...(membershipAssignWarnings.length ? { membershipAssignWarnings } : {}),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/invoices/:id/pay', async (req, res) => {
  try {
    const { paymentMethod, staffId, membershipId, secondaryPaymentMethod, primaryAmount, secondaryAmount } = req.body;
    const invoiceId = Number(req.params.id);
    const invoice = await db.getInvoiceById(invoiceId);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ success: false, error: 'Invoice already paid' });

    const total = Number(invoice.total) || 0;
    const tenderMethods = ['cash', 'upi', 'card'];

    let amountFromMembership = 0;
    let finalPaymentMethod = normalizeInvoicePayMethod(paymentMethod) || 'cash';
    let secMethodOut = null;
    let paymentSplitByMethod = null;

    if (finalPaymentMethod === 'membership') {
      let activeMembership;
      if (membershipId) {
        activeMembership = await db.getMembershipByIdAndCustomer(Number(membershipId), invoice.customer_id);
        if (!activeMembership) {
          activeMembership = await db.getMembershipByIdAndCustomerAllowZeroBalance(Number(membershipId), invoice.customer_id);
          if (activeMembership) activeMembership = await db.repairMembershipBalanceIfNeeded(activeMembership);
        }
        if (!activeMembership) return res.status(400).json({ success: false, error: 'Invalid membership ID or membership does not belong to this customer.' });
      } else {
        activeMembership = await db.getActiveMembershipForCustomer(invoice.customer_id);
        if (!activeMembership) return res.status(400).json({ success: false, error: 'No active membership with balance for this customer' });
      }
      const balance = Number(activeMembership.remaining_balance) || 0;
      if (balance <= 0) return res.status(400).json({ success: false, error: 'Membership has no remaining balance.' });
      amountFromMembership = Math.min(balance, total);
      const remainder = Math.round((total - amountFromMembership) * 100) / 100;
      if (remainder > 0) {
        secMethodOut = normalizeInvoicePayMethod(secondaryPaymentMethod);
        if (!tenderMethods.includes(secMethodOut)) {
          return res.status(400).json({
            success: false,
            error: `Membership balance (₹${balance.toFixed(2)}) covers ₹${amountFromMembership.toFixed(2)}. Pay remaining ₹${remainder.toFixed(2)} via Cash, UPI, or Card.`,
          });
        }
        finalPaymentMethod = `membership+${secMethodOut}`;
      }
      const commissionPct = activeMembership.staff_commission_percent ?? 5;
      await dbMembership.recordMembershipRedemption({
        customerMembershipId: activeMembership.id,
        invoiceId,
        amountRedeemed: amountFromMembership,
        discountPercent: 0,
        staffId: staffId ? Number(staffId) : null,
        staffIncentivePercent: commissionPct,
      });
    } else {
      const secRaw = String(secondaryPaymentMethod || '').trim();
      if (secRaw) {
        secMethodOut = normalizeInvoicePayMethod(secondaryPaymentMethod);
        if (!tenderMethods.includes(finalPaymentMethod) || !tenderMethods.includes(secMethodOut)) {
          return res.status(400).json({ success: false, error: 'Split payment: choose two of Cash, UPI, or Card.' });
        }
        if (finalPaymentMethod === secMethodOut) {
          return res.status(400).json({ success: false, error: 'Use two different payment methods for a split payment.' });
        }
        const aPaise = Math.round(Number(primaryAmount) * 100);
        const bPaise = Math.round(Number(secondaryAmount) * 100);
        const totalPaise = Math.round(total * 100);
        if (!Number.isFinite(aPaise) || !Number.isFinite(bPaise) || aPaise <= 0 || bPaise <= 0) {
          return res.status(400).json({ success: false, error: 'Enter the amount for each part of the payment.' });
        }
        if (aPaise + bPaise !== totalPaise) {
          return res.status(400).json({
            success: false,
            error: `Amounts must add up to ₹${(totalPaise / 100).toFixed(2)} (exact invoice total). You entered ₹${((aPaise + bPaise) / 100).toFixed(2)}.`,
          });
        }
        paymentSplitByMethod = {
          [finalPaymentMethod]: aPaise / 100,
          [secMethodOut]: bPaise / 100,
        };
      } else if (!tenderMethods.includes(finalPaymentMethod)) {
        return res.status(400).json({ success: false, error: 'Invalid payment method.' });
      }
    }

    const updated = await db.markInvoicePaid(invoiceId, finalPaymentMethod, {
      amountFromMembership,
      secondaryPaymentMethod: secMethodOut,
      paymentSplitByMethod,
    });

    // Deduct stock for sold retail products and products consumed delivering services.
    try {
      await dbInventory.deductInvoiceStock(invoiceId);
    } catch (stockErr) {
      console.error('[Invoice] Stock deduction failed:', stockErr.message);
    }

    const customer = await db.getCustomerById(updated.customer_id);
    if (customer?.phone && whatsapp.isConfigured()) {
      const r = await whatsapp.sendPaymentReceipt({
        customerPhone: customer.phone,
        customerName: updated.customer_name,
        invoiceNumber: updated.invoice_number,
        amount: updated.total,
      });
      await db.logWhatsApp(customer.phone, 'payment_receipt', r.ok ? 'sent' : 'failed', r.error);
      if (r.ok) console.log('[WhatsApp] Payment receipt sent to', customer.phone);
      else console.error('[WhatsApp] Payment receipt failed:', r.error);
    }

    if (invoiceEmail.isNotifyReady()) {
      const paidSnapshot = updated;
      setImmediate(() => {
        invoiceEmail.sendPaidInvoiceAdminNotify(paidSnapshot).then((er) => {
          if (er.skipped) return;
          if (er.ok) console.log('[Invoice email] Admin notify sent for paid', paidSnapshot.invoice_number);
          else console.error('[Invoice email] Failed:', er.error);
        }).catch((err) => console.error('[Invoice email] Error:', err.message));
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const data = await dbCatalog.getServices(req.query);
    res.json({ success: true, data: dbCatalog.mergeServicesWithSeedForQuickPick(data) });
  } catch {
    res.json({ success: true, data: require('./data/services') });
  }
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

app.get('/api/staff/work-history', async (req, res) => {
  try {
    const staffId = req.query.staffId ? Number(req.query.staffId) : null;
    const from = req.query.from || null;
    const to = req.query.to || null;
    const data = await db.getStaffWorkHistory({ staffId, from, to });
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
    const { name, durationDays, price, benefits, discountPercent, applyAtCheckout, specialPrice } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Plan name required' });
    const data = await db.createMembershipPlan({ name, durationDays: durationDays ?? 30, price: price ?? 0, benefits, discountPercent, applyAtCheckout, specialPrice });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/membership-plans/:id', async (req, res) => {
  try {
    const { name, durationDays, price, benefits, isActive, discountPercent, applyAtCheckout, specialPrice } = req.body;
    const data = await db.updateMembershipPlan(Number(req.params.id), { name, durationDays, price, benefits, isActive, discountPercent, applyAtCheckout, specialPrice });
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
    const { customerId, planId, startDate, notes } = req.body;
    if (!customerId || !planId) {
      return res.status(400).json({ success: false, error: 'Select both a customer and a plan.' });
    }
    const plan = await db.getMembershipPlanById(Number(planId));
    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });
    const creditAmount = Number(plan.special_price ?? plan.price) || 0;
    const data = await db.assignMembershipToCustomer({
      customerId: Number(customerId),
      planId: Number(planId),
      startDate: startDate || null,
      endDate: null,
      notes,
      creditAmount,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Inventory ---
app.get('/api/inventory/suppliers', async (req, res) => {
  try {
    const data = await dbInventory.getSuppliers();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/inventory/suppliers', async (req, res) => {
  try {
    const { name, contact, email, phone, address, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Supplier name required' });
    const data = await dbInventory.createSupplier({ name, contact, email, phone, address, notes });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/inventory/suppliers/:id', async (req, res) => {
  try {
    const data = await dbInventory.updateSupplier(Number(req.params.id), req.body);
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/inventory/products', async (req, res) => {
  try {
    const data = await dbInventory.getProducts(req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/inventory/products/low-stock', async (req, res) => {
  try {
    const data = await dbInventory.getLowStockProducts();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/inventory/products/:id', async (req, res) => {
  try {
    const data = await dbInventory.getProductById(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/inventory/products', async (req, res) => {
  try {
    const { name, sku, category, unit, costPrice, sellingPrice, quantity, lowStockThreshold, supplierId } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Product name required' });
    const data = await dbInventory.createProduct({ name, sku, category, unit, costPrice, sellingPrice, quantity, lowStockThreshold, supplierId });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/inventory/products/:id', async (req, res) => {
  try {
    const { name, sku, category, unit, costPrice, sellingPrice, quantity, lowStockThreshold, supplierId, isActive } = req.body;
    const data = await dbInventory.updateProduct(Number(req.params.id), { name, sku, category, unit, costPrice, sellingPrice, quantity, lowStockThreshold, supplierId, isActive });
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/inventory/products/:id/adjust', async (req, res) => {
  try {
    const { quantityChange, reason, referenceType, referenceId } = req.body;
    if (quantityChange == null) return res.status(400).json({ success: false, error: 'quantityChange required' });
    const data = await dbInventory.adjustProductStock(Number(req.params.id), Number(quantityChange), reason, referenceType, referenceId);
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/inventory/products/:id/movements', async (req, res) => {
  try {
    const data = await dbInventory.getProductMovements(Number(req.params.id), 50);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Digital Catalog ---
app.get('/api/catalog/services', async (req, res) => {
  try {
    const data = await dbCatalog.getServices(req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/catalog/services/categories', async (req, res) => {
  try {
    const data = await dbCatalog.getServiceCategories();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/catalog/services', async (req, res) => {
  try {
    const { name, category, price, durationMins, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Service name required' });
    const data = await dbCatalog.createService({ name, category, price, durationMins, description });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/catalog/services/:id', async (req, res) => {
  try {
    const { name, category, price, durationMins, description, isActive } = req.body;
    const data = await dbCatalog.updateService(Number(req.params.id), { name, category, price, durationMins, description, isActive });
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/catalog/promotions', async (req, res) => {
  try {
    const data = await dbCatalog.getPromotions(req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/catalog/promotions', async (req, res) => {
  try {
    const { name, description, discountType, discountValue, minPurchase, startDate, endDate } = req.body;
    if (!name?.trim() || !startDate || !endDate) return res.status(400).json({ success: false, error: 'Name, startDate, endDate required' });
    const data = await dbCatalog.createPromotion({ name, description, discountType, discountValue, minPurchase, startDate, endDate });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/catalog/promotions/:id', async (req, res) => {
  try {
    const data = await dbCatalog.updatePromotion(Number(req.params.id), req.body);
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- CRM ---
app.get('/api/crm/customers/:id', async (req, res) => {
  try {
    const data = await dbCrm.getCustomer360(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/crm/customers/:id/preferences', async (req, res) => {
  try {
    const data = await dbCrm.getCustomerPreferences(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/crm/customers/:id/preferences', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key?.trim()) return res.status(400).json({ success: false, error: 'key required' });
    await dbCrm.setCustomerPreference(Number(req.params.id), key.trim(), value ?? '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/crm/customers/:id/tags', async (req, res) => {
  try {
    const data = await dbCrm.getCustomerTags(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/crm/customers/:id/tags', async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag?.trim()) return res.status(400).json({ success: false, error: 'tag required' });
    await dbCrm.addCustomerTag(Number(req.params.id), tag);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/crm/customers/:id/tags/:tag', async (req, res) => {
  try {
    await dbCrm.removeCustomerTag(Number(req.params.id), req.params.tag);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/crm/customers/:id/notes', async (req, res) => {
  try {
    const data = await dbCrm.getCustomerNotes(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/crm/customers/:id/notes', async (req, res) => {
  try {
    const { note, staffId } = req.body;
    if (!note?.trim()) return res.status(400).json({ success: false, error: 'note required' });
    const data = await dbCrm.addCustomerNote(Number(req.params.id), note, staffId || null);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Staff Management ---
app.get('/api/staff/shifts', async (req, res) => {
  try {
    const data = await dbStaffMgmt.getStaffShifts(req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/staff/shifts', async (req, res) => {
  try {
    const { staffId, shiftDate, startTime, endTime, breakMinutes, notes } = req.body;
    if (!staffId || !shiftDate || !startTime || !endTime) return res.status(400).json({ success: false, error: 'staffId, shiftDate, startTime, endTime required' });
    const data = await dbStaffMgmt.createStaffShift({ staffId, shiftDate, startTime, endTime, breakMinutes, notes });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/staff/shifts/:id', async (req, res) => {
  try {
    await dbStaffMgmt.deleteStaffShift(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/staff/attendance', async (req, res) => {
  try {
    const data = await dbStaffMgmt.getStaffAttendance(req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/staff/attendance', async (req, res) => {
  try {
    const { staffId, attendanceDate, checkIn, checkOut, status, notes } = req.body;
    if (!staffId || !attendanceDate) return res.status(400).json({ success: false, error: 'staffId, attendanceDate required' });
    const data = await dbStaffMgmt.upsertStaffAttendance({ staffId, attendanceDate, checkIn, checkOut, status, notes });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/staff/goals', async (req, res) => {
  try {
    const data = await dbStaffMgmt.getStaffGoals(req.query.staffId ? Number(req.query.staffId) : null);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/staff/goals', async (req, res) => {
  try {
    const { staffId, periodType, periodValue, targetAmount, targetCount } = req.body;
    if (!staffId || !periodValue) return res.status(400).json({ success: false, error: 'staffId, periodValue required' });
    const data = await dbStaffMgmt.upsertStaffGoal({ staffId, periodType, periodValue, targetAmount, targetCount });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/membership/active', async (req, res) => {
  try {
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    if (!customerId) return res.status(400).json({ success: false, error: 'customerId required' });
    const data = await db.getActiveMembershipForCustomer(customerId);
    res.json({ success: true, data: data || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/membership/for-customer', async (req, res) => {
  try {
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    if (!customerId) return res.status(400).json({ success: false, error: 'customerId required' });
    const data = await db.getLatestMembershipForCustomer(customerId);
    res.json({ success: true, data: data || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/membership/redemptions/:customerMembershipId', async (req, res) => {
  try {
    const data = await dbMembership.getMembershipRedemptions(Number(req.params.customerMembershipId));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/membership/expiring-soon', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const data = await dbMembership.getMembershipsExpiringSoon(days);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/membership/send-expiry-reminders', async (req, res) => {
  try {
    const days = parseInt(req.body.days, 10) || 7;
    const list = await dbMembership.getMembershipsExpiringSoon(days);
    const sent = [];
    const failed = [];
    for (const m of list) {
      const already = await dbMembership.getReminderSent(m.id, 'expiry');
      if (already || !m.customer_phone?.trim()) continue;
      const daysLeft = Math.ceil((new Date(m.end_date) - new Date()) / (1000 * 60 * 60 * 24));
      const r = await whatsapp.sendMembershipExpiryReminder({
        customerPhone: m.customer_phone,
        customerName: m.customer_name,
        planName: m.plan_name,
        endDate: m.end_date,
        daysLeft,
      });
      if (r.ok) {
        await dbMembership.markReminderSent(m.id, 'expiry');
        sent.push({ id: m.id, customer: m.customer_name });
      } else {
        failed.push({ id: m.id, customer: m.customer_name, error: r.error });
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    res.json({ success: true, data: { sent, failed, total: list.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/membership/renew/:id', async (req, res) => {
  try {
    const extendDays = req.body.extendDays ? parseInt(req.body.extendDays, 10) : null;
    const data = await dbMembership.renewMembership(Number(req.params.id), extendDays);
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/membership/upgrade/:id', async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ success: false, error: 'planId required' });
    const data = await dbMembership.upgradeMembership(Number(req.params.id), Number(planId));
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/membership/top-up/:id', async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'amount required and must be positive' });
    const data = await dbMembership.topUpMembership(Number(req.params.id), amount);
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
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

app.get('/api/analytics/clients/summary', async (req, res) => {
  try {
    const data = await db.getClientInsightsSummary();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Debug: inspect invoice dates for a month (helps diagnose Feb showing 0)
app.get('/api/analytics/clients/debug', async (req, res) => {
  try {
    const month = req.query.month || istMonthStr();
    const startDate = `${month}-01`;
    const endDate = lastDayOfMonthYmd(month);
    const r = await db.pool.query(
      `SELECT id, invoice_number, invoice_date, created_at,
        (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date AS created_ist,
        (created_at AT TIME ZONE 'Asia/Kolkata')::date AS created_local
       FROM invoices
       WHERE invoice_date >= $1 AND invoice_date <= $2
          OR (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= $1 AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= $2
          OR (created_at AT TIME ZONE 'Asia/Kolkata')::date >= $1 AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= $2
       ORDER BY id LIMIT 20`,
      [startDate, endDate]
    );
    res.json({ success: true, month, startDate, endDate, count: r.rows.length, sample: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Debug: see raw invoice dates for a month (helps diagnose Feb showing 0)
app.get('/api/analytics/clients/debug', async (req, res) => {
  try {
    const month = req.query.month || istMonthStr();
    const startDate = `${month}-01`;
    const endDate = lastDayOfMonthYmd(month);
    const r = await db.pool.query(
      `SELECT id, invoice_number, invoice_date, created_at,
        (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date AS created_ist,
        (created_at AT TIME ZONE 'Asia/Kolkata')::date AS created_local
       FROM invoices
       WHERE invoice_date >= $1 AND invoice_date <= $2
          OR (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= $1 AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= $2
          OR (created_at AT TIME ZONE 'Asia/Kolkata')::date >= $1 AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= $2`,
      [startDate, endDate]
    );
    res.json({ success: true, month, startDate, endDate, count: r.rows.length, invoices: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Debug: see raw invoice dates for a month (helps diagnose Feb showing 0)
app.get('/api/analytics/clients/debug', async (req, res) => {
  try {
    const month = req.query.month || istMonthStr();
    const startDate = `${month}-01`;
    const endDate = lastDayOfMonthYmd(month);
    const r = await db.pool.query(
      `SELECT id, invoice_number, invoice_date, created_at,
        (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date AS created_utc_ist,
        (created_at AT TIME ZONE 'Asia/Kolkata')::date AS created_local
       FROM invoices
       WHERE invoice_date >= $1 AND invoice_date <= $2
          OR (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= $1 AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= $2
          OR (created_at AT TIME ZONE 'Asia/Kolkata')::date >= $1 AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= $2`,
      [startDate, endDate]
    );
    res.json({ success: true, month, startDate, endDate, count: r.rows.length, invoices: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Debug: see raw invoice dates for a month (helps diagnose Feb showing 0)
app.get('/api/analytics/clients/debug', async (req, res) => {
  try {
    const month = req.query.month || istMonthStr();
    const startDate = `${month}-01`;
    const endDate = lastDayOfMonthYmd(month);
    const { pool } = require('./database');
    const r = await pool.query(
      `SELECT id, invoice_number, invoice_date, created_at,
        (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date AS created_ist,
        (created_at AT TIME ZONE 'Asia/Kolkata')::date AS created_local
       FROM invoices
       WHERE invoice_date >= $1 AND invoice_date <= $2
          OR (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date >= $1 AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date <= $2
          OR (created_at AT TIME ZONE 'Asia/Kolkata')::date >= $1 AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= $2`,
      [startDate, endDate]
    );
    res.json({ success: true, month, startDate, endDate, count: r.rows.length, invoices: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/whatsapp/status', (req, res) => {
  res.json(whatsapp.getWhatsAppStatus());
});

app.get('/api/email/status', (req, res) => {
  res.json(invoiceEmail.getNotifyStatus());
});

app.get('/api/email/status', (req, res) => {
  res.json(invoiceEmail.getNotifyStatus());
});

app.get('/api/whatsapp/logs', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const logs = await db.getWhatsAppLogs(limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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

// --- Expenses ---
app.get('/api/expenses', async (req, res) => {
  try {
    const { type, fromDate, toDate } = req.query;
    const data = await dbExpenses.getExpenses({
      type: type || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/expenses/categories', (req, res) => {
  res.json({
    success: true,
    data: { fixed: dbExpenses.FIXED_CATEGORIES, daily: dbExpenses.DAILY_CATEGORIES },
  });
});

app.get('/api/expenses/summary', async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const data = await dbExpenses.getExpenseSummary({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const { type, category, amount, expenseDate, notes } = req.body;
    if (!category?.trim()) return res.status(400).json({ success: false, error: 'Category is required' });
    if (!amount && amount !== 0) return res.status(400).json({ success: false, error: 'Amount is required' });
    const data = await dbExpenses.createExpense({
      type: type || 'daily',
      category: category.trim(),
      amount: Number(amount),
      expenseDate: expenseDate || todayIST(),
      notes: notes?.trim() || null,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { type, category, amount, expenseDate, notes } = req.body;
    const data = await dbExpenses.updateExpense(Number(req.params.id), {
      type,
      category,
      amount: amount != null ? Number(amount) : undefined,
      expenseDate,
      notes,
    });
    if (!data) return res.status(404).json({ success: false, error: 'Expense not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const deleted = await dbExpenses.deleteExpense(Number(req.params.id));
    if (!deleted) return res.status(404).json({ success: false, error: 'Expense not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve React app + SPA fallback (must be last, after all API routes)
if (clientDist) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = process.env.NODE_ENV === 'test' ? null : app.listen(PORT, () => {
  console.log(`Salon Billing API at http://localhost:${PORT}`);
  const emailStatus = invoiceEmail.getNotifyStatus();
  if (emailStatus.recipients.length > 0) {
    const via = emailStatus.ready
      ? `${emailStatus.provider} ready (email when invoice marked paid)`
      : `incomplete (${emailStatus.missing.join('; ')})`;
    console.log(`[Invoice email] Notify → ${emailStatus.recipients.join(', ')} | ${via}`);
  }

  const waStatus = whatsapp.getWhatsAppStatus();
  if (waStatus.configured) {
    console.log(
      `[WhatsApp] Ready | bill=${waStatus.billTemplate} payment=${waStatus.paymentTemplate}`,
    );
  } else if (waStatus.missing.length) {
    console.log(`[WhatsApp] Not configured (${waStatus.missing.join(', ')})`);
  }
});

module.exports = { app, server };
