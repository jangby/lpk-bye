require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const pino = require('pino');
const QRCode = require('qrcode');
const { pool } = require('../config/database');
const { normalizePhone, resolveSenderPhone } = require('../utils/phone');
const { recognizeTransfer } = require('../utils/paymentOcr');
const { createPortalToken, hashPortalToken, getPortalUrl } = require('../utils/participantPortal');
const { getBotCommand, getStatusLabel } = require('../utils/whatsappCommands');

const authDir = path.resolve(process.env.WHATSAPP_AUTH_DIR || '.whatsapp_auth');
const receiptDir = path.resolve(process.env.PAYMENT_RECEIPT_DIR || 'private/payment-receipts');
const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'silent' });
let socket = null;
let state = 'disconnected';
let qrDataUrl = null;
let phone = null;
let lastError = null;
let startPromise = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let removingSession = false;
let baileys = null;

async function getBaileys() {
  if (!baileys) baileys = await import('@whiskeysockets/baileys');
  return baileys;
}

function getWhatsAppStatus() {
  return {
    state,
    connected: state === 'connected',
    qr: qrDataUrl,
    phone,
    error: lastError
  };
}

function getMessageContent(message) {
  let content = message.message;
  for (let depth = 0; depth < 4; depth += 1) {
    const wrapped = content?.ephemeralMessage?.message
      || content?.viewOnceMessage?.message
      || content?.viewOnceMessageV2?.message
      || content?.documentWithCaptionMessage?.message;
    if (!wrapped) break;
    content = wrapped;
  }
  return content;
}

function getSenderJid(message) {
  const key = message.key || {};
  const candidate = key.remoteJidAlt || key.participantAlt || key.remoteJid;
  return typeof candidate === 'string' ? candidate : '';
}

async function sendChatText(jid, text) {
  if (!socket || state !== 'connected') throw new Error('Bot WhatsApp belum terhubung');
  await socket.sendMessage(jid, { text });
}

async function findRegistrant(senderPhone, messageText) {
  const suffixLength = Math.min(10, senderPhone.length);
  const suffix = senderPhone.slice(-suffixLength);
  const [rows] = await pool.execute(
    `SELECT r.id, r.full_name, r.whatsapp, r.registration_code, r.batch_id, r.status, r.portal_token_hash,
       r.participant_feedback, r.training_fee, b.batch_name, b.program_type, b.start_date,
       b.end_date, b.payment_instructions
     FROM registrants r JOIN batches b ON b.id = r.batch_id
     WHERE RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(r.whatsapp, '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), ?) = ?
     ORDER BY r.id DESC`,
    [suffixLength, suffix]
  );
  const matches = rows.filter((row) => normalizePhone(row.whatsapp) === senderPhone);
  const registrationCode = messageText.match(/BYE-JPN-\d{4}-\d{6}/i)?.[0];
  if (registrationCode) {
    const byCode = matches.filter((row) => row.registration_code.toLowerCase() === registrationCode.toLowerCase());
    if (byCode.length === 1) return byCode[0];
  }
  return matches.length === 1 ? matches[0] : null;
}

function getImageType(content) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(content?.imageMessage?.mimetype)) return content.imageMessage;
  if (allowedTypes.includes(content?.documentMessage?.mimetype)) return content.documentMessage;
  return null;
}

function getTextContent(content) {
  return content?.conversation
    || content?.extendedTextMessage?.text
    || content?.imageMessage?.caption
    || content?.documentMessage?.caption
    || '';
}

function getRegistrationUrl() {
  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${baseUrl}/pendaftaran`;
}

async function handleTextCommand(message, jid, text) {
  const command = getBotCommand(text);
  if (!command) return;

  if (command === 'menu') {
    await sendChatText(
      jid,
      `Halo! Saya asisten WhatsApp LPK BYE.\n\nKetik:\nSTATUS <kode> - status pendaftaran\nPEMBAYARAN <kode> - biaya dan cicilan\nJADWAL <kode> - informasi pelatihan\nPORTAL <kode> - kirim tautan portal peserta\nSetelah pendaftaran terverifikasi, kirim foto bukti transfer di chat ini.\n\nPendaftaran: ${getRegistrationUrl()}\nUntuk nomor yang mendaftarkan lebih dari satu peserta, sertakan kode pendaftaran.`
    );
    return;
  }

  const senderPhone = await resolveSenderPhone(message, socket?.signalRepository?.lidMapping);
  const registrant = senderPhone ? await findRegistrant(senderPhone, text) : null;
  if (!registrant) {
    await sendChatText(
      jid,
      'Data pendaftar belum ditemukan untuk nomor ini atau ada lebih dari satu pendaftar. Gunakan nomor WhatsApp yang terdaftar dan sertakan kode BYE-JPN-... setelah perintah. Ketik MENU untuk bantuan.'
    );
    return;
  }

  if (command === 'portal') {
    const token = createPortalToken();
    await pool.execute(
      'UPDATE registrants SET portal_token_hash = ? WHERE id = ?',
      [hashPortalToken(token), registrant.id]
    );
    try {
      await sendChatText(
        jid,
        `Tautan portal pribadi ${registrant.registration_code}:\n${getPortalUrl(token)}\n\nTautan lama sudah tidak berlaku. Jangan bagikan tautan ini kepada orang lain.`
      );
    } catch (error) {
      await pool.execute(
        'UPDATE registrants SET portal_token_hash = ? WHERE id = ?',
        [registrant.portal_token_hash, registrant.id]
      );
      throw error;
    }
    return;
  }

  if (command === 'status') {
    const feedback = registrant.participant_feedback ? `\nPesan admin: ${registrant.participant_feedback}` : '';
    await sendChatText(
      jid,
      `Status pendaftaran ${registrant.registration_code}: ${getStatusLabel(registrant.status)}.${feedback}\n\nKetik PORTAL ${registrant.registration_code} untuk membuka ringkasan peserta.`
    );
    return;
  }

  if (command === 'payment') {
    if (!['verified', 'accepted'].includes(registrant.status)) {
      await sendChatText(
        jid,
        `Pendaftaran ${registrant.registration_code} masih berstatus ${getStatusLabel(registrant.status)}. Instruksi pembayaran akan diberikan setelah pendaftaran diverifikasi admin.`
      );
      return;
    }
    if (Number(registrant.training_fee) <= 0) {
      await sendChatText(jid, `Tidak ada biaya pelatihan yang tercatat untuk ${registrant.registration_code}.`);
      return;
    }
    const [[summary]] = await pool.execute(
      `SELECT COALESCE(SUM(amount_approved), 0) AS paid_total
       FROM payments WHERE registrant_id = ? AND status = 'approved'`,
      [registrant.id]
    );
    const fee = Number(registrant.training_fee || 0);
    const paid = Number(summary.paid_total || 0);
    const instructions = registrant.payment_instructions || 'Silakan hubungi admin untuk mendapatkan instruksi pembayaran.';
    await sendChatText(
      jid,
      `Pembayaran ${registrant.registration_code}\nBiaya pelatihan: Rp${new Intl.NumberFormat('id-ID').format(fee)}\nTerverifikasi: Rp${new Intl.NumberFormat('id-ID').format(paid)}\nSisa: Rp${new Intl.NumberFormat('id-ID').format(Math.max(0, fee - paid))}\n\nInstruksi transfer:\n${instructions}\n\nPembayaran dapat dicicil. Kirim foto bukti transfer di chat ini; admin akan memeriksanya sebelum pembayaran dicatat.`
    );
    return;
  }

  const formatDate = (value) => {
    const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return date.toLocaleDateString('id-ID');
  };
  await sendChatText(
    jid,
    `Informasi program ${registrant.batch_name}\n${registrant.program_type}\nPeriode: ${formatDate(registrant.start_date)} - ${formatDate(registrant.end_date)}\n\n${registrant.registration_code}: ${getStatusLabel(registrant.status)}.\nKetik PORTAL ${registrant.registration_code} untuk detail peserta.`
  );
}

async function handleIncomingMessage(message) {
  if (!message?.message || message.key?.fromMe) return;
  const jid = getSenderJid(message);
  if (!jid || jid.endsWith('@g.us')) return;
  const content = getMessageContent(message);
  const media = getImageType(content);
  if (!media) {
    await handleTextCommand(message, jid, getTextContent(content));
    return;
  }

  const messageId = message.key?.id;
  const senderPhone = await resolveSenderPhone(message, socket?.signalRepository?.lidMapping);
  if (!messageId || !senderPhone) {
    await sendChatText(jid, 'Nomor WhatsApp tidak dapat dikenali. Silakan kirim bukti dari nomor yang digunakan saat mendaftar.');
    return;
  }

  const whatsappMessageId = `${jid}:${messageId}`;
  const [existing] = await pool.execute(
    'SELECT id FROM payments WHERE whatsapp_message_id = ? LIMIT 1',
    [whatsappMessageId]
  );
  if (existing.length) return;

  const caption = media.caption || content?.conversation || content?.extendedTextMessage?.text || '';
  const registrant = await findRegistrant(senderPhone, caption);
  if (!registrant) {
    await sendChatText(
      jid,
      'Nomor ini belum cocok dengan satu data pendaftar. Gunakan nomor WhatsApp yang terdaftar dan sertakan kode pendaftaran (BYE-JPN-...) pada keterangan foto jika nomor dipakai lebih dari satu pendaftar.'
    );
    return;
  }
  if (Number(registrant.training_fee) <= 0) {
    await sendChatText(jid, `Tidak ada biaya pelatihan yang tercatat untuk ${registrant.registration_code}; bukti pembayaran tidak perlu dikirim.`);
    return;
  }
  if (!['verified', 'accepted'].includes(registrant.status)) {
    await sendChatText(
      jid,
      `Bukti belum dapat diajukan karena status pendaftaran ${registrant.registration_code} adalah ${getStatusLabel(registrant.status)}. Tunggu verifikasi admin sebelum melakukan pembayaran.`
    );
    return;
  }

  const maxBytes = Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024;
  if (Number(media.fileLength || 0) > maxBytes) {
    await sendChatText(jid, `Ukuran foto bukti maksimal ${process.env.MAX_FILE_SIZE_MB || 5} MB. Silakan kirim ulang foto yang lebih kecil.`);
    return;
  }

  const { downloadMediaMessage } = await getBaileys();
  const image = await downloadMediaMessage(message, 'buffer', {}, {
    logger,
    reuploadRequest: socket.updateMediaMessage
  });
  if (!Buffer.isBuffer(image) || !image.length) {
    throw new Error('Gambar bukti transfer dari WhatsApp kosong atau tidak dapat dibaca');
  }

  await fs.mkdir(receiptDir, { recursive: true });
  const extension = media.mimetype === 'image/png' ? '.png'
    : media.mimetype === 'image/webp' ? '.webp' : '.jpg';
  const fileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const filePath = path.join(receiptDir, fileName);
  await fs.writeFile(filePath, image);

  let ocr = { text: '', amount: null };
  let ocrStatus = 'failed';
  let ocrError = null;
  try {
    ocr = await recognizeTransfer(image);
    ocrStatus = ocr.amount ? 'read' : 'unreadable';
  } catch (error) {
    ocrError = error.message;
    console.error('OCR bukti pembayaran gagal:', error.message);
  }

  try {
    await pool.execute(
      `INSERT INTO payments
       (registrant_id, amount_detected, receipt_path, sender_phone, whatsapp_message_id,
        ocr_text, ocr_status, ocr_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        registrant.id,
        ocr.amount,
        fileName,
        senderPhone,
        whatsappMessageId,
        ocr.text || null,
        ocrStatus,
        ocrError
      ]
    );
  } catch (error) {
    await fs.unlink(filePath).catch((cleanupError) => {
      console.error('Gagal menghapus file bukti yang tidak tersimpan:', cleanupError.message);
    });
    throw error;
  }

  const amountText = ocr.amount
    ? `Perkiraan nominal: Rp${new Intl.NumberFormat('id-ID').format(ocr.amount)}.`
    : 'Nominal belum terbaca otomatis.';
  await sendChatText(
    jid,
    `Bukti pembayaran untuk ${registrant.registration_code} sudah diterima. ${amountText} Pembayaran menunggu verifikasi admin. Bot tidak menyetujui pembayaran secara otomatis.`
  );
}

async function startWhatsAppBot({ reconnecting = false } = {}) {
  if (state === 'connected' || state === 'qr' || state === 'connecting') return getWhatsAppStatus();
  if (startPromise) return startPromise;
  if (!reconnecting) reconnectAttempt = 0;

  startPromise = (async () => {
    state = 'connecting';
    qrDataUrl = null;
    lastError = null;
    removingSession = false;
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      Browsers,
      fetchLatestBaileysVersion
    } = await getBaileys();
    const { version, isLatest, error: versionError } = await fetchLatestBaileysVersion();
    if (!version || (!isLatest && versionError)) {
      throw new Error(`Versi WhatsApp Web tidak dapat diambil${versionError?.message ? `: ${versionError.message}` : ''}`);
    }
    const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
    const currentSocket = makeWASocket({
      auth: authState,
      version,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      logger
    });
    socket = currentSocket;
    currentSocket.ev.on('creds.update', saveCreds);
    currentSocket.ev.on('connection.update', async (update) => {
      if (update.qr) {
        try {
          qrDataUrl = await QRCode.toDataURL(update.qr);
          state = 'qr';
          lastError = null;
        } catch (error) {
          state = 'disconnected';
          lastError = `QR WhatsApp gagal dibuat: ${error.message}`;
          console.error(lastError);
        }
      }
      if (update.connection === 'open') {
        state = 'connected';
        qrDataUrl = null;
        lastError = null;
        phone = currentSocket.user?.id?.split(':')[0]?.split('@')[0] || null;
        reconnectAttempt = 0;
      }
      if (update.connection === 'close') {
        socket = null;
        qrDataUrl = null;
        state = 'disconnected';
        const statusCode = update.lastDisconnect?.error?.output?.statusCode;
        const cause = update.lastDisconnect?.error?.message;
        if (statusCode === DisconnectReason.loggedOut) {
          phone = null;
          lastError = 'Sesi WhatsApp terputus. Hubungkan ulang menggunakan QR.';
        } else if (!removingSession && reconnectAttempt < 3) {
          reconnectAttempt += 1;
          lastError = `Koneksi WhatsApp terputus${statusCode ? ` (kode ${statusCode})` : ''}${cause ? `: ${cause}` : '.'}`;
          console.error(lastError);
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            startWhatsAppBot({ reconnecting: true }).catch((error) => {
              lastError = error.message;
              console.error('Reconnect WhatsApp gagal:', error.message);
            });
          }, Math.min(2000 * (2 ** (reconnectAttempt - 1)), 10000));
          reconnectTimer.unref?.();
        } else if (!removingSession) {
          lastError = `Koneksi WhatsApp gagal setelah ${reconnectAttempt} percobaan ulang. Periksa jaringan, lalu coba hubungkan ulang.`;
          console.error(lastError);
        }
      }
    });
    currentSocket.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const message of messages) {
        handleIncomingMessage(message).catch((error) => {
          console.error('Memproses pesan bukti pembayaran gagal:', error.message);
        });
      }
    });
    return getWhatsAppStatus();
  })();

  try {
    return await startPromise;
  } catch (error) {
    state = 'disconnected';
    lastError = error.message;
    throw error;
  } finally {
    startPromise = null;
  }
}

async function startIfLinked() {
  try {
    await fs.access(path.join(authDir, 'creds.json'));
  } catch {
    return;
  }
  startWhatsAppBot().catch((error) => {
    lastError = error.message;
    console.error('Memulai ulang bot WhatsApp gagal:', error.message);
  });
}

async function deleteWhatsAppSession() {
  removingSession = true;
  clearTimeout(reconnectTimer);
  reconnectAttempt = 0;
  const currentSocket = socket;
  socket = null;
  let logoutError = null;
  if (currentSocket) {
    try {
      await currentSocket.logout();
    } catch (error) {
      logoutError = error;
    }
  }
  await fs.rm(authDir, { recursive: true, force: true });
  state = 'disconnected';
  qrDataUrl = null;
  phone = null;
  lastError = null;
  if (logoutError) throw logoutError;
  return getWhatsAppStatus();
}

async function stopWhatsAppBot() {
  removingSession = true;
  clearTimeout(reconnectTimer);
  reconnectAttempt = 0;
  const currentSocket = socket;
  socket = null;
  state = 'disconnected';
  qrDataUrl = null;
  if (currentSocket) currentSocket.end(new Error('Backend sedang dimatikan'));
}

async function sendWhatsAppMessage(phoneNumber, text) {
  if (!socket || state !== 'connected') throw new Error('Bot WhatsApp belum terhubung');
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) throw new Error('Nomor WhatsApp peserta tidak valid');
  await socket.sendMessage(`${normalized}@s.whatsapp.net`, { text });
}

module.exports = {
  getWhatsAppStatus,
  startWhatsAppBot,
  startIfLinked,
  deleteWhatsAppSession,
  stopWhatsAppBot,
  sendWhatsAppMessage
};
