require('dotenv').config();
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

app.post('/api/invoices', async (req, res) => {
  try {
    const { customerId, customer, items, taxPercent, appointmentId, notes, staffId } = req.body;
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
      staffId: staffId ? Number(staffId) : null,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/invoices/:id/pay', async (req, res) => {
  try {
    const { paymentMethod, staffId, membershipId, secondaryPaymentMethod } = req.body;
    const invoiceId = Number(req.params.id);
    const invoice = await db.getInvoiceById(invoiceId);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ success: false, error: 'Invoice already paid' });

    const total = Number(invoice.total) || 0;
    let amountFromMembership = 0;
    let finalPaymentMethod = paymentMethod || 'cash';

    if ((paymentMethod || '').toLowerCase() === 'membership') {
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
      const remainder = total - amountFromMembership;
      if (remainder > 0) {
        const secondary = (secondaryPaymentMethod || '').trim().toLowerCase();
        if (!['cash', 'upi', 'card'].includes(secondary)) {
          return res.status(400).json({
            success: false,
            error: `Membership balance (₹${balance.toFixed(2)}) covers ₹${amountFromMembership.toFixed(2)}. Pay remaining ₹${remainder.toFixed(2)} via Cash, UPI, or Card.`,
          });
        }
        finalPaymentMethod = `membership+${secondary}`;
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
    }

    const updated = await db.markInvoicePaid(invoiceId, finalPaymentMethod, {
      amountFromMembership: amountFromMembership > 0 ? amountFromMembership : 0,
      secondaryPaymentMethod: amountFromMembership > 0 && total > amountFromMembership ? secondaryPaymentMethod : null,
    });
    const customer = await db.getCustomerById(updated.customer_id);
    if (customer?.phone && whatsapp.isConfigured()) {
      const r = await whatsapp.sendPaymentReceipt({
        customerPhone: customer.phone,
        customerName: updated.customer_name,
        invoiceNumber: updated.invoice_number,
        amount: updated.total,
      });
      await db.logWhatsApp(customer.phone, 'payment_receipt', r.ok ? 'sent' : 'failed', r.error);
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const data = await dbCatalog.getServices(req.query);
    res.json({ success: true, data: data?.length ? data : require('./data/services') });
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
      expenseDate: expenseDate || new Date().toISOString().slice(0, 10),
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

app.listen(PORT, () => {
  console.log(`Salon Billing API at http://localhost:${PORT}`);
});
