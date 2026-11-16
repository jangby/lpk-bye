const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWelcomeMessage, buildStatusMessage } = require('./participantMessages');

test('welcome message includes registration, payment, and participant portal details', () => {
  const message = buildWelcomeMessage({
    full_name: 'Ayu',
    registration_code: 'BYE-JPN-2026-123456',
    batch_name: 'Gelombang N5',
    training_fee: 1500000,
    payment_instructions: 'Transfer ke rekening LPK BYE'
  }, 'https://lpkbye.id/peserta/token');

  assert.match(message, /BYE-JPN-2026-123456/);
  assert.match(message, /Rp1\.500\.000/);
  assert.match(message, /https:\/\/lpkbye\.id\/peserta\/token/);
  assert.match(message, /tunggu verifikasi pendaftaran sebelum melakukan transfer/);
});

test('verified and rejected messages include only participant-facing feedback', () => {
  const verified = buildStatusMessage({
    full_name: 'Ayu',
    registration_code: 'BYE-JPN-2026-123456',
    status: 'verified',
    training_fee: 1500000,
    payment_instructions: 'Transfer ke rekening LPK BYE'
  });
  const rejected = buildStatusMessage({
    full_name: 'Ayu',
    registration_code: 'BYE-JPN-2026-123456',
    status: 'rejected',
    participant_feedback: 'Mohon unggah ulang identitas yang jelas.'
  });

  assert.match(verified, /Selamat Ayu/);
  assert.match(verified, /Transfer ke rekening LPK BYE/);
  assert.match(rejected, /Mohon unggah ulang identitas yang jelas/);
});
