function getBotCommand(text) {
  const command = String(text || '').trim().toLowerCase().split(/\s+/)[0];
  if (['menu', 'bantuan', 'help', 'hai', 'halo', 'hi'].includes(command)) return 'menu';
  if (['status', 'daftar', 'pendaftaran'].includes(command)) return 'status';
  if (['biaya', 'pembayaran', 'cicilan'].includes(command)) return 'payment';
  if (['jadwal', 'kelas', 'program'].includes(command)) return 'schedule';
  if (['portal', 'link'].includes(command)) return 'portal';
  return null;
}

function getStatusLabel(status) {
  return ({
    pending: 'Menunggu verifikasi',
    verified: 'Terverifikasi',
    accepted: 'Diterima',
    rejected: 'Ditolak'
  })[status] || status;
}

module.exports = { getBotCommand, getStatusLabel };
