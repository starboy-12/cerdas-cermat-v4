# Cerdas Cermat

Prototipe belajar berbentuk buku 3D untuk TK, SD, SMP, dan SMA. Frontend dan backend berjalan pada alamat yang terpisah; frontend berkomunikasi dengan backend melalui REST API.

## Struktur

```text
backend/
  data/books.js                  Katalog jenjang dan bank 50 soal Matematika
  data/curriculum-catalog.js     Peta mapel, fase, topik, dan materi ringkas awal
  data/quizzes.js                Paket kuis 50 soal per mapel dan jenjang
  data/progress.json             Progres dan riwayat hasil runtime
  src/server.js                  REST API, pemeriksaan jawaban, penilaian, dan penyimpanan
  .env.example                   Konfigurasi port dan CORS
frontend/
  assets/storybook/               Ilustrasi lokal dan catatan sumbernya
  package.json                   Perintah menjalankan frontend terpisah
  server.js                      Server file statis lokal
  config.js                      Alamat API yang dipakai frontend
  index.html                     Halaman katalog, pemilih kurikulum, buku dan hasil
  app.js                         Navigasi, animasi per lembar, kuis dan interaksi API
  styles.css                     Tampilan aplikasi
  book-layout.css                Ukuran buku, halaman, dialog, dan tampilan ponsel
  reader-motion.css              Animasi buka buku
```

## Menjalankan secara terpisah

Perlu Node.js 18+.

Terminal pertama, jalankan API:

```powershell
cd backend
npm.cmd start
```

Terminal kedua dari folder proyek, jalankan frontend:

```powershell
cd frontend
npm.cmd start
```

Buka `http://localhost:5174`. Backend berjalan di `http://localhost:3101`; alamatnya diatur di `frontend/config.js`. Port ini menghindari bentrok dengan layanan lain yang memakai port `5173` dan `3100`.

Untuk menjalankan keduanya sekaligus dari folder proyek, gunakan:

```powershell
.\start.cmd
```

Skrip membuka jendela backend dan frontend, lalu memeriksa endpoint keduanya. Tutup jendela proses masing-masing untuk menghentikannya. Alternatifnya, jalankan perintah `npm.cmd start` dari dua terminal seperti di atas. Jika mengganti port frontend, tambahkan origin yang sesuai ke `CORS_ORIGIN` sebelum backend dijalankan.

## Alur prototipe yang tersedia

1. Pilih jenjang, kurikulum, dan fase/kelas.
2. Pilih mata pelajaran dan materi.
3. Baca ringkasan materi dalam empat halaman buku; progres baca disimpan oleh backend.
4. Setiap mapel atau elemen memiliki kuis latihan 50 soal, tiga soal per halaman. Kuis dapat dipilih langsung dari daftar materi atau dimulai setelah membaca materi.
5. Jawaban diperiksa backend; progres dan hasil kuis disimpan terpisah per mapel.
6. Buku khusus "Kisah Kecil Nusantara" berdiri terpisah dari empat buku latihan. Pilih TK, SD, SMP, atau SMA untuk membaca enam bab bergambar: sejarah, agama dan budi pekerti, sejarah Islam, kisah para nabi, A–Z, serta hewan. Bab sejarah Islam dan nabi memiliki beberapa halaman adegan dan makna yang berbeda menurut jenjang, rujukan ayat atau hadis pada halaman, dan ilustrasi simbolis tanpa penggambaran sosok nabi. Buku ini memakai animasi balik lembar yang sama.

Bank kuis selain Matematika adalah draf latihan otomatis dan perlu ditelaah guru sebelum dipakai sebagai penilaian resmi. Pemetaan topik juga merupakan peta awal, bukan pengganti buku ajar resmi.

API penting: `GET /api/catalog`, `GET /api/catalog/:level/subjects?curriculum=...&phase=...`, `GET /api/materials/:level/:subject/:topic/pages/:number`, `GET /api/quizzes/:level/:subject/pages/:number?curriculum=...&phase=...`, `GET /api/storybook`, `GET /api/storybook/:level`, `GET /api/storybook/:level/pages/:number`, `GET /api/reading-progress/:studentId?key=...`, `PUT /api/reading-progress`, `GET /api/progress/:studentId`, `PUT /api/progress`, `POST /api/answer`, dan `POST /api/results`. Endpoint `GET /api/books/:id/pages/:number` tetap tersedia sebagai rute kompatibilitas Matematika. Cek backend melalui `GET /api/health`.

Gambar buku cerita tersedia lokal dan tetap bisa dibuka saat offline. Kredit serta lisensi gambar dicatat di [ATTRIBUTIONS.md](frontend/assets/storybook/ATTRIBUTIONS.md). Bab agama umum menyajikan nilai yang inklusif; bab sejarah Islam dan kisah para nabi merujuk ayat atau hadis yang dicantumkan langsung pada halaman.

## Status backlog

Status berikut mencerminkan implementasi di repository dan tes yang tersedia. **Selesai** berarti jalur implementasi ada; **Perlu verifikasi** berarti perlu tes operasional, audit perangkat/aksesibilitas, atau peninjauan ahli; **Belum selesai** berarti masih ada kemampuan yang belum tersedia. Status selesai bukan pengesahan kebenaran materi oleh ahli kurikulum.

### Backend

| ID | Status | Catatan |
|---|---|---|
| BE-18 | Selesai | Validasi struktur katalog, fase, dan tujuan belajar tersedia. |
| BE-19 | Selesai | Skema konten menyimpan sumber, reviewer, tanggal tinjau, dan status publikasi. |
| BE-20 | Selesai | Validasi soal mencakup kunci, pilihan, kesulitan, dan pembahasan. |
| BE-21 | Selesai | Topik mengacu eksplisit pada ID paket kuis. |
| BE-22 | Selesai | API menolak hasil sebelum semua soal dijawab. |
| BE-23 | Selesai | Input, konteks paket, nomor halaman, dan pilihan divalidasi. |
| BE-24 | Selesai | Kebijakan identitas, privasi, retensi, dan penghapusan ada di [PRIVACY.md](PRIVACY.md). |
| BE-25 | Selesai | Penulisan lokal diserialisasi; tes mencakup jawaban paralel dan penggabungan perubahan. |
| BE-26 | Selesai | Tes otomatis API, validasi, dan penyimpanan dijalankan lewat `npm test`. |
| BE-27 | Selesai | Dokumen konten memiliki `schemaVersion` dan validasi skema. |
| BE-28 | Selesai | API pengelolaan konten tersedia dengan pembatasan role. |
| BE-29 | Selesai | Workflow draf, review, persetujuan/penolakan, dan publikasi tersedia. |
| BE-30 | Selesai | Revisi dan komentar reviewer tersimpan. |
| BE-31 | Selesai | API memulai percobaan baru tanpa menghapus hasil lama. |
| BE-32 | Selesai | API menyediakan progres topik dan riwayat bertanggal. |
| BE-33 | Selesai | Respons error menggunakan kode dan pesan terstandar; kegagalan simpan dilaporkan. |
| BE-34 | Selesai | Skema PostgreSQL dan skrip migrasi JSON tersedia. |
| BE-35 | Perlu verifikasi | Migrasi memvalidasi data dan manifest; perlu diuji terhadap database PostgreSQL tujuan. |
| BE-36 | Selesai | Autentikasi email/kata sandi dan Google ID token terverifikasi; sesi membawa role akun. |
| BE-37 | Selesai | Tes API memverifikasi kepemilikan progres, role guru/reviewer/admin, kelas, dan akses agregat. |
| BE-38 | Selesai | Spesifikasi OpenAPI tersedia dan diperiksa oleh pipeline. |
| BE-39 | Selesai | API membatasi laju, ukuran request, dan durasi permintaan. |
| BE-40 | Perlu verifikasi | Skrip backup/restore tersedia; pemulihan PostgreSQL perlu diuji di lingkungan target. |
| BE-41 | Selesai | Log JSON mencatat request, status, dan durasi; metrik respons, latensi, error, serta health check PostgreSQL tersedia. |
| BE-42 | Perlu verifikasi | Guard production, HTTPS, dan CORS didokumentasikan; perlu validasi deployment nyata. |
| BE-43 | Selesai | CI menjalankan tes, lint, build, tes browser, dan pemeriksaan OpenAPI. |
| BE-44 | Selesai | `POST /api/sync/progress` menyimpan batch progres secara atomik; batch gagal tidak menyimpan perubahan parsial. |
| BE-45 | Selesai | Admin menugaskan siswa/guru ke kelas; API agregat hanya dapat diakses guru yang ditugaskan. |
| BE-46 | Selesai | API konfigurasi muatan lokal sekolah tersedia. |
| BE-47 | Selesai | API merekomendasikan latihan untuk nilai tertinggi di bawah 80% dan memprioritaskan topik terlemah; ambang tetap perlu ditinjau ahli. |
| BE-48 | Selesai | API metadata media mencatat atribusi dan lisensi. |

### Frontend

| ID | Status | Catatan |
|---|---|---|
| FE-17 | Selesai | Materi melanjutkan ke kuis berdasarkan relasi topik. |
| FE-18 | Selesai | Materi tanpa kuis terkait memberi pilihan langkah berikutnya. |
| FE-19 | Selesai | Topik dan materi membedakan draf dari konten tervalidasi/terbit; label status diuji. |
| FE-20 | Selesai | Status online/offline dan penyimpanan tertunda ditampilkan. |
| FE-21 | Selesai | UI menangani loading, error, cache offline, dan percobaan ulang. |
| FE-22 | Selesai | UI dan API mencegah hasil final sebelum kuis lengkap. |
| FE-23 | Selesai | Tes browser mencakup alur dari katalog sampai hasil kuis. |
| FE-24 | Selesai | Tombol melanjutkan materi terakhir tersedia. |
| FE-25 | Selesai | Status baca dan kuis membedakan belum dimulai, progres jawaban, serta percobaan selesai; status diuji. |
| FE-26 | Selesai | Halaman progres menampilkan riwayat nilai dan progres per topik. |
| FE-27 | Selesai | Pengguna dapat memulai percobaan baru tanpa menghapus hasil sebelumnya. |
| FE-29 | Selesai | Editor materi, soal, dan pembahasan menggunakan dokumen konten. |
| FE-30 | Selesai | Status draf, review, persetujuan, penolakan, dan publikasi ditangani UI. |
| FE-31 | Perlu verifikasi | Tes keyboard memeriksa trap dan pemulihan fokus; audit Axe lulus, tetapi pembaca layar nyata perlu diuji manual. |
| FE-32 | Perlu verifikasi | Audit Axe WCAG 2.1 AA pada katalog, pembaca, akun, dan progres lulus; zoom 200% serta penggunaan tanpa warna perlu verifikasi manual. |
| FE-33 | Selesai | Tes layout ponsel (375px), tablet (768px), dan desktop (1440px) memeriksa halaman, katalog, serta pembaca. |
| FE-34 | Selesai | Pesan berhasil, gagal, dan coba lagi tersedia untuk alur utama. |
| FE-35 | Selesai | UI mendukung masuk, registrasi, keluar, dan Google Sign-In. |
| FE-36 | Selesai | Login diwajibkan sebelum aplikasi terbuka; sesi tervalidasi dan logout mengunci kembali aplikasi. |
| FE-37 | Selesai | UI memakai API konten dan progres yang mendukung penyimpanan database. |
| FE-38 | Selesai | Tes komponen otomatis dan alur browser tersedia di CI. |
| FE-39 | Selesai | CI menjalankan lint dan build frontend. |
| FE-40 | Selesai | Konfigurasi URL API frontend dapat diatur untuk deployment. |
| FE-41 | Selesai | Manifest dan service worker mendukung instalasi PWA. |
| FE-42 | Selesai | Halaman yang pernah dibuka dapat dibaca dari cache offline. |
| FE-43 | Selesai | Antrean progres tertunda dan indikator sinkronisasi tersedia. |
| FE-44 | Selesai | Aktivitas refleksi interaktif tersedia dengan pilihan respons, umpan balik, dan escaping konten. |
| FE-45 | Selesai | Progres menampilkan rekomendasi API dengan prioritas nilai terendah; kalibrasi pembelajaran perlu peninjauan ahli. |
| FE-46 | Selesai | UI guru menampilkan agregat hasil kelas yang ditugaskan; admin mengelola penugasan kelas. |
| FE-47 | Selesai | UI menyediakan pemilihan konten muatan lokal sekolah. |

Katalog, materi, dan bank soal tetap perlu ditelaah guru sebelum digunakan sebagai materi tervalidasi atau penilaian resmi. Pengujian PostgreSQL operasional, backup/restore pada infrastruktur target, audit aksesibilitas, serta validasi rekomendasi oleh ahli adalah tindak lanjut yang belum dapat dianggap selesai hanya berdasarkan tes otomatis.

Rujukan pemetaan awal: [Portal Kurikulum Nasional](https://kurikulum.kemendikdasmen.go.id/), [Panduan Mata Pelajaran](https://kurikulum.kemendikdasmen.go.id/panduan-mapel), [panduan pemilihan mapel SMA](https://kurikulum.kemendikdasmen.go.id/file/1697008038_manage_file.pdf), dan [panduan Capaian Pembelajaran Fase Fondasi PAUD](https://kurikulum.kemendikdasmen.go.id/file/panduan/dokumen/01.%20Panduan%20CP_Fase%20Fondasi_PAUD_14_09_2025_revisi%203.pdf).

Login wajib; aplikasi tidak lagi membuat identitas tamu baru. File `backend/data/progress.json` lama mungkin masih berisi progres tamu dari versi sebelumnya. Akun siswa menyinkronkan progres antarperangkat. Hapus file runtime tersebut jika ingin memulai data lokal dari awal.

## API, akun, dan konten

OpenAPI tersedia di `GET /api/openapi.json`; katalog dan bank soal dapat diperiksa melalui `GET /api/catalog/validate`. Respons kegagalan memakai `code`, `message`, dan header `X-Request-Id`.

Aplikasi mewajibkan login sebelum materi, latihan, progres, atau fitur lain dapat digunakan; endpoint belajar backend juga menolak permintaan tanpa sesi. Masuk dengan email/kata sandi atau Google tersedia dari layar awal. Pendaftaran terbuka membuat akun siswa. Pendaftaran guru dan reviewer memerlukan `TEACHER_INVITE_CODE` atau `REVIEWER_INVITE_CODE`; admin awal dibuat dari `ADMIN_EMAIL` dan `ADMIN_PASSWORD` saat backend dimulai. Login Google dengan email terverifikasi yang cocok dengan `DEVELOPER_EMAIL` (default `satriosimputra21@gmail.com`) memberikan peran admin. Untuk mengaktifkan atau mengatur login kata sandi pada akun yang sama, atur `ADMIN_EMAIL` dan `ADMIN_PASSWORD` di lingkungan backend; konfigurasi tersebut mempromosikan akun yang sudah ada ke admin dan mengatur ulang kata sandinya saat backend dimulai. Simpan rahasia di environment deployment, jangan di source control. Kata sandi admin harus minimal 12 karakter. Sesi berlaku 12 jam di memori backend. Untuk mengaktifkan tombol Google, buat OAuth Client ID tipe Web di Google Cloud Console, masukkan origin frontend pada Authorized JavaScript origins, lalu atur `GOOGLE_CLIENT_ID` di backend; Client Secret tidak diperlukan untuk alur ID token ini. Backend memverifikasi tanda tangan token, audience, penerbit, kedaluwarsa, dan status email terverifikasi, kemudian menautkan email Google ke akun siswa yang sudah ada bila cocok. Progres akun dibatasi ke identitas pemilik. Admin mengelola kelas dan menugaskan akun siswa/guru melalui **Progres saya**; guru hanya melihat agregat untuk kelas yang ditugaskan dan tanpa nama siswa. Tetap gunakan data fiktif sampai kebijakan sekolah dan deployment ditinjau.

Antarmuka Studio Konten telah dihapus. API pengelolaan dan peninjauan konten tetap tersedia di backend. Konten muatan lokal harus berstatus terbit sebelum admin sekolah dapat memilihnya di **Progres saya → Muatan lokal sekolah**. API sekolah berada di `/api/schools/:schoolId/catalog`; API metadata lisensi media berada di `/api/media`. API kelas admin berada di `/api/classes`; dashboard agregat guru menggunakan `/api/analytics/class?classId=...`. Sinkronisasi antrean offline menggunakan `POST /api/sync/progress` dan bersifat atomik per batch.

## PostgreSQL dan operasi

Mode lokal memakai JSON. Untuk PostgreSQL, pasang dependency dari `backend/package.json`, atur `DATABASE_URL`, lalu jalankan backend. `backend/db/schema.sql` diterapkan saat startup. Progres ditulis ke `application_state` dan diselaraskan ke tabel identitas, percobaan, jawaban, dan posisi baca dalam transaksi; penulis berbeda digabung berdasarkan perubahan yang mereka buat. Editor konten, pilihan sekolah, dan metadata media tetap memakai file `CONTENT_FILE`.

Impor file progres lama:

```powershell
cd backend
$env:DATABASE_URL = 'postgresql://...'
npm.cmd run migrate:json
```

Backup JSON: `.\backend\scripts\backup.ps1 -Type json`. Backup PostgreSQL: `.\backend\scripts\backup.ps1 -Type postgres` dengan `DATABASE_URL` dan `pg_dump` tersedia. Uji restore ke folder atau database kosong terpisah memakai `.\backend\scripts\restore.ps1 -ConfirmRestore`; jangan arahkan uji pemulihan ke database layanan aktif. Jalankan `GET /api/catalog/validate` dan bandingkan manifest jumlah data setelah restore. Backup dapat berisi hash kata sandi dan progres siswa; batasi aksesnya.

Production mewajibkan `DATABASE_URL`, `NODE_ENV=production`, `TRUST_PROXY_TLS=1`, origin HTTPS yang spesifik di `CORS_ORIGIN`, serta reverse proxy yang mengakhiri HTTPS dan mengirim `X-Forwarded-Proto: https`. Atur rahasia melalui environment deployment, bukan repository. Server membatasi payload, durasi request, dan laju permintaan.

## Pengujian

```powershell
cd backend
npm.cmd run lint
npm.cmd test

cd ..\frontend
npm.cmd install
npm.cmd run lint
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Pipeline GitHub Actions menjalankan validasi sintaks, tes API/migrasi/penyimpanan, tes komponen, build, dan alur browser Chromium. Tes memakai file data sementara. `GET /api/metrics` menyediakan metrik operasional untuk admin; `/api/health` memeriksa koneksi PostgreSQL bila digunakan. Frontend dapat dipasang sebagai PWA; halaman dan gambar yang pernah dibuka tersedia offline, dan jawaban offline baru dihitung setelah diperiksa backend. HTTPS diperlukan untuk instalasi PWA di luar localhost.

Sebelum mengumpulkan data siswa sungguhan, baca [kebijakan data demo](PRIVACY.md). Katalog dan bank soal tetap berstatus draf sampai guru/reviewer meninjaunya; validasi otomatis hanya memeriksa struktur data, bukan kebenaran pedagogisnya.
