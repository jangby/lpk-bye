const crypto = require('crypto');

function createPortalToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashPortalToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getPortalUrl(token, baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173') {
  return `${baseUrl.replace(/\/+$/, '')}/peserta/${token}`;
}

module.exports = { createPortalToken, hashPortalToken, getPortalUrl };
