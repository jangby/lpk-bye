const test = require('node:test');
const assert = require('node:assert/strict');
const { PROGRAM_NAMES, isBatchOpen } = require('./batchPrograms');

test('exposes the separately managed program choices', () => {
  assert.deepEqual(PROGRAM_NAMES, [
    'SERTIFIKASI BNSP DIGITAL MARKETING',
    'PELATIHAN BAHASA JEPANG'
  ]);
});

test('active batches can accept registrations before their scheduled start date', () => {
  assert.equal(isBatchOpen({ is_active: 1, start_date: '2027-01-01', end_date: '2027-12-31' }), true);
  assert.equal(isBatchOpen({ is_active: 0, start_date: '2026-01-01', end_date: '2026-12-31' }), false);
});
