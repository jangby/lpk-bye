const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { parseJson } = require('../utils/helpers');
const { sendWhatsAppMessage } = require('../services/whatsappBot');
const { buildWelcomeMessage, buildStatusMessage } = require('../services/participantMessages');
const { createPortalToken, hashPortalToken, getPortalUrl } = require('../utils/participantPortal');

exports.login = async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM admin_users WHERE email = ? LIMIT 1',
      [req.body.email.toLowerCase()]);
    if (!rows.length || !(await bcrypt.compare(req.body.password, rows[0].password_hash))) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }
    const token = jwt.sign({ sub: rows[0].id, role: rows[0].role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
    res.json({ success: true, data: { token, admin: { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role } } });
  } catch (error) { next(error); }
};

exports.me = (req, res) => res.json({ success: true, data: req.admin });

exports.dashboard = async (req, res, next) => {
  try {
    const [[counts]] = await pool.query(`SELECT
      (SELECT COUNT(*) FROM batches) AS total_batches,
      (SELECT COUNT(*) FROM batches WHERE is_active = TRUE) AS active_batches,
      (SELECT COUNT(*) FROM registrants) AS total_registrants,
      (SELECT COUNT(*) FROM registrants WHERE status = 'pending') AS pending_registrants,
      (SELECT COUNT(*) FROM payments WHERE status = 'pending') AS pending_payments,
      (SELECT COALESCE(SUM(amount_approved), 0) FROM payments WHERE status = 'approved') AS total_payments_received`);
    res.json({ success: true, data: counts });
  } catch (error) { next(error); }
};

exports.listBatches = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT b.*, COUNT(r.id) AS registrant_count
      FROM batches b LEFT JOIN registrants r ON r.batch_id = b.id
      GROUP BY b.id ORDER BY b.created_at DESC`);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
};

exports.createBatch = async (req, res, next) => {
  try {
    const {
      batch_name, program_type = 'Bahasa Jepang', description, start_date, end_date,
      quota = 0, training_fee = 0, payment_instructions = null, is_active = false
    } = req.body;
    if (end_date < start_date) return res.status(422).json({ success: false, message: 'Tanggal selesai tidak boleh sebelum tanggal mulai' });
    const [result] = await pool.execute(
      `INSERT INTO batches
       (batch_name, program_type, description, start_date, end_date, quota, training_fee, payment_instructions, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batch_name, program_type, description || null, start_date, end_date, quota, training_fee, payment_instructions, is_active]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
};

exports.updateBatch = async (req, res, next) => {
  try {
    const allowed = ['batch_name', 'program_type', 'description', 'start_date', 'end_date', 'quota', 'training_fee', 'payment_instructions', 'is_active'];
    const entries = Object.entries(req.body).filter(([key]) => allowed.includes(key));
    if (!entries.length) return res.status(422).json({ success: false, message: 'Tidak ada data yang diperbarui' });
    const fields = entries.map(([key]) => `${key} = ?`);
    const values = entries.map(([, value]) => value);
    const [result] = await pool.execute(`UPDATE batches SET ${fields.join(', ')} WHERE id = ?`, [...values, req.params.batchId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Batch tidak ditemukan' });
    res.json({ success: true, message: 'Batch berhasil diperbarui' });
  } catch (error) { next(error); }
};

exports.deleteBatch = async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM batches WHERE id = ?', [req.params.batchId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Batch tidak ditemukan' });
    res.json({ success: true, message: 'Batch berhasil dihapus' });
  } catch (error) { next(error); }
};

exports.getFields = async (req, res, next) => {
  try {
    const [fields] = await pool.execute(
      `SELECT id, batch_id, field_name, field_label, field_type, options, is_required, order_index
       FROM form_fields WHERE batch_id = ? ORDER BY order_index, id`,
      [req.params.batchId]
    );
    fields.forEach((field) => {
      if (typeof field.options === 'string') {
        try { field.options = JSON.parse(field.options); } catch { field.options = null; }
      }
    });
    res.json({ success: true, data: fields });
  } catch (error) { next(error); }
};

exports.addField = async (req, res, next) => {
  try {
    const { field_name, field_label, field_type, options, is_required = false, order_index = 0 } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO form_fields (batch_id, field_name, field_label, field_type, options, is_required, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.batchId, field_name, field_label, field_type, options ? JSON.stringify(options) : null, is_required, order_index]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
};

exports.updateField = async (req, res, next) => {
  try {
    const allowed = ['field_name', 'field_label', 'field_type', 'options', 'is_required', 'order_index'];
    const entries = Object.entries(req.body).filter(([key]) => allowed.includes(key));
    if (!entries.length) return res.status(422).json({ success: false, message: 'Tidak ada data yang diperbarui' });
    const values = entries.map(([key, value]) => key === 'options' && value != null ? JSON.stringify(value) : value);
    const [result] = await pool.execute(`UPDATE form_fields SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`,
      [...values, req.params.fieldId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Field tidak ditemukan' });
    res.json({ success: true, message: 'Field berhasil diperbarui' });
  } catch (error) { next(error); }
};

exports.deleteField = async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM form_fields WHERE id = ?', [req.params.fieldId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Field tidak ditemukan' });
    res.json({ success: true, message: 'Field berhasil dihapus' });
  } catch (error) { next(error); }
};

exports.registrants = async (req, res, next) => {
  try {
    const [registrants] = await pool.execute(
      `SELECT r.id, r.batch_id, r.training_fee, r.full_name, r.whatsapp, r.email,
       r.registration_code, r.status, r.notes, r.participant_feedback,
       r.welcome_notification_status, r.welcome_notification_error,
       r.status_notification_status, r.status_notification_error, r.created_at, r.updated_at,
       COALESCE((SELECT SUM(p.amount_approved) FROM payments p
         WHERE p.registrant_id = r.id AND p.status = 'approved'), 0) AS paid_total,
       GREATEST(r.training_fee - COALESCE((SELECT SUM(p.amount_approved) FROM payments p
         WHERE p.registrant_id = r.id AND p.status = 'approved'), 0), 0) AS balance_due
       FROM registrants r JOIN batches b ON b.id = r.batch_id
       WHERE r.batch_id = ? ORDER BY r.created_at DESC`,
      [req.params.batchId]
    );
    const [answers] = await pool.query(
      `SELECT a.registrant_id, f.field_name, f.field_label, a.answer_value
       FROM registrant_answers a JOIN form_fields f ON f.id = a.field_id
       JOIN registrants r ON r.id = a.registrant_id WHERE r.batch_id = ?`,
      [req.params.batchId]
    );
    for (const registrant of registrants) {
      registrant.answers = answers.filter((answer) => answer.registrant_id === registrant.id);
    }
    res.json({ success: true, data: registrants });
  } catch (error) { next(error); }
};

exports.updateRegistrantStatus = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[registrant]] = await connection.execute(
      `SELECT r.*, b.batch_name, b.start_date, b.end_date, b.payment_instructions
       FROM registrants r JOIN batches b ON b.id = r.batch_id
       WHERE r.id = ? FOR UPDATE`,
      [req.params.registrantId]
    );
    if (!registrant) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Pendaftar tidak ditemukan' });
    }

    const notes = req.body.notes === undefined ? registrant.notes : (req.body.notes || null);
    const feedback = req.body.feedback === undefined
      ? registrant.participant_feedback
      : (req.body.feedback.trim() || null);
    if (req.body.status === 'rejected' && !feedback) {
      await connection.rollback();
      return res.status(422).json({ success: false, message: 'Pesan untuk peserta wajib diisi saat menolak pendaftaran' });
    }
    const shouldNotify = req.body.status !== registrant.status || feedback !== registrant.participant_feedback;
    await connection.execute(
      `UPDATE registrants SET status = ?, notes = ?, participant_feedback = ?,
       status_notification_status = ?, status_notification_error = ?
       WHERE id = ?`,
      [
        req.body.status,
        notes,
        feedback,
        shouldNotify ? 'pending' : registrant.status_notification_status,
        shouldNotify ? null : registrant.status_notification_error,
        registrant.id
      ]
    );
    await connection.commit();

    registrant.status = req.body.status;
    registrant.notes = notes;
    registrant.participant_feedback = feedback;
    const notification = shouldNotify
      ? await deliverRegistrantNotification(registrant, 'status')
      : null;
    res.json({
      success: true,
      message: notification && !notification.sent
        ? 'Status pendaftaran tersimpan, tetapi pesan WhatsApp gagal dikirim'
        : 'Status pendaftaran berhasil diperbarui',
      data: { notification }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

async function deliverRegistrantNotification(registrant, type, portalUrl = null) {
  const statusField = type === 'welcome' ? 'welcome_notification' : 'status_notification';
  const message = type === 'welcome'
    ? buildWelcomeMessage(registrant, portalUrl)
    : buildStatusMessage(registrant);
  try {
    await sendWhatsAppMessage(registrant.whatsapp, message);
    await pool.execute(
      `UPDATE registrants SET ${statusField}_status = 'sent', ${statusField}_error = NULL WHERE id = ?`,
      [registrant.id]
    );
    return { sent: true };
  } catch (error) {
    await pool.execute(
      `UPDATE registrants SET ${statusField}_status = 'failed', ${statusField}_error = ? WHERE id = ?`,
      [error.message, registrant.id]
    );
    return { sent: false, error: error.message };
  }
}

exports.retryRegistrantNotification = async (req, res, next) => {
  try {
    const type = req.body.type || 'status';
    const [[registrant]] = await pool.execute(
      `SELECT r.*, b.batch_name, b.start_date, b.end_date, b.payment_instructions
       FROM registrants r JOIN batches b ON b.id = r.batch_id
       WHERE r.id = ?`,
      [req.params.registrantId]
    );
    if (!registrant) {
      return res.status(404).json({ success: false, message: 'Pendaftar tidak ditemukan' });
    }

    let portalUrl = null;
    if (type === 'welcome') {
      const portalToken = createPortalToken();
      await pool.execute(
        `UPDATE registrants
         SET portal_token_hash = ?, welcome_notification_status = 'pending', welcome_notification_error = NULL
         WHERE id = ?`,
        [hashPortalToken(portalToken), registrant.id]
      );
      portalUrl = getPortalUrl(portalToken);
    } else {
      await pool.execute(
        "UPDATE registrants SET status_notification_status = 'pending', status_notification_error = NULL WHERE id = ?",
        [registrant.id]
      );
    }

    const notification = await deliverRegistrantNotification(registrant, type, portalUrl);
    if (type === 'welcome' && !notification.sent) {
      await pool.execute(
        'UPDATE registrants SET portal_token_hash = ? WHERE id = ?',
        [registrant.portal_token_hash, registrant.id]
      );
    }
    res.status(notification.sent ? 200 : 503).json({
      success: notification.sent,
      message: notification.sent ? 'Pesan WhatsApp berhasil dikirim' : 'Pesan WhatsApp gagal dikirim',
      data: { notification }
    });
  } catch (error) { next(error); }
};
