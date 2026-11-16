# Dokumentasi API dan Rancangan UI LPK BYE

Dokumen ini menjadi acuan integrasi frontend, pembuatan desain Figma, dan pengembangan landing page serta dashboard admin.

## 1. Informasi Umum

- Base URL development: `http://localhost:5000`
- Format data: JSON, kecuali upload pendaftaran yang memakai `multipart/form-data`
- Endpoint publik diawali `/api/public`
- Endpoint admin diawali `/api/admin`
- Endpoint admin memakai header `Authorization: Bearer <token>`

### Format respons sukses

```json
{
  "success": true,
  "message": "Pesan opsional",
  "data": {}
}
```

### Format respons error

```json
{
  "success": false,
  "message": "Deskripsi error",
  "errors": [
    {
      "field": "nama_field",
      "message": "Pesan validasi"
    }
  ]
}
```

### Status pendaftar

| Value | Label UI | Warna UI |
|---|---|---|
| `pending` | Menunggu Verifikasi | Kuning |
| `verified` | Sudah Diverifikasi | Biru |
| `accepted` | Diterima | Hijau |
| `rejected` | Ditolak | Merah |

## 2. API Publik

### 2.1 Health Check

```text
GET /api/public/health
```

Respons `200`:

```json
{
  "success": true,
  "message": "Backend dan database aktif"
}
```

### 2.2 Ambil Batch Aktif dan Field Dinamis

Digunakan pada hero landing page dan form pendaftaran.

```text
GET /api/public/batch-active
```

Respons `200`:

```json
{
  "success": true,
  "data": {
    "batch": {
      "id": 1,
      "batch_name": "Gelombang 1 - Bahasa Jepang Pemula (N5)",
      "program_type": "Bahasa Jepang",
      "description": "Persiapan dasar bahasa Jepang untuk kebutuhan magang dan kerja di Jepang.",
      "start_date": "2026-01-01",
      "end_date": "2026-12-31",
      "quota": 30,
      "training_fee": 3500000,
      "is_active": 1
    },
    "fields": [
      {
        "id": 1,
        "field_name": "pendidikan_terakhir",
        "field_label": "Pendidikan Terakhir",
        "field_type": "select",
        "options": ["SD", "SMP", "SMA/SMK", "D3", "S1"],
        "is_required": 1,
        "order_index": 1
      },
      {
        "id": 2,
        "field_name": "tanggal_lahir",
        "field_label": "Tanggal Lahir",
        "field_type": "date",
        "options": null,
        "is_required": 1,
        "order_index": 2
      },
      {
        "id": 3,
        "field_name": "alamat",
        "field_label": "Alamat Lengkap",
        "field_type": "textarea",
        "options": null,
        "is_required": 1,
        "order_index": 3
      },
      {
        "id": 4,
        "field_name": "motivasi",
        "field_label": "Motivasi Mengikuti Kelas",
        "field_type": "textarea",
        "options": null,
        "is_required": 1,
        "order_index": 4
      },
      {
        "id": 5,
        "field_name": "foto_identitas",
        "field_label": "Foto/Scan Identitas",
        "field_type": "file",
        "options": null,
        "is_required": 0,
        "order_index": 5
      }
    ],
    "payment": {
      "training_fee": 3500000,
      "bot_phone": null,
      "bot_connected": false
    }
  }
}
```

Respons `404` jika tidak ada gelombang aktif:

```json
{
  "success": false,
  "message": "Belum ada gelombang aktif"
}
```

### Mapping tipe field ke UI

| `field_type` | Komponen frontend |
|---|---|
| `text` | Input teks |
| `number` | Input angka |
| `email` | Input email |
| `date` | Date picker |
| `select` | Dropdown dari `options` |
| `radio` | Radio group dari `options` |
| `textarea` | Textarea |
| `file` | File uploader JPG, PNG, atau PDF |

### 2.3 Kirim Pendaftaran

```text
POST /api/public/register
Content-Type: multipart/form-data
```

Part wajib dan opsional:

| Field | Jenis | Wajib | Contoh |
|---|---|---:|---|
| `batch_id` | text/number | Ya | `1` |
| `full_name` | text | Ya | `Ayu Nuraini` |
| `whatsapp` | text | Ya | `081234567890` |
| `email` | text | Tidak | `ayu@email.com` |
| `answers` | JSON string | Ya | JSON pada contoh di bawah |
| `<field_name>` | file | Sesuai field | `foto_identitas` |

Contoh JSON yang ditempatkan pada part `answers`:

```json
{
  "pendidikan_terakhir": "SMA/SMK",
  "tanggal_lahir": "2005-01-01",
  "alamat": "Jl. Contoh No. 10, Bandung",
  "motivasi": "Ingin belajar bahasa Jepang untuk persiapan magang."
}
```

Contoh Frontend JavaScript:

```javascript
const formData = new FormData();
formData.append("batch_id", activeBatch.id);
formData.append("full_name", form.full_name);
formData.append("whatsapp", form.whatsapp);
formData.append("email", form.email);
formData.append("answers", JSON.stringify(dynamicAnswers));

if (selectedFile) {
  formData.append("foto_identitas", selectedFile);
}

const response = await fetch("http://localhost:5000/api/public/register", {
  method: "POST",
  body: formData
});

const result = await response.json();
```

Respons sukses `201`:

```json
{
  "success": true,
  "message": "Pendaftaran berhasil",
  "data": {
    "registration_code": "BYE-JPN-2026-966975",
    "portal_url": "http://localhost:5173/peserta/opaque-secret-token",
    "notification": {
      "status": "sent",
      "message": "Informasi pendaftaran sudah dikirim ke WhatsApp peserta."
    },
    "whatsapp_url": "https://wa.me/6283820943475?text=Halo%20LPK%20BYE%2C%20saya%20Ayu%20Nuraini%20sudah%20mendaftar%20dengan%20kode%20BYE-JPN-2026-966975.",
    "payment": {
      "training_fee": 3500000,
      "bot_phone": "6283820943475"
    }
  }
}
```

`portal_url` adalah tautan rahasia unik peserta. Basis URL diatur lewat `FRONTEND_URL`. API hanya menyimpan hash token; tautan lengkap dikirim langsung kepada peserta. Jika pesan sambutan gagal dikirim, `notification.status` bernilai `failed`, tetapi pendaftaran tetap tersimpan dan tautan portal tetap ditampilkan.

Respons error:

```json
{
  "success": false,
  "message": "Alamat Lengkap wajib diisi"
}
```

Respons kuota penuh:

```json
{
  "success": false,
  "message": "Kuota gelombang sudah penuh"
}
```

Respons validasi:

```json
{
  "success": false,
  "message": "Data tidak valid",
  "errors": [
    {
      "field": "whatsapp",
      "message": "Invalid value"
    }
  ]
}
```

### 2.4 Portal Peserta

```text
GET /api/public/portal/:token
```

Token pada URL bertindak sebagai kredensial privat. Respons tidak memuat nomor WhatsApp, email, jawaban formulir, berkas identitas, atau catatan internal admin. Cache dinonaktifkan.

Respons `200`:

```json
{
  "success": true,
  "data": {
    "participant": {
      "full_name": "Ayu Nuraini",
      "registration_code": "BYE-JPN-2026-966975",
      "status": "verified",
      "feedback": "Pendaftaran sudah diverifikasi. Selamat bergabung!",
      "registered_at": "2026-06-02T03:00:00.000Z"
    },
    "training": {
      "batch_name": "Gelombang 1 - Bahasa Jepang Pemula (N5)",
      "program_type": "Bahasa Jepang",
      "description": "Program pemula",
      "start_date": "2026-07-01T00:00:00.000Z",
      "end_date": "2026-12-31T00:00:00.000Z"
    },
    "payment": {
      "training_fee": 3500000,
      "paid_total": 500000,
      "balance_due": 3000000,
      "instructions": "Transfer BCA 123456789 a.n. LPK BYE",
      "bot_phone": "6283820943475",
      "transactions": [
        {
          "id": 14,
          "amount_detected": 500000,
          "amount_approved": 500000,
          "status": "approved",
          "rejection_reason": null,
          "created_at": "2026-06-02T03:10:00.000Z",
          "reviewed_at": "2026-06-02T04:00:00.000Z"
        }
      ]
    }
  }
}
```

Respons `404` jika token tidak valid atau telah diganti:

```json
{ "success": false, "message": "Tautan portal tidak valid atau sudah diperbarui." }
```

Setelah pendaftaran tersimpan, bot mengirim pesan sambutan dan tautan portal. Instruksi pembayaran dan pengiriman bukti tersedia setelah status pendaftaran `verified` atau `accepted`.

## 3. API Admin

### 3.1 Login

```text
POST /api/admin/auth/login
Content-Type: application/json
```

Request:

```json
{
  "email": "admin@lpkbye.id",
  "password": "GantiDenganPasswordKuat"
}
```

Respons `200`:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": 1,
      "name": "Administrator LPK BYE",
      "email": "admin@lpkbye.id",
      "role": "super_admin"
    }
  }
}
```

Login gagal:

```json
{
  "success": false,
  "message": "Email atau password salah"
}
```

### 3.2 Data Admin

```text
GET /api/admin/me
Authorization: Bearer <token>
```

Respons:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Administrator LPK BYE",
    "email": "admin@lpkbye.id",
    "role": "super_admin"
  }
}
```

### 3.3 Ringkasan Dashboard

```text
GET /api/admin/dashboard
Authorization: Bearer <token>
```

Respons:

```json
{
  "success": true,
  "data": {
    "total_batches": 1,
    "active_batches": 1,
    "total_registrants": 1,
    "pending_registrants": 1
  }
}
```

## 4. Manajemen Batch

### Daftar batch

```text
GET /api/admin/batches
Authorization: Bearer <token>
```

Respons:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "batch_name": "Gelombang 1 - Bahasa Jepang Pemula (N5)",
      "program_type": "Bahasa Jepang",
      "description": "Persiapan dasar bahasa Jepang untuk kebutuhan magang dan kerja di Jepang.",
      "start_date": "2026-01-01",
      "end_date": "2026-12-31",
      "quota": 30,
      "is_active": 1,
      "registrant_count": 1
    }
  ]
}
```

### Buat batch

```text
POST /api/admin/batches
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "batch_name": "Gelombang 2 - Bahasa Jepang Dasar N5",
  "program_type": "Bahasa Jepang",
  "description": "Kelas bahasa Jepang intensif untuk pemula.",
  "start_date": "2027-01-01",
  "end_date": "2027-03-31",
  "quota": 30,
  "is_active": true
}
```

Respons `201`:

```json
{
  "success": true,
  "data": {
    "id": 2
  }
}
```

### Perbarui batch

```text
PATCH /api/admin/batches/:batchId
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "quota": 40,
  "is_active": false
}
```

Respons:

```json
{
  "success": true,
  "message": "Batch berhasil diperbarui"
}
```

### Hapus batch

```text
DELETE /api/admin/batches/:batchId
Authorization: Bearer <token>
```

Respons:

```json
{
  "success": true,
  "message": "Batch berhasil dihapus"
}
```

## 5. Form Builder

### Tambah field

```text
POST /api/admin/batches/:batchId/fields
Authorization: Bearer <token>
Content-Type: application/json
```

Request untuk field teks:

```json
{
  "field_name": "pengalaman_kerja",
  "field_label": "Pengalaman Kerja",
  "field_type": "textarea",
  "options": null,
  "is_required": false,
  "order_index": 6
}
```

Request untuk pilihan:

```json
{
  "field_name": "tujuan_kelas",
  "field_label": "Tujuan Mengikuti Kelas",
  "field_type": "radio",
  "options": ["Kerja ke Jepang", "Kuliah ke Jepang", "Hobi", "Magang"],
  "is_required": true,
  "order_index": 7
}
```

Respons `201`:

```json
{
  "success": true,
  "data": {
    "id": 6
  }
}
```

### Perbarui dan hapus field

```text
PUT /api/admin/fields/:fieldId
DELETE /api/admin/fields/:fieldId
Authorization: Bearer <token>
```

Request update:

```json
{
  "field_label": "Pengalaman Kerja Terakhir",
  "is_required": true,
  "order_index": 5
}
```

Respons:

```json
{
  "success": true,
  "message": "Field berhasil diperbarui"
}
```

## 6. Data Pendaftar

### Daftar pendaftar batch

```text
GET /api/admin/batches/:batchId/registrants
Authorization: Bearer <token>
```

Respons:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "batch_id": 1,
      "full_name": "Ayu Nuraini",
      "whatsapp": "081234567890",
      "email": "ayu@email.com",
      "registration_code": "BYE-JPN-2026-966975",
      "status": "pending",
      "notes": null,
      "answers": [
        {
          "registrant_id": 1,
          "field_name": "pendidikan_terakhir",
          "field_label": "Pendidikan Terakhir",
          "answer_value": "SMA/SMK"
        },
        {
          "registrant_id": 1,
          "field_name": "alamat",
          "field_label": "Alamat Lengkap",
          "answer_value": "Jl. Contoh No. 10, Bandung"
        }
      ]
    }
  ]
}
```

### Perbarui status

```text
PATCH /api/admin/registrants/:registrantId/status
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "status": "verified",
  "feedback": "Dokumen sudah lengkap dan valid. Selamat bergabung!",
  "notes": "Hanya catatan internal admin."
}
```

Respons:

```json
{
  "success": true,
  "message": "Status pendaftaran berhasil diperbarui",
  "data": {
    "notification": {
      "sent": true
    }
  }
}
```

`feedback` ditampilkan di portal dan dikirim ke peserta saat status atau feedback berubah. `notes` hanya untuk admin. Jika WhatsApp gagal mengirim, status pendaftaran tetap tersimpan dan respons menyatakan pesan gagal.
Status `rejected` wajib disertai pesan untuk peserta sebagai alasan dan tindak lanjut.

Kirim ulang pesan sambutan (tautan portal baru akan menggantikan tautan sebelumnya):

```http
POST /api/admin/registrants/8/notify
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{ "type": "welcome" }
```

Kirim ulang pembaruan status:

```json
{ "type": "status" }
```

## 7. Error Umum

Token hilang atau tidak valid, `401`:

```json
{
  "success": false,
  "message": "Token autentikasi diperlukan"
}
```

Endpoint tidak ditemukan, `404`:

```json
{
  "success": false,
  "message": "Endpoint tidak ditemukan"
}
```

Duplikat data, `409`:

```json
{
  "success": false,
  "message": "Data sudah terdaftar atau duplikat"
}
```

## 8. Rancangan Landing Page

### Arah visual

- Mood: modern, hangat, profesional, dan optimis
- Primary: merah marun Jepang
- Secondary: navy/biru gelap
- Background: putih dan krem muda
- Accent: merah muda/koral dan hijau WhatsApp
- Typography: Plus Jakarta Sans atau Sora untuk heading, Inter untuk body
- Border radius: 16-24 px
- Shadow: lembut dan rendah
- Gunakan sedikit motif Jepang seperti matahari terbit, garis topografi, atau grid geometris

### Responsive frame

- Desktop: 1440 x 1000 px
- Tablet: 768 x 1024 px
- Mobile: 390 x 844 px
- Content max width: 1200 px
- Desktop grid: 12 kolom, gap 24 px

### Section landing page

1. **Header**
   - Logo LPK BYE
   - Menu: Beranda, Tentang, Program, Keunggulan, Testimoni, Kontak
   - CTA `Daftar Sekarang`
   - Sticky header putih saat scroll

2. **Hero**
   - Badge `Pendaftaran Gelombang Dibuka`
   - Judul `Wujudkan Karier Jepang Bersama LPK BYE`
   - Deskripsi tentang pembelajaran bahasa Jepang, persiapan wawancara, administrasi, dan penempatan
   - CTA `Daftar Sekarang` dan `Lihat Program`
   - Visual peserta belajar atau ilustrasi modern
   - Card batch dan status kuota

3. **Informasi gelombang**
   - Menampilkan `batch_name`, `program_type`, periode, kuota, dan status aktif dari API
   - Desktop: satu baris card
   - Mobile: grid dua kolom atau card vertikal

4. **Tentang LPK BYE**
   - Layout foto 5 kolom dan konten 7 kolom
   - Judul `Dibimbing Profesional, Siap Kerja di Jepang`
   - Poin pengajar berpengalaman, kurikulum terarah, pendampingan berkelanjutan

5. **Statistik**
   - Peserta dilatih
   - Jenjang pembelajaran
   - Pendampingan administrasi
   - Praktik wawancara
   - Angka harus dikonfirmasi LPK sebelum dipublikasikan

6. **Program**
   - Bahasa Jepang Pemula
   - Persiapan Kerja dan Magang
   - Pendampingan Administrasi
   - Setiap card berisi manfaat, materi singkat, dan CTA

7. **Keunggulan**
   - Kurikulum terstruktur
   - Mentor berpengalaman
   - Kelas interaktif
   - Pendampingan berkelanjutan

8. **Alur pendaftaran**
   - Isi formulir
   - Kirim berkas
   - Verifikasi admin
   - Konfirmasi WhatsApp

9. **Form pendaftaran**
   - Panel informasi batch di kiri
   - Form di kanan pada desktop
   - Field dasar: nama lengkap, WhatsApp, email
   - Field dinamis urut sesuai `order_index`
   - Input wajib memiliki tanda `*`
   - Error ditampilkan langsung di bawah field
   - File uploader menggunakan format JPG, PNG, PDF, maksimal 5 MB
   - Tombol `Mengirim...` saat loading
   - Modal sukses menampilkan `registration_code`
   - CTA WhatsApp membuka `whatsapp_url`

10. **Testimoni**
    - Foto peserta, kutipan, nama, dan nama program
    - Gunakan nama anonim atau persetujuan untuk testimoni nyata

11. **FAQ**
    - Siapa yang dapat mengikuti kelas
    - Persyaratan usia
    - Cara mengetahui status pendaftaran
    - Dokumen yang disiapkan
    - Lama pembelajaran
    - Batasan garansi penempatan harus dikonfirmasi LPK

12. **CTA akhir dan footer**
    - Banner merah marun
    - Tombol daftar
    - Logo dan deskripsi
    - WhatsApp `0838-2094-3475`
    - Alamat di Bandung
    - Instagram, YouTube, dan Facebook

## 9. State Frontend Wajib

### Landing page

- Loading saat memanggil batch aktif
- Batch aktif tersedia
- Batch tidak aktif atau pendaftaran belum dibuka
- Field dinamis berbagai tipe
- Validasi field wajib
- File terlalu besar atau format salah
- Submit error
- Submit success
- Modal kode registrasi

### Admin

- Loading login
- Login gagal
- Token kedaluwarsa
- Batch kosong
- Form builder kosong
- Tidak ada pendaftar
- Update status loading dan sukses

## 10. Rancangan Dashboard Admin

- Sidebar dengan Dashboard, Batch, Form Builder, dan Pendaftar
- Topbar berisi nama admin dan role
- Login admin satu panel ilustrasi dan satu panel form
- Card dashboard untuk total batch, batch aktif, total pendaftar, dan pending
- Tabel batch berisi nama, periode, kuota, jumlah pendaftar, status, dan aksi
- Form builder sortable untuk mengatur field dan `order_index`
- Tabel pendaftar dilengkapi pencarian, filter status, dan detail
- Badge status warna kuning, biru, hijau, atau merah
- Detail peserta menampilkan seluruh jawaban dinamis dan notes admin

## 11. Prompt untuk Figma AI

```text
Buatkan desain responsive landing page LPK BYE untuk lembaga pelatihan
Bahasa Jepang di Bandung. Gunakan visual modern, hangat, profesional, dan
tepercaya dengan sentuhan budaya Jepang.

Palette merah marun sebagai primary, navy sebagai supporting, cream sebagai
background, coral sebagai accent, dan hijau WhatsApp untuk CTA.
Gunakan typography Plus Jakarta Sans atau Sora. Border radius 16-24 px.
Buat frame desktop 1440px dan mobile 390px.

Susun header sticky, hero, card batch aktif, tentang LPK, statistik,
program Bahasa Jepang, keunggulan, alur pendaftaran, form pendaftaran,
testimoni, FAQ, CTA akhir, dan footer.

Hero judulnya: "Wujudkan Karier Jepang Bersama LPK BYE".
Form harus menampilkan nama lengkap, WhatsApp, email, lalu field dinamis.
Dukung komponen text, number, email, date, select, radio, textarea, dan file.
Select dan radio memakai array options. Field required menampilkan tanda *.
Modal sukses menampilkan kode registrasi dan tombol Konfirmasi via WhatsApp.

API landing page:
GET /api/public/batch-active mengembalikan { batch, fields }.
POST /api/public/register memakai multipart/form-data dan mengembalikan
{ registration_code, whatsapp_url }.
```

## 12. Prompt Admin untuk Figma AI

```text
Buatkan dashboard admin sistem pendaftaran LPK BYE dengan sidebar kiri,
topbar, dan content area pada background abu-abu terang.
Buat halaman login, dashboard, daftar batch, form batch, form builder,
daftar pendaftar, dan detail pendaftar.

Gunakan status pending kuning, verified biru, accepted hijau, dan rejected merah.
Form builder mendukung text, number, email, date, select, radio, textarea,
dan file, lengkap dengan options, is_required, dan order_index.
Dashboard memakai total_batches, active_batches, total_registrants,
dan pending_registrants.
Semua endpoint admin membutuhkan Bearer token.
```

## 13. Checklist Sebelum Handover UI

- [ ] Desktop, tablet, dan mobile telah dibuat
- [ ] State loading, error, kosong, dan sukses tersedia
- [ ] Semua `field_type` API memiliki komponen UI
- [ ] Field wajib ditandai dan divalidasi
- [ ] Upload memvalidasi format dan ukuran
- [ ] Modal sukses menampilkan kode registrasi
- [ ] WhatsApp menggunakan URL dari API
- [ ] Status admin konsisten pada tabel dan badge
- [ ] Form builder mendukung urutan, options, dan required
- [ ] Detail pendaftar menampilkan jawaban dinamis
- [ ] Link navigasi dan tombol CTA berfungsi

## 14. Biaya Pelatihan dan Pembayaran Cicilan

### Konfigurasi biaya pada gelombang

`POST /api/admin/batches` dan `PATCH /api/admin/batches/:batchId` menerima:

```json
{
  "training_fee": 3500000,
  "payment_instructions": "Transfer BCA 123456789 a.n. LPK BYE"
}
```

Nilai biaya disalin ke pendaftar saat pendaftaran agar perubahan harga gelombang tidak mengubah sisa tagihan peserta yang sudah terdaftar.

### Alur peserta

1. Setelah pendaftaran tersimpan, bot menyapa peserta lewat WhatsApp dengan kode pendaftaran dan tautan portal pribadi.
2. Tautan `GET /api/public/portal/:token` menampilkan status, data gelombang, biaya, dan transaksi pembayaran. Tautan bertindak sebagai kredensial; simpan secara privat.
3. Admin mengubah status dan mengisi `feedback` yang terlihat peserta. Catatan internal disimpan di `notes` dan tidak dikirim.
4. Setelah status `verified` atau `accepted`, bot memberi ucapan selamat serta instruksi cicilan. Peserta dapat mengirim foto bukti dari nomor terdaftar.
5. Bot juga menyediakan perintah `MENU`, `STATUS <kode>`, `PEMBAYARAN <kode>`, `JADWAL <kode>`, dan `PORTAL <kode>`. Perintah yang menampilkan data pendaftar memerlukan nomor terdaftar; bila satu nomor dipakai beberapa peserta, sertakan kode pendaftaran.
6. Jika nomor cocok dengan tepat satu pendaftar dan statusnya sudah `verified` atau `accepted`, bot menyimpan foto, hasil OCR, dan membuat transaksi `pending`. Nominal OCR hanya perkiraan dan tidak pernah menyetujui transaksi otomatis.
7. Setelah admin menyetujui/menolak cicilan, bot mengirim pemberitahuan. Pesan yang gagal dapat dicoba ulang dari menu pembayaran.

Status pembayaran: `pending`, `approved`, `rejected`. Nilai `paid_total` dan `balance_due` menghitung hanya pembayaran berstatus `approved`.

### Pengelolaan pembayaran admin

`GET /api/admin/payments?status=pending` memberikan daftar transaksi, data pendaftar, hasil OCR, status notifikasi, dan ringkasan:

```json
{
  "success": true,
  "data": [
    {
      "id": 14,
      "registrant_id": 8,
      "full_name": "Nama Peserta",
      "registration_code": "BYE-JPN-2026-123456",
      "sender_phone": "6281234567890",
      "amount_detected": "500000.00",
      "amount_approved": null,
      "status": "pending",
      "ocr_status": "read",
      "receipt_path": "bukti.jpg",
      "notification_status": "pending"
    }
  ],
  "summary": {
    "pending_count": 1,
    "pending_amount": "500000.00",
    "total_received": "0.00"
  }
}
```

Bukti tidak tersedia secara publik. Buka melalui `GET /api/admin/payments/:paymentId/receipt` dengan Bearer token admin.

Setujui transaksi dengan nominal yang telah diperiksa:

```http
PATCH /api/admin/payments/14/review
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{ "status": "approved", "amount": 500000 }
```

Tolak transaksi harus menyertakan alasan:

```json
{ "status": "rejected", "rejection_reason": "Nominal pada bukti tidak sesuai." }
```

Respons mencakup `data.notification.sent`. Jika pengiriman gagal, status pembayaran tetap tersimpan dan `POST /api/admin/payments/14/notify` dapat dipakai untuk mengirim ulang.

### Tautan akun WhatsApp

Semua endpoint berikut memerlukan Bearer token admin:

- `GET /api/admin/whatsapp/status` - status koneksi, nomor tertaut, atau QR dalam bentuk data URL.
- `POST /api/admin/whatsapp/connect` - mulai koneksi dan minta QR.
- `DELETE /api/admin/whatsapp/session` - logout dan hapus sesi lokal; QR baru diperlukan untuk menautkan akun kembali.
- `GET /api/admin/payments/:paymentId/receipt` - membuka foto bukti secara privat dengan Bearer token admin.

Baileys adalah library WhatsApp Web tidak resmi. Gunakan nomor khusus, simpan direktori sesi secara privat, dan jangan commit sesi tersebut ke repository.
