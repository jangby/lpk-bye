const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const requireAdmin = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const paymentsController = require('../controllers/paymentsController');
const whatsappController = require('../controllers/whatsappController');
const siteContentController = require('../controllers/siteContentController');
const imageUpload = require('../middleware/imageUpload');
const { PROGRAM_NAMES } = require('../utils/batchPrograms');

const router = express.Router();

router.post('/auth/login',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  validate,
  adminController.login
);

router.use(requireAdmin);
router.get('/me', adminController.me);

router.get('/site-content', siteContentController.adminContent);
router.put('/site-content/logo',
  imageUpload.single('logo'),
  siteContentController.updateLogo
);
router.delete('/site-content/logo', siteContentController.resetLogo);
router.post('/landing-slides',
  imageUpload.single('image'),
  body('title').optional({ checkFalsy: true }).isLength({ max: 180 }),
  body('caption').optional({ checkFalsy: true }).isLength({ max: 500 }),
  body('link_url').optional({ checkFalsy: true }).custom((value) =>
    (value.startsWith('/') && !value.startsWith('//')) || /^https?:\/\//i.test(value)),
  body('sort_order').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validate,
  siteContentController.createSlide
);
router.patch('/landing-slides/:slideId',
  param('slideId').isInt({ min: 1 }),
  imageUpload.single('image'),
  body('title').optional({ checkFalsy: true }).isLength({ max: 180 }),
  body('caption').optional({ checkFalsy: true }).isLength({ max: 500 }),
  body('link_url').optional({ checkFalsy: true }).custom((value) =>
    (value.startsWith('/') && !value.startsWith('//')) || /^https?:\/\//i.test(value)),
  body('sort_order').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validate,
  siteContentController.updateSlide
);
router.delete('/landing-slides/:slideId',
  param('slideId').isInt({ min: 1 }),
  validate,
  siteContentController.deleteSlide
);
router.post('/landing-gallery',
  imageUpload.single('image'),
  body('title').optional({ checkFalsy: true }).isLength({ max: 180 }),
  body('caption').optional({ checkFalsy: true }).isLength({ max: 500 }),
  body('sort_order').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validate,
  siteContentController.createGalleryItem
);
router.patch('/landing-gallery/:itemId',
  param('itemId').isInt({ min: 1 }),
  imageUpload.single('image'),
  body('title').optional({ checkFalsy: true }).isLength({ max: 180 }),
  body('caption').optional({ checkFalsy: true }).isLength({ max: 500 }),
  body('sort_order').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validate,
  siteContentController.updateGalleryItem
);
router.delete('/landing-gallery/:itemId',
  param('itemId').isInt({ min: 1 }),
  validate,
  siteContentController.deleteGalleryItem
);
router.post('/landing-faqs',
  body('question').trim().isLength({ min: 5, max: 255 }),
  body('answer').trim().isLength({ min: 5, max: 5000 }),
  body('sort_order').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validate,
  siteContentController.createFaq
);
router.patch('/landing-faqs/:faqId',
  param('faqId').isInt({ min: 1 }),
  body('question').optional().trim().isLength({ min: 5, max: 255 }),
  body('answer').optional().trim().isLength({ min: 5, max: 5000 }),
  body('sort_order').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validate,
  siteContentController.updateFaq
);
router.delete('/landing-faqs/:faqId',
  param('faqId').isInt({ min: 1 }),
  validate,
  siteContentController.deleteFaq
);

router.get('/dashboard', adminController.dashboard);
router.get('/batches', adminController.listBatches);
router.post('/batches',
  body('batch_name').trim().isLength({ min: 3, max: 150 }),
  body('program_type').isIn(PROGRAM_NAMES),
  body('start_date').isISO8601(),
  body('end_date').isISO8601(),
  body('quota').optional().isInt({ min: 0 }),
  body('training_fee').optional({ nullable: true }).isFloat({ min: 0, max: 9999999999.99 }),
  body('payment_instructions').optional().isLength({ max: 5000 }),
  body('is_active').optional().isBoolean(),
  validate,
  adminController.createBatch
);
router.patch('/batches/:batchId',
  param('batchId').isInt({ min: 1 }),
  body('program_type').optional().isIn(PROGRAM_NAMES),
  body('training_fee').optional({ nullable: true }).isFloat({ min: 0, max: 9999999999.99 }),
  validate,
  adminController.updateBatch
);
router.delete('/batches/:batchId',
  param('batchId').isInt({ min: 1 }),
  validate,
  adminController.deleteBatch
);
router.get('/batches/:batchId/fields',
  param('batchId').isInt({ min: 1 }),
  validate,
  adminController.getFields
);
router.post('/batches/:batchId/fields',
  param('batchId').isInt({ min: 1 }),
  body('field_name').matches(/^[a-z][a-z0-9_]*$/),
  body('field_label').trim().isLength({ min: 1, max: 150 }),
  body('field_type').isIn(['text', 'number', 'email', 'select', 'radio', 'textarea', 'file', 'date']),
  body('is_required').optional().isBoolean(),
  validate,
  adminController.addField
);
router.put('/fields/:fieldId',
  param('fieldId').isInt({ min: 1 }),
  validate,
  adminController.updateField
);
router.delete('/fields/:fieldId',
  param('fieldId').isInt({ min: 1 }),
  validate,
  adminController.deleteField
);
router.get('/batches/:batchId/registrants',
  param('batchId').isInt({ min: 1 }),
  validate,
  adminController.registrants
);
router.patch('/registrants/:registrantId/status',
  param('registrantId').isInt({ min: 1 }),
  body('status').isIn(['pending', 'verified', 'accepted', 'rejected']),
  body('notes').optional({ nullable: true }).isLength({ max: 5000 }),
  body('feedback').optional({ nullable: true }).isLength({ max: 2000 }),
  validate,
  adminController.updateRegistrantStatus
);
router.post('/registrants/:registrantId/notify',
  param('registrantId').isInt({ min: 1 }),
  body('type').optional().isIn(['welcome', 'status']),
  validate,
  adminController.retryRegistrantNotification
);

router.get('/payments', paymentsController.list);
router.get('/payments/:paymentId/receipt',
  param('paymentId').isInt({ min: 1 }),
  validate,
  paymentsController.receipt
);
router.patch('/payments/:paymentId/review',
  param('paymentId').isInt({ min: 1 }),
  body('status').isIn(['approved', 'rejected']),
  body('amount').optional().isFloat({ min: 0, max: 9999999999.99 }),
  body('rejection_reason').optional().isLength({ max: 2000 }),
  validate,
  paymentsController.review
);
router.post('/payments/:paymentId/notify',
  param('paymentId').isInt({ min: 1 }),
  validate,
  paymentsController.retryNotification
);

router.get('/whatsapp/status', whatsappController.status);
router.post('/whatsapp/connect', whatsappController.connect);
router.delete('/whatsapp/session', whatsappController.remove);

module.exports = router;
