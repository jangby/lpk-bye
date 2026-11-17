# Backend LPK BYE

Backend Express.js dan MySQL untuk landing page serta sistem pendaftaran peserta LPK BYE.

Untuk kontrak API lengkap beserta contoh respons JSON dan rancangan landing page, lihat [API_DESIGN_DOCUMENTATION.md](./API_DESIGN_DOCUMENTATION.md).

Untuk instalasi produksi di VPS Ubuntu dengan Nginx, MySQL, domain, HTTPS, backup, dan prosedur update, lihat [DEPLOYMENT_UBUNTU.md](../DEPLOYMENT_UBUNTU.md).

## Persyaratan

- Node.js 20 atau lebih baru
- MySQL/MariaDB dari Laragon
- Database `db_lpk_bye`

## Instalasi

```powershell
cd C:\laragon\www\lpk-bye\backend
npm install
Copy-Item .env.example .env
npm run setup
npm run dev
```

Pastikan MySQL Laragon sedang berjalan dan database `db_lpk_bye` sudah dibuat. Pengaturan default `.env` menggunakan host `127.0.0.1`, port `3306`, user `root`, dan password kosong. Sesuaikan `DB_*` jika konfigurasi Laragon Anda berbeda.

Sebelum menjalankan `npm run setup`, isi `ADMIN_PASSWORD` di `.env` dengan password kuat minimal 12 karakter. Seed tidak lagi memakai kredensial admin default. Jangan commit `.env` atau password database ke Git.

## Biaya dan pembayaran cicilan

Biaya serta instruksi transfer diatur per gelombang melalui menu **Gelombang**. Peserta melihat biaya saat mendaftar; instruksi transfer baru diberikan setelah pendaftaran diverifikasi atau diterima. Foto bukti yang dikirim ke nomor WhatsApp bot akan dicocokkan berdasarkan nomor pengirim, diproses dengan OCR Tesseract lokal, lalu disimpan sebagai transaksi berstatus menunggu verifikasi. OCR hanya memberi perkiraan nominal; admin tetap wajib mencocokkan bukti dan nominal.

Setelah pendaftaran, bot mengirim pesan sambutan, kode pendaftaran, status awal, dan tautan portal pribadi. Saat status pendaftaran diperbarui, peserta menerima pesan WhatsApp; pesan untuk peserta dipisahkan dari catatan internal admin. Jika pengiriman gagal, admin dapat mencoba ulang dari detail peserta.

Portal peserta menampilkan status pendaftaran, informasi gelombang, biaya, cicilan, dan riwayat pembayaran dengan tata letak mobile-friendly. Tautannya adalah kredensial pribadi: simpan dengan aman dan jangan dibagikan. Bot juga merespons `MENU`, `STATUS <kode>`, `PEMBAYARAN <kode>`, `JADWAL <kode>`, dan `PORTAL <kode>`. Pengiriman bukti pembayaran baru dibuka setelah pendaftaran diverifikasi atau diterima.

Baileys merupakan koneksi WhatsApp tidak resmi dan penggunaan berlebihan dapat menyebabkan pembatasan akun. Uji terlebih dahulu dengan nomor khusus. Sesi tautan WhatsApp disimpan lokal di `.whatsapp_auth/` dan tidak boleh dimasukkan ke Git. Jalankan backend sebagai proses yang terus hidup agar koneksi bot tetap tersedia. MySQL Laragon dan sesi bot lokal tidak dapat dipakai langsung oleh deployment serverless seperti Vercel.

Backend memakai Baileys `7.0.0-rc14` untuk membaca nomor alternatif dan pemetaan LID dari pesan WhatsApp. Atur `FRONTEND_URL` pada `.env` ke alamat frontend yang digunakan agar tautan portal WhatsApp benar. Setelah memperbarui dependency atau `.env`, restart backend. Jika sesi lama tidak dapat tersambung, hapus sesi dari menu **Pembayaran**, lalu hubungkan kembali dengan QR; jangan hapus folder `.whatsapp_auth/` kecuali memang ingin mereset tautan secara manual.

## Notifikasi dan perintah admin WhatsApp

Atur `WHATSAPP_ADMIN_PHONES` di `backend/.env` dengan nomor WhatsApp admin dalam format kode negara, pisahkan beberapa nomor dengan koma (contoh format: `62xxxxxxxxxx,62yyyyyyyyyy`). Nomor ini menjadi daftar izin: hanya pengirim dari nomor tersebut yang dapat memakai perintah admin, dan semua nomor terdaftar menerima ringkasan pendaftar baru. Backend membaca file ini berdasarkan lokasi kode, bukan folder kerja terminal. Setelah mengubah `.env`, restart backend dan pastikan bot WhatsApp sudah terhubung.

Pesan pendaftar baru mencakup nama, kode pendaftaran, program, gelombang, kontak, biaya, dan tautan langsung untuk review. Jawaban formulir dan dokumen tidak dikirim lewat WhatsApp; buka tautan detail di dashboard. Jika pengiriman gagal atau nomor admin belum diatur, status dan alasan kegagalan tercatat di detail pendaftar dan dapat dikirim ulang. Dashboard memperbarui jumlah pendaftar serta pembayaran menunggu review setiap menit.

Kirim perintah berikut dari nomor admin yang diizinkan:

- `ADMIN` - bantuan perintah admin
- `ADMIN RINGKASAN` - total peserta, status pendaftaran, jumlah per program, pembayaran terverifikasi, dan bukti yang menunggu review
- `ADMIN HARI INI` - pendaftaran baru dan pembayaran yang disetujui hari ini
- `ADMIN PENDAFTAR` - hingga 10 pendaftar yang perlu direview
- `ADMIN PEMBAYARAN` - hingga 10 bukti pembayaran yang perlu diperiksa
- `ADMIN GELOMBANG` - jumlah pendaftar dan kuota gelombang aktif

Nominal “pembayaran terverifikasi” hanya menjumlahkan transaksi yang sudah disetujui admin; bukti yang menunggu review ditampilkan terpisah sebagai perkiraan OCR. Setelah mengunduh pembaruan ini, jalankan `npm run migrate` di folder `backend` untuk menambahkan status notifikasi admin pada database.

Jangan gunakan `localhost` pada `FRONTEND_URL` jika peserta membuka tautan dari ponsel. Gunakan domain frontend yang dapat diakses peserta; untuk uji jaringan lokal, gunakan alamat IP LAN komputer dan jalankan frontend dengan `npm run dev -- --host 0.0.0.0`.

Foto bukti tersimpan privat di `private/payment-receipts/` dan hanya dapat dibuka melalui endpoint admin terautentikasi. Simpan/cadangkan folder tersebut bersama database.

## Deployment

Backend ini dikonfigurasi untuk MySQL lokal Laragon. Vercel tidak dapat mengakses database yang hanya berjalan di komputer lokal, dan proses serverless tidak cocok untuk koneksi Baileys yang harus selalu hidup. Untuk produksi, gunakan host backend persisten, MySQL yang dapat dijangkau dari host tersebut, serta penyimpanan file persisten.

## Akun admin

Email dan password admin ditentukan melalui `ADMIN_EMAIL` dan `ADMIN_PASSWORD` di `.env` sebelum menjalankan `npm run seed`. Gunakan password kuat minimal 12 karakter; seed tidak menyediakan password default.

## Endpoint

### Publik

- `GET /api/public/health` - pemeriksaan API dan database
- `GET /api/public/batch-active` - batch aktif beserta field dinamis
- `GET /api/public/portal/:token` - ringkasan privat peserta menggunakan tautan rahasia
- `POST /api/public/register` - pendaftaran peserta

Request pendaftaran memakai `multipart/form-data` agar mendukung field bertipe `file`:

```json
{
  "batch_id": 1,
  "full_name": "Nama Peserta",
  "whatsapp": "081234567890",
  "email": "peserta@email.com",
  "answers": "{\"pendidikan_terakhir\":\"SMA/SMK\",\"tanggal_lahir\":\"2005-01-01\",\"alamat\":\"Bandung\",\"motivasi\":\"Belajar Bahasa Jepang\"}"
}
```

Tambahkan file menggunakan nama field form, misalnya `foto_identitas`.

### Admin

- `POST /api/admin/auth/login`
- `GET /api/admin/me`
- `GET /api/admin/dashboard`
- `GET /api/admin/batches`
- `POST /api/admin/batches`
- `PATCH /api/admin/batches/:batchId`
- `DELETE /api/admin/batches/:batchId`
- `POST /api/admin/batches/:batchId/fields`
- `PUT /api/admin/fields/:fieldId`
- `DELETE /api/admin/fields/:fieldId`
- `GET /api/admin/batches/:batchId/registrants`
- `PATCH /api/admin/registrants/:registrantId/status`
- `POST /api/admin/registrants/:registrantId/notify`
- `GET /api/admin/payments`
- `GET /api/admin/payments/:paymentId/receipt`
- `PATCH /api/admin/payments/:paymentId/review`
- `POST /api/admin/payments/:paymentId/notify`
- `GET /api/admin/whatsapp/status`
- `POST /api/admin/whatsapp/connect`
- `DELETE /api/admin/whatsapp/session`

Endpoint admin selain login membutuhkan header:

```text
Authorization: Bearer <token>
```
