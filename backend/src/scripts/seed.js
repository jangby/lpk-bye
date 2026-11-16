require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

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

  const [rows] = await pool.execute('SELECT id FROM batches WHERE batch_name = ? LIMIT 1',
    ['Gelombang 1 - Bahasa Jepang Pemula (N5)']);
  let batchId;
  if (rows.length) {
    batchId = rows[0].id;
  } else {
    const [result] = await pool.execute(
      `INSERT INTO batches
       (batch_name, program_type, description, start_date, end_date, quota, is_active)
       VALUES ('Gelombang 1 - Bahasa Jepang Pemula (N5)', 'Bahasa Jepang',
         'Persiapan dasar bahasa Jepang untuk kebutuhan magang dan kerja di Jepang.',
         ?, ?, 30, TRUE)`,
      [process.env.SEED_START_DATE || '2026-01-01', process.env.SEED_END_DATE || '2026-12-31']
    );
    batchId = result.insertId;
  }
  const fields = [
    ['pendidikan_terakhir', 'Pendidikan Terakhir', 'select', JSON.stringify(['SD', 'SMP', 'SMA/SMK', 'D3', 'S1']), 1],
    ['tanggal_lahir', 'Tanggal Lahir', 'date', null, 1],
    ['alamat', 'Alamat Lengkap', 'textarea', null, 1],
    ['motivasi', 'Motivasi Mengikuti Kelas', 'textarea', null, 1],
    ['foto_identitas', 'Foto/Scan Identitas', 'file', null, 0]
  ];
  for (let index = 0; index < fields.length; index++) {
    const [name, label, type, options, required] = fields[index];
    await pool.execute(
      `INSERT INTO form_fields (batch_id, field_name, field_label, field_type, options, is_required, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE field_label = VALUES(field_label), field_type = VALUES(field_type),
       options = VALUES(options), is_required = VALUES(is_required), order_index = VALUES(order_index)`,
      [batchId, name, label, type, options, required, index + 1]
    );
  }
  console.log(`Seed selesai. Login admin: ${email}`);
}

seed().then(() => pool.end()).catch((error) => {
  console.error('Seed gagal:', error.message);
  process.exit(1);
});
