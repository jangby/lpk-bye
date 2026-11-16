function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return digits;
}

function phoneFromJid(jid) {
  if (typeof jid !== 'string') return '';
  const [user, server] = jid.split('@');
  if (!user || !['s.whatsapp.net', 'c.us', 'hosted'].includes(server)) return '';
  return normalizePhone(user.split(':')[0]);
}

async function resolveSenderPhone(message, lidMapping) {
  const key = message?.key || {};
  const candidates = [key.remoteJidAlt, key.participantAlt, key.remoteJid, key.participant];
  for (const jid of candidates) {
    const phone = phoneFromJid(jid);
    if (phone) return phone;
  }

  const lid = [key.remoteJid, key.participant].find(
    (jid) => typeof jid === 'string' && jid.endsWith('@lid')
  );
  if (!lid || typeof lidMapping?.getPNForLID !== 'function') return '';

  return phoneFromJid(await lidMapping.getPNForLID(lid));
}

module.exports = { normalizePhone, resolveSenderPhone };
