# Panduan Deployment LPK BYE di VPS Ubuntu

Panduan ini memasang frontend React/Vite dan backend Express/MySQL pada satu VPS Ubuntu. Source code disimpan di `/var/www/lpk-bye`, Nginx melayani frontend dan menjadi reverse proxy ke backend, sedangkan systemd menjaga backend serta bot WhatsApp tetap berjalan.

> Gunakan Ubuntu Server 22.04/24.04, akses SSH dengan akun sudo, alamat IPv4 VPS, dan domain yang dapat Anda kelola. Sesuaikan nama domain, alamat email, serta password contoh sebelum menjalankan perintah.

## 1. Siapkan DNS dan firewall

Di panel DNS domain, buat record:

| Tipe | Nama | Nilai |
|---|---|---|
| A | `@` | IPv4 VPS |
| A | `www` | IPv4 VPS |

Jika VPS menggunakan IPv6, tambahkan record AAAA hanya bila IPv6 tersebut benar-benar aktif dan dapat diakses. Tunggu propagasi DNS. Dari komputer lokal atau VPS, periksa:

```bash
dig +short example.com
dig +short www.example.com
```

Kedua nama domain harus mengarah ke VPS sebelum meminta sertifikat HTTPS. Ganti `example.com` dengan domain Anda.

Pastikan firewall di panel penyedia VPS mengizinkan TCP `22` (SSH), `80` (HTTP), dan `443` (HTTPS). Di VPS, aktifkan UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Jika SSH Anda menggunakan port selain `22`, izinkan port SSH tersebut sebelum mengaktifkan UFW agar koneksi administrasi tidak terputus.

Jangan membuka port `5000` ke internet. Port itu hanya digunakan Nginx untuk berbicara dengan backend di VPS.

## 2. Perbarui Ubuntu dan pasang dependensi

Masuk ke VPS melalui SSH, lalu jalankan:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl dnsutils gnupg git nginx mysql-server snapd
```

Pasang Node.js 22:

```bash
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
sudo chmod a+r /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
  | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt update
sudo apt install -y nodejs
node --version
npm --version
```

Pastikan `node --version` menunjukkan versi 20 atau lebih baru. Aktifkan layanan MySQL dan Nginx:

```bash
sudo systemctl enable --now mysql
sudo systemctl enable --now nginx
```

## 3. Buat user aplikasi dan clone repository

Jalankan proses Node.js sebagai user khusus, bukan `root`:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/lpk-bye
sudo chown deploy:deploy /var/www/lpk-bye
sudo -iu deploy
git clone https://github.com/jangby/lpk-bye.git /var/www/lpk-bye
exit
```

Jika repository dibuat private, siapkan SSH deploy key untuk user `deploy` di GitHub, tambahkan public key ke repository, lalu clone dengan URL SSH. Jangan menyimpan token GitHub di URL remote atau file aplikasi.

## 4. Buat database MySQL

Masuk ke MySQL sebagai administrator lokal:

```bash
sudo mysql
```

Buat database dan user aplikasi khusus. Buat password aman dengan `openssl rand -hex 32`, lalu gunakan nilainya sebagai `GANTI_PASSWORD_DATABASE_KUAT` pada SQL dan `.env`:

```sql
CREATE DATABASE db_lpk_bye
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'lpk_bye'@'localhost'
  IDENTIFIED BY 'GANTI_PASSWORD_DATABASE_KUAT';

GRANT ALL PRIVILEGES ON db_lpk_bye.* TO 'lpk_bye'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Karena backend memakai `DB_SOCKET`, koneksi MariaDB berasal melalui Unix socket dan harus memakai akun `'lpk_bye'@'localhost'`. Akun `'lpk_bye'@'127.0.0.1'` adalah akun berbeda yang digunakan untuk koneksi TCP.

Jangan gunakan akun MySQL `root` dari aplikasi.

## 5. Konfigurasikan backend

Salin contoh konfigurasi, lalu edit file rahasia `.env`:

```bash
sudo -iu deploy
cd /var/www/lpk-bye/backend
cp .env.example .env
nano .env
```

Isi nilai produksi, jangan biarkan placeholder:

```dotenv
PORT=5000
NODE_ENV=production
DB_HOST=127.0.0.1
DB_PORT=3306
DB_SOCKET=/run/mysqld/mysqld.sock
DB_NAME=db_lpk_bye
DB_USER=lpk_bye
DB_PASSWORD=GANTI_PASSWORD_DATABASE_KUAT
DB_POOL_MAX=10
JWT_SECRET=GANTI_DENGAN_HASIL_OPENSSL_RAND
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=GANTI_PASSWORD_ADMIN_MINIMAL_12_KARAKTER
UPLOAD_DIR=uploads
PAYMENT_RECEIPT_DIR=private/payment-receipts
MAX_FILE_SIZE_MB=5
CORS_ORIGIN=https://example.com,https://www.example.com
FRONTEND_URL=https://example.com
WHATSAPP_NUMBER=628xxxxxxxxxx
WHATSAPP_AUTH_DIR=.whatsapp_auth
WHATSAPP_LOG_LEVEL=silent
```

Buat secret JWT acak di terminal terpisah:

```bash
openssl rand -base64 48
```

Salin hasilnya ke `JWT_SECRET`. Gunakan password database dan admin yang berbeda. `WHATSAPP_NUMBER` adalah nomor kontak publik dengan kode negara, tanpa tanda `+`; bila nomor bot sudah tersambung, bot akan menggunakan nomor akun yang tertaut.

Simpan file dan kunci izin aksesnya:

```bash
chmod 600 .env
mkdir -p .whatsapp_auth private/payment-receipts uploads
chmod 700 .whatsapp_auth private/payment-receipts
exit
```

File `.env` dan data sesi/pembayaran tidak boleh dimasukkan ke Git atau disajikan langsung oleh Nginx.

## 6. Instal dependensi, migrasi, dan seed awal

Pasang dependensi backend dan frontend sebagai user `deploy`:

```bash
sudo -iu deploy
cd /var/www/lpk-bye/backend
npm ci --omit=dev
npm test
npm run migrate
npm run seed

cd /var/www/lpk-bye/frontend
npm ci
```

`npm run seed` hanya untuk instalasi awal. Seed membuat akun admin sesuai `ADMIN_EMAIL` dan `ADMIN_PASSWORD`; jangan jalankan lagi pada setiap update karena proses seed dapat memperbarui hash password admin.

Frontend memakai URL relatif `/api`. Pada VPS satu domain, biarkan `VITE_API_URL` kosong seperti pada `.env.example`; Nginx akan meneruskan `/api` ke backend lokal.

```bash
cd /var/www/lpk-bye/frontend
cp .env.example .env.production
npm run build
exit
```

Jika file `.env.production` sudah ada, pastikan isinya tetap `VITE_API_URL=`. Jangan isi URL backend `localhost` pada build frontend.

## 7. Jalankan backend dengan systemd

Buat unit service:

```bash
sudo tee /etc/systemd/system/lpk-bye.service >/dev/null <<'EOF'
[Unit]
Description=LPK BYE Express API and WhatsApp bot
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/lpk-bye/backend
Environment=NODE_ENV=production
Environment=PORT=5000
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
UMask=0027

[Install]
WantedBy=multi-user.target
EOF
```

Pastikan lokasi Node.js benar dengan `command -v node`; jika hasilnya bukan `/usr/bin/node`, sesuaikan `ExecStart`. Aktifkan dan periksa service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lpk-bye
sudo systemctl status lpk-bye --no-pager
sudo journalctl -u lpk-bye -n 100 --no-pager
```

Backend membaca `.env` dari working directory. Setelah restart VPS, systemd akan menjalankan ulang backend dan bot.

## 8. Konfigurasikan Nginx

Buat konfigurasi site. Ganti `example.com` dengan domain Anda:

```bash
sudo tee /etc/nginx/sites-available/lpk-bye >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    client_max_body_size 10m;
    root /var/www/lpk-bye/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/lpk-bye /etc/nginx/sites-enabled/lpk-bye
sudo nginx -t
sudo systemctl reload nginx
```

Jika link site sudah pernah dibuat, jangan membuat symlink kedua. Pastikan DNS dan akses HTTP sudah berfungsi sebelum menerbitkan sertifikat:

```bash
curl -I http://example.com
curl http://example.com/api/public/health
```

Endpoint health harus mengembalikan respons JSON sukses. Jika tidak, periksa `systemctl status lpk-bye` dan log Nginx/backend sebelum melanjutkan.

## 9. Pasang sertifikat HTTPS

Pasang Certbot melalui Snap dan minta sertifikat untuk domain:

```bash
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d example.com -d www.example.com
```

Masukkan alamat email pemilik, setujui persyaratan, dan pilih pengalihan HTTP ke HTTPS jika diminta. Jika hanya memakai satu nama domain, hapus nama lainnya dari perintah. Verifikasi HTTPS dan perpanjangan otomatis:

```bash
curl -I https://example.com
curl https://example.com/api/public/health
sudo certbot renew --dry-run
```

Certbot biasanya menyiapkan timer perpanjangan otomatis. Jangan menghapus konfigurasi sertifikat di Nginx.

## 10. Sambungkan bot WhatsApp

1. Buka `https://example.com/admin` dan masuk menggunakan `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
2. Dari menu WhatsApp/Pembayaran, pilih **Hubungkan WhatsApp**, lalu scan QR dengan akun admin.
3. Pastikan status koneksi bot tampil tersambung dan backend tetap aktif.
4. Jangan menghapus `/var/www/lpk-bye/backend/.whatsapp_auth`; folder itu menyimpan sesi tautan bot. Sertakan dalam backup terenkripsi dengan akses terbatas.

Baileys adalah koneksi WhatsApp tidak resmi. Gunakan nomor yang memang disiapkan untuk operasional dan perhatikan kebijakan WhatsApp. Jika nomor ditautkan ulang, lakukan dari panel admin; jangan menghapus sesi kecuali memang ingin memutus tautan.

## 11. Menerapkan update kode dari GitHub

Lakukan perubahan dan push ke branch `main` di GitHub terlebih dahulu. Sebelum deploy, buat backup database. Login sebagai user `deploy` dan periksa worktree:

```bash
sudo -iu deploy
cd /var/www/lpk-bye
git status --short
git rev-parse --short HEAD
```

Worktree produksi seharusnya bersih. Jika `git status --short` menampilkan file, berhenti dan tinjau perubahan itu terlebih dahulu; jangan menimpanya dengan reset paksa. Jika bersih, ambil update:

```bash
cd /var/www/lpk-bye
git fetch origin
git pull --ff-only origin main
exit
```

Tinjau perubahan `.env.example`, README, package lock, dan migrasi. Jika rilis menambah variabel environment, tambahkan nilainya secara manual ke server `.env`; jangan mengganti `.env` produksi dengan file contoh. Jalankan langkah berikut:

```bash
sudo -iu deploy
cd /var/www/lpk-bye/backend
npm ci --omit=dev
npm test
npm run migrate

cd /var/www/lpk-bye/frontend
npm ci
npm run build
exit
```

Setelah perintah berhasil, restart backend dan verifikasi:

```bash
sudo systemctl restart lpk-bye
sudo systemctl status lpk-bye --no-pager
sudo journalctl -u lpk-bye -n 100 --no-pager
curl https://example.com/api/public/health
```

Migrasi saat ini memeriksa keberadaan tabel/kolom sebelum menambahkannya, tetapi tetap buat backup sebelum setiap rilis yang mengubah skema. Jangan menjalankan `npm run seed` pada update biasa. Jika hanya mengubah konfigurasi Nginx, uji dengan `sudo nginx -t` sebelum `sudo systemctl reload nginx`.

Untuk rollback aplikasi, perbaiki atau revert perubahan di GitHub, push commit baru, lalu jalankan prosedur update kembali. Jangan mengembalikan database ke backup tanpa mempertimbangkan pendaftaran/pembayaran yang masuk setelah backup.

## 12. Backup dan perawatan rutin

### Backup database dan file penting

Buat direktori backup dengan izin terbatas:

```bash
sudo install -d -m 700 /var/backups/lpk-bye
```

Backup database (masukkan password database saat diminta):

```bash
sudo bash -o pipefail -c 'umask 077; mysqldump --single-transaction -h 127.0.0.1 -u lpk_bye -p db_lpk_bye | gzip > /var/backups/lpk-bye/db-$(date +%F).sql.gz'
```

Backup file unggahan dan state lokal:

```bash
sudo tar -czf /var/backups/lpk-bye/files-$(date +%F).tar.gz \
  -C /var/www/lpk-bye/backend \
  .env .whatsapp_auth private/payment-receipts uploads
sudo chmod 600 /var/backups/lpk-bye/*
```

Backup file berisi secret `.env`, kredensial sesi WhatsApp, dan bukti pembayaran. Batasi aksesnya dan enkripsi sebelum mengirim ke penyimpanan off-site. Uji pemulihan database/file secara berkala di lingkungan staging; backup yang belum pernah diuji belum tentu dapat dipulihkan.

### Jadwal pemeriksaan yang disarankan

- **Harian:** periksa status aplikasi, endpoint health, kapasitas disk, dan log error.
- **Mingguan:** buat backup database serta file, pastikan salinannya tersimpan di lokasi terpisah, dan periksa status koneksi bot WhatsApp.
- **Bulanan:** uji restore backup, tinjau pembaruan Ubuntu/Node.js/dependensi, lalu periksa perpanjangan TLS dengan `sudo certbot renew --dry-run`.

Perintah pemeriksaan cepat:

```bash
sudo systemctl status lpk-bye mysql nginx --no-pager
sudo journalctl -u lpk-bye --since today --no-pager
sudo tail -n 100 /var/log/nginx/error.log
df -h
free -h
sudo certbot certificates
```

Lakukan pembaruan paket OS pada waktu pemeliharaan:

```bash
sudo apt update
sudo apt upgrade
```

Jika kernel atau layanan penting diperbarui, jadwalkan restart VPS dan periksa kembali `lpk-bye`, MySQL, Nginx, endpoint health, dan koneksi WhatsApp setelahnya.

## 13. Pemecahan masalah

| Gejala | Pemeriksaan |
|---|---|
| Domain tidak terbuka | Periksa record DNS, firewall penyedia, UFW, `sudo systemctl status nginx`, dan `sudo nginx -t`. |
| HTTPS gagal diterbitkan | Pastikan A/AAAA mengarah ke VPS, port 80/443 terbuka, dan `server_name` cocok dengan domain. |
| Frontend tampil tetapi API gagal | Periksa `VITE_API_URL` kosong, blok `location /api/`, `CORS_ORIGIN`, backend, dan `curl https://example.com/api/public/health`. |
| Backend gagal mulai | Periksa `.env`, izin file, koneksi MySQL, `sudo journalctl -u lpk-bye -n 100 --no-pager`, serta status `mysql`. |
| Migrasi gagal | Backup database, baca pesan error, pastikan user MySQL memiliki hak pada `db_lpk_bye`, lalu ulangi hanya setelah penyebabnya diperbaiki. |
| Klien MariaDB berhasil tetapi koneksi Node.js melalui TCP ditolak | Untuk MariaDB lokal, set `DB_SOCKET=/run/mysqld/mysqld.sock` di `.env`, jalankan ulang migrasi, lalu restart backend. `DB_SOCKET` mengutamakan Unix socket dibanding `DB_HOST`/`DB_PORT`. |
| QR WhatsApp tidak muncul atau bot offline | Periksa log backend, izin direktori `.whatsapp_auth`, koneksi internet VPS, dan status perangkat tertaut di WhatsApp. |
| Disk hampir penuh | Periksa ukuran log, backup, unggahan, dan bukti pembayaran; arsipkan/hapus hanya setelah kebijakan retensi dan backup dipastikan. |

Jangan mengirim file `.env`, token portal peserta, kredensial WhatsApp, atau bukti transfer saat meminta bantuan teknis.
