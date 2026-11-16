const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, resolveSenderPhone } = require('./phone');

test('normalizes Indonesian phone numbers into WhatsApp country format', () => {
  assert.equal(normalizePhone('0812-3456-7890'), '6281234567890');
  assert.equal(normalizePhone('+62 812 3456 7890'), '6281234567890');
  assert.equal(normalizePhone('81234567890'), '6281234567890');
});

test('prefers the phone JID provided alongside a LID', async () => {
  const message = {
    key: {
      remoteJid: '123456789012345@lid',
      remoteJidAlt: '6281234567890@s.whatsapp.net'
    }
  };
  assert.equal(await resolveSenderPhone(message), '6281234567890');
});

test('resolves a LID through Baileys mapping when no phone JID is included', async () => {
  const lid = '123456789012345@lid';
  let lookedUpLid;
  const mapping = {
    async getPNForLID(value) {
      lookedUpLid = value;
      return '6281234567890@s.whatsapp.net';
    }
  };

  assert.equal(await resolveSenderPhone({ key: { remoteJid: lid } }, mapping), '6281234567890');
  assert.equal(lookedUpLid, lid);
});

test('does not treat an unmapped LID as a phone number', async () => {
  assert.equal(
    await resolveSenderPhone({ key: { remoteJid: '123456789012345@lid' } }, {
      async getPNForLID() {
        return null;
      }
    }),
    ''
  );
});
