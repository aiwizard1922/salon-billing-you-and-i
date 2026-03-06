/** Format number as Indian Rupees (₹) with Indian numbering (lakhs, crores) */
export function formatINR(num, decimals = 2) {
  const n = Number(num);
  if (Number.isNaN(n)) return '₹0.00';
  const [intPart, decPart] = n.toFixed(decimals).split('.');
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const formatted =
    rest.length > 0
      ? rest.replace(/(\d)(?=(\d{2})+$)/g, '$1,') + ',' + last3
      : last3;
  return `₹${formatted}${decPart ? '.' + decPart : ''}`;
}
