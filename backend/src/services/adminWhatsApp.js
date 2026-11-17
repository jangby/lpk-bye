const { pool } = require('../config/database');
const {
  getAdminPhones,
  buildAdminRegistrationMessage,
  formatAdminSummary,
  formatAdminToday,
  formatPendingRegistrants,
  formatPendingPayments,
  formatActiveBatches
} = require('../utils/whatsappAdmin');

async function notifyAdminsOfRegistration(registrant, sendToPhone) {
  const phones = getAdminPhones();
  if (!phones.length) {
    console.error('WhatsApp admin notification skipped: configure WHATSAPP_ADMIN_PHONES.');
    return {
      status: 'not_configured',
      error: 'Atur WHATSAPP_ADMIN_PHONES pada konfigurasi backend.'
    };
  }

  const message = buildAdminRegistrationMessage(registrant);
  const results = await Promise.all(phones.map(async (phone) => {
    try {
      await sendToPhone(phone, message);
      return null;
    } catch (error) {
      console.error('WhatsApp admin registration alert failed:', error.message);
      return error.message;
    }
  }));
  const failed = results.filter(Boolean).length;
  return {
    status: failed === 0 ? 'sent' : failed === phones.length ? 'failed' : 'partial',
    sent: phones.length - failed,
    failed,
    error: results.filter(Boolean).join('; ') || null
  };
}

async function sendAdminCommand(command, sendText) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (command === 'help') {
    await sendText([
      'MENU ADMIN LPK BYE',
      'ADMIN RINGKASAN · total pendaftar dan pembayaran',
      'ADMIN HARI INI · aktivitas hari ini',
      'ADMIN PENDAFTAR · daftar yang menunggu review',
      'ADMIN PEMBAYARAN · bukti transfer menunggu review',
      'ADMIN GELOMBANG · ringkasan gelombang aktif',
      '',
      'Nominal pemasukan hanya menghitung pembayaran yang sudah disetujui admin.'
    ].join('\n'));
    return;
  }

  if (command === 'summary') {
    const [registrantResult, paymentResult, programResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) AS verified,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today,
        SUM(CASE WHEN admin_notification_status IN ('pending', 'failed', 'partial', 'not_configured') THEN 1 ELSE 0 END) AS admin_notifications_pending
        FROM registrants`),
      pool.query(`SELECT
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_approved ELSE 0 END), 0) AS received,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_detected ELSE 0 END), 0) AS pending_amount
        FROM payments`),
      pool.query(`SELECT r.program_type, COUNT(DISTINCT r.id) AS total,
          COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.amount_approved ELSE 0 END), 0) AS received
        FROM registrants r LEFT JOIN payments p ON p.registrant_id = r.id
        GROUP BY r.program_type ORDER BY total DESC`)
    ]);
    const registrants = registrantResult[0][0];
    const payments = paymentResult[0][0];
    const programStats = programResult[0];
    await sendText(formatAdminSummary(registrants, payments, programStats, frontendUrl));
    return;
  }

  if (command === 'today') {
    const [registrantResult, paymentResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
        FROM registrants WHERE DATE(created_at) = CURDATE()`),
      pool.query(`SELECT
        SUM(CASE WHEN status = 'approved' AND DATE(reviewed_at) = CURDATE() THEN 1 ELSE 0 END) AS approved_count,
        COALESCE(SUM(CASE WHEN status = 'approved' AND DATE(reviewed_at) = CURDATE() THEN amount_approved ELSE 0 END), 0) AS received,
        SUM(CASE WHEN status = 'pending' AND DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS pending_count
        FROM payments`)
    ]);
    const registrants = registrantResult[0][0];
    const payments = paymentResult[0][0];
    await sendText(formatAdminToday(registrants, payments, frontendUrl));
    return;
  }

  if (command === 'registrants') {
    const [rows] = await pool.query(`SELECT id, full_name, registration_code, program_type
      FROM registrants WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10`);
    await sendText(formatPendingRegistrants(rows, frontendUrl));
    return;
  }

  if (command === 'payments') {
    const [rows] = await pool.query(`SELECT r.full_name, r.registration_code, p.amount_detected
      FROM payments p JOIN registrants r ON r.id = p.registrant_id
      WHERE p.status = 'pending' ORDER BY p.created_at DESC LIMIT 10`);
    await sendText(formatPendingPayments(rows, frontendUrl));
    return;
  }

  if (command === 'batches') {
    const [rows] = await pool.query(`SELECT b.id, b.batch_name, b.program_type, b.quota,
        COUNT(r.id) AS registrant_count
      FROM batches b LEFT JOIN registrants r ON r.batch_id = b.id
      WHERE b.is_active = TRUE AND b.end_date >= CURDATE()
      GROUP BY b.id ORDER BY b.start_date, b.id`);
    await sendText(formatActiveBatches(rows));
  }
}

module.exports = { notifyAdminsOfRegistration, sendAdminCommand };
