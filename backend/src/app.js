const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('./config/env');

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev', {
    skip: (req) => req.originalUrl.split('?')[0].startsWith('/api/public/portal/')
  }));
}
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || 'uploads')));

app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.get('/', (req, res) => res.json({
  success: true,
  name: 'LPK BYE API',
  docs: '/api/public/health'
}));
app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' }));
app.use(errorHandler);

module.exports = app;
