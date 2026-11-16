const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const publicController = require('../controllers/publicController');

const router = express.Router();
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = /\.(jpg|jpeg|png|pdf)$/i.test(file.originalname);
    callback(allowed ? null : new Error('File harus berformat JPG, PNG, atau PDF'), allowed);
  }
});

router.get('/health', publicController.health);
router.get('/batch-active', publicController.activeBatch);
router.get('/portal/:token',
  param('token').matches(/^[A-Za-z0-9_-]{43}$/),
  validate,
  publicController.participantPortal
);
router.post('/register',
  upload.any(),
  body('batch_id').isInt({ min: 1 }),
  body('full_name').trim().isLength({ min: 3, max: 150 }),
  body('whatsapp').trim().matches(/^[0-9+\-()\s]{8,20}$/),
  body('email').optional({ checkFalsy: true }).isEmail(),
  validate,
  publicController.register
);

module.exports = router;
