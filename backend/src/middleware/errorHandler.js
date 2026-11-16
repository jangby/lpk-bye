module.exports = (error, req, res, next) => {
  if (error instanceof require('multer').MulterError) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'Data sudah terdaftar atau duplikat' });
  }
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error(error);
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Terjadi kesalahan pada server' : error.message
  });
};
