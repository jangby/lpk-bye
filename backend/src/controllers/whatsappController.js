const {
  getWhatsAppStatus,
  startWhatsAppBot,
  deleteWhatsAppSession
} = require('../services/whatsappBot');

exports.status = (req, res) => res.json({ success: true, data: getWhatsAppStatus() });

exports.connect = async (req, res, next) => {
  try {
    const data = await startWhatsAppBot();
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const data = await deleteWhatsAppSession();
    res.json({ success: true, message: 'Sesi bot WhatsApp telah dihapus', data });
  } catch (error) { next(error); }
};
