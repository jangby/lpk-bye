const test = require('node:test');
const assert = require('node:assert/strict');
const { PROGRAM_NAMES } = require('./batchPrograms');

test('exposes the separately managed program choices', () => {
  assert.deepEqual(PROGRAM_NAMES, [
    'SERTIFIKASI BNSP DIGITAL MARKETING',
    'PELATIHAN BAHASA JEPANG'
  ]);
});
