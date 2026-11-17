const test = require('node:test');
const assert = require('node:assert/strict');
const { notifyAdminsOfRegistration } = require('./adminWhatsApp');

test('sends a new registration alert to each configured admin number', async () => {
  const previousPhones = process.env.WHATSAPP_ADMIN_PHONES;
  process.env.WHATSAPP_ADMIN_PHONES = '081234567890,6289876543210';
  const deliveries = [];

  try {
    const result = await notifyAdminsOfRegistration({
      id: 8,
      full_name: 'Peserta Contoh',
      registration_code: 'BYE-2026-123456',
      program_type: 'PELATIHAN BAHASA JEPANG',
      batch_name: 'Gelombang 1',
      whatsapp: '081234567890',
      email: null,
      training_fee: 3500000
    }, async (phone, message) => deliveries.push({ phone, message }));

    assert.equal(result.status, 'sent');
    assert.equal(deliveries.length, 2);
    assert.deepEqual(deliveries.map((delivery) => delivery.phone), ['6281234567890', '6289876543210']);
    assert.ok(deliveries.every((delivery) => delivery.message.includes('BYE-2026-123456')));
  } finally {
    if (previousPhones === undefined) delete process.env.WHATSAPP_ADMIN_PHONES;
    else process.env.WHATSAPP_ADMIN_PHONES = previousPhones;
  }
});
