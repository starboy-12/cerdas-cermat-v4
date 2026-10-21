# Flowchart Cerdas Cermat

Dokumen ini menggambarkan alur yang tersedia pada prototipe saat ini, bukan rancangan fitur masa depan. Diagram menggunakan Mermaid dan dapat dilihat di editor Markdown yang mendukung Mermaid.

## 1. Alur belajar pengguna

```mermaid
flowchart TD
    A([Mulai]) --> B[Frontend memuat katalog dari GET /api/catalog]
    B --> C{API tersedia?}
    C -- Tidak --> C1[Tampilkan pesan; minta backend dan frontend dijalankan]
    C -- Ya --> D[Tampilkan rak jenjang TK, SD, SMP, SMA]
    D --> E[Pilih buku / jenjang]
    E --> F[Pilih kurikulum]
    F --> G[Pilih fase atau kelompok kelas]
    G --> H[Frontend meminta mata pelajaran dan materi]
    H --> I{Katalog valid dan tersedia?}
    I -- Tidak --> I1[Tampilkan pesan; kosongkan pilihan materi]
    I -- Ya --> J[Pilih mata pelajaran dan materi]
    J --> K{Materi terhubung ke kuis?}
    K -- Ya --> N[Buka mode kuis]
    K -- Tidak --> L[Buka mode membaca materi]
    L --> M[Baca sampai halaman terakhir; progres baca disimpan per halaman]
    M --> M1{Ada materi kuis untuk mata pelajaran ini?}
    M1 -- Tidak --> M2[Tutup pembaca; sarankan memilih materi lain]
    M1 -- Ya --> N1[Mulai kuis pertama yang tersedia untuk mata pelajaran]
    N1 --> N
    N --> O[Muat halaman kuis; 3 soal per halaman]
    O --> P[Pilih jawaban]
    P --> Q[POST /api/answer: backend memeriksa, menyimpan jawaban, dan mengirim pembahasan]
    Q --> R{Permintaan berhasil?}
    R -- Tidak --> R1[Aktifkan kembali pilihan jawaban; tampilkan pesan]
    R1 --> P
    R -- Ya --> S[Tampilkan benar/salah dan pembahasan]
    S --> T{Masih ada halaman?}
    T -- Ya --> O
    T -- Tidak --> U{Semua 50 soal sudah dijawab?}
    U -- Tidak --> U1[Backend menolak penyelesaian dengan HTTP 409]
    U1 --> O
    U -- Ya --> V[POST /api/results]
    V --> W[Simpan percobaan dan hitung nilai]
    W --> X[Tampilkan nilai, jumlah benar, dan rekomendasi]
    X --> Y([Tinjau jawaban atau tutup pembaca])
```

### Catatan perilaku saat ini

- Materi dan kuis diambil dari API; frontend statis berjalan terpisah dari backend.
- Katalog memuat TK, SD, SMP, dan SMA serta opsi Kurikulum Merdeka, K13, dan Darurat/arsip. Ketersediaan nyata bergantung pada isi katalog.
- Topik yang tersedia sebagai kuis dibuka langsung ke kuis. Topik tanpa kuis membuka empat halaman ringkasan materi.
- Ketika pembacaan materi selesai, sistem mencari kuis pertama yang tersedia untuk mata pelajaran tersebut. Keterkaitan spesifik antara topik yang dibaca dan topik kuis belum terlihat dijamin di alur ini; perlu ditetapkan dan diuji sebelum konten diperluas.
- Kuis terdiri dari 50 soal, tiga soal per halaman. Backend memeriksa jawaban satu per satu dan baru membuat hasil setelah semua soal dijawab.
- Hasil kuis disimpan sebagai percobaan; daftar riwayat dibatasi hingga 100 percobaan per identitas.
- Identitas belajar dibuat di peramban dan progres lokal menggunakan `localStorage`; tidak ada login atau sinkronisasi antarperangkat.
- Materi ringkas dan bank soal ditandai sebagai draf yang perlu ditelaah guru. Jangan gunakan sebagai penilaian resmi sebelum validasi.

## 1A. Alur buku cerita terpisah

```mermaid
flowchart LR
    A[Rak utama] --> B[Buku Kisah Kecil Nusantara]
    B --> C[Pilih jenjang TK, SD, SMP, atau SMA]
    C --> D[Backend memuat enam bab bergambar]
    D --> E[Pilih tema: sejarah, budi pekerti, sejarah Islam, kisah para nabi, A–Z, atau hewan]
    E --> F[Buka halaman kisah]
    F --> G[Balik halaman satu per satu; simpan progres per bab]
    G --> H[Baca pembelajaran dan pertanyaan refleksi]
    H --> I{Bab lain?}
    I -- Ya --> E
    I -- Tidak --> J[Kembali ke rak]
```

Buku cerita adalah pilihan terpisah dari buku kuis jenjang. Bab sejarah Islam dan kisah para nabi memiliki beberapa halaman adegan serta halaman makna yang disesuaikan dengan jenjang; tiap halaman menggunakan ilustrasi lokal dan rujukan ayat atau hadis. Ilustrasi kisah nabi memakai simbol dan latar tanpa menggambarkan sosok nabi. Bab agama umum tetap inklusif; penelaahan guru tetap disarankan.

## 2. Alur penyimpanan dan layanan

```mermaid
flowchart LR
    subgraph Browser["Peramban / Frontend"]
        UI[UI perpustakaan dan pembaca]
        ID[ID tamu dari localStorage]
        LP[Cache progres kuis di localStorage]
        UI --> ID
        UI --> LP
    end

    subgraph API["Backend REST API"]
        CAT[GET /api/catalog dan /api/catalog/:level/subjects]
        CONTENT[GET /api/materials/... atau /api/quizzes/...]
        STORY[GET /api/storybook/:level dan /pages/:number]
        ANSWER[POST /api/answer]
        PROGRESS[GET/PUT /api/progress dan /api/reading-progress]
        RESULT[POST /api/results]
        HEALTH[GET /api/health]
    end

    subgraph Store["Penyimpanan prototipe"]
        DATA[Data katalog, materi, soal, dan cerita dalam berkas JavaScript]
        JSON[progress.json: progres, progres baca, percobaan]
    end

    UI -->|Baca katalog dan konten| CAT
    UI -->|Baca materi atau halaman kuis| CONTENT
    UI -->|Pilih jenjang dan baca halaman cerita| STORY
    UI -->|Kirim identitas, paket, soal, pilihan| ANSWER
    ANSWER -->|Cari kunci jawaban; simpan jawaban| JSON
    ANSWER -->|Hasil benar/salah dan pembahasan| UI
    UI -->|Ambil atau simpan progres| PROGRESS
    PROGRESS --> JSON
    UI -->|Minta nilai setelah semua soal dijawab| RESULT
    RESULT -->|Simpan percobaan| JSON
    CAT --> DATA
    CONTENT --> DATA
    STORY --> DATA
    UI -.->|Fallback cache progres kuis bila API gagal| LP
    HEALTH -->|Status layanan| API
```

## 3. Permukaan API yang terkait alur

| Kebutuhan | Endpoint |
|---|---|
| Memuat jenjang dan daftar kurikulum | `GET /api/catalog` |
| Memuat mapel dan topik untuk konteks belajar | `GET /api/catalog/:level/subjects?curriculum=...&phase=...` |
| Memuat satu halaman materi | `GET /api/materials/:level/:subject/:topic/pages/:number` |
| Memuat satu halaman kuis | `GET /api/quizzes/:level/:subject/pages/:number` |
| Memuat katalog buku cerita per jenjang | `GET /api/storybook/:level` |
| Memuat satu halaman cerita | `GET /api/storybook/:level/pages/:number` |
| Memeriksa dan menyimpan jawaban | `POST /api/answer` |
| Memuat/menyimpan progres kuis | `GET /api/progress/:studentId`, `PUT /api/progress` |
| Memuat/menyimpan progres membaca | `GET /api/reading-progress/:studentId`, `PUT /api/reading-progress` |
| Menyimpan hasil setelah kuis lengkap | `POST /api/results` |
| Memeriksa kesehatan backend | `GET /api/health` |

Endpoint kompatibilitas `GET /api/books/:id/pages/:number` masih tersedia untuk paket Matematika.
