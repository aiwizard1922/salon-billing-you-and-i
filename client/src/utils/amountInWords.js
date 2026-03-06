/** Convert number to words (Indian numbering - lakhs, crores) */
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

export function amountInWords(amount) {
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
