const app = require('./app');
const { pool } = require('./config/database');
const { startIfLinked, stopWhatsAppBot } = require('./services/whatsappBot');

const port = Number(process.env.PORT || 5000);
const server = app.listen(port, () => {
  console.log(`LPK BYE API berjalan di http://localhost:${port}`);
  startIfLinked();
});

async function shutdown(signal) {
  console.log(`\n${signal} diterima, mematikan server...`);
  server.close(async () => {
    await stopWhatsAppBot();
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
