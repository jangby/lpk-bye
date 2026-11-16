const test = require('node:test');
const assert = require('node:assert/strict');
const { registrationCode } = require('./helpers');

test('creates program-neutral registration codes', () => {
  assert.match(registrationCode(2026), /^BYE-2026-\d{6}$/);
});
