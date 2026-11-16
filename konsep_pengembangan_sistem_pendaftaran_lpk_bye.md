# Konsep Pengembangan Sistem Pendaftaran Kelas Bahasa Jepang - LPK BYE

Dokumen ini merangkum keseluruhan konsep perancangan aplikasi web pendaftaran pelatihan **Kelas Bahasa Jepang** untuk **LPK Bandung Youth Entrepreneur (BYE)** (berbasis operasional di Bandung). Proyek ini dirancang sebagai bagian dari kegiatan On-the-Job Training (OJT) dengan memanfaatkan stack modern **Node.js (Backend)**, **React & Tailwind CSS (Frontend)**, serta database relasional.

---

## 1. Latar Belakang & Tujuan
* **Latar Belakang:** LPK BYE secara rutin membuka pelatihan keterampilan dan bahasa (khususnya Bahasa Jepang untuk persiapan magang/kerja). Selama ini proses pengelolaan batch dan formulir pendaftaran sering kali statis dan membutuhkan perubahan koding jika ada syarat baru.
* **Tujuan:** Membangun sistem web landing page interaktif yang dilengkapi fitur **Dynamic Form Builder per Batch**, memungkinkan admin LPK mengatur gelombang dan kolom pertanyaan secara fleksibel tanpa mengubah kode program.

---

## 2. Arsitektur & Struktur Database (MySQL / PostgreSQL)

Sistem dirancang menggunakan 4 tabel utama untuk mendukung sifat dinamis dari formulir pendaftaran:

1. **Tabel `batches` (Manajemen Gelombang)**
   * `id` (PK, INT)
   * `batch_name` (VARCHAR): Contoh: "Gelombang 1 - Bahasa Jepang Pemula (N5)"
   * `program_type` (VARCHAR): Contoh: "Bahasa Jepang"
   * `start_date` & `end_date` (DATE)
   * `quota` (INT)
   * `is_active` (BOOLEAN): Status buka/tutup gelombang.

2. **Tabel `form_fields` (Form Builder Dinamis)**
   * `id` (PK, INT)
   * `batch_id` (FK ke `batches`)
   * `field_name` (VARCHAR): Nama unik identifier, cth: `pendidikan_terakhir`
   * `field_label` (VARCHAR): Label tampilan, cth: "Pendidikan Terakhir"
   * `field_type` (ENUM): `text`, `number`, `email`, `select`, `radio`, `textarea`, `file`
   * `options` (JSON): Pilihan untuk tipe *select* / *radio* (disimpan sebagai array string)
   * `is_required` (BOOLEAN)
   * `order_index` (INT): Urutan tampil di form.

3. **Tabel `registrants` (Data Utama Pendaftar)**
   * `id` (PK, INT)
   * `batch_id` (FK ke `batches`)
   * `full_name` (VARCHAR)
   * `whatsapp` (VARCHAR)
   * `registration_code` (VARCHAR, UNIQUE): Cth: `BYE-JPN-2026-001`
   * `status` (ENUM): `pending`, `verified`, `accepted`, `rejected`
   * `created_at` (TIMESTAMP)

4. **Tabel `registrant_answers` (Jawaban Dinamis Pendaftar)**
   * `id` (PK, INT)
   * `registrant_id` (FK ke `registrants`)
   * `field_id` (FK ke `form_fields`)
   * `answer_value` (TEXT): Nilai jawaban pendaftar atau path file upload.

---

## 3. Skema API (Node.js & Express)

### A. Sisi Publik (Landing Page & Pendaftar)
* `GET /api/public/batch-active`
  * **Deskripsi:** Mengambil informasi batch yang sedang aktif beserta struktur form dinamisnya (`form_fields`).
* `POST /api/public/register`
  * **Deskripsi:** Menerima data pendaftaran utama serta array jawaban dinamis, menyimpan ke database menggunakan transaksi SQL, dan menghasilkan URL redirect WhatsApp otomatis.

### B. Sisi Admin (Manajemen LPK BYE)
* `POST /api/admin/batches`
  * **Deskripsi:** Membuat gelombang/batch pelatihan baru.
* `POST /api/admin/batches/:batchId/fields`
  * **Deskripsi:** Menambahkan pertanyaan custom baru ke dalam batch tertentu.
* `GET /api/admin/batches/:batchId/registrants`
  * **Deskripsi:** Menampilkan daftar pendaftar lengkap dengan seluruh jawaban dinamis mereka per batch.

---

## 4. Alur Antarmuka Pengguna (UI/UX Workflow)

1. **Hero & Program Overview Section:** Pengunjung membuka landing page, melihat keunggulan belajar Bahasa Jepang di LPK BYE, serta informasi ringkas mengenai batch yang sedang buka.
2. **Dynamic Form Section:** Frontend secara otomatis melakukan *fetch* struktur form dari API Node.js dan merender form input (Text, Select, Radio, Textarea) secara dinamis sesuai konfigurasi admin.
3. **Submission & WhatsApp Integration:** Setelah tombol submit ditekan:
   * Data masuk ke database backend.
   * Muncul pop-up sukses berisi kode pendaftaran unik.
   * Terdapat tombol *“Lanjutkan Konfirmasi via WhatsApp”* yang langsung terhubung ke nomor resmi LPK BYE (`0838-2094-3475`).

---

## 5. Rencana Tahapan Implementasi
1. **Tahap 1:** Perancangan Database & Pembuatan Migration SQL.
2. **Tahap 2:** Pembuatan Backend Node.js/Express (Endpoint publik & admin, validasi Zoi/Joi).
3. **Tahap 3:** Pembuatan Frontend Landing Page & Dynamic Form Renderer menggunakan React & Tailwind CSS.
4. **Tahap 4:** Integrasi API, Testing end-to-end pendaftaran, dan uji coba fitur WhatsApp redirection.