function formatCurrency(value) {
  return `Rp${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function buildWelcomeMessage(registrant, portalUrl) {
  const lines = [
    `Halo ${registrant.full_name}, terima kasih sudah mendaftar di LPK BYE!`,
    `Kode pendaftaran: ${registrant.registration_code}`,
    `Program: ${registrant.batch_name}`,
    `Periode pelatihan: ${formatDate(registrant.start_date)} - ${formatDate(registrant.end_date)}`,
    `Status saat ini: menunggu verifikasi admin.`
  ];

  if (Number(registrant.training_fee) > 0) {
    lines.push(
      `Biaya pelatihan: ${formatCurrency(registrant.training_fee)}. Pembayaran dapat dicicil.`,
      'Mohon tunggu verifikasi pendaftaran sebelum melakukan transfer. Instruksi pembayaran akan dikirim setelah pendaftaran diverifikasi.'
    );
  }

  lines.push(
    'Simpan tautan portal pribadi berikut untuk melihat status dan pembayaran:',
    portalUrl
  );
  if (Number(registrant.training_fee) > 0) {
    lines.push('Setelah pendaftaran diverifikasi, kirim foto bukti transfer melalui chat ini. Ketik MENU untuk melihat bantuan bot.');
  } else {
    lines.push('Ketik MENU untuk melihat bantuan bot atau hubungi admin jika membutuhkan informasi lebih lanjut.');
  }
  return lines.join('\n\n');
}

function buildStatusMessage(registrant) {
  const lines = [];
  if (registrant.status === 'rejected') {
    lines.push(
      `Halo ${registrant.full_name}, mohon maaf pendaftaran ${registrant.registration_code} belum dapat kami terima.`,
      registrant.participant_feedback || 'Silakan hubungi admin LPK BYE untuk mengetahui tindak lanjut.'
    );
  } else if (registrant.status === 'verified') {
    lines.push(`Selamat ${registrant.full_name}! Pendaftaran ${registrant.registration_code} sudah diverifikasi.`);
  } else if (registrant.status === 'accepted') {
    lines.push(`Selamat ${registrant.full_name}! Kamu diterima pada program ${registrant.batch_name}.`);
  } else {
    lines.push(`Halo ${registrant.full_name}, status pendaftaran ${registrant.registration_code} saat ini menunggu verifikasi admin.`);
  }

  if (registrant.participant_feedback && registrant.status !== 'rejected') {
    lines.push(`Pesan admin:\n${registrant.participant_feedback}`);
  }
  if (['verified', 'accepted'].includes(registrant.status) && Number(registrant.training_fee) > 0) {
    lines.push(
      `Biaya pelatihan: ${formatCurrency(registrant.training_fee)}. Pembayaran dapat dicicil.`,
      registrant.payment_instructions
        ? `Cara pembayaran:\n${registrant.payment_instructions}`
        : 'Silakan hubungi admin untuk mendapatkan instruksi pembayaran.',
      'Kirim foto bukti transfer ke chat bot ini. Setiap pembayaran akan diperiksa admin sebelum dinyatakan lunas.'
    );
  } else if (['verified', 'accepted'].includes(registrant.status)) {
    lines.push('Saat ini tidak ada biaya pelatihan yang tercatat. Hubungi admin jika memerlukan informasi tambahan.');
  }

  lines.push('Untuk melihat status dan riwayat pembayaran, buka tautan portal pribadi dari pesan pendaftaran atau ketik PORTAL di chat ini.');
  return lines.join('\n\n');
}

module.exports = { buildWelcomeMessage, buildStatusMessage };
