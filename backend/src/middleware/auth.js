const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

module.exports = async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ success: false, message: 'Token autentikasi diperlukan' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT id, name, email, role FROM admin_users WHERE id = ? LIMIT 1',
      [payload.sub]
    );
    if (!rows.length) return res.status(401).json({ success: false, message: 'Akun admin tidak ditemukan' });
    req.admin = rows[0];
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kedaluwarsa' });
  }
};
