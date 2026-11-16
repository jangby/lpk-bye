const { pool } = require('../config/database');
const { sendWhatsAppMessage } = require('../services/whatsappBot');
const path = require('path');

exports.list = async (req, res, next) => {
  try {
    const status = req.query.status;
    const where = status ? 'WHERE p.status = ?' : '';
    const params = status ? [status] : [];
    const [payments] = await pool.execute(
      `SELECT p.*, r.full_name, r.whatsapp, r.registration_code, b.batch_name, r.training_fee,
        (SELECT COALESCE(SUM(paid.amount_approved), 0) FROM payments paid
         WHERE paid.registrant_id = r.id AND paid.status = 'approved') AS paid_total
       FROM payments p
       JOIN registrants r ON r.id = p.registrant_id
       JOIN batches b ON b.id = r.batch_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT 500`,
      params
    );
    const [[summary]] = await pool.query(`SELECT
      (SELECT COUNT(*) FROM payments WHERE status = 'pending') AS pending_count,
      (SELECT COALESCE(SUM(amount_detected), 0) FROM payments WHERE status = 'pending') AS pending_amount,
      (SELECT COALESCE(SUM(amount_approved), 0) FROM payments WHERE status = 'approved') AS total_received`);
    res.json({ success: true, data: payments, summary });
  } catch (error) { next(error); }
};

exports.receipt = async (req, res, next) => {
  try {
    const [[payment]] = await pool.execute(
      'SELECT receipt_path FROM payments WHERE id = ?',
      [req.params.paymentId]
    );
    if (!payment) return res.status(404).json({ success: false, message: 'Bukti pembayaran tidak ditemukan' });
    const receiptDir = path.resolve(process.env.PAYMENT_RECEIPT_DIR || 'private/payment-receipts');
    const filePath = path.resolve(receiptDir, path.basename(payment.receipt_path));
    if (!filePath.startsWith(`${receiptDir}${path.sep}`)) {
      return res.status(400).json({ success: false, message: 'Path bukti pembayaran tidak valid' });
    }
    res.set('Cache-Control', 'no-store');
    res.sendFile(filePath, (error) => {
      if (error?.code === 'ENOENT') {
        res.status(404).json({ success: false, message: 'File bukti pembayaran tidak ditemukan di penyimpanan' });
      } else if (error) {
        next(error);
      }
    });
  } catch (error) { next(error); }
};

async function deliverReviewNotification(paymentId, payment) {
  const [[summary]] = await pool.query(
    `SELECT r.training_fee,
      COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.amount_approved ELSE 0 END), 0) AS paid_total
     FROM payments p
     JOIN registrants r ON r.id = p.registrant_id
     WHERE p.registrant_id = ?
     GROUP BY r.id, r.training_fee`,
    [payment.registrant_id]
  );
  const approved = payment.status === 'approved';
  const amount = new Intl.NumberFormat('id-ID').format(Number(payment.amount_approved || 0));
  const remaining = Math.max(0, Number(summary?.training_fee || 0) - Number(summary?.paid_total || 0));
  const text = approved
    ? `Pembayaran cicilan Rp${amount} untuk ${payment.registration_code} telah diverifikasi. Total terbayar Rp${new Intl.NumberFormat('id-ID').format(Number(summary?.paid_total || 0))}; sisa biaya pelatihan Rp${new Intl.NumberFormat('id-ID').format(remaining)}. Terima kasih.`
    : `Bukti pembayaran untuk ${payment.registration_code} belum dapat kami verifikasi. Alasan: ${payment.rejection_reason}. Silakan perbaiki dan kirim ulang bukti transfer.`;

  try {
    await sendWhatsAppMessage(payment.whatsapp, text);
    await pool.execute(
      "UPDATE payments SET notification_status = 'sent', notification_error = NULL WHERE id = ?",
      [paymentId]
    );
    return { sent: true };
  } catch (error) {
    await pool.execute(
      "UPDATE payments SET notification_status = 'failed', notification_error = ? WHERE id = ?",
      [error.message, paymentId]
    );
    return { sent: false, error: error.message };
  }
}

exports.review = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { status, rejection_reason: rejectionReason } = req.body;
    const amount = status === 'approved' ? Number(req.body.amount) : null;
    if (status === 'approved' && (!Number.isFinite(amount) || amount <= 0)) {
      return res.status(422).json({ success: false, message: 'Nominal pembayaran yang disetujui harus lebih dari 0' });
    }
    if (status === 'rejected' && !rejectionReason?.trim()) {
      return res.status(422).json({ success: false, message: 'Alasan penolakan wajib diisi' });
    }

    await connection.beginTransaction();
    const [[payment]] = await connection.execute(
      `SELECT p.*, r.whatsapp, r.registration_code
       FROM payments p JOIN registrants r ON r.id = p.registrant_id
       WHERE p.id = ? FOR UPDATE`,
      [req.params.paymentId]
    );
    if (!payment) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Pembayaran tidak ditemukan' });
    }
    if (payment.status !== 'pending') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Pembayaran ini sudah ditinjau' });
    }

    await connection.execute(
      `UPDATE payments SET status = ?, amount_approved = ?, rejection_reason = ?,
       reviewed_by = ?, reviewed_at = NOW(), notification_status = 'pending', notification_error = NULL
       WHERE id = ?`,
      [status, amount, status === 'rejected' ? rejectionReason.trim() : null, req.admin.id, payment.id]
    );
    await connection.commit();
    payment.status = status;
    payment.amount_approved = amount;
    payment.rejection_reason = status === 'rejected' ? rejectionReason.trim() : null;
    const notification = await deliverReviewNotification(payment.id, payment);
    res.json({
      success: true,
      message: notification.sent
        ? 'Pembayaran berhasil ditinjau dan notifikasi terkirim'
        : 'Pembayaran berhasil ditinjau, tetapi notifikasi WhatsApp gagal dikirim',
      data: { notification }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

exports.retryNotification = async (req, res, next) => {
  try {
    const [[payment]] = await pool.execute(
      `SELECT p.*, r.whatsapp, r.registration_code
       FROM payments p JOIN registrants r ON r.id = p.registrant_id
       WHERE p.id = ?`,
      [req.params.paymentId]
    );
    if (!payment) return res.status(404).json({ success: false, message: 'Pembayaran tidak ditemukan' });
    if (payment.status === 'pending') {
      return res.status(409).json({ success: false, message: 'Pembayaran belum ditinjau admin' });
    }
    const notification = await deliverReviewNotification(payment.id, payment);
    res.status(notification.sent ? 200 : 503).json({
      success: notification.sent,
      message: notification.sent ? 'Notifikasi berhasil dikirim ulang' : 'Notifikasi gagal dikirim',
      data: { notification }
    });
  } catch (error) { next(error); }
};
