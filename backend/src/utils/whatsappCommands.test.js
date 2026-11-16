const test = require('node:test');
const assert = require('node:assert/strict');
const { getBotCommand, getStatusLabel } = require('./whatsappCommands');

test('recognizes participant self-service WhatsApp commands', () => {
  assert.equal(getBotCommand('MENU'), 'menu');
  assert.equal(getBotCommand('STATUS BYE-JPN-2026-123456'), 'status');
  assert.equal(getBotCommand('pembayaran BYE-JPN-2026-123456'), 'payment');
  assert.equal(getBotCommand('jadwal'), 'schedule');
  assert.equal(getBotCommand('portal BYE-JPN-2026-123456'), 'portal');
  assert.equal(getBotCommand('pesan bebas'), null);
});

test('translates registration status into participant-friendly labels', () => {
  assert.equal(getStatusLabel('verified'), 'Terverifikasi');
  assert.equal(getStatusLabel('rejected'), 'Ditolak');
});
