const puppeteer = require('puppeteer');
const { buildInvoicePdfHtml } = require('../utils/invoicePdfHtml');

function shopFromEnv() {
  return {
    name: process.env.BUSINESS_NAME || 'Salon',
    address: process.env.BUSINESS_ADDRESS || '',
    phone: process.env.BUSINESS_PHONE || '',
    email: process.env.BUSINESS_EMAIL || '',
    gstin: process.env.BUSINESS_GSTIN || '',
    state: process.env.BUSINESS_STATE || '',
  };
}

/**
 * Renders the same HTML layout as the on-screen tax invoice to a PDF buffer.
 */
async function invoiceToPdfBuffer(invoice, shop) {
  const html = buildInvoicePdfHtml(invoice, shop);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

module.exports = {
  invoiceToPdfBuffer,
  shopFromEnv,
};
