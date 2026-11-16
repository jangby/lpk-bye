require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { PROGRAM_NAMES } = require('../utils/batchPrograms');

const fields = [
  ['pendidikan_terakhir', 'Pendidikan Terakhir', 'select', JSON.stringify(['SD', 'SMP', 'SMA/SMK', 'D3', 'S1']), 1],
  ['tanggal_lahir', 'Tanggal Lahir', 'date', null, 1],
  ['alamat', 'Alamat Lengkap', 'textarea', null, 1],
  ['motivasi', 'Motivasi Mengikuti Kelas', 'textarea', null, 1],
  ['foto_identitas', 'Foto/Scan Identitas', 'file', null, 0]
];

async function seedBatch(programType, batchName) {
  const [rows] = await pool.execute(
    'SELECT id FROM batches WHERE program_type = ? ORDER BY id LIMIT 1',
    [programType]
  );
  let batchId = rows[0]?.id;
  if (!batchId) {
    const description = programType === PROGRAM_NAMES[0]
      ? 'Gelombang Sertifikasi BNSP Digital Marketing LPK BYE.'
      : 'Gelombang Pelatihan Bahasa Jepang LPK BYE.';
    const [result] = await pool.execute(
      `INSERT INTO batches
       (batch_name, program_type, description, start_date, end_date, quota, training_fee, is_active)
       VALUES (?, ?, ?, COALESCE(?, CURDATE()), COALESCE(?, CURDATE()), 0, NULL, ?)`,
      [
        batchName,
        programType,
        description,
        process.env.SEED_START_DATE || null,
        process.env.SEED_END_DATE || null,
        false
      ]
    );
    batchId = result.insertId;
  }

  for (let index = 0; index < fields.length; index++) {
    const [name, label, type, options, required] = fields[index];
    await pool.execute(
      `INSERT IGNORE INTO form_fields
       (batch_id, field_name, field_label, field_type, options, is_required, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [batchId, name, label, type, options, required, index + 1]
    );
  }
}

async function seed() {
  const email = (process.env.ADMIN_EMAIL || 'admin@lpkbye.id').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.trim().length < 12) {
    throw new Error('Set ADMIN_PASSWORD to a value with at least 12 characters before seeding.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute(
    `INSERT INTO admin_users (name, email, password_hash, role)
     VALUES ('Administrator LPK BYE', ?, ?, 'super_admin')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [email, passwordHash]
  );

  await seedBatch(PROGRAM_NAMES[0], 'Gelombang 1 - Sertifikasi BNSP Digital Marketing');
  await seedBatch(PROGRAM_NAMES[1], 'Gelombang 1 - Pelatihan Bahasa Jepang');
  console.log(`Seed selesai. Login admin: ${email}`);
}

seed().then(() => pool.end()).catch((error) => {
  console.error('Seed gagal:', error.message);
  process.exit(1);
});
