# You and I Salon – Feature Implementation Plan

This document outlines the implementation plan for the six feature areas.

---

## 1. Inventory Management

**Goal:** Track stock levels in real-time, low-stock alerts, reduce wastage, manage orders, link to billing.

### Database
- `products` – name, sku, category, unit, cost_price, selling_price, quantity, low_stock_threshold
- `product_movements` – in/out/adjustment with reason, reference (invoice_id, order_id)
- `suppliers` – name, contact, email
- `purchase_orders` – supplier, status, total
- `purchase_order_items` – product, quantity, unit_price
- Link `invoice_items` to `product_id` (optional) for auto stock deduction

### API
- CRUD: products, suppliers, purchase orders
- Stock in/out/adjustment endpoints
- Low-stock list & alerts
- Movement history

### UI
- Products list with search, filters, quantity
- Low-stock alert banner/card
- Add/Edit product form
- Stock adjustment modal
- Purchase order creation
- Movement history

---

## 2. Digital Catalog

**Goal:** Manage services, products, and promotions in one interactive catalog.

### Database
- `services` – name, category, price, duration_mins, description, is_active (migrate from static file)
- `catalog_promotions` – name, description, discount_type, discount_value, start_date, end_date
- `catalog_items` – polymorphic link (service_id or product_id) for catalog display

### API
- CRUD: services, promotions
- Public catalog endpoint (for sharing/embedding)
- Catalog by category

### UI
- Catalog page: services + products + promotions
- Category tabs or sidebar
- Add/Edit service, product, promotion
- Promo cards with validity
- Optional: shareable public catalog URL

---

## 3. CRM

**Goal:** 360° client view, history, preferences, personalization, retention, loyalty.

### Database
- `customer_preferences` – key-value (preferred_stylist, allergies, etc.)
- `customer_tags` – tags for segmentation
- `customer_notes` – notes with staff_id, created_at
- Use existing: customers, invoices, appointments

### API
- Customer profile with full history
- Invoices, appointments, notes, preferences, tags
- Client segmentation by tags/lifetime value
- Quick stats: total spend, visit count, last visit

### UI
- Client 360° profile page
- Timeline: appointments, invoices, notes
- Preferences & tags
- Add note, edit preferences
- Filter clients by tag, LTV, last visit

---

## 4. Staff Management

**Goal:** Shifts, attendance, goals, calendar, auto incentives.

### Database
- `staff_shifts` – staff_id, date, start_time, end_time, break_minutes
- `staff_attendance` – staff_id, date, check_in, check_out, status
- `staff_goals` – staff_id, period (monthly), target_amount, target_count
- `staff_commission_rules` – staff_id, service_category, percent
- `staff_incentives` – staff_id, period, amount, type

### API
- CRUD: shifts, attendance, goals, commission rules
- Incentive calculation endpoint
- Staff calendar (shifts + appointments)
- Attendance report

### UI
- Staff calendar
- Shift scheduler
- Attendance (check-in/out)
- Goals & performance
- Commission rules
- Incentive dashboard

---

## 5. Membership

**Goal:** Special rewards, packages, auto-apply benefits at checkout.

### Database (extend existing)
- Add to `membership_plans`: discount_percent, apply_at_checkout, package_services (JSON)
- Add to `customer_memberships`: usage_count, benefits_used
- Optional: `membership_benefits` – plan_id, benefit_type, value

### API
- Check active membership for customer
- Apply membership discount at invoice creation
- Membership usage tracking

### UI
- Plan cards with discount details
- Auto-apply toggle at checkout
- Usage display on customer profile

---

## Implementation Order

| Phase | Features | Rationale |
|-------|----------|-----------|
| **Phase 1** | Inventory + Digital Catalog | Products needed for catalog; services already exist |
| **Phase 2** | Membership enhancement | Auto-apply at checkout builds on existing memberships |
| **Phase 3** | CRM | Uses existing customer/invoice data |
| **Phase 4** | Staff Management | Independent; can be built in parallel |

---

## Migration Files

Run in order (from project root). Ensure `schema.sql` and `001` have run first:

```bash
psql -U aishwaryabh -d salon_db -f server/db/migrations/001-staff-memberships-clients.sql
psql -U aishwaryabh -d salon_db -f server/db/migrations/002-inventory-products.sql
psql -U aishwaryabh -d salon_db -f server/db/migrations/003-digital-catalog.sql
psql -U aishwaryabh -d salon_db -f server/db/seed-services.sql
psql -U aishwaryabh -d salon_db -f server/db/migrations/004-crm.sql
psql -U aishwaryabh -d salon_db -f server/db/migrations/005-staff-management.sql
psql -U aishwaryabh -d salon_db -f server/db/migrations/006-membership-enhancements.sql
```

- `002-inventory-products.sql` – products, movements, suppliers, orders
- `003-digital-catalog.sql` – services table, promotions
- `seed-services.sql` – initial services data
- `004-crm.sql` – preferences, tags, notes
- `005-staff-management.sql` – shifts, attendance, goals, incentives (requires 003)
- `006-membership-enhancements.sql` – plan extensions
