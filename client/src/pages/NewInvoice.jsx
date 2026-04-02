import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Search, Scissors, Package, Gift, Layers, CreditCard, CheckCircle2 } from 'lucide-react';
import { formatINR } from '../utils/formatCurrency';

const API = '/api';

const emptyLine = (lineKind = 'service') => {
  const base = {
    lineKind,
    unit_price: 0,
    quantity: 1,
    staff_id: '',
    membership_plan_id: lineKind === 'membership' ? null : undefined,
  };
  if (lineKind === 'service') {
    return {
      ...base,
      serviceMode: 'catalog',
      catalog_service_id: null,
      service_name: '',
    };
  }
  if (lineKind === 'product') {
    return {
      ...base,
      productMode: 'catalog',
      catalog_product_id: null,
      service_name: '',
      custom_product_name: '',
    };
  }
  if (lineKind === 'gift_card') {
    return { ...base, service_name: 'Gift Card' };
  }
  return { ...base, service_name: '' };
};

/** Label typed by user or selected from catalog (for validation, subtotal). */
function resolvedLineLabel(item) {
  if (item.lineKind === 'product' && item.productMode === 'custom') {
    return String(item.custom_product_name || '').trim();
  }
  return String(item.service_name || '').trim();
}

/** Value stored on invoice / sent to API. */
function resolvedInvoiceServiceName(item) {
  if (item.lineKind === 'product' && item.productMode === 'custom') {
    const n = String(item.custom_product_name || '').trim();
    return n ? `[Product] ${n}` : '';
  }
  return String(item.service_name || '').trim();
}

export default function NewInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preset = searchParams.get('customer');

  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [staff, setStaff] = useState([]);
  const [customerMode, setCustomerMode] = useState(preset ? 'existing' : 'new');
  const [customerId, setCustomerId] = useState(preset || '');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', gender: '' });
  const [lookupFound, setLookupFound] = useState(null);
  const [items, setItems] = useState([emptyLine('service')]);
  const [cgstPercent, setCgstPercent] = useState(2.5);
  const [sgstPercent, setSgstPercent] = useState(2.5);
  const [igstPercent, setIgstPercent] = useState(0);
  const [serviceTaxPercent, setServiceTaxPercent] = useState(0);
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [createPaymentMethod, setCreatePaymentMethod] = useState('cash');
  const [createPaySplit, setCreatePaySplit] = useState(false);
  const [createSecondaryMethod, setCreateSecondaryMethod] = useState('upi');
  const [createSplitPrimaryAmt, setCreateSplitPrimaryAmt] = useState('');
  const [createSplitSecondaryAmt, setCreateSplitSecondaryAmt] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeMembership, setActiveMembership] = useState(null);
  const [activeMembershipWithBalance, setActiveMembershipWithBalance] = useState(null);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/customers`).then((r) => r.json()).then((d) => d.success && setCustomers(d.data));
    fetch(`${API}/services`).then((r) => r.json()).then((d) => d.success && setServices(d.data));
    fetch(`${API}/staff?active=true`).then((r) => r.json()).then((d) => d.success && setStaff(d.data));
    fetch(`${API}/inventory/products?search=&lowStock=false`).then((r) => r.json()).then((d) => d.success && setProducts(d.data || []));
    fetch(`${API}/membership-plans`).then((r) => r.json()).then((d) => d.success && setMembershipPlans(d.data || []));
  }, []);

  useEffect(() => {
    if (preset) {
      setCustomerMode('existing');
      setCustomerId(preset);
      const c = customers.find((x) => String(x.id) === preset);
      if (c) setCustomerSearch(`${c.name} – ${c.phone}`);
    }
  }, [preset, customers]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (customerMode === 'existing' && customerId) {
      Promise.all([
        fetch(`${API}/membership/for-customer?customerId=${customerId}`).then((r) => r.json()),
        fetch(`${API}/membership/active?customerId=${customerId}`).then((r) => r.json()),
      ]).then(([fc, ac]) => {
        setActiveMembership(fc.data || null);
        setActiveMembershipWithBalance(ac.data || null);
      });
    } else {
      setActiveMembership(null);
      setActiveMembershipWithBalance(null);
    }
  }, [customerMode, customerId]);

  const lookupByPhone = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 10) {
      setLookupFound(null);
      return;
    }
    fetch(`${API}/customers/lookup?phone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setLookupFound(d.data);
          setNewCustomer((p) => ({ ...p, name: d.data.name, gender: d.data.gender || '' }));
        } else {
          setLookupFound(null);
        }
      })
      .catch(() => setLookupFound(null));
  };

  const setItemFields = (i, patch) => {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const addServiceRow = () => setItems((prev) => [...prev, emptyLine('service')]);
  const addProductRow = () => setItems((prev) => [...prev, emptyLine('product')]);
  const addMembershipRow = () => setItems((prev) => [...prev, emptyLine('membership')]);
  const addPackageRow = () => setItems((prev) => [...prev, emptyLine('package')]);
  const addGiftCardRow = () => setItems((prev) => [...prev, emptyLine('gift_card')]);

  const removeRow = (i) => items.length > 1 && setItems(items.filter((_, j) => j !== i));
  const update = (i, f, v) => {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [f]: v };
      if (f === 'service_name' && next[i].lineKind === 'service' && next[i].serviceMode !== 'custom') {
        const s = services.find((x) => x.name === v);
        if (s) {
          next[i].unit_price = s.price;
          next[i].catalog_service_id = s.id;
        }
      }
      return next;
    });
  };

  /** Group catalog services for dropdown; DB allows same name in different categories. */
  const servicesByCategory = useMemo(() => {
    const map = new Map();
    for (const s of services) {
      const cat = s.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(s);
    }
    return [...map.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)));
  }, [services]);

  function catalogSelectValue(item) {
    if (item.lineKind !== 'service' || item.serviceMode === 'custom') return '';
    if (item.catalog_service_id != null && item.catalog_service_id !== '') {
      const idStr = String(item.catalog_service_id);
      if (services.some((s) => String(s.id) === idStr)) return idStr;
    }
    const matches = services.filter((s) => s.name === item.service_name);
    if (matches.length === 1) return String(matches[0].id);
    if (matches.length > 1) {
      const byPrice = matches.filter((s) => Number(s.price) === Number(item.unit_price));
      if (byPrice.length === 1) return String(byPrice[0].id);
    }
    return '';
  }

  const onProductSelect = (i, productId) => {
    if (productId === '__custom__') {
      setItemFields(i, {
        productMode: 'custom',
        catalog_product_id: null,
        service_name: '',
        custom_product_name: '',
        unit_price: 0,
      });
      return;
    }
    if (!productId) {
      setItemFields(i, {
        productMode: 'catalog',
        catalog_product_id: null,
        service_name: '',
        custom_product_name: '',
        unit_price: 0,
      });
      return;
    }
    const p = products.find((x) => String(x.id) === String(productId));
    if (p) {
      setItemFields(i, {
        productMode: 'catalog',
        catalog_product_id: p.id,
        service_name: `[Product] ${p.name}`,
        custom_product_name: '',
        unit_price: Number(p.selling_price) || 0,
      });
    } else {
      setItemFields(i, {
        productMode: 'catalog',
        catalog_product_id: null,
        service_name: '',
        custom_product_name: '',
        unit_price: 0,
      });
    }
  };

  const onMembershipSelect = (i, planId) => {
    const plan = membershipPlans.find((x) => String(x.id) === String(planId));
    if (plan) {
      const catalogPrice = Number(plan.special_price ?? plan.price) || 0;
      setItemFields(i, {
        service_name: `[Membership] ${plan.name}`,
        unit_price: catalogPrice,
        membership_plan_id: plan.id,
      });
    } else {
      setItemFields(i, { service_name: '', unit_price: 0, membership_plan_id: null });
    }
  };

  const rawSubtotal = items.reduce((s, i) => {
    if (!resolvedLineLabel(i)) return s;
    return s + Number(i.unit_price || 0) * (i.quantity || 1);
  }, 0);
  const effectiveTaxPercent =
    Math.max(0, Number(cgstPercent) || 0) +
    Math.max(0, Number(sgstPercent) || 0) +
    Math.max(0, Number(igstPercent) || 0) +
    Math.max(0, Number(serviceTaxPercent) || 0);
  const cgstAmountLine = (rawSubtotal * Math.max(0, Number(cgstPercent) || 0)) / 100;
  const sgstAmountLine = (rawSubtotal * Math.max(0, Number(sgstPercent) || 0)) / 100;
  const igstAmountLine = (rawSubtotal * Math.max(0, Number(igstPercent) || 0)) / 100;
  const serviceTaxAmountLine = (rawSubtotal * Math.max(0, Number(serviceTaxPercent) || 0)) / 100;
  const tax = cgstAmountLine + sgstAmountLine + igstAmountLine + serviceTaxAmountLine;
  const totalBeforeDiscount = rawSubtotal + tax;
  const discountPctNum = Math.max(0, Math.min(100, Number(discountValue) || 0));
  const discountAmount =
    discountType === 'fixed'
      ? Math.min(Math.max(0, Number(discountValue) || 0), totalBeforeDiscount)
      : (totalBeforeDiscount * discountPctNum) / 100;
  const total = Math.round(Math.max(0, totalBeforeDiscount - discountAmount) * 100) / 100;
  const displayBalance = activeMembership
    ? (activeMembership.remaining_balance != null ? Number(activeMembership.remaining_balance) : null)
        ?? (activeMembership.initial_balance != null ? Number(activeMembership.initial_balance) : null)
        ?? ((activeMembership.usage_count ?? 0) === 0 ? (Number(activeMembership.plan_price) || Number(activeMembership.special_price) || 0) : 0)
    : 0;
  const membershipBalance = activeMembershipWithBalance
    ? (activeMembershipWithBalance.remaining_balance != null ? Number(activeMembershipWithBalance.remaining_balance) : Number(activeMembershipWithBalance.initial_balance) ?? 0)
    : 0;
  const canPayFromMembership = customerMode === 'existing' && activeMembershipWithBalance && membershipBalance >= total;
  const normPayMethodKey = (m) => {
    const x = String(m || '').toLowerCase();
    if (x === 'upi') return 'upi';
    if (x === 'card') return 'card';
    return 'cash';
  };
  const splitTenderMethodsClash =
    createPaySplit &&
    createPaymentMethod !== 'membership' &&
    normPayMethodKey(createPaymentMethod) === normPayMethodKey(createSecondaryMethod);

  const customerSearchLower = String(customerSearch || '').trim().toLowerCase();
  const customerSearchDigits = customerSearchLower.replace(/\D/g, '');
  const filteredCustomersForSelect = !customerSearchLower
    ? customers
    : customers.filter((c) => {
        const name = String(c.name || '').toLowerCase();
        const phone = String(c.phone || '').replace(/\D/g, '');
        return name.includes(customerSearchLower) || (customerSearchDigits.length > 0 && phone.includes(customerSearchDigits));
      });

  const canSubmit = () => {
    const hasItems = items.some((i) => resolvedLineLabel(i));
    const allLinesHaveStaff = items
      .filter((i) => resolvedLineLabel(i))
      .every((i) => i.staff_id && Number(i.staff_id) > 0);
    if (customerMode === 'existing') return customerId && hasItems && allLinesHaveStaff;
    return newCustomer.name?.trim() && newCustomer.phone?.trim() && hasItems && allLinesHaveStaff;
  };

  const buildPayload = () => {
    const payload = {
      items: items
        .map((i) => {
          const label = resolvedLineLabel(i);
          if (!label) return null;
          const invName = resolvedInvoiceServiceName(i);
          const row = {
            lineKind: i.lineKind,
            service_name: invName,
            unit_price: Number(i.unit_price),
            quantity: Number(i.quantity) || 1,
            staff_id: i.staff_id ? Number(i.staff_id) : null,
          };
          if (i.serviceMode != null) row.serviceMode = i.serviceMode;
          if (i.productMode != null) row.productMode = i.productMode;
          const pid = i.membership_plan_id != null && i.membership_plan_id !== '' ? Number(i.membership_plan_id) : null;
          if (Number.isFinite(pid) && pid > 0) row.membership_plan_id = pid;
          return row;
        })
        .filter(Boolean),
      taxPercent: effectiveTaxPercent,
      cgstPercent: Math.max(0, Number(cgstPercent) || 0),
      sgstPercent: Math.max(0, Number(sgstPercent) || 0),
      igstPercent: Math.max(0, Number(igstPercent) || 0),
      serviceTaxPercent: Math.max(0, Number(serviceTaxPercent) || 0),
      discountType,
      discountPercent: discountType === 'percent' ? discountPctNum : 0,
      discountFixed: discountType === 'fixed' ? Math.max(0, Number(discountValue) || 0) : 0,
      notes: notes || undefined,
      sendWhatsApp,
    };
    if (customerMode === 'existing') {
      payload.customerId = Number(customerId);
    } else {
      payload.customer = { name: newCustomer.name.trim(), phone: newCustomer.phone.trim(), gender: newCustomer.gender || null };
    }
    return payload;
  };

  const navigateToInvoice = (invoiceId, whatsappState) => {
    navigate(`/invoices/${invoiceId}`, { state: whatsappState });
  };

  const postPay = (invoiceId, body, whatsappState, onFailMessage) =>
    fetch(`${API}/invoices/${invoiceId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r2) => r2.json())
      .then((d2) => {
        if (d2.success) navigateToInvoice(invoiceId, whatsappState);
        else {
          setError(d2.error || onFailMessage);
          setTimeout(() => navigateToInvoice(invoiceId, whatsappState), 2000);
        }
      })
      .catch(() => {
        setError(onFailMessage);
        setTimeout(() => navigateToInvoice(invoiceId, whatsappState), 2000);
      });

  /** @param {'pending' | 'membership' | 'markPaid'} mode */
  const submit = (e, mode = 'pending') => {
    e?.preventDefault?.();
    if (!canSubmit()) return;
    setError('');
    setLoading(true);
    const payload = buildPayload();
    fetch(`${API}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        let d;
        try {
          d = await r.json();
        } catch {
          throw new Error(r.ok ? 'Invalid response' : 'Server error – is the backend running?');
        }
        if (!d.success) {
          setError(d.error || 'Failed to create invoice');
          return;
        }
        const invoiceId = d.data.id;
        const invTotal = Number(d.data.total);
        const whatsappState = {
          whatsappSent: d.data.whatsappSent,
          whatsappError: d.data.whatsappError,
          customerMatchNotice: d.data.customerMatchNotice || null,
        };

        if (mode === 'membership') {
          if (activeMembershipWithBalance && membershipBalance >= invTotal) {
            return postPay(
              invoiceId,
              { paymentMethod: 'membership', membershipId: activeMembershipWithBalance.id },
              whatsappState,
              'Invoice created but payment failed. You can pay from the invoice view.',
            );
          }
          navigateToInvoice(invoiceId, whatsappState);
          return;
        }

        if (mode === 'markPaid') {
          if (createPaymentMethod === 'membership') {
            if (!activeMembershipWithBalance || membershipBalance < invTotal) {
              setError('Membership balance is not enough for this bill. Choose Cash, UPI, or Card—or leave the sale as pending.');
              setTimeout(() => navigateToInvoice(invoiceId, whatsappState), 2500);
              return;
            }
            return postPay(
              invoiceId,
              { paymentMethod: 'membership', membershipId: activeMembershipWithBalance.id },
              whatsappState,
              'Invoice created but membership payment failed. Open the invoice to try again.',
            );
          }
          if (createPaySplit) {
            const norm = (m) => {
              const x = String(m || '').toLowerCase();
              if (x === 'upi') return 'upi';
              if (x === 'card') return 'card';
              return 'cash';
            };
            const p1 = norm(createPaymentMethod);
            const p2 = norm(createSecondaryMethod);
            if (p1 === p2) {
              setError('Split payment: choose two different methods (e.g. cash + UPI).');
              setTimeout(() => navigateToInvoice(invoiceId, whatsappState), 2500);
              return;
            }
            const aPaise = Math.round(Number(createSplitPrimaryAmt) * 100);
            const bPaise = Math.round(Number(createSplitSecondaryAmt) * 100);
            const tPaise = Math.round(Number(invTotal) * 100);
            if (!Number.isFinite(aPaise) || !Number.isFinite(bPaise) || aPaise <= 0 || bPaise <= 0) {
              setError('Enter both amounts for the split payment.');
              setTimeout(() => navigateToInvoice(invoiceId, whatsappState), 2500);
              return;
            }
            if (aPaise + bPaise !== tPaise) {
              setError(
                `Split amounts must add up to ${formatINR(tPaise / 100, 2)} (saved bill total). They currently add up to ${formatINR((aPaise + bPaise) / 100, 2)}.`,
              );
              setTimeout(() => navigateToInvoice(invoiceId, whatsappState), 2500);
              return;
            }
            return postPay(
              invoiceId,
              {
                paymentMethod: p1,
                secondaryPaymentMethod: p2,
                primaryAmount: aPaise / 100,
                secondaryAmount: bPaise / 100,
              },
              whatsappState,
              'Invoice created but marking paid failed. Open the invoice to try again.',
            );
          }
          return postPay(
            invoiceId,
            { paymentMethod: createPaymentMethod },
            whatsappState,
            'Invoice created but marking paid failed. Open the invoice to try again.',
          );
        }

        navigateToInvoice(invoiceId, whatsappState);
      })
      .catch((err) => setError(err.message || 'Request failed'))
      .finally(() => setLoading(false));
  };

  const btnClass =
    'inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 hover:border-slate-400 transition';

  const productCatalogSelectValue = (item) => {
    if (item.lineKind !== 'product' || item.productMode === 'custom') return '';
    if (item.catalog_product_id != null && item.catalog_product_id !== '') {
      const idStr = String(item.catalog_product_id);
      if (products.some((p) => String(p.id) === idStr)) return idStr;
    }
    const m = products.find((p) => `[Product] ${p.name}` === item.service_name);
    return m ? String(m.id) : '';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Quick Sales</h2>
      <form onSubmit={(e) => submit(e, 'pending')} className="bg-white rounded-xl shadow p-6">
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Customer *</label>
          <div className="flex gap-4 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="customerMode"
                checked={customerMode === 'new'}
                onChange={() => { setCustomerMode('new'); setLookupFound(null); }}
              />
              <span>New customer (add while creating invoice)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="customerMode"
                checked={customerMode === 'existing'}
                onChange={() => {
                  setCustomerMode('existing');
                  setLookupFound(null);
                  setCustomerSearch('');
                  setCustomerId(preset || '');
                  setShowCustomerDropdown(false);
                }}
              />
              <span>Select existing</span>
            </label>
          </div>
          {customerMode === 'existing' && activeMembership && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Membership {activeMembership.customer_phone || `MEM-${activeMembership.id}`}</strong> · Balance: {formatINR(displayBalance)} · Uses: {activeMembership.usage_count ?? 0}
              <br />
              <span className="text-amber-700">
                {displayBalance > 0 ? 'Pay from membership when marking invoice as paid.' : 'Balance exhausted. Pay by cash/UPI at checkout.'}
              </span>
            </div>
          )}
          {customerMode === 'existing' ? (
            <div className="relative" ref={customerDropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer by name or phone..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerId('');
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full pl-9 pr-8 border rounded-lg px-3 py-2"
                />
                {customerId && (
                  <button
                    type="button"
                    onClick={() => { setCustomerId(''); setCustomerSearch(''); setShowCustomerDropdown(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Clear selection"
                  >
                    ×
                  </button>
                )}
              </div>
              {showCustomerDropdown && (
                <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                  {filteredCustomersForSelect.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-slate-500">No customers match</div>
                  ) : (
                    filteredCustomersForSelect.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomerId(String(c.id));
                          setCustomerSearch(`${c.name} – ${c.phone}`);
                          setShowCustomerDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${String(customerId) === String(c.id) ? 'bg-amber-50 text-amber-800' : ''}`}
                      >
                        {c.name} – {c.phone}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Customer name *"
                  value={newCustomer.name}
                  onChange={(e) => {
                    setNewCustomer((p) => ({ ...p, name: e.target.value }));
                    setLookupFound(null);
                  }}
                  className="border rounded-lg px-3 py-2"
                />
                <input
                  type="tel"
                  placeholder="Phone * (tab out to lookup)"
                  value={newCustomer.phone}
                  onChange={(e) => {
                    setNewCustomer((p) => ({ ...p, phone: e.target.value }));
                    setLookupFound(null);
                  }}
                  onBlur={() => lookupByPhone(newCustomer.phone)}
                  className="border rounded-lg px-3 py-2"
                />
              </div>
              <div className="mt-3">
                <label className="block text-xs text-slate-500 mb-1">Gender</label>
                <select
                  value={newCustomer.gender}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, gender: e.target.value }))}
                  className="border rounded-lg px-3 py-2 w-full md:w-48"
                >
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {lookupFound && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">✓ Found existing customer:</span>
                    <span>{lookupFound.name}</span>
                    <span className="text-green-600">({lookupFound.phone})</span>
                  </div>
                  <p className="mt-2 text-xs text-green-900/85 leading-snug">
                    Linked to this profile. Use another phone for a new customer.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Line items *</label>
          <div className="flex flex-wrap gap-2 mb-3">
            <button type="button" onClick={addServiceRow} className={btnClass} title="Add a service from catalog">
              <Scissors className="w-4 h-4" /> Add Service <Plus className="w-4 h-4" />
            </button>
            <button type="button" onClick={addProductRow} className={btnClass} title="Add a retail product from inventory">
              <Package className="w-4 h-4" /> Add Product <Plus className="w-4 h-4" />
            </button>
            <button type="button" onClick={addMembershipRow} className={btnClass} title="Add a membership plan as a line">
              <Gift className="w-4 h-4" /> Add Membership <Plus className="w-4 h-4" />
            </button>
            <button type="button" onClick={addPackageRow} className={btnClass} title="Add a custom package (name + price)">
              <Layers className="w-4 h-4" /> Add Package <Plus className="w-4 h-4" />
            </button>
            <button type="button" onClick={addGiftCardRow} className={btnClass} title="Add gift card amount">
              <CreditCard className="w-4 h-4" /> Gift Card
            </button>
          </div>
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap gap-2 mb-3 items-center border-b border-slate-100 pb-3">
              <span className="text-xs text-slate-400 w-20 shrink-0 capitalize">{item.lineKind.replace('_', ' ')}</span>
              <div className="flex-1 min-w-[200px]">
                {item.lineKind === 'service' && item.serviceMode !== 'custom' && (
                  <select
                    value={catalogSelectValue(item)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__custom__') {
                        setItemFields(i, {
                          serviceMode: 'custom',
                          catalog_service_id: null,
                          service_name: '',
                          unit_price: 0,
                        });
                        return;
                      }
                      if (!v) {
                        setItemFields(i, {
                          serviceMode: 'catalog',
                          catalog_service_id: null,
                          service_name: '',
                          unit_price: 0,
                        });
                        return;
                      }
                      const s = services.find((x) => String(x.id) === String(v));
                      setItemFields(i, {
                        serviceMode: 'catalog',
                        catalog_service_id: s?.id ?? null,
                        service_name: s?.name || '',
                        unit_price: s ? Number(s.price) || 0 : 0,
                      });
                    }}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select service</option>
                    {servicesByCategory.map(([category, list]) => (
                      <optgroup key={category} label={category}>
                        {list.map((s) => (
                          <option key={s.id} value={String(s.id)}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="__custom__">Custom / combo…</option>
                  </select>
                )}
                {item.lineKind === 'service' && item.serviceMode === 'custom' && (
                  <div className="space-y-1 w-full">
                    <input
                      type="text"
                      placeholder="Service or combo name"
                      value={item.service_name}
                      onChange={(e) => update(i, 'service_name', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                    <p className="text-[11px] text-slate-500">Enter the name and price in the row—no price is shown in the name.</p>
                    <button
                      type="button"
                      className="text-xs text-amber-700 hover:underline"
                      onClick={() =>
                        setItemFields(i, {
                          serviceMode: 'catalog',
                          catalog_service_id: null,
                          service_name: '',
                          unit_price: 0,
                        })
                      }
                    >
                      ← Pick from catalog
                    </button>
                  </div>
                )}
                {item.lineKind === 'product' && item.productMode !== 'custom' && (
                  <select
                    value={productCatalogSelectValue(item)}
                    onChange={(e) => onProductSelect(i, e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value="__custom__">Custom item…</option>
                  </select>
                )}
                {item.lineKind === 'product' && item.productMode === 'custom' && (
                  <div className="space-y-1 w-full">
                    <input
                      type="text"
                      placeholder="Product name"
                      value={item.custom_product_name || ''}
                      onChange={(e) => setItemFields(i, { custom_product_name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                    <p className="text-[11px] text-slate-500">Saved to inventory as a retail item when you complete the sale.</p>
                    <button
                      type="button"
                      className="text-xs text-amber-700 hover:underline"
                      onClick={() => onProductSelect(i, '')}
                    >
                      ← Pick from catalog
                    </button>
                  </div>
                )}
                {item.lineKind === 'membership' && (
                  <select
                    value={item.membership_plan_id != null && item.membership_plan_id !== '' ? String(item.membership_plan_id) : ''}
                    onChange={(e) => onMembershipSelect(i, e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select membership plan</option>
                    {membershipPlans.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                )}
                {item.lineKind === 'package' && (
                  <div className="space-y-1 w-full">
                    <input
                      type="text"
                      placeholder="Package name"
                      value={item.service_name}
                      onChange={(e) => update(i, 'service_name', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                    <p className="text-[11px] text-slate-500">Saved under Service catalog (category Package) when you complete the sale.</p>
                  </div>
                )}
                {item.lineKind === 'gift_card' && (
                  <input
                    type="text"
                    placeholder="Label (e.g. Gift Card)"
                    value={item.service_name}
                    onChange={(e) => update(i, 'service_name', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                )}
              </div>
              <input type="number" min={1} value={item.quantity} onChange={(e) => update(i, 'quantity', e.target.value)} className="w-16 border rounded px-2 py-2 text-center" title="Qty" />
              <input
                type="number"
                min={0}
                step={0.01}
                value={item.unit_price}
                onChange={(e) => update(i, 'unit_price', e.target.value)}
                className="w-28 border rounded px-2 py-2"
                title="Price"
              />
              <select value={item.staff_id || ''} onChange={(e) => update(i, 'staff_id', e.target.value)} className="w-40 border rounded px-2 py-2 text-sm" title="Staff">
                <option value="">Staff *</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" onClick={() => removeRow(i)} className="p-2 text-red-500 hover:bg-red-50 rounded" title="Remove line">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">Tax & discount</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
            <div className="col-span-2 sm:col-span-3 lg:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Discount</label>
              <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-slate-400/35 focus-within:border-slate-400">
                <select
                  value={discountType}
                  onChange={(e) => { setDiscountType(e.target.value); setDiscountValue(0); }}
                  className="border-0 border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 w-[3.75rem] sm:w-[4.25rem] shrink-0 cursor-pointer outline-none hover:bg-slate-100/90"
                  title={discountType === 'percent' ? 'Discount as % of (subtotal + tax)' : 'Discount as fixed ₹ amount'}
                  aria-label="Discount unit: percent or rupees"
                >
                  <option value="percent">%</option>
                  <option value="fixed">₹</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={discountType === 'percent' ? 100 : undefined}
                  step={discountType === 'percent' ? 0.01 : 1}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  placeholder={discountType === 'percent' ? 'e.g. 5' : 'e.g. 100'}
                  className="flex-1 min-w-0 border-0 px-3 py-2.5 text-sm tabular-nums text-slate-800 placeholder:text-slate-400 outline-none bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CGST %</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={cgstPercent}
                onChange={(e) => setCgstPercent(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">SGST %</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={sgstPercent}
                onChange={(e) => setSgstPercent(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">IGST %</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={igstPercent}
                onChange={(e) => setIgstPercent(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Service tax %</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={serviceTaxPercent}
                onChange={(e) => setServiceTaxPercent(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Combined GST: {effectiveTaxPercent.toFixed(2)}%</p>
        </div>
        <div className="mb-6">
          <label className="block text-sm text-slate-700 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded px-3 py-2" rows={2} />
        </div>
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendWhatsApp}
              onChange={(e) => setSendWhatsApp(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Send bill to customer via WhatsApp</span>
          </label>
        </div>
        <div className="border-t border-slate-200 pt-5 mb-8">
          <p className="text-sm font-semibold text-slate-800 mb-3">Bill summary</p>
          <div className="flex flex-col md:flex-row md:justify-end gap-4">
            <div className="w-full md:max-w-md space-y-1.5 text-sm rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex justify-between text-slate-700"><span>Subtotal (₹)</span><span className="tabular-nums font-medium">{formatINR(rawSubtotal)}</span></div>
              <div className="flex justify-between text-slate-600 text-xs"><span>Total (₹)</span><span className="tabular-nums">{formatINR(rawSubtotal)}</span></div>
              <div className="flex justify-between text-slate-700"><span>Taxable amount (₹)</span><span className="tabular-nums font-medium">{formatINR(rawSubtotal)}</span></div>
              {(Number(cgstPercent) || 0) > 0 && (
                <div className="flex justify-between text-slate-600"><span>CGST (₹) @ {Number(cgstPercent)}%</span><span className="tabular-nums">{formatINR(cgstAmountLine)}</span></div>
              )}
              {(Number(sgstPercent) || 0) > 0 && (
                <div className="flex justify-between text-slate-600"><span>SGST (₹) @ {Number(sgstPercent)}%</span><span className="tabular-nums">{formatINR(sgstAmountLine)}</span></div>
              )}
              {(Number(igstPercent) || 0) > 0 && (
                <div className="flex justify-between text-slate-600"><span>IGST (₹) @ {Number(igstPercent)}%</span><span className="tabular-nums">{formatINR(igstAmountLine)}</span></div>
              )}
              {(Number(serviceTaxPercent) || 0) > 0 && (
                <div className="flex justify-between text-slate-600"><span>Service tax (₹) @ {Number(serviceTaxPercent)}%</span><span className="tabular-nums">{formatINR(serviceTaxAmountLine)}</span></div>
              )}
              {effectiveTaxPercent > 0 && (
                <div className="flex justify-between text-slate-500 text-xs pt-1 border-t border-dashed border-slate-200"><span>Total tax (₹)</span><span className="tabular-nums">{formatINR(tax)}</span></div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>{discountType === 'percent' ? `Discount (${discountPctNum}%)` : 'Discount (₹)'}</span>
                  <span className="tabular-nums">-{formatINR(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-slate-900 pt-2 border-t-2 border-slate-200"><span>Grand total (₹)</span><span className="tabular-nums">{formatINR(total)}</span></div>
              <div className="flex justify-between text-slate-600 text-sm"><span>Paying now (₹)</span><span className="tabular-nums font-medium text-slate-800">{formatINR(total)}</span></div>
              <div className="flex justify-between text-slate-500 text-sm"><span>Due (₹)</span><span className="tabular-nums">0.00</span></div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-5 border-t border-slate-200 pt-6">
          <div className="flex gap-2 items-center flex-wrap">
            <button type="submit" disabled={loading || !canSubmit()} className="px-5 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 text-sm font-medium shadow-sm" title={!canSubmit() ? 'Fill customer details, add at least one service, and assign staff to each' : ''}>{loading ? 'Creating...' : 'Complete sale'}</button>
            {canPayFromMembership && (
              <button type="button" disabled={loading || !canSubmit()} onClick={(e) => submit(e, 'membership')} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium shadow-sm">
                {loading ? 'Creating...' : 'Complete sale & pay from membership'}
              </button>
            )}
            <button type="button" onClick={() => navigate('/')} className="px-5 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-medium">Cancel</button>
          </div>
          {!canSubmit() &&
            (newCustomer.name || newCustomer.phone || customerId) &&
            items.some((i) => resolvedLineLabel(i)) &&
            !items.filter((i) => resolvedLineLabel(i)).every((i) => i.staff_id && Number(i.staff_id) > 0) && (
            <span className="text-sm text-amber-600">Assign staff to each line</span>
          )}
          {!canSubmit() && (newCustomer.name || newCustomer.phone || customerId) && !items.some((i) => resolvedLineLabel(i)) && (
            <span className="text-sm text-amber-600">Add at least one line below</span>
          )}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-3">Record payment</p>
            {createPaymentMethod !== 'membership' && (
              <label className="flex items-center gap-2 cursor-pointer mb-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={createPaySplit}
                  onChange={(e) => {
                    const on = e.target.checked;
                    if (on) {
                      setCreatePaymentMethod('cash');
                      setCreateSecondaryMethod('upi');
                      setCreateSplitPrimaryAmt('');
                      setCreateSplitSecondaryAmt('');
                    }
                    setCreatePaySplit(on);
                  }}
                  className="rounded border-slate-300"
                />
                Split payment (e.g. cash + UPI)
              </label>
            )}
            {createPaySplit && createPaymentMethod !== 'membership' ? (
              <div className="space-y-3 mb-4">
                <p className="text-xs text-slate-600">
                  Exact grand total <strong>{formatINR(Math.round(Number(total) * 100) / 100, 2)}</strong> — both amounts must add up to this (paise-accurate).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-xs font-medium text-slate-600 mb-1">First payment</span>
                    <select
                      value={createPaymentMethod}
                      onChange={(e) => setCreatePaymentMethod(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white mb-2"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="₹"
                      value={createSplitPrimaryAmt}
                      onChange={(e) => setCreateSplitPrimaryAmt(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-600 mb-1">Second payment</span>
                    <select
                      value={createSecondaryMethod}
                      onChange={(e) => setCreateSecondaryMethod(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white mb-2"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="₹"
                      value={createSplitSecondaryAmt}
                      onChange={(e) => setCreateSplitSecondaryAmt(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-amber-700 hover:underline"
                    onClick={() => {
                    const aPaise = Math.round(Number(createSplitPrimaryAmt) * 100);
                    if (!Number.isFinite(aPaise) || aPaise <= 0) return;
                    const totalPaise = Math.round(Number(total) * 100);
                    const restPaise = totalPaise - aPaise;
                    if (restPaise >= 0) setCreateSplitSecondaryAmt(String(restPaise / 100));
                  }}
                >
                  Set second amount to remainder
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <label className="block text-sm text-slate-600 shrink-0">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Payment method</span>
                  <select
                    value={createPaymentMethod}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCreatePaymentMethod(v);
                      if (v === 'membership') setCreatePaySplit(false);
                    }}
                    className="min-w-[200px] w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-800 shadow-sm"
                  >
                    {canPayFromMembership && (
                      <option value="membership">Pay from membership</option>
                    )}
                    <option value="cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                  </select>
                </label>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 mt-2">
              <button
                type="button"
                disabled={loading || !canSubmit() || splitTenderMethodsClash}
                onClick={(e) => submit(e, 'markPaid')}
                className="group inline-flex items-center justify-center gap-2.5 w-full sm:w-auto px-7 py-3 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 border border-slate-700/80 shadow-md shadow-slate-900/15 ring-1 ring-white/10 disabled:opacity-45 disabled:shadow-none disabled:hover:bg-slate-800 transition-colors"
              >
                <CheckCircle2 className="w-5 h-5 text-amber-400/95 group-hover:text-amber-300 shrink-0" strokeWidth={2.25} aria-hidden />
                {loading ? 'Saving...' : 'Mark paid'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
