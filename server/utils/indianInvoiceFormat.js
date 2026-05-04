/** Mirrors client invoice display helpers (CommonJS for server PDF/email). */

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

function toWords(n) {
  if (n === 0) return '';
  if (n < 10) return ones[n];
  if (n < 20) return teens[n - 10];
  if (n < 100) return (tens[Math.floor(n / 10)] + ' ' + ones[n % 10]).trim();
  if (n < 1000) return (ones[Math.floor(n / 100)] + ' Hundred ' + toWords(n % 100)).trim();
  if (n < 100000) return (toWords(Math.floor(n / 1000)) + ' Thousand ' + toWords(n % 1000)).trim();
  if (n < 10000000) return (toWords(Math.floor(n / 100000)) + ' Lakh ' + toWords(n % 100000)).trim();
  return (toWords(Math.floor(n / 10000000)) + ' Crore ' + toWords(n % 10000000)).trim();
}

function amountInWords(amount) {
  const n = Math.floor(Number(amount));
  const paise = Math.round((Number(amount) - n) * 100);
  let words = toWords(n);
  if (!words) words = 'Zero';
  words += ' Rupees Only';
  if (paise > 0) {
    words = words.replace(' Only', '') + ' and ' + toWords(paise) + ' Paise Only';
  }
  return words;
}

function formatINR(num, decimals = 2) {
  const n = Number(num);
  if (Number.isNaN(n)) return '₹0.00';
  const [intPart, decPart] = n.toFixed(decimals).split('.');
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const formatted =
    rest.length > 0 ? rest.replace(/(\d)(?=(\d{2})+$)/g, '$1,') + ',' + last3 : last3;
  return `₹${formatted}${decPart ? '.' + decPart : ''}`;
}

function formatDateIST(dateOrStr, options = {}) {
  if (dateOrStr == null || dateOrStr === '') return '–';
  if (typeof dateOrStr === 'string') {
    const t = dateOrStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const d = new Date(`${t}T12:00:00+05:30`);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...options });
      }
    }
  }
  const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
  if (!d || isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...options });
}

module.exports = { amountInWords, formatINR, formatDateIST };
