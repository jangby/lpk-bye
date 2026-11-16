const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTransferAmount } = require('./paymentOcr');

test('parses Indonesian currency and separators from transfer receipts', () => {
  assert.equal(parseTransferAmount('Nominal Transfer\nRp 1.250.000'), 1250000);
  assert.equal(parseTransferAmount('Jumlah: 250.000,00'), 250000);
});

test('returns null when the receipt has no plausible transfer amount', () => {
  assert.equal(parseTransferAmount('Transfer berhasil\nTanggal 16/11/2026'), null);
});
