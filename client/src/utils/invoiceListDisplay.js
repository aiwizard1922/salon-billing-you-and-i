/**
 * Payment method label for invoice list rows (matches invoice.payment_method / secondary_payment_method).
 */
export function formatInvoicePaymentLabel(inv) {
  if (!inv || inv.status !== 'paid') return '—';
  const rawPrimary = (inv.payment_method || '').trim();
  const rawSecondary = (inv.secondary_payment_method || '').trim();
  if (!rawPrimary) return '—';

  const normalize = (m) => {
    const x = String(m).toLowerCase().trim();
    if (x === 'upi') return 'UPI';
    if (x === 'cash') return 'Cash';
    if (x === 'card') return 'Card';
    if (x.startsWith('membership')) return 'Membership';
    return m.charAt(0).toUpperCase() + m.slice(1);
  };

  if (rawSecondary) {
    return `${normalize(rawPrimary)} + ${normalize(rawSecondary)}`;
  }
  return normalize(rawPrimary);
}
