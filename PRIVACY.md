# Kebijakan data demo Cerdas Cermat

Kebijakan ini menjelaskan implementasi prototipe saat ini, bukan pengganti peninjauan hukum atau kebijakan sekolah.

## Identitas dan data

- Login wajib untuk memakai fitur belajar. Akun email/kata sandi menyimpan nama, email, peran, hash kata sandi scrypt, dan salt. Kata sandi asli tidak disimpan.
- Login Google mengirim ID token dari Google Identity Services ke backend untuk verifikasi; backend menyimpan nama, email, dan ID subjek Google untuk menghubungkan login berikutnya. ID token Google tidak disimpan. Email terverifikasi yang cocok dengan konfigurasi `DEVELOPER_EMAIL` memperoleh peran admin. Admin dapat memakai login kata sandi jika `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dikonfigurasi; backend menyimpan hash kata sandi, bukan kata sandi aslinya. Login Google memerlukan konfigurasi Client ID.
- Token sesi aplikasi berada di `localStorage`, berlaku selama 12 jam di proses backend, dan berakhir ketika backend dimulai ulang.
- File JSON dari versi demo sebelumnya dapat tetap memuat progres tamu lama meskipun aplikasi sekarang mewajibkan login; tinjau atau hapus file tersebut sebelum penggunaan baru.
- Jawaban kuis, pilihan jawaban, pembahasan, waktu menjawab, halaman terakhir dibaca, nilai, dan tanggal percobaan dipakai untuk menyimpan progres serta menyajikan ringkasan belajar.
- Log API mencatat ID permintaan, metode, path tanpa query, status, durasi, dan jenis kejadian. Isi request, nama, email, ID siswa, dan token tidak dicatat.

## Tujuan, akses, dan batas penggunaan

Data digunakan untuk menjalankan latihan dan mengembalikan progres kepada pemilik akun. Siswa hanya dapat membaca dan mengubah progres dengan ID akunnya; guru hanya dapat membaca agregat anonim untuk kelas yang ditugaskan; admin mengelola keanggotaan kelas, konten, dan penghapusan progres. Penugasan kelas dibuat admin, dan agregat tidak menyertakan nama atau jawaban siswa. Endpoint belajar menolak permintaan tanpa sesi. Gunakan data fiktif sampai kebijakan sekolah dan deployment ditinjau.

Jangan masukkan data siswa nyata atau data sensitif ke demo ini. Sebelum dipakai sekolah, sekolah perlu menetapkan pemberitahuan, persetujuan yang sesuai, pengendali data, akses staf, penanganan insiden, serta verifikasi kewajiban perlindungan data yang berlaku.

## Retensi dan penghapusan

- Backend membatasi riwayat menjadi 100 percobaan per identitas. Progres aktif dan posisi baca pada penyimpanan JSON tidak kedaluwarsa otomatis.
- Pengguna dapat memilih **Hapus progres saya** untuk menghapus jawaban, posisi baca, dan riwayat kuis di backend serta cache peramban. Penghapusan akun belum tersedia.
- Untuk lingkungan sekolah, retensi yang disarankan adalah 12 bulan setelah aktivitas terakhir, lalu penghapusan atau anonimisasi. Kebijakan demo belum menjalankan penghapusan otomatis; admin harus menghapus progres melalui endpoint atau prosedur operasional.
- File progres dan backup dapat berisi data akun. Simpan dengan akses terbatas, jangan unggah ke repository, dan hapus backup sesuai jadwal retensi yang sama.

## Penyimpanan dan sinkronisasi

Penyimpanan default adalah JSON lokal. PostgreSQL dapat diaktifkan dengan `DATABASE_URL`; progres akun lalu disimpan di tabel state JSONB dengan penggabungan perubahan bersamaan. Konten editor masih memakai file JSON terpisah. Cache offline berada di peramban dan antrean jawaban tidak dihitung sebagai hasil final sebelum backend memeriksanya.
