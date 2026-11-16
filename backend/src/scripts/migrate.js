require('dotenv').config();
const statements = require('../config/schema');
const { pool } = require('../config/database');

async function migrate() {
  for (const sql of statements) await pool.query(sql);
  const [trainingFee] = await pool.query("SHOW COLUMNS FROM batches LIKE 'training_fee'");
  if (!trainingFee.length) {
    await pool.query('ALTER TABLE batches ADD COLUMN training_fee DECIMAL(12,2) UNSIGNED NOT NULL DEFAULT 0 AFTER quota');
  }
  const [paymentInstructions] = await pool.query("SHOW COLUMNS FROM batches LIKE 'payment_instructions'");
  if (!paymentInstructions.length) {
    await pool.query('ALTER TABLE batches ADD COLUMN payment_instructions TEXT AFTER training_fee');
  }
  const [registrantFee] = await pool.query("SHOW COLUMNS FROM registrants LIKE 'training_fee'");
  if (!registrantFee.length) {
    await pool.query('ALTER TABLE registrants ADD COLUMN training_fee DECIMAL(12,2) UNSIGNED NOT NULL DEFAULT 0 AFTER batch_id');
    await pool.query(`UPDATE registrants r JOIN batches b ON b.id = r.batch_id
      SET r.training_fee = b.training_fee`);
  }
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
  console.log('Skema MySQL berhasil dibuat.');
  await pool.end();
}

migrate().catch((error) => {
  console.error('Migrasi gagal:', error.message);
  process.exit(1);
});
