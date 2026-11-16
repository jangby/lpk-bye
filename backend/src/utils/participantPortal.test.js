const test = require('node:test');
const assert = require('node:assert/strict');
const { createPortalToken, hashPortalToken, getPortalUrl } = require('./participantPortal');

test('creates a unique opaque portal token and stores only its hash', () => {
  const first = createPortalToken();
  const second = createPortalToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.match(hashPortalToken(first), /^[a-f0-9]{64}$/);
  assert.notEqual(hashPortalToken(first), first);
});

test('builds a participant link from the configured frontend URL', () => {
  assert.equal(getPortalUrl('secret-token', 'https://lpkbye.id/'), 'https://lpkbye.id/peserta/secret-token');
});
