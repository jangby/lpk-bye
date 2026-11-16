const crypto = require('crypto');

function registrationCode(year = new Date().getFullYear()) {
  return `BYE-${year}-${crypto.randomInt(100000, 999999)}`;
}

function whatsappUrl(registrationCode, fullName) {
  const number = process.env.WHATSAPP_NUMBER || '6283820943475';
  const message = `Halo LPK BYE, saya ${fullName} sudah mendaftar dengan kode ${registrationCode}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return fallback; }
}

module.exports = { registrationCode, whatsappUrl, parseJson };
