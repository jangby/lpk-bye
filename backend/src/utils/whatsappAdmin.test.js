const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getAdminPhones,
  isAdminPhone,
  parseAdminCommand,
  buildAdminRegistrationMessage,
  formatAdminSummary,
  formatPendingPayments
} = require('./whatsappAdmin');

test('parses and normalizes configured admin numbers without duplicates', () => {
  assert.deepEqual(
    getAdminPhones('0812-3456-7890, +62 812 3456 7890; 6289876543210'),
    ['6281234567890', '6289876543210']
  );
  assert.deepEqual(getAdminPhones(''), []);
  assert.throws(() => getAdminPhones('not-a-phone'), /nomor yang tidak valid/);
});

test('authorizes commands only for configured WhatsApp admins', () => {
  assert.equal(isAdminPhone('+62 812 3456 7890', ['6281234567890']), true);
  assert.equal(isAdminPhone('0812-0000-0000', ['6281234567890']), false);
  assert.equal(isAdminPhone('', ['6281234567890']), false);
});

test('recognizes admin reports without confusing participant commands', () => {
  assert.equal(parseAdminCommand('ADMIN'), 'help');
  assert.equal(parseAdminCommand('admin ringkasan'), 'summary');
  assert.equal(parseAdminCommand('ADMIN HARI INI'), 'today');
  assert.equal(parseAdminCommand('admin pembayaran'), 'payments');
  assert.equal(parseAdminCommand('ADMIN gelombang'), 'batches');
  assert.equal(parseAdminCommand('PEMBAYARAN BYE-2026-123456'), null);
});

test('builds a registration alert with dashboard detail link and single-line fields', () => {
  const message = buildAdminRegistrationMessage({
    id: 12,
    full_name: 'Ayu\nNama',
    registration_code: 'BYE-2026-123456',
    program_type: 'PELATIHAN BAHASA JEPANG',
    batch_name: 'Gelombang 1',
    whatsapp: '081234567890',
    email: 'ayu@example.test',
    training_fee: 3500000
  }, 'https://lpkbye.example/');

  assert.match(message, /Nama: Ayu Nama/);
  assert.match(message, /Status: MENUNGGU REVIEW/);
  assert.match(message, /Biaya: Rp3\.500\.000/);
  assert.match(message, /https:\/\/lpkbye\.example\/admin\/registrants\/12/);
});

test('formats only approved amounts as received and labels pending amounts as estimates', () => {
  const message = formatAdminSummary(
    { total: 4, pending: 2, verified: 1, accepted: 1, rejected: 0, today: 1, admin_notifications_pending: 1 },
    { approved_count: 1, received: 500000, pending_count: 2, pending_amount: 750000 },
    [{ program_type: 'PELATIHAN BAHASA JEPANG', total: 4, received: 500000 }],
    'https://lpkbye.example'
  );

  assert.match(message, /Pembayaran terverifikasi: 1 transaksi · Rp500\.000/);
  assert.match(message, /Bukti menunggu review: 2 transaksi · perkiraan Rp750\.000/);
  assert.match(message, /PELATIHAN BAHASA JEPANG: 4 pendaftar · Rp500\.000 masuk/);
  assert.match(message, /Notifikasi admin perlu perhatian: 1/);
  assert.match(formatPendingPayments([], 'https://lpkbye.example'), /Tidak ada bukti pembayaran/);
});
