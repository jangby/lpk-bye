require('dotenv').config();
const statements = require('../config/schema');
const { pool } = require('../config/database');
const { PROGRAM_NAMES } = require('../utils/batchPrograms');

function parseProgramOptions(value) {
  if (value == null) return [];
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error('Data program gelombang lama tidak valid.');
  return parsed;
}

function canonicalProgram(name) {
  const normalized = String(name || '').trim().toUpperCase();
  if (['BAHASA JEPANG', 'PELATIHAN BAHASA JEPANG'].includes(normalized)) {
    return PROGRAM_NAMES[1];
  }
  if (normalized === 'SERTIFIKASI BNSP DIGITAL MARKETING') {
    return PROGRAM_NAMES[0];
  }
  return null;
}

function batchNameForProgram(batchName, programType) {
  const baseName = batchName
    .replace(/\s*-\s*Program LPK BYE$/i, '')
    .replace(/\s*-\s*Bahasa Jepang Pemula(?:\s*\(N5\))?$/i, '')
    .trim();
  const label = programType === 'PELATIHAN BAHASA JEPANG'
    ? 'Pelatihan Bahasa Jepang'
    : 'Sertifikasi BNSP Digital Marketing';
  return `${baseName || 'Gelombang'} - ${label}`.slice(0, 150);
}

async function migrate() {
  for (const sql of statements) await pool.query(sql);
  const [trainingFee] = await pool.query("SHOW COLUMNS FROM batches LIKE 'training_fee'");
  if (!trainingFee.length) {
    await pool.query('ALTER TABLE batches ADD COLUMN training_fee DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER quota');
  } else {
    await pool.query('ALTER TABLE batches MODIFY COLUMN training_fee DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL');
  }
  const [paymentInstructions] = await pool.query("SHOW COLUMNS FROM batches LIKE 'payment_instructions'");
  if (!paymentInstructions.length) {
    await pool.query('ALTER TABLE batches ADD COLUMN payment_instructions TEXT AFTER training_fee');
  }
  const [registrantFee] = await pool.query("SHOW COLUMNS FROM registrants LIKE 'training_fee'");
  if (!registrantFee.length) {
    await pool.query('ALTER TABLE registrants ADD COLUMN training_fee DECIMAL(12,2) UNSIGNED NOT NULL DEFAULT 0 AFTER batch_id');
    await pool.query(`UPDATE registrants r JOIN batches b ON b.id = r.batch_id
      SET r.training_fee = COALESCE(b.training_fee, 0)`);
  }
  const [registrantProgram] = await pool.query("SHOW COLUMNS FROM registrants LIKE 'program_type'");
  if (!registrantProgram.length) {
    await pool.query("ALTER TABLE registrants ADD COLUMN program_type VARCHAR(100) NOT NULL DEFAULT '' AFTER batch_id");
  }

  const [programsColumn] = await pool.query("SHOW COLUMNS FROM batches LIKE 'programs'");
  if (programsColumn.length) {
    const [batches] = await pool.query('SELECT * FROM batches ORDER BY id');
    for (const batch of batches) {
      const options = parseProgramOptions(batch.programs)
        .map((option) => ({
          name: canonicalProgram(option.name),
          quota: Number(option.quota ?? batch.quota ?? 0),
          trainingFee: option.training_fee == null
            ? (Number(batch.training_fee) > 0 ? Number(batch.training_fee) : null)
            : Number(option.training_fee)
        }))
        .filter((option) => option.name);
      if (options.length < 2) {
        const programType = canonicalProgram(batch.program_type) || options[0]?.name;
        if (programType) {
          await pool.execute('UPDATE batches SET program_type = ? WHERE id = ?', [programType, batch.id]);
          await pool.execute(
            `UPDATE registrants SET program_type = ?, training_fee = COALESCE(?, training_fee)
             WHERE batch_id = ? AND (program_type = '' OR program_type = 'Bahasa Jepang')`,
            [programType, options[0]?.trainingFee ?? null, batch.id]
          );
        }
        continue;
      }

      const primary = options.find((option) => option.name === 'PELATIHAN BAHASA JEPANG') || options[0];
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(
          `UPDATE registrants SET program_type = ?, training_fee = COALESCE(?, training_fee)
           WHERE batch_id = ? AND (program_type = '' OR program_type = 'Bahasa Jepang'
             OR program_type LIKE '%,%')`,
          [primary.name, primary.trainingFee, batch.id]
        );
        await connection.execute(
          `UPDATE batches SET batch_name = ?, program_type = ?, quota = ?, training_fee = ?
           WHERE id = ?`,
          [
            batchNameForProgram(batch.batch_name, primary.name),
            primary.name,
            primary.quota,
            primary.trainingFee,
            batch.id
          ]
        );
        for (const option of options.filter((item) => item.name !== primary.name)) {
          const [result] = await connection.execute(
            `INSERT INTO batches
             (batch_name, program_type, description, start_date, end_date, quota, training_fee,
              payment_instructions, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              batchNameForProgram(batch.batch_name, option.name),
              option.name,
              batch.description,
              batch.start_date,
              batch.end_date,
              option.quota,
              option.trainingFee,
              batch.payment_instructions,
              batch.is_active
            ]
          );
          await connection.execute(
            `UPDATE registrants SET batch_id = ?, program_type = ?, training_fee = COALESCE(?, training_fee)
             WHERE batch_id = ? AND program_type = ?`,
            [result.insertId, option.name, option.trainingFee, batch.id, option.name]
          );
          await connection.execute(
            `INSERT INTO form_fields
             (batch_id, field_name, field_label, field_type, options, is_required, order_index)
             SELECT ?, field_name, field_label, field_type, options, is_required, order_index
             FROM form_fields WHERE batch_id = ?`,
            [result.insertId, batch.id]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    await pool.query('ALTER TABLE batches DROP COLUMN programs');
  } else {
    await pool.query(`UPDATE batches SET program_type = 'PELATIHAN BAHASA JEPANG'
      WHERE program_type = 'Bahasa Jepang'`);
    await pool.query(`UPDATE registrants SET program_type = 'PELATIHAN BAHASA JEPANG'
      WHERE program_type = 'Bahasa Jepang'`);
  }
  await pool.query(`UPDATE registrants r JOIN batches b ON b.id = r.batch_id
    SET r.program_type = b.program_type WHERE r.program_type = ''`);
  await pool.query(`UPDATE batches SET batch_name = 'Gelombang 1 - Pelatihan Bahasa Jepang'
    WHERE batch_name = 'Gelombang 1 - Bahasa Jepang Pemula (N5)'`);
  const registrantColumns = [
    ['portal_token_hash', 'CHAR(64) NULL AFTER registration_code'],
    ['participant_feedback', 'TEXT NULL AFTER notes'],
    ['welcome_notification_status', "VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER participant_feedback"],
    ['welcome_notification_error', 'TEXT NULL AFTER welcome_notification_status'],
    ['status_notification_status', "VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER welcome_notification_error"],
    ['status_notification_error', 'TEXT NULL AFTER status_notification_status']
  ];
  for (const [name, definition] of registrantColumns) {
    const [column] = await pool.query(`SHOW COLUMNS FROM registrants LIKE '${name}'`);
    if (!column.length) {
      await pool.query(`ALTER TABLE registrants ADD COLUMN ${name} ${definition}`);
    }
  }
  const [portalIndex] = await pool.query(
    "SHOW INDEX FROM registrants WHERE Key_name = 'uq_registrants_portal_token_hash'"
  );
  if (!portalIndex.length) {
    await pool.query('ALTER TABLE registrants ADD UNIQUE KEY uq_registrants_portal_token_hash (portal_token_hash)');
  }
  await pool.query('INSERT IGNORE INTO site_settings (id, logo_url) VALUES (1, NULL)');
  const defaultFaqs = [
    ['Program apa saja yang tersedia?', 'LPK BYE memiliki Sertifikasi BNSP Digital Marketing dan Pelatihan Bahasa Jepang. Setiap program memiliki gelombang dan jadwal pendaftaran masing-masing.'],
    ['Siapa saja yang dapat mengikuti kelas?', 'Kelas terbuka untuk lulusan SMP/SMA/SMK, fresh graduate, maupun calon pekerja yang memenuhi persyaratan gelombang.'],
    ['Apakah ada persyaratan usia?', 'Persyaratan dapat berbeda berdasarkan program. Informasi lengkap akan dikonfirmasi tim administrasi.'],
    ['Bagaimana cara mendaftar?', 'Pilih gelombang program yang tersedia, lengkapi formulir pendaftaran, lalu tunggu konfirmasi dari admin melalui WhatsApp.'],
    ['Dokumen apa yang perlu disiapkan?', 'Umumnya identitas diri, data pendidikan, foto, dan dokumen pendukung sesuai informasi pada formulir.'],
    ['Apakah LPK menjamin penempatan kerja?', 'LPK memberikan pembelajaran dan pendampingan. Keputusan penempatan mengikuti ketentuan mitra dan hasil seleksi peserta.']
  ];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[{ faqs_initialized: faqsInitialized }]] = await connection.query(
      'SELECT faqs_initialized FROM site_settings WHERE id = 1 FOR UPDATE'
    );
    if (!faqsInitialized) {
      for (let index = 0; index < defaultFaqs.length; index++) {
        await connection.execute(
          'INSERT INTO landing_faqs (question, answer, sort_order, is_active) VALUES (?, ?, ?, TRUE)',
          [...defaultFaqs[index], index + 1]
        );
      }
      await connection.query('UPDATE site_settings SET faqs_initialized = TRUE WHERE id = 1');
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  console.log('Skema MySQL berhasil dibuat.');
  await pool.end();
}

migrate().catch((error) => {
  console.error('Migrasi gagal:', error.message);
  process.exit(1);
});
