const { pool } = require('../config/database');
const { registrationCode, whatsappUrl, parseJson } = require('../utils/helpers');
const { getWhatsAppStatus, sendWhatsAppMessage } = require('../services/whatsappBot');
const { notifyAdminsOfRegistration } = require('../services/adminWhatsApp');
const { buildWelcomeMessage } = require('../services/participantMessages');
const { createPortalToken, hashPortalToken, getPortalUrl } = require('../utils/participantPortal');
const { isBatchOpen } = require('../utils/batchPrograms');

exports.health = async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'Backend dan database aktif' });
  } catch (error) { next(error); }
};

exports.activeBatch = async (req, res, next) => {
  try {
    const [batches] = await pool.execute(
      `SELECT id, batch_name, program_type, description, start_date, end_date, quota, training_fee, is_active
       FROM batches WHERE is_active = TRUE AND end_date >= CURDATE()
       ORDER BY start_date DESC, created_at DESC`
    );
    if (!batches.length) return res.status(404).json({ success: false, message: 'Belum ada gelombang aktif' });

    const batchIds = batches.map((batch) => batch.id);
    const placeholders = batchIds.map(() => '?').join(', ');
    const [fieldRows] = await pool.execute(
      `SELECT id, batch_id, field_name, field_label, field_type, options, is_required, order_index
       FROM form_fields WHERE batch_id IN (${placeholders}) ORDER BY batch_id, order_index, id`,
      batchIds
    );
    const [registrantCounts] = await pool.execute(
      `SELECT batch_id, COUNT(*) AS registrant_count FROM registrants
       WHERE batch_id IN (${placeholders}) GROUP BY batch_id`,
      batchIds
    );
    const counts = new Map(registrantCounts.map((row) => [Number(row.batch_id), Number(row.registrant_count)]));
    const fieldsByBatch = new Map(batches.map((batch) => [Number(batch.id), []]));
    for (const field of fieldRows) {
      field.options = parseJson(field.options, null);
      fieldsByBatch.get(Number(field.batch_id)).push(field);
    }
    res.json({
      success: true,
      data: {
        batches: batches.map((batch) => {
          const registrantCount = counts.get(Number(batch.id)) || 0;
          return {
            ...batch,
            registrant_count: registrantCount,
            is_full: batch.quota > 0 && registrantCount >= batch.quota,
            fields: fieldsByBatch.get(Number(batch.id))
          };
        })
      }
    });
  } catch (error) { next(error); }
};

exports.register = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const batchId = Number(req.body.batch_id);
    let answers = req.body.answers;
    if (typeof answers === 'string') answers = JSON.parse(answers);
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw Object.assign(new Error('answers harus berupa objek'), { status: 422 });
    }

    await connection.beginTransaction();
    const [[batch]] = await connection.execute(
      `SELECT id, batch_name, program_type, quota, training_fee, payment_instructions, start_date, end_date, is_active
       FROM batches WHERE id = ? FOR UPDATE`,
      [batchId]
    );
    if (!isBatchOpen(batch)) {
      throw Object.assign(new Error('Gelombang tidak tersedia untuk pendaftaran'), { status: 404 });
    }
    const [[{ before_batch_end }]] = await connection.execute(
      'SELECT end_date >= CURDATE() AS before_batch_end FROM batches WHERE id = ?',
      [batchId]
    );
    if (!before_batch_end) {
      throw Object.assign(new Error('Gelombang sudah berakhir dan pendaftaran ditutup'), { status: 404 });
    }
    if (batch.training_fee == null) {
      throw Object.assign(new Error('Biaya gelombang ini belum ditetapkan'), { status: 409 });
    }
    const [[{ registered }]] = await connection.execute(
      'SELECT COUNT(*) AS registered FROM registrants WHERE batch_id = ?',
      [batchId]
    );
    if (batch.quota > 0 && registered >= batch.quota) {
      throw Object.assign(new Error('Kuota gelombang sudah penuh'), { status: 409 });
    }

    const [fields] = await connection.execute(
      'SELECT id, field_name, field_label, field_type, is_required FROM form_fields WHERE batch_id = ?',
      [batchId]
    );
    for (const field of fields) {
      const value = answers[field.field_name];
      const fileProvided = req.files?.some((file) => file.fieldname === field.field_name);
      const missingStandardValue = value === undefined || value === null || String(value).trim() === '';
      if ((field.is_required && field.field_type !== 'file' && missingStandardValue) ||
          (field.is_required && field.field_type === 'file' && !fileProvided)) {
        throw Object.assign(new Error(`${field.field_label} wajib diisi`), { status: 422 });
      }
    }

    req.files?.forEach((file) => {
      answers[file.fieldname] = `/uploads/${file.filename}`;
    });

    let code;
    let portalToken;
    let inserted = false;
    let registrantId = null;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      code = registrationCode();
      portalToken = createPortalToken();
      let result;
      try {
        [result] = await connection.execute(
          `INSERT INTO registrants
           (batch_id, program_type, training_fee, full_name, whatsapp, email, registration_code,
            portal_token_hash, admin_notification_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            batchId,
            batch.program_type,
            batch.training_fee,
            req.body.full_name.trim(),
            req.body.whatsapp.trim(),
            req.body.email || null,
            code,
            hashPortalToken(portalToken)
          ]
        );
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') continue;
        throw error;
      }

      registrantId = result.insertId;
      for (const field of fields) {
        if (answers[field.field_name] !== undefined) {
          await connection.execute(
            'INSERT INTO registrant_answers (registrant_id, field_id, answer_value) VALUES (?, ?, ?)',
            [registrantId, field.id, String(answers[field.field_name])]
          );
        }
      }
      inserted = true;
      await connection.commit();
    }
    if (!inserted) throw new Error('Kode pendaftaran tidak berhasil dibuat');
    const portalUrl = getPortalUrl(portalToken);
    let notificationStatus = 'sent';
    try {
      await sendWhatsAppMessage(req.body.whatsapp.trim(), buildWelcomeMessage({
        full_name: req.body.full_name.trim(),
        registration_code: code,
        batch_name: batch.batch_name,
        program_type: batch.program_type,
        start_date: batch.start_date,
        end_date: batch.end_date,
        training_fee: batch.training_fee,
        payment_instructions: batch.payment_instructions || ''
      }, portalUrl));
      await pool.execute(
        "UPDATE registrants SET welcome_notification_status = 'sent', welcome_notification_error = NULL WHERE id = ?",
        [registrantId]
      );
    } catch (error) {
      notificationStatus = 'failed';
      console.error('Pesan sambutan pendaftar gagal dikirim:', error.message);
      try {
        await pool.execute(
          "UPDATE registrants SET welcome_notification_status = 'failed', welcome_notification_error = ? WHERE id = ?",
          [error.message, registrantId]
        );
      } catch (saveError) {
        console.error('Status pesan sambutan gagal disimpan:', saveError.message);
      }
    }

    let adminNotification = { status: 'failed', error: 'Pengiriman notifikasi belum berhasil.' };
    try {
      adminNotification = await notifyAdminsOfRegistration({
        id: registrantId,
        full_name: req.body.full_name.trim(),
        registration_code: code,
        program_type: batch.program_type,
        batch_name: batch.batch_name,
        whatsapp: req.body.whatsapp.trim(),
        email: req.body.email,
        training_fee: batch.training_fee
      }, sendWhatsAppMessage);
      if (adminNotification.status !== 'sent') {
        console.error(`Notifikasi pendaftar baru ke WhatsApp admin: ${adminNotification.status}.`);
      }
    } catch (error) {
      adminNotification = { status: 'failed', error: error.message };
      console.error('Notifikasi pendaftar baru ke WhatsApp admin gagal:', error.message);
    }
    try {
      await pool.execute(
        'UPDATE registrants SET admin_notification_status = ?, admin_notification_error = ? WHERE id = ?',
        [adminNotification.status, adminNotification.error || null, registrantId]
      );
    } catch (error) {
      console.error('Status notifikasi admin gagal disimpan:', error.message);
    }

    const bot = getWhatsAppStatus();
    return res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil',
      data: {
        registration_code: code,
        batch_name: batch.batch_name,
        program_type: batch.program_type,
        portal_url: portalUrl,
        notification: {
          status: notificationStatus,
          message: notificationStatus === 'sent'
            ? 'Informasi pendaftaran sudah dikirim ke WhatsApp peserta.'
            : 'Pendaftaran berhasil, tetapi pesan WhatsApp belum terkirim. Simpan tautan portal ini.'
        },
        whatsapp_url: whatsappUrl(code, req.body.full_name.trim()),
        payment: {
          training_fee: batch.training_fee,
          bot_phone: bot.connected ? bot.phone : null
        }
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

exports.participantPortal = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, private');
    const tokenHash = hashPortalToken(req.params.token);
    const [[registrant]] = await pool.execute(
      `SELECT r.id, r.full_name, r.registration_code, r.status, r.participant_feedback,
        r.program_type, r.training_fee, r.created_at, b.batch_name, b.description,
        b.start_date, b.end_date, b.payment_instructions,
        COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.amount_approved ELSE 0 END), 0) AS paid_total
       FROM registrants r
       JOIN batches b ON b.id = r.batch_id
       LEFT JOIN payments p ON p.registrant_id = r.id
       WHERE r.portal_token_hash = ?
       GROUP BY r.id, b.id`,
      [tokenHash]
    );
    if (!registrant) {
      return res.status(404).json({ success: false, message: 'Tautan portal tidak valid atau sudah diperbarui.' });
    }

    const [payments] = await pool.execute(
      `SELECT id, amount_detected, amount_approved, status, rejection_reason, created_at, reviewed_at
       FROM payments WHERE registrant_id = ? ORDER BY created_at DESC LIMIT 100`,
      [registrant.id]
    );
    const trainingFee = Number(registrant.training_fee || 0);
    const paidTotal = Number(registrant.paid_total || 0);
    res.json({
      success: true,
      data: {
        participant: {
          full_name: registrant.full_name,
          registration_code: registrant.registration_code,
          status: registrant.status,
          feedback: registrant.participant_feedback,
          registered_at: registrant.created_at
        },
        training: {
          batch_name: registrant.batch_name,
          program_type: registrant.program_type,
          description: registrant.description,
          start_date: registrant.start_date,
          end_date: registrant.end_date
        },
        payment: {
          training_fee: trainingFee,
          paid_total: paidTotal,
          balance_due: Math.max(0, trainingFee - paidTotal),
          instructions: ['verified', 'accepted'].includes(registrant.status) && trainingFee > 0
            ? registrant.payment_instructions || ''
            : '',
          bot_phone: getWhatsAppStatus().phone || process.env.WHATSAPP_NUMBER || null,
          transactions: payments.map((payment) => ({
            ...payment,
            amount_detected: payment.amount_detected == null ? null : Number(payment.amount_detected),
            amount_approved: payment.amount_approved == null ? null : Number(payment.amount_approved)
          }))
        }
      }
    });
  } catch (error) { next(error); }
};
