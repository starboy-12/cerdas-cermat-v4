# Backlog Cerdas Cermat

Backlog ini disusun dari pemeriksaan README dan implementasi frontend/backend saat ini. Aplikasi adalah prototipe, belum platform belajar siap produksi. Prioritas adalah rekomendasi; ukuran pekerjaan, penanggung jawab, dan jadwal belum ditetapkan.

## Ringkasan kondisi sekarang

**Sudah tersedia:** katalog jenjang dan pilihan kurikulum/fase, pemilihan mapel/topik, buku interaktif responsif, ringkasan materi empat halaman, kuis 50 soal (3 soal per halaman), pemeriksaan jawaban di backend, pembahasan, progres baca/kuis, hasil dan rekomendasi sederhana, endpoint kesehatan, preferensi reduced motion, serta buku cerita terpisah dengan enam tema untuk setiap jenjang TK–SMA. Bab sejarah Islam dan para nabi kini berupa rangkaian adegan dan makna yang disesuaikan per jenjang, disertai rujukan sumber dan ilustrasi lokal.

**Batasan yang diketahui:** isi katalog/materi/soal dan cerita masih berupa draf awal yang belum ditelaah guru atau dipetakan rinci ke CP/KD; bab sejarah Islam dan kisah nabi memiliki rujukan ayat/hadis, tetapi tetap perlu ditelaah guru agama; bab agama umum membahas nilai umum secara inklusif; progres memakai ID tamu buatan peramban dan berkas JSON lokal; belum ada akun/role guru/admin; belum ada panel pengelolaan konten; belum ada database relasional, sinkronisasi perangkat, mode offline/PWA, spesifikasi OpenAPI, atau pengujian otomatis yang tercantum.

**Risiko alur yang perlu dipastikan:** setelah menyelesaikan materi non-kuis, implementasi memilih kuis pertama yang tersedia pada mapel tersebut. Hubungan antara topik yang dipelajari dan kuis yang dimulai perlu dibuat eksplisit agar pengalaman belajar tidak berpindah topik secara mengejutkan.

Status item di bawah ini adalah `Perlu dikerjakan` kecuali disebut `Perlu verifikasi`. Jangan menganggap fitur atau standar yang belum disebut dalam dokumen ini telah diuji.

## Prioritas P0 — Fondasi sebelum penggunaan nyata

| ID | Pekerjaan | Kekurangan/risiko saat ini | Kriteria selesai |
|---|---|---|---|
| P0-01 | Validasi kurikulum bersama ahli | Peta materi merupakan peta awal; topik, fase/kelas, dan istilah dapat tidak selaras dengan dokumen resmi atau kebutuhan sekolah. | Setiap entri aktif memiliki kurikulum, jenjang/fase, tujuan belajar/CP atau KD yang relevan, sumber rujukan, tanggal tinjau, dan reviewer; katalog arsip diberi penanda jelas. |
| P0-02 | Kurasi materi ajar | Ringkasan materi ditandai draf dan cakupannya belum memadai untuk semua topik. | Setiap topik yang dipublikasikan mempunyai tujuan, materi sesuai usia, contoh/aktivitas, sumber, atribusi yang diperlukan, status publikasi, serta persetujuan reviewer. Materi draf tidak tampil sebagai konten tervalidasi. |
| P0-03 | Validasi bank soal dan pembahasan | Soal otomatis/draf dapat ambigu, salah tingkat kesulitan, atau tidak sesuai kompetensi; kunci dan pembahasan harus ditinjau. | Soal memiliki keterkaitan ke tujuan/topik, tingkat kesulitan, kunci, alasan jawaban, status review, dan reviewer. Soal berstatus draf tidak digunakan untuk penilaian resmi. |
| P0-04 | Perbaiki keterkaitan materi–kuis | Setelah materi selesai, kuis pertama pada mapel dipilih, bukan berdasarkan relasi topik yang terbukti eksplisit. | Setiap materi menyimpan ID kuis/tujuan lanjut yang eksplisit; materi yang tidak memiliki kuis menawarkan langkah berikutnya yang jelas. Uji pemetaan untuk tiap jenjang dan mapel. |
| P0-05 | Tetapkan batas penggunaan dan privasi siswa | ID tamu berada di klien, bukan autentikasi; identitas dapat hilang saat data peramban dibersihkan dan progres tidak tersinkron. Data progres siswa memerlukan aturan retensi dan akses. | Tentukan apakah MVP hanya demo anonim atau digunakan siswa sungguhan. Dokumentasikan data yang dikumpulkan, tujuan, retensi, penghapusan, dan persetujuan yang diperlukan; jangan tampilkan data pribadi dalam ID atau log. |
| P0-06 | Tambahkan autentikasi dan otorisasi bila dipakai nyata | Belum ada login/role. Mengetahui atau menebak ID klien tidak setara dengan membuktikan kepemilikan progres. | Sebelum menyimpan data siswa nyata, identitas diverifikasi server dan setiap endpoint data membatasi akses ke pemilik/role yang berwenang; uji akses lintas akun ditolak. |
| P0-07 | Ketahanan penyimpanan progres | Data disimpan di `progress.json`, satu file lokal; belum ada migrasi database, kebijakan backup/restore, atau penanganan konkurensi lintas instance. | Pilih dan dokumentasikan target penyimpanan; ada migrasi, backup terjadwal, uji restore, validasi skema, serta uji tulis serentak tanpa kehilangan data. Bila tetap demo lokal, batasan ini dijelaskan dengan jelas. |
| P0-08 | Uji otomatis alur inti | Manifest saat ini tidak mencantumkan skrip pengujian otomatis. Perubahan UI/API berisiko merusak alur belajar dan penyimpanan tanpa terdeteksi. | Ada tes untuk katalog, validasi input API, pemeriksaan jawaban, penolakan hasil kuis yang belum lengkap, penyimpanan progres, dan jalur pengguna utama; tes dapat dijalankan satu perintah di CI. |

## Prioritas P1 — Produk belajar dan pengelolaan konten

| ID | Pekerjaan | Kekurangan/risiko saat ini | Kriteria selesai |
|---|---|---|---|
| P1-01 | Model konten terstruktur | Katalog, materi, dan soal berada di berkas kode; perubahan konten memerlukan perubahan/deploy kode dan metadata review terbatas. | Definisikan skema konten berversi untuk kurikulum, jenjang/fase, mapel, topik, materi, tujuan, soal, sumber, dan status review; validasi skema otomatis. |
| P1-02 | Panel review guru | Tidak ada alur bagi guru untuk membuat, memperbaiki, meninjau, dan menerbitkan konten. | Guru/reviewer dapat melihat antrean draf, mengedit konten, memberi komentar/status, menyetujui atau menolak, dan melihat riwayat perubahan; publikasi memerlukan hak yang sesuai. |
| P1-03 | Pencarian dan navigasi kurikulum | Memilih jenjang, kurikulum, fase, mapel, topik sudah ada, namun pengalaman untuk menemukan materi atau melanjutkan belajar masih terbatas. | Pengguna dapat melihat daftar materi dengan status selesai/belum, kembali ke pilihan sebelumnya, melanjutkan terakhir dibaca, dan memahami ketersediaan mapel/topik tanpa pesan yang menyesatkan. |
| P1-04 | Progres belajar yang bermakna | Progres utama menghitung jawaban tersimpan; belum tampak target belajar, tren penguasaan, atau progres lintas topik yang bisa dipahami. | Halaman progres memperlihatkan materi/kuis yang dikerjakan, nilai dan tanggal, serta perkembangan per topik; definisi metrik dan data kosong dijelaskan. |
| P1-05 | Pengulangan dan reset kuis | Jawaban tersimpan per soal dan tidak tampak alur eksplisit untuk mengulang, memulai percobaan baru, atau menghapus jawaban lama. | Pengguna dapat memulai percobaan baru secara jelas; hasil lama tetap tercatat; kebijakan untuk jawaban/attempt sebelumnya dan tombol reset dikonfirmasi sebelum penyimpanan. |
| P1-06 | Aksesibilitas | Ada label ARIA pada sebagian kontrol dan dukungan reduced motion, tetapi akses keyboard/pembaca layar penuh dan fokus dialog perlu divalidasi. | Audit WCAG 2.2 AA pada alur utama: semua aksi dapat dilakukan dengan keyboard, fokus dialog terkelola/dikembalikan, status jawaban diumumkan, kontras dan zoom memadai, dan tidak bergantung pada warna saja. |
| P1-07 | Keseragaman pesan dan kegagalan API | Beberapa operasi progres di frontend menangkap kegagalan tanpa memberi tahu pengguna; ini dapat membuat progres baca tidak tersimpan tanpa indikasi. | Kegagalan simpan dibedakan dari sukses, ada indikator mencoba ulang atau pesan yang dapat ditindaklanjuti, dan UI tidak mengklaim progres tersimpan ketika server menolak/gagal. |
| P1-08 | Responsif dan kompatibilitas | Desain ponsel ada, tetapi matriks browser/perangkat dan pengujian regresi visual belum tercatat. | Uji alur pada ukuran ponsel/tablet/desktop dan browser yang disepakati; tidak ada kontrol terpotong, navigasi tertutup, atau konten buku tak terbaca. |

## Prioritas P2 — Kesiapan teknis dan operasional

| ID | Pekerjaan | Kekurangan/risiko saat ini | Kriteria selesai |
|---|---|---|---|
| P2-01 | Dokumentasi API | Endpoint didokumentasikan di README, tetapi belum ada spesifikasi OpenAPI yang dapat divalidasi dan dipakai konsumen. | OpenAPI mencakup request/response, kode error, parameter, batasan input, dan contoh; CI memvalidasi spesifikasi terhadap bentuk respons aktual. |
| P2-02 | Upgrade storage ke database | README mencatat PostgreSQL/Prisma sebagai pekerjaan mendatang; file JSON tidak sesuai untuk multi-instance/pertumbuhan data. | Rancang skema, migrasi dan strategi perpindahan data; data lama dapat dimigrasi dengan verifikasi jumlah rekaman dan integritas. |
| P2-03 | Login dan role | Akun siswa/guru/admin belum tersedia. Pelaksanaan bergantung pada keputusan produk dan persetujuan privasi (P0-05). | Implementasi autentikasi aman dan role dengan uji hak akses; dukung reset kredensial dan penutupan akun sesuai kebijakan. |
| P2-04 | Logging dan pemantauan | Endpoint health ada, tetapi belum terlihat metrik, alarm, atau pelacakan kegagalan penyimpanan/API. | Log terstruktur tanpa data siswa sensitif, metrik error/latensi, pemeriksaan kesehatan dependensi, dan prosedur respons insiden tersedia. |
| P2-05 | CI dan quality gates | Tidak ada pipeline pengujian/lint/build yang tercantum. | Pipeline menjalankan validasi konten, tes backend/frontend yang tersedia, pemeriksaan format/lint, dan smoke test sebelum deploy. |
| P2-06 | Pemisahan frontend/backend untuk deploy | Server Node minimal tersedia untuk dijalankan lokal; belum ada prosedur deploy/konfigurasi production yang didokumentasikan. | Konfigurasi environment tervalidasi, HTTPS, CORS berizin minimum, health check, instruksi deploy/rollback, dan konfigurasi rahasia di luar repository. |
| P2-07 | Batasan API dan ketahanan | Input JSON memiliki batas ukuran dan beberapa validasi; belum tercatat batas laju, kebijakan backup, atau pengujian beban. | Tetapkan batas request dan rate limit sesuai risiko, timeout, serta uji beban untuk puncak yang disepakati; error tidak membocorkan rincian internal. |

## Prioritas P3 — Pengembangan pengalaman belajar

| ID | Pekerjaan | Nilai pengembangan | Kriteria selesai |
|---|---|---|---|
| P3-01 | PWA dan penggunaan offline | Belum ada mode offline/PWA. | Pengguna dapat memasang aplikasi; konten yang memang diizinkan dapat dibaca offline; status jawaban lokal dan sinkronisasi ulang memiliki aturan konflik dan indikator yang jelas. |
| P3-02 | Media pembelajaran | Konten saat ini berfokus pada halaman teks/kuis. | Tambahkan gambar/audio/aktivitas interaktif hanya dengan sumber dan lisensi yang tervalidasi, teks alternatif, dan pengalaman yang tetap berfungsi pada koneksi lambat. |
| P3-03 | Diferensiasi latihan | Kuis menggunakan paket 50 soal; belum tampak jalur adaptif. | Rekomendasi latihan didasarkan pada bukti penguasaan yang dijelaskan; guru dapat mengatur cakupan/tingkat kesulitan, dan siswa tetap memahami alasan rekomendasi. |
| P3-04 | Analitik guru/kelas | Tidak tersedia ringkasan kelas atau pemantauan hasil belajar oleh guru. | Guru dapat melihat agregat yang relevan sesuai hak akses, tanpa mengekspos data yang tidak perlu; ekspor dan retensi mengikuti kebijakan privasi. |
| P3-05 | Perluasan muatan lokal dan pilihan sekolah | Muatan lokal/mapel pilihan bergantung pada sekolah dan daerah. | Sekolah dapat memilih/mengonfigurasi konten lokal dengan metadata sumber, reviewer, dan mekanisme publikasi yang sama dengan katalog utama. |

## Urutan pengerjaan yang disarankan

1. **Tetapkan ruang lingkup penggunaan** (demo anonim atau layanan siswa nyata), kebijakan data, dan kriteria kelayakan konten.
2. **Selesaikan P0-01 sampai P0-04** untuk memastikan materi, soal, serta hubungan materi-kuis benar secara pedagogis.
3. **Selesaikan P0-05 sampai P0-08** sebelum menyimpan data siswa nyata atau melakukan peluncuran terbuka.
4. **Bangun skema konten dan workflow review** (P1-01, P1-02), kemudian lengkapi navigasi, progres, pengulangan, dan aksesibilitas (P1-03 sampai P1-08).
5. **Tingkatkan operasi/deploy dan API** sesuai skala penggunaan (P2), lalu tambah PWA dan fitur pembelajaran lanjutan (P3).

## Di luar cakupan / keputusan yang masih diperlukan

- Target pengguna dan model penggunaan: demo pribadi, sekolah, atau publik.
- Apakah akun siswa diperlukan, siapa yang mengelola akun, serta aturan persetujuan orang tua/sekolah.
- Kurikulum, fase/kelas, mapel dan wilayah yang harus diprioritaskan untuk konten tervalidasi.
- Definisi penilaian: latihan formatif atau penilaian resmi, termasuk kebijakan nilai, kesempatan mengulang, dan pembahasan.
- Infrastruktur, target ketersediaan, kapasitas, anggaran, serta pihak yang bertanggung jawab atas konten dan operasi.
