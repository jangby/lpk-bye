require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : {}),
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'db_lpk_bye',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_MAX || 10),
  queueLimit: 0,
  dateStrings: false
});

module.exports = { pool };
