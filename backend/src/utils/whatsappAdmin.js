const { normalizePhone } = require('./phone');

function getAdminPhones(value = process.env.WHATSAPP_ADMIN_PHONES || '') {
  const entries = String(value).split(/[;,]/).map((entry) => entry.trim()).filter(Boolean);
  const phones = entries.map((entry) => {
    const phone = normalizePhone(entry);
    if (!/^\d{8,15}$/.test(phone)) {
      throw new Error('WHATSAPP_ADMIN_PHONES berisi nomor yang tidak valid.');
    }
    return phone;
  });
  return [...new Set(phones)];
}

function isAdminPhone(senderPhone, adminPhones = getAdminPhones()) {
  const phone = normalizePhone(senderPhone);
  return Boolean(phone && adminPhones.includes(phone));
}

function parseAdminCommand(text) {
  const [prefix, ...parts] = String(text || '').trim().toLowerCase().split(/\s+/);
  if (prefix !== 'admin') return null;
  const command = parts.join(' ');
  if (['', 'menu', 'bantuan', 'help'].includes(command)) return 'help';
  if (['ringkasan', 'rekap', 'laporan', 'summary'].includes(command)) return 'summary';
  if (['hari ini', 'today'].includes(command)) return 'today';
  if (['pendaftar', 'pendaftaran', 'review', 'verifikasi'].includes(command)) return 'registrants';
  if (['pembayaran', 'transaksi', 'uang'].includes(command)) return 'payments';
  if (['gelombang', 'program'].includes(command)) return 'batches';
  return 'help';
}

function cleanMessageValue(value, fallback = '-') {
  const text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
  return text ? text.slice(0, 180) : fallback;
}

function formatCurrency(value) {
  return `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;
}

function buildAdminRegistrationMessage(registrant, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173') {
  const baseUrl = frontendUrl.replace(/\/+$/, '');
  return [
    'PENDAFTARAN BARU · LPK BYE',
    'Status: MENUNGGU REVIEW',
    `Nama: ${cleanMessageValue(registrant.full_name)}`,
    `Kode: ${cleanMessageValue(registrant.registration_code)}`,
    `Program: ${cleanMessageValue(registrant.program_type)}`,
    `Gelombang: ${cleanMessageValue(registrant.batch_name)}`,
    `WhatsApp: ${cleanMessageValue(registrant.whatsapp)}`,
    `Email: ${cleanMessageValue(registrant.email)}`,
    `Biaya: ${formatCurrency(registrant.training_fee)}`,
    'Mohon tinjau profil, jawaban, dan dokumen di dashboard:',
    `${baseUrl}/admin/registrants/${encodeURIComponent(registrant.id)}`
  ].join('\n');
}

function formatAdminSummary(registrants, payments, programStats, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173') {
  const programs = programStats.length
    ? programStats.map((item) => `• ${cleanMessageValue(item.program_type)}: ${Number(item.total) || 0} pendaftar · ${formatCurrency(item.received)} masuk`).join('\n')
    : '• Belum ada pendaftar';
  const baseUrl = frontendUrl.replace(/\/+$/, '');
  return [
    'RINGKASAN LPK BYE · SEMUA WAKTU',
    `Total pendaftar: ${Number(registrants.total) || 0}`,
    `Menunggu review: ${Number(registrants.pending) || 0}`,
    `Terverifikasi: ${Number(registrants.verified) || 0} · Diterima: ${Number(registrants.accepted) || 0} · Ditolak: ${Number(registrants.rejected) || 0}`,
    `Pendaftar hari ini: ${Number(registrants.today) || 0}`,
    `Notifikasi admin perlu perhatian: ${Number(registrants.admin_notifications_pending) || 0}`,
    '',
    `Pembayaran terverifikasi: ${Number(payments.approved_count) || 0} transaksi · ${formatCurrency(payments.received)}`,
    `Bukti menunggu review: ${Number(payments.pending_count) || 0} transaksi · perkiraan ${formatCurrency(payments.pending_amount)}`,
    '',
    'Pendaftar per program:',
    programs,
    '',
    `Dashboard: ${baseUrl}/admin/dashboard`
  ].join('\n');
}

function formatAdminToday(registrants, payments, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173') {
  const baseUrl = frontendUrl.replace(/\/+$/, '');
  return [
    'RINGKASAN HARI INI · LPK BYE',
    `Pendaftar baru: ${Number(registrants.total) || 0}`,
    `Menunggu review: ${Number(registrants.pending) || 0}`,
    `Pembayaran diverifikasi: ${Number(payments.approved_count) || 0} transaksi · ${formatCurrency(payments.received)}`,
    `Bukti pembayaran masuk: ${Number(payments.pending_count) || 0} transaksi menunggu review`,
    `Dashboard: ${baseUrl}/admin/dashboard`
  ].join('\n');
}

function formatPendingRegistrants(rows, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173') {
  const baseUrl = frontendUrl.replace(/\/+$/, '');
  const items = rows.length
    ? rows.map((row) => `• ${cleanMessageValue(row.full_name)} · ${cleanMessageValue(row.registration_code)} · ${cleanMessageValue(row.program_type)}`).join('\n')
    : 'Tidak ada pendaftar yang menunggu review.';
  return [
    'PENDAFTAR MENUNGGU REVIEW',
    items,
    '',
    `Dashboard: ${baseUrl}/admin/registrants`
  ].join('\n');
}

function formatPendingPayments(rows, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173') {
  const baseUrl = frontendUrl.replace(/\/+$/, '');
  const items = rows.length
    ? rows.map((row) => `• ${cleanMessageValue(row.full_name)} · ${cleanMessageValue(row.registration_code)} · perkiraan ${formatCurrency(row.amount_detected)}`).join('\n')
    : 'Tidak ada bukti pembayaran yang menunggu review.';
  return [
    'PEMBAYARAN MENUNGGU REVIEW',
    items,
    '',
    `Dashboard: ${baseUrl}/admin/payments`
  ].join('\n');
}

function formatActiveBatches(rows) {
  if (!rows.length) return 'Tidak ada gelombang aktif.';
  return [
    'GELOMBANG AKTIF · LPK BYE',
    ...rows.map((row) => {
      const quota = Number(row.quota) > 0 ? `${Number(row.registrant_count) || 0}/${Number(row.quota)}` : `${Number(row.registrant_count) || 0} pendaftar`;
      return `• ${cleanMessageValue(row.batch_name)}\n  ${cleanMessageValue(row.program_type)} · ${quota}`;
    })
  ].join('\n');
}

module.exports = {
  getAdminPhones,
  isAdminPhone,
  parseAdminCommand,
  buildAdminRegistrationMessage,
  formatAdminSummary,
  formatAdminToday,
  formatPendingRegistrants,
  formatPendingPayments,
  formatActiveBatches
};
