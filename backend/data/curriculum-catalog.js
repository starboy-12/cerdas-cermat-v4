const CURRICULUM_NOTES = {
  merdeka: 'Peta materi awal berdasarkan fase dan Capaian Pembelajaran. Muatan lokal dan mata pelajaran pilihan mengikuti ketersediaan sekolah. Setiap mapel memiliki kuis latihan 50 soal yang masih berupa draf dan perlu ditelaah guru.',
  k13: 'Peta materi awal Kurikulum 2013. Guru perlu mengaitkan topik dengan Kompetensi Dasar dan kelas yang digunakan sekolah. Setiap mapel memiliki kuis latihan 50 soal yang masih berupa draf dan perlu ditelaah guru.',
  darurat: 'Katalog arsip pembelajaran esensial yang mengacu pada penyederhanaan K13; bukan kurikulum nasional aktif yang berdiri sendiri. Setiap mapel memiliki kuis latihan 50 soal yang masih berupa draf dan perlu ditelaah guru.',
  kbk: 'Katalog arsip ringkas yang mengacu pada pendekatan Kurikulum Berbasis Kompetensi 2004. Pengelompokan kelas dan mata pelajaran adalah peta awal, bukan salinan dokumen resmi; sekolah dan jenjang dapat berbeda. Materi serta kuis perlu ditelaah guru.',
  ktsp: 'Katalog arsip ringkas Kurikulum Tingkat Satuan Pendidikan 2006. Pengelompokan kelas dan mata pelajaran adalah peta awal, bukan salinan dokumen resmi; KTSP memberi ruang pengembangan kurikulum pada satuan pendidikan. Materi serta kuis perlu ditelaah guru.',
};

const SUBJECTS = {
  agama: { name: 'Pendidikan Agama dan Budi Pekerti', family: 'values', topics: ['Mengenal keyakinan dan rasa syukur', 'Doa dan kebiasaan ibadah', 'Jujur dan bertanggung jawab', 'Menghormati sesama', 'Merawat diri dan lingkungan'] },
  jati: { name: 'Jati Diri', family: 'foundation', topics: ['Mengenal diri dan keluarga', 'Mengenali dan mengelola emosi', 'Berteman dan bekerja sama', 'Mandiri dan menjaga diri', 'Bergerak dengan aman'] },
  literasi: { name: 'Dasar-dasar Literasi, Matematika, Sains, Teknologi, Rekayasa, dan Seni', family: 'foundation', topics: ['Menyimak dan menyampaikan gagasan', 'Kepekaan bilangan dan pola', 'Mengamati sebab dan akibat', 'Menggunakan teknologi dengan aman', 'Mencoba dan mengapresiasi karya seni'] },
  moral: { name: 'Nilai Agama dan Budi Pekerti', family: 'values', topics: ['Mengenal kebiasaan ibadah', 'Bersikap jujur dan penyayang', 'Menghargai perbedaan', 'Menjaga kebersihan dan kesehatan'] },
  motorik: { name: 'Fisik-Motorik', family: 'movement', topics: ['Gerak tubuh dan keseimbangan', 'Koordinasi tangan dan mata', 'Kebiasaan hidup bersih', 'Bermain dengan aman'] },
  kognitif: { name: 'Kognitif', family: 'science', topics: ['Mengelompokkan benda', 'Mengenali pola', 'Memecahkan masalah sederhana', 'Mencoba dan mengamati perubahan'] },
  bahasa: { name: 'Bahasa', family: 'language', topics: ['Menyimak cerita', 'Menceritakan pengalaman', 'Mengenal bunyi dan simbol', 'Membuat coretan bermakna'] },
  sosial: { name: 'Sosial-Emosional', family: 'values', topics: ['Mengenali perasaan', 'Menunggu giliran', 'Bekerja sama saat bermain', 'Mengikuti kesepakatan'] },
  seni: { name: 'Seni dan Budaya', family: 'arts', topics: ['Garis, bentuk, dan warna', 'Irama dan bunyi sekitar', 'Gerak dan ekspresi', 'Membuat karya dari bahan aman'] },
  pancasila: { name: 'Pendidikan Pancasila', family: 'civic', topics: ['Pancasila dalam kehidupan sehari-hari', 'Aturan dan tanggung jawab', 'Hak dan kewajiban', 'Keberagaman dan persatuan', 'Musyawarah dan gotong royong'] },
  pkn: { name: 'Pendidikan Pancasila dan Kewarganegaraan (PPKn)', family: 'civic', topics: ['Nilai Pancasila dan perilaku warga', 'Aturan, hak, dan kewajiban', 'Keberagaman Indonesia', 'Musyawarah dan persatuan'] },
  indonesia: { name: 'Bahasa Indonesia', family: 'language', topics: ['Menyimak dan memahami informasi', 'Membaca teks dan menemukan gagasan', 'Berbicara dan berdiskusi', 'Menulis teks sesuai tujuan', 'Sastra dan tanggapan terhadap bacaan'] },
  matematika: { name: 'Matematika', family: 'math', topics: ['Bilangan dan operasi hitung', 'Pecahan, desimal, dan persen', 'Pola, relasi, dan aljabar', 'Pengukuran dan geometri', 'Data dan peluang'] },
  english: { name: 'Bahasa Inggris', family: 'language', topics: ['Ungkapan sehari-hari', 'Kosakata dan pelafalan', 'Membaca teks sederhana', 'Menulis dan menyampaikan pesan'] },
  pjok: { name: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', family: 'movement', topics: ['Gerak dasar dan permainan', 'Kebugaran dan latihan aman', 'Kesehatan diri dan kebersihan', 'Gizi, istirahat, dan keselamatan'] },
  sbdb: { name: 'Seni Budaya dan Prakarya', family: 'arts', topics: ['Mengamati karya dan budaya', 'Unsur rupa dan komposisi', 'Musik, irama, dan ekspresi', 'Karya kreatif dari bahan sekitar'] },
  ipas: { name: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', family: 'science', topics: ['Makhluk hidup dan lingkungannya', 'Tubuh, kesehatan, dan kebutuhan hidup', 'Benda, energi, dan perubahan', 'Lingkungan, peta, dan kehidupan masyarakat', 'Sejarah dan kegiatan ekonomi sekitar'] },
  ipa: { name: 'Ilmu Pengetahuan Alam (IPA)', family: 'science', topics: ['Pengukuran dan penyelidikan ilmiah', 'Zat dan perubahannya', 'Gaya, gerak, dan energi', 'Struktur dan fungsi makhluk hidup', 'Bumi, antariksa, dan lingkungan'] },
  ips: { name: 'Ilmu Pengetahuan Sosial (IPS)', family: 'society', topics: ['Interaksi sosial dan lembaga', 'Ruang, peta, dan lingkungan', 'Kebutuhan, kegiatan, dan pelaku ekonomi', 'Perubahan sosial dan sejarah Indonesia', 'Keragaman dan hubungan antardaerah'] },
  informatika: { name: 'Informatika', family: 'digital', topics: ['Berpikir komputasional', 'Data dan representasi informasi', 'Algoritma dan pemrograman dasar', 'Sistem komputer dan jaringan', 'Keamanan, etika, dan dampak digital'] },
  prakarya: { name: 'Prakarya dan Kewirausahaan', family: 'creative', topics: ['Merancang produk sederhana', 'Bahan, alat, dan keselamatan kerja', 'Proses produksi dan mutu', 'Menghitung biaya dan mengenalkan produk'] },
  mulok: { name: 'Muatan Lokal (disesuaikan daerah)', family: 'society', topics: ['Bahasa dan ungkapan daerah', 'Sejarah dan budaya setempat', 'Lingkungan dan potensi daerah', 'Karya atau praktik lokal'] },
  coding: { name: 'Koding dan Kecerdasan Artifisial (pilihan)', family: 'digital', topics: ['Menyusun langkah dan algoritma', 'Pola, percabangan, dan pengulangan', 'Membuat solusi dengan blok atau kode', 'Data dan cara kerja kecerdasan artifisial', 'Etika dan tanggung jawab menggunakan AI'] },
  history: { name: 'Sejarah', family: 'society', topics: ['Cara kerja sejarah dan sumber', 'Kehidupan masa lalu di Indonesia', 'Perubahan dan kesinambungan', 'Pergerakan nasional dan kemerdekaan', 'Sejarah lokal dan dunia'] },
  ipaTerpadu: { name: 'Ilmu Pengetahuan Alam (terpadu)', family: 'science', topics: ['Metode ilmiah dan pengukuran', 'Keanekaragaman dan sistem kehidupan', 'Materi dan perubahan kimia', 'Gerak, energi, dan gejala alam', 'Bumi, lingkungan, dan perubahan iklim'] },
  ipsTerpadu: { name: 'Ilmu Pengetahuan Sosial (terpadu)', family: 'society', topics: ['Manusia, ruang, dan lingkungan', 'Peristiwa dan perubahan sejarah', 'Interaksi sosial dan kebudayaan', 'Kebutuhan, pasar, dan ekonomi', 'Tantangan masyarakat Indonesia'] },
  biologi: { name: 'Biologi', family: 'science', topics: ['Keanekaragaman dan klasifikasi', 'Sel dan organisasi kehidupan', 'Ekosistem dan perubahan lingkungan', 'Genetika dan pewarisan sifat', 'Evolusi dan bioteknologi'] },
  kimia: { name: 'Kimia', family: 'science', topics: ['Struktur atom dan tabel periodik', 'Ikatan dan bentuk molekul', 'Stoikiometri dan reaksi kimia', 'Larutan, asam-basa, dan kesetimbangan', 'Kimia dalam kehidupan dan lingkungan'] },
  fisika: { name: 'Fisika', family: 'science', topics: ['Pengukuran dan vektor', 'Gerak dan hukum Newton', 'Energi, momentum, dan fluida', 'Gelombang, bunyi, dan cahaya', 'Listrik, magnet, dan fisika modern'] },
  mathLanjut: { name: 'Matematika Tingkat Lanjut', family: 'math', topics: ['Fungsi dan komposisi', 'Trigonometri', 'Matriks dan vektor', 'Kalkulus dasar', 'Peluang dan distribusi'] },
  sociology: { name: 'Sosiologi', family: 'society', topics: ['Individu dan kelompok sosial', 'Nilai, norma, dan sosialisasi', 'Lembaga dan struktur sosial', 'Konflik dan integrasi', 'Penelitian sosial sederhana'] },
  economics: { name: 'Ekonomi', family: 'society', topics: ['Kelangkaan dan pilihan', 'Permintaan, penawaran, dan pasar', 'Uang, bank, dan kebijakan', 'Pendapatan nasional dan pertumbuhan', 'Akuntansi dan perencanaan keuangan'] },
  geography: { name: 'Geografi', family: 'society', topics: ['Konsep ruang dan peta', 'Dinamika litosfer dan atmosfer', 'Kependudukan dan persebaran', 'Interaksi desa-kota dan wilayah', 'Mitigasi bencana dan lingkungan'] },
  anthropology: { name: 'Antropologi', family: 'society', topics: ['Budaya dan identitas', 'Keberagaman dan kearifan lokal', 'Relasi sosial dan perubahan budaya', 'Bahasa, simbol, dan praktik budaya'] },
  indonesiaLanjut: { name: 'Bahasa Indonesia Tingkat Lanjut', family: 'language', topics: ['Membaca kritis teks kompleks', 'Kajian sastra dan interpretasi', 'Menulis argumentasi dan karya', 'Presentasi dan diskusi akademik'] },
  englishLanjut: { name: 'Bahasa Inggris Tingkat Lanjut', family: 'language', topics: ['Membaca teks autentik', 'Menulis argumentasi', 'Menyampaikan gagasan lisan', 'Mengevaluasi informasi dan sudut pandang'] },
  foreignLanguage: { name: 'Bahasa Asing (pilihan sekolah)', family: 'language', topics: ['Salam dan perkenalan', 'Kosakata dan pola kalimat', 'Memahami teks sederhana', 'Percakapan dan budaya penutur'] },
  bahasaKorea: { name: 'Bahasa Korea (pilihan)', family: 'language', topics: ['Salam dan perkenalan', 'Hangul dan kosakata dasar', 'Percakapan sederhana', 'Membaca dan menulis kalimat'] },
  bahasaMandarin: { name: 'Bahasa Mandarin (pilihan)', family: 'language', topics: ['Salam dan perkenalan', 'Pinyin dan kosakata dasar', 'Ungkapan sederhana', 'Membaca karakter dasar'] },
  bahasaJepang: { name: 'Bahasa Jepang (pilihan)', family: 'language', topics: ['Salam dan perkenalan', 'Hiragana dan kosakata dasar', 'Percakapan sederhana', 'Membaca kalimat dasar'] },
  bahasaJerman: { name: 'Bahasa Jerman (pilihan)', family: 'language', topics: ['Salam dan perkenalan', 'Kosakata dan artikel dasar', 'Ungkapan sehari-hari', 'Membaca teks sederhana'] },
  bahasaPrancis: { name: 'Bahasa Prancis (pilihan)', family: 'language', topics: ['Salam dan perkenalan', 'Bunyi dan kosakata dasar', 'Ungkapan sehari-hari', 'Membaca teks sederhana'] },
  mapelSekolah: { name: 'Mata Pelajaran Pilihan Sekolah', family: 'creative', topics: ['Tujuan belajar pilihan', 'Konsep dan keterampilan utama', 'Praktik sesuai konteks sekolah', 'Refleksi dan hasil karya'] },
  k13Science: { name: 'IPA', family: 'science', topics: ['Makhluk hidup dan lingkungannya', 'Materi dan perubahannya', 'Energi, gaya, dan gerak', 'Bumi dan antariksa'] },
  k13Social: { name: 'IPS', family: 'society', topics: ['Peta dan kondisi lingkungan', 'Interaksi sosial dan budaya', 'Kegiatan ekonomi', 'Sejarah Indonesia'] },
  k13Arts: { name: 'Seni Budaya', family: 'arts', topics: ['Menggambar dan berkarya', 'Musik dan irama', 'Tari dan ekspresi', 'Apresiasi budaya setempat'] },
  bahasaArab: { name: 'Bahasa Arab (pilihan)', family: 'language', topics: ['Mufradat sehari-hari', 'Ungkapan dan percakapan', 'Membaca teks sederhana', 'Menulis kalimat dasar'] },
  pkWU: { name: 'Prakarya dan Kewirausahaan', family: 'creative', topics: ['Peluang usaha sederhana', 'Rencana produk dan biaya', 'Proses produksi', 'Pemasaran dan evaluasi'] },
};

const PHASES = {
  tk: [{ id: 'fondasi', label: 'Fase Fondasi · PAUD/TK' }],
  sd: [{ id: 'a', label: 'Fase A · Kelas 1–2' }, { id: 'b', label: 'Fase B · Kelas 3–4' }, { id: 'c', label: 'Fase C · Kelas 5–6' }],
  smp: [{ id: 'd', label: 'Fase D · Kelas 7–9' }],
  sma: [{ id: 'e', label: 'Fase E · Kelas 10' }, { id: 'f', label: 'Fase F · Kelas 11–12' }],
};

function legacyPhasesFor(levelId) {
  if (levelId === 'tk') return [
    { id: 'kelompok-a', label: 'Kelompok A · usia 4–5 tahun', templatePhaseId: 'fondasi' },
    { id: 'kelompok-b', label: 'Kelompok B · usia 5–6 tahun', templatePhaseId: 'fondasi' },
  ];
  const grades = levelId === 'sd' ? [1, 2, 3, 4, 5, 6]
    : levelId === 'smp' ? [7, 8, 9]
      : levelId === 'sma' ? [10, 11, 12] : [];
  return grades.map((grade) => {
    const templatePhaseId = levelId === 'sd' ? (grade <= 2 ? 'a' : grade <= 4 ? 'b' : 'c')
      : levelId === 'smp' ? 'd' : grade === 10 ? 'e' : 'f';
    return {
      id: `kelas-${grade}`,
      label: `Kelas ${grade}`,
      templatePhaseId,
    };
  });
}

function phasesFor(levelId, curriculum) {
  if (!CURRICULUM_DEFINITIONS[curriculum]) return [];
  return curriculum === 'merdeka'
    ? (PHASES[levelId] || [])
    : legacyPhasesFor(levelId);
}

function phaseDefinitionId(levelId, curriculum, phaseId) {
  const phase = phasesFor(levelId, curriculum).find((item) => item.id === phaseId);
  return phase?.templatePhaseId || (curriculum === 'merdeka' ? phaseId : null);
}

const MERDEKA = {
  'tk.fondasi': [['agama'], ['jati'], ['literasi']],
  'sd.a': [['agama'], ['pancasila'], ['indonesia'], ['matematika'], ['pjok'], ['seni'], ['english', 'optional'], ['mulok', 'local']],
  'sd.b': [['agama'], ['pancasila'], ['indonesia'], ['matematika'], ['ipas'], ['pjok'], ['seni'], ['english', 'optional'], ['mulok', 'local']],
  'sd.c': [['agama'], ['pancasila'], ['indonesia'], ['matematika'], ['ipas'], ['pjok'], ['seni'], ['english', 'optional'], ['coding', 'optional'], ['mulok', 'local']],
  'smp.d': [['agama'], ['pancasila'], ['indonesia'], ['matematika'], ['english'], ['ipa'], ['ips'], ['pjok'], ['seni'], ['informatika'], ['prakarya'], ['coding', 'optional'], ['mulok', 'local']],
  'sma.e': [['agama'], ['pancasila'], ['indonesia'], ['matematika'], ['english'], ['pjok'], ['history'], ['seni'], ['ipaTerpadu', 'school'], ['ipsTerpadu', 'school'], ['informatika', 'school'], ['coding', 'optional'], ['mulok', 'local']],
  'sma.f': [['agama'], ['pancasila'], ['indonesia'], ['matematika'], ['english'], ['pjok'], ['history'], ['seni'], ['biologi', 'optional'], ['kimia', 'optional'], ['fisika', 'optional'], ['informatika', 'optional'], ['mathLanjut', 'optional'], ['sociology', 'optional'], ['economics', 'optional'], ['geography', 'optional'], ['anthropology', 'optional'], ['indonesiaLanjut', 'optional'], ['englishLanjut', 'optional'], ['foreignLanguage', 'optional'], ['bahasaArab', 'optional'], ['bahasaKorea', 'optional'], ['bahasaMandarin', 'optional'], ['bahasaJepang', 'optional'], ['bahasaJerman', 'optional'], ['bahasaPrancis', 'optional'], ['pkWU', 'optional'], ['mapelSekolah', 'optional'], ['coding', 'optional'], ['mulok', 'local']],
};

const K13 = {
  'tk.fondasi': [['moral'], ['motorik'], ['kognitif'], ['bahasa'], ['sosial'], ['seni']],
  'sd.a': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science', 'integrated'], ['k13Social', 'integrated'], ['k13Arts'], ['pjok'], ['mulok', 'local']],
  'sd.b': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science'], ['k13Social'], ['k13Arts'], ['pjok'], ['english', 'school'], ['mulok', 'local']],
  'sd.c': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science'], ['k13Social'], ['k13Arts'], ['pjok'], ['english', 'school'], ['mulok', 'local']],
  'smp.d': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['k13Science'], ['k13Social'], ['pjok'], ['k13Arts'], ['prakarya'], ['mulok', 'local']],
  'sma.e': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['pjok'], ['history'], ['k13Science', 'optional'], ['k13Social', 'optional'], ['k13Arts'], ['informatika', 'school'], ['mulok', 'local']],
  'sma.f': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['pjok'], ['history'], ['k13Arts'], ['biologi', 'optional'], ['kimia', 'optional'], ['fisika', 'optional'], ['mathLanjut', 'optional'], ['geography', 'optional'], ['economics', 'optional'], ['sociology', 'optional'], ['indonesiaLanjut', 'optional'], ['englishLanjut', 'optional'], ['foreignLanguage', 'optional'], ['bahasaArab', 'optional'], ['bahasaKorea', 'optional'], ['bahasaMandarin', 'optional'], ['bahasaJepang', 'optional'], ['bahasaJerman', 'optional'], ['bahasaPrancis', 'optional'], ['pkWU', 'optional'], ['mulok', 'local']],
};

const DARURAT = {
  'tk.fondasi': [['moral'], ['motorik'], ['kognitif'], ['bahasa'], ['sosial'], ['seni']],
  'sd.a': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science', 'integrated'], ['k13Social', 'integrated'], ['k13Arts'], ['pjok'], ['mulok', 'local']],
  'sd.b': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science'], ['k13Social'], ['k13Arts'], ['pjok'], ['mulok', 'local']],
  'sd.c': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science'], ['k13Social'], ['k13Arts'], ['pjok'], ['mulok', 'local']],
  'smp.d': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['k13Science'], ['k13Social'], ['pjok'], ['k13Arts'], ['prakarya'], ['mulok', 'local']],
  'sma.e': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['pjok'], ['history'], ['k13Science', 'optional'], ['k13Social', 'optional'], ['k13Arts'], ['mulok', 'local']],
  'sma.f': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['pjok'], ['history'], ['k13Science', 'optional'], ['k13Social', 'optional'], ['k13Arts'], ['biologi', 'optional'], ['fisika', 'optional'], ['kimia', 'optional'], ['geography', 'optional'], ['economics', 'optional'], ['sociology', 'optional'], ['mulok', 'local']],
};

const KBK = {
  'tk.fondasi': [['moral'], ['motorik'], ['kognitif'], ['bahasa'], ['sosial'], ['seni']],
  'sd.a': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science', 'integrated'], ['k13Social', 'integrated'], ['k13Arts'], ['pjok'], ['mulok', 'local']],
  'sd.b': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science'], ['k13Social'], ['k13Arts'], ['pjok'], ['mulok', 'local']],
  'sd.c': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science'], ['k13Social'], ['k13Arts'], ['pjok'], ['mulok', 'local']],
  'smp.d': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['k13Science'], ['k13Social'], ['pjok'], ['k13Arts'], ['prakarya'], ['mulok', 'local']],
  'sma.e': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['pjok'], ['history'], ['k13Science', 'optional'], ['k13Social', 'optional'], ['k13Arts'], ['mulok', 'local']],
  'sma.f': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['pjok'], ['history'], ['k13Arts'], ['biologi', 'optional'], ['kimia', 'optional'], ['fisika', 'optional'], ['geography', 'optional'], ['economics', 'optional'], ['sociology', 'optional'], ['mulok', 'local']],
};

const KTSP = {
  'tk.fondasi': [['moral'], ['motorik'], ['kognitif'], ['bahasa'], ['sosial'], ['seni']],
  'sd.a': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science', 'integrated'], ['k13Social', 'integrated'], ['k13Arts'], ['pjok'], ['mulok', 'local']],
  'sd.b': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science'], ['k13Social'], ['k13Arts'], ['pjok'], ['english', 'school'], ['mulok', 'local']],
  'sd.c': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['k13Science'], ['k13Social'], ['k13Arts'], ['pjok'], ['english', 'school'], ['mulok', 'local']],
  'smp.d': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['k13Science'], ['k13Social'], ['pjok'], ['k13Arts'], ['prakarya'], ['mulok', 'local']],
  'sma.e': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['pjok'], ['history'], ['k13Science', 'optional'], ['k13Social', 'optional'], ['k13Arts'], ['mulok', 'local']],
  'sma.f': [['agama'], ['pkn'], ['indonesia'], ['matematika'], ['english'], ['pjok'], ['history'], ['k13Arts'], ['biologi', 'optional'], ['kimia', 'optional'], ['fisika', 'optional'], ['geography', 'optional'], ['economics', 'optional'], ['sociology', 'optional'], ['mulok', 'local']],
};

const CURRICULA = [
  { id: 'merdeka', name: 'Kurikulum Merdeka', status: 'Berlaku' },
  { id: 'k13', name: 'Kurikulum 2013', status: 'Berlaku' },
  { id: 'darurat', name: 'Kurikulum Darurat (arsip)', status: 'Arsip' },
  { id: 'kbk', name: 'Kurikulum 2004 (KBK)', status: 'Arsip' },
  { id: 'ktsp', name: 'Kurikulum 2006 (KTSP)', status: 'Arsip' },
];

const CURRICULUM_DEFINITIONS = { merdeka: MERDEKA, k13: K13, darurat: DARURAT, kbk: KBK, ktsp: KTSP };

function phaseLabel(levelId, phaseId, curriculum = 'merdeka') {
  return phasesFor(levelId, curriculum).find((item) => item.id === phaseId)?.label || '';
}

const PHASE_TOPICS = {
  'sd.a:matematika': ['Bilangan sampai 20', 'Penjumlahan dan pengurangan sederhana', 'Mengenal pola berulang', 'Bentuk dan posisi benda', 'Membandingkan panjang dan waktu'],
  'sd.b:matematika': ['Bilangan cacah dan nilai tempat', 'Perkalian dan pembagian', 'Pecahan sederhana', 'Pengukuran panjang dan luas', 'Bangun datar dan penyajian data'],
  'sd.c:matematika': ['Operasi hitung bilangan', 'Pecahan, desimal, dan persen', 'Perbandingan dan skala', 'Bangun ruang dan volume', 'Data, diagram, dan peluang sederhana'],
  'smp.d:matematika': ['Bilangan dan perbandingan', 'Aljabar dan persamaan linear', 'Relasi, fungsi, dan pola', 'Geometri dan pengukuran', 'Statistika dan peluang'],
  'sma.e:matematika': ['Bilangan berpangkat dan bentuk akar', 'Persamaan dan fungsi', 'Barisan dan pola bilangan', 'Trigonometri dasar', 'Statistika dan peluang'],
  'sma.f:matematika': ['Fungsi dan pemodelan', 'Trigonometri dan geometri', 'Matriks dan vektor dasar', 'Statistika dan analisis data', 'Peluang dan pemecahan masalah'],
  'sd.a:english': ['Salam dan memperkenalkan diri', 'Benda dan orang di sekitar', 'Instruksi sederhana', 'Warna, angka, dan bentuk'],
  'sd.b:english': ['Kegiatan sehari-hari', 'Keluarga dan lingkungan', 'Deskripsi sederhana', 'Membaca petunjuk singkat'],
  'sd.c:english': ['Rutinitas dan pengalaman', 'Mendeskripsikan tempat dan orang', 'Memahami teks informasi', 'Menulis pesan sederhana'],
  'smp.d:english': ['Descriptive and recount texts', 'Instructions and announcements', 'Narrative and report texts', 'Opinions and everyday communication'],
  'sma.e:english': ['Descriptive and recount texts', 'Narrative and exposition', 'Expressing ideas and opinions', 'Writing for a clear purpose'],
  'sma.f:english': ['Reading and evaluating authentic texts', 'Argumentative writing', 'Discussion and presentation', 'Language for academic contexts'],
};

const LEGACY_MATH_TOPICS = {
  'sd.kelas-1': ['Bilangan sampai 20', 'Penjumlahan dan pengurangan sampai 20', 'Pola dan bentuk sederhana', 'Panjang dan waktu sehari-hari', 'Mengelompokkan dan membandingkan benda'],
  'sd.kelas-2': ['Bilangan sampai 100', 'Penjumlahan dan pengurangan', 'Perkalian sebagai kelompok sama banyak', 'Pengukuran panjang dan waktu', 'Membaca tabel sederhana'],
  'sd.kelas-3': ['Bilangan sampai 1.000', 'Perkalian dan pembagian dasar', 'Pecahan sederhana', 'Panjang, berat, dan waktu', 'Bangun datar dan data'],
  'sd.kelas-4': ['Operasi bilangan cacah', 'Faktor, kelipatan, dan pecahan', 'Pengukuran dan satuan', 'Keliling dan luas bangun datar', 'Tabel dan diagram'],
  'sd.kelas-5': ['Operasi bilangan besar', 'Pecahan dan desimal', 'Perbandingan dan skala', 'Luas dan volume', 'Penyajian dan pembacaan data'],
  'sd.kelas-6': ['Operasi pecahan dan desimal', 'Persen dan perbandingan', 'Kecepatan dan debit sederhana', 'Luas dan volume bangun ruang', 'Statistika dan peluang sederhana'],
  'smp.kelas-7': ['Bilangan bulat dan pecahan', 'Perbandingan dan aritmetika sosial', 'Bentuk aljabar dan persamaan sederhana', 'Garis, sudut, dan bangun datar', 'Data dan penyajian statistik'],
  'smp.kelas-8': ['Pola bilangan dan relasi', 'Persamaan garis lurus', 'Sistem persamaan linear', 'Teorema Pythagoras dan bangun ruang', 'Peluang dan statistika'],
  'smp.kelas-9': ['Pangkat, akar, dan bentuk baku', 'Persamaan dan fungsi kuadrat', 'Kesebangunan dan bangun ruang', 'Transformasi geometri', 'Peluang dan statistika'],
  'sma.kelas-10': ['Persamaan dan pertidaksamaan', 'Fungsi dan grafik', 'Eksponen dan logaritma', 'Trigonometri dasar', 'Statistika dan peluang'],
  'sma.kelas-11': ['Komposisi dan invers fungsi', 'Trigonometri dan barisan', 'Matriks dan vektor', 'Limit dan turunan dasar', 'Peluang dan distribusi'],
  'sma.kelas-12': ['Fungsi dan pemodelan', 'Turunan dan penerapannya', 'Integral dasar', 'Program linear dan matriks', 'Statistika dan peluang'],
};

function gradeForPhase(levelId, phaseId, curriculum) {
  if (curriculum !== 'merdeka') {
    const match = phaseId.match(/^kelas-(\d+)$/);
    if (match) return Number(match[1]);
    if (phaseId === 'kelompok-b') return 6;
    return 5;
  }
  if (levelId === 'sd') return ({ a: 2, b: 4, c: 6 })[phaseId] || 0;
  if (levelId === 'smp') return 8;
  if (levelId === 'sma') return phaseId === 'e' ? 10 : 12;
  return 0;
}

function availableSubjects(levelId, curriculum, phaseId) {
  const definitionPhase = phaseDefinitionId(levelId, curriculum, phaseId);
  const definition = definitionPhase && CURRICULUM_DEFINITIONS[curriculum]?.[`${levelId}.${definitionPhase}`];
  if (!definition) return [];
  return definition.map(([id, availability = 'required']) => {
    const subject = SUBJECTS[id];
    const topicTitles = (id === 'matematika' && LEGACY_MATH_TOPICS[`${levelId}.${phaseId}`])
      || PHASE_TOPICS[`${levelId}.${definitionPhase}:${id}`]
      || subject.topics;
    const quizId = `${levelId}-${curriculum}-${phaseId}-${id}-quiz`;
    const topics = topicTitles.map((title, index) => ({
      id: `${id}-${index + 1}`,
      title,
      objective: `Mengenali dan menggunakan gagasan utama pada materi ${title.toLowerCase()} sesuai ${phaseLabel(levelId, phaseId, curriculum)}.`,
      quizAvailable: false,
      quizId,
      publicationStatus: 'draft',
      source: { title: 'Draf pemetaan internal Cerdas Cermat', url: '' },
      reviewer: null,
      reviewedAt: null,
    }));
    topics.push({
      id: 'kuis-50', title: `Kuis ${subject.name} · 50 soal`,
      objective: `Latihan 50 soal campuran untuk ${subject.name} pada ${phaseLabel(levelId, phaseId, curriculum)}. Bank soal berstatus draf dan perlu ditelaah guru.`,
      quizAvailable: true,
      quizId,
      publicationStatus: 'draft',
      source: { title: 'Bank soal draf otomatis', url: '' },
      reviewer: null,
      reviewedAt: null,
    });
    const selectedTopics = curriculum === 'darurat'
      ? topics.filter((topic) => !topic.quizAvailable).slice(0, 3).concat(topics.filter((topic) => topic.quizAvailable))
      : topics;
    return {
      id,
      name: levelId === 'tk' && curriculum === 'merdeka' && id === 'agama' ? 'Nilai Agama dan Budi Pekerti' : subject.name,
      availability,
      availabilityLabel: ({ required: 'Umum', optional: 'Pilihan', local: 'Muatan lokal', school: 'Pengaturan sekolah', integrated: 'Terpadu' })[availability],
      family: subject.family,
      description: `${subject.name} membantu murid ${subject.family === 'math' ? 'bernalar dengan bilangan, bentuk, pola, atau data' : subject.family === 'language' ? 'memahami dan menyampaikan gagasan' : subject.family === 'science' ? 'mengamati, menjelaskan, dan menyelidiki lingkungan' : subject.family === 'movement' ? 'bergerak, menjaga kesehatan, dan mengenali keselamatan' : subject.family === 'arts' ? 'mencipta dan mengapresiasi karya' : subject.family === 'digital' ? 'berpikir runtut serta menggunakan teknologi dengan bertanggung jawab' : 'memahami diri, sesama, dan lingkungan'} melalui kegiatan yang sesuai usia.`,
      topics: selectedTopics,
    };
  });
}

function lessonsFor(levelId, curriculum, phaseId, subjectId) {
  const subject = availableSubjects(levelId, curriculum, phaseId).find((item) => item.id === subjectId);
  return subject || null;
}

function topicConcept(family, title) {
  const value = title.toLowerCase();
  const rules = {
    math: [
      [/bilangan|nilai tempat|angka/, 'Bilangan menyatakan banyak atau urutan. Nilai tempat membantu kita membaca dan membandingkan angka.'],
      [/jumlah|penjumlahan|tambah/, 'Penjumlahan menggabungkan dua kelompok. Pengurangan menunjukkan selisih atau bagian yang tersisa.'],
      [/perkalian|pembagian|operasi hitung/, 'Perkalian adalah penjumlahan berulang; pembagian membagi jumlah menjadi kelompok yang sama.'],
      [/pecahan|desimal|persen/, 'Pecahan, desimal, dan persen dapat menyatakan bagian dari satu keseluruhan dengan bentuk berbeda.'],
      [/perbandingan|rasio|skala/, 'Perbandingan menunjukkan hubungan dua kuantitas; skala memakai hubungan itu untuk mewakili ukuran sebenarnya.'],
      [/pola|barisan/, 'Pola memiliki aturan yang berulang atau berubah. Temukan aturannya untuk memprediksi suku berikutnya.'],
      [/aljabar|persamaan|fungsi|relasi/, 'Simbol mewakili nilai yang belum diketahui. Hubungan antarnilai dapat ditulis sebagai bentuk atau aturan matematika.'],
      [/geometri|bangun|bentuk|trigonometri|vektor|matriks/, 'Geometri membahas bentuk, ukuran, posisi, dan hubungan ruang. Gambar berlabel membantu menjelaskan sifat-sifatnya.'],
      [/data|statistika|diagram/, 'Data dikumpulkan dan disajikan agar mudah dibaca. Pilih tabel atau diagram yang sesuai lalu jelaskan kecenderungannya.'],
      [/peluang/, 'Peluang menggambarkan kemungkinan suatu hasil. Bandingkan banyak hasil yang diharapkan dengan seluruh hasil yang mungkin.'],
    ],
    language: [
      [/menyimak|mendengar/, 'Menyimak berarti menangkap informasi, tujuan, dan rincian penting dari tuturan atau rekaman.'],
      [/membaca|teks|cerita|sastra/, 'Pembaca memahami isi dengan menemukan gagasan utama, rincian pendukung, urutan, dan makna kata dalam konteks.'],
      [/menulis|coretan/, 'Tulisan yang jelas memiliki tujuan, gagasan yang runtut, serta pilihan kata dan ejaan yang sesuai.'],
      [/berbicara|diskusi|presentasi|percakapan|ungkapan/, 'Berbicara efektif menyampaikan gagasan dengan runtut, mendengarkan lawan bicara, dan menyesuaikan bahasa dengan situasi.'],
      [/kosakata|bunyi|simbol|huruf|hangul|hiragana|pinyin|mufradat/, 'Kosakata dan bunyi menjadi dasar untuk memahami pesan. Latih dengan contoh, pengulangan, dan penggunaan dalam kalimat.'],
    ],
    science: [
      [/makhluk hidup|keanekaragaman|sel|genetika|ekosistem|bioteknologi/, 'Makhluk hidup memiliki struktur dan kebutuhan yang saling berkaitan dengan lingkungannya. Pengamatan membantu menjelaskan persamaan dan perbedaannya.'],
      [/materi|zat|atom|ikatan|kimia|reaksi|larutan/, 'Materi tersusun dari partikel. Sifat dan perubahan yang diamati dapat dijelaskan melalui susunan serta interaksi partikelnya.'],
      [/gaya|gerak|energi|fisika|vektor|fluida|momentum/, 'Gerak dan perubahan dapat dianalisis dari gaya, jarak, waktu, dan energi yang terlibat. Gunakan satuan dan bukti yang tepat.'],
      [/bumi|antariksa|atmosfer|litosfer|iklim|lingkungan/, 'Bumi terdiri dari sistem yang saling memengaruhi. Perubahan alam dan kegiatan manusia berdampak pada lingkungan.'],
      [/pengukuran|penyelidikan|ilmiah/, 'Penyelidikan dimulai dengan pertanyaan, pengukuran yang konsisten, pencatatan hasil, dan kesimpulan berdasarkan bukti.'],
    ],
    society: [
      [/peta|ruang|wilayah|geografi|lingkungan/, 'Lokasi dan kondisi wilayah memengaruhi cara manusia hidup. Peta membantu membaca letak, jarak, pola, dan hubungan antartempat.'],
      [/ekonomi|pasar|uang|bank|kelangkaan|kebutuhan|biaya/, 'Sumber daya terbatas membuat orang menentukan prioritas. Pilihan ekonomi melibatkan kebutuhan, biaya, manfaat, dan pertukaran.'],
      [/sejarah|masa lalu|perubahan|kemerdekaan/, 'Sejarah mempelajari perubahan kehidupan manusia dari waktu ke waktu melalui sumber dan bukti yang dapat dibandingkan.'],
      [/sosial|kelompok|masyarakat|budaya|keragaman|identitas/, 'Hubungan sosial terbentuk melalui interaksi, nilai, dan kebiasaan. Perbedaan dapat dipahami dengan melihat sudut pandang dan konteks.'],
      [/penelitian/, 'Penelitian sosial mengumpulkan informasi secara terencana, menjaga etika, lalu menyampaikan temuan dengan alasan yang jelas.'],
    ],
    civic: [
      [/pancasila|persatuan|keberagaman/, 'Nilai Pancasila menjadi pedoman hidup bersama. Menghargai perbedaan dan menjaga persatuan tampak dalam tindakan sehari-hari.'],
      [/aturan|hak|kewajiban|tanggung jawab/, 'Aturan melindungi kepentingan bersama. Hak berjalan bersama kewajiban dan tanggung jawab kepada orang lain.'],
      [/musyawarah|gotong royong/, 'Musyawarah memberi ruang untuk mendengar alasan dan mencari keputusan bersama; gotong royong membagi peran untuk tujuan bersama.'],
    ],
    digital: [
      [/algoritma|langkah|berpikir komputasional|pola/, 'Masalah lebih mudah diselesaikan saat dipecah menjadi langkah yang jelas, diurutkan, dan diperiksa kembali.'],
      [/data|representasi/, 'Data perlu disusun dan dibaca dengan cermat. Bentuk representasi yang dipilih memengaruhi cara orang memahami informasi.'],
      [/artifisial|kecerdasan|ai/, 'Sistem AI mengenali pola dari data untuk menghasilkan keluaran. Hasilnya perlu diperiksa karena dapat keliru atau bias.'],
      [/keamanan|etika|dampak|jaringan/, 'Penggunaan teknologi yang bertanggung jawab melindungi privasi, memeriksa informasi, dan menghormati orang lain.'],
    ],
    movement: [
      [/gerak|permainan|keseimbangan|koordinasi/, 'Gerak dilakukan dengan koordinasi dan kontrol tubuh. Latihan bertahap serta ruang yang aman membantu mencegah cedera.'],
      [/kesehatan|kebersihan|gizi|istirahat/, 'Kesehatan didukung kebiasaan bersih, makanan beragam, cukup istirahat, aktivitas fisik, dan menjaga keselamatan.'],
    ],
    arts: [
      [/warna|rupa|bentuk|menggambar|karya/, 'Unsur seperti garis, bentuk, warna, tekstur, dan susunan dipilih untuk menyampaikan gagasan visual.'],
      [/musik|irama|bunyi/, 'Bunyi, tempo, irama, dan dinamika dapat diatur untuk membentuk suasana dan ekspresi.'],
      [/tari|gerak|ekspresi/, 'Gerak, ruang, waktu, dan tenaga dipadukan untuk menyampaikan suasana atau cerita.'],
      [/budaya|apresiasi/, 'Karya budaya mencerminkan pengalaman dan nilai masyarakat. Mengapresiasi berarti mengamati serta menghormati konteksnya.'],
    ],
    values: [
      [/ibadah|keyakinan|agama|syukur/, 'Nilai agama tampak dalam rasa syukur, kebiasaan ibadah sesuai keyakinan, dan sikap menghormati sesama.'],
      [/emosi|perasaan/, 'Mengenali perasaan membantu kita memilih cara yang aman untuk mengekspresikan diri dan memahami orang lain.'],
      [/kerja sama|giliran|kesepakatan/, 'Kesepakatan bersama membantu semua orang merasa aman, mendapat giliran, dan berperan dalam kegiatan.'],
      [/jujur|tanggung jawab|menghargai|menyayangi/, 'Sikap jujur, peduli, dan bertanggung jawab dapat dilatih melalui pilihan kecil dalam kehidupan sehari-hari.'],
    ],
    foundation: [
      [/bilangan|pola/, 'Anak mengenali jumlah, urutan, kesamaan, perbedaan, bentuk, dan pola melalui benda serta permainan.'],
      [/teknologi/, 'Teknologi dikenalkan lewat alat sederhana dan aman untuk mencari informasi atau membantu menyelesaikan masalah.'],
      [/seni|karya/, 'Anak mencoba bahan dan cara berkarya, mengekspresikan gagasan, lalu menghargai karya diri dan teman.'],
      [/bahasa|menyimak|gagasan/, 'Anak belajar memahami informasi dan menyampaikan pikiran atau perasaan lewat percakapan, gambar, dan tulisan awal.'],
      [/sebab|mengamati/, 'Mengamati perubahan dan mengajukan pertanyaan sederhana membantu anak mengenali hubungan sebab dan akibat.'],
    ],
    creative: [
      [/biaya|pasar|pemasaran|usaha/, 'Perencanaan usaha mempertimbangkan siapa yang membutuhkan produk, bahan, biaya, manfaat, dan cara mengenalkannya.'],
      [/bahan|produksi|produk|rancangan/, 'Produk dibuat melalui rancangan, pemilihan bahan dan alat yang aman, proses kerja, serta pemeriksaan mutu.'],
    ],
  };
  for (const [pattern, explanation] of (rules[family] || [])) if (pattern.test(value)) return explanation;
  return `${title} dipelajari dengan mengenali istilah penting, mengamati contoh, lalu menjelaskan hubungan gagasan menggunakan alasan yang sesuai.`;
}

function lessonPages(levelId, curriculum, phaseId, subjectId, topicId) {
  const subject = lessonsFor(levelId, curriculum, phaseId, subjectId);
  const topic = subject?.topics.find((item) => item.id === topicId);
  if (!subject || !topic) return null;
  const family = subject.family;
  const guide = {
    foundation: ['Gunakan benda, cerita, dan permainan di sekitar anak. Beri waktu untuk mencoba, berbicara, dan bergerak.', 'Ajak anak menunjukkan apa yang ia lihat atau rasakan. Hargai proses mencoba, bukan hanya hasil akhirnya.'],
    values: ['Hubungkan gagasan dengan contoh perilaku di rumah, sekolah, dan lingkungan. Bedakan tindakan yang menjaga diri dan menghargai orang lain.', 'Pilih satu tindakan baik yang dapat dilakukan hari ini, lalu ceritakan dampaknya kepada orang lain.'],
    language: ['Baca atau dengarkan contoh dengan saksama. Temukan siapa, apa, kapan, di mana, dan maksud yang ingin disampaikan.', 'Coba sampaikan kembali gagasan dengan kata-katamu sendiri. Periksa apakah isi dan pilihan katanya sesuai tujuan.'],
    math: ['Gunakan benda, gambar, tabel, atau garis bilangan untuk menunjukkan hubungan yang sedang dipelajari. Tuliskan langkahnya agar mudah diperiksa.', 'Coba satu contoh dengan angka berbeda. Periksa hasil menggunakan cara lain atau dengan memperkirakan jawabannya.'],
    science: ['Mulai dengan pertanyaan yang dapat diamati. Catat hasil, bandingkan bukti, lalu bedakan hasil pengamatan dari dugaan.', 'Gunakan alat dan bahan dengan aman. Jelaskan kesimpulan berdasarkan bukti yang berhasil dikumpulkan.'],
    society: ['Gunakan contoh dari rumah, sekolah, daerah, atau sumber tepercaya. Kenali hubungan antara orang, tempat, kebutuhan, dan perubahan.', 'Bandingkan dua contoh, lalu jelaskan persamaan, perbedaan, dan alasan yang didukung bukti.'],
    civic: ['Perhatikan contoh kehidupan bersama. Kenali aturan, hak, kewajiban, dan nilai yang membantu orang hidup berdampingan.', 'Diskusikan pilihan tindakan yang adil dan bertanggung jawab untuk situasi tersebut.'],
    arts: ['Amati bentuk, warna, bunyi, gerak, atau bahan yang tersedia. Buat rancangan sederhana sebelum mulai berkarya.', 'Ceritakan pilihanmu dan apresiasi cara orang lain menyampaikan gagasan melalui karya.'],
    movement: ['Lakukan gerakan secara bertahap, di ruang aman, dan sesuai kemampuan. Berhenti jika tubuh terasa sakit atau tidak nyaman.', 'Sebutkan kebiasaan yang mendukung kesehatan dan keselamatan sebelum, selama, dan sesudah aktivitas.'],
    digital: ['Uraikan masalah menjadi langkah kecil dan urutkan instruksi. Periksa hasilnya, data yang dipakai, serta risiko bagi pengguna.', 'Jangan membagikan data pribadi. Periksa informasi dan gunakan teknologi untuk tujuan yang aman dan bermanfaat.'],
    creative: ['Kenali kebutuhan, bahan, alat, waktu, dan keselamatan sebelum membuat produk. Buat rancangan dan hitung sumber daya yang dibutuhkan.', 'Uji hasil, minta masukan, lalu catat perubahan yang membuat produk lebih berguna.'],
  }[family] || ['Amati contoh yang dekat dengan kehidupan sehari-hari dan catat hal pentingnya.', 'Jelaskan kembali gagasan dengan alasan atau bukti yang sesuai.'];
  const phase = phaseLabel(levelId, phaseId, curriculum);
  return {
    material: {
      curriculum, curriculumNote: CURRICULUM_NOTES[curriculum],
      phase, subject: { id: subject.id, name: subject.name },
      topic: { id: topic.id, title: topic.title, objective: topic.objective },
      reviewStatus: 'Materi ringkas awal · perlu telaah guru',
      publicationStatus: topic.publicationStatus,
      source: topic.source,
      reviewer: topic.reviewer,
      reviewedAt: topic.reviewedAt,
      quizId: topic.quizId,
      nextTopicId: subject.topics.find((item) => item.quizAvailable && item.quizId === topic.quizId)?.id || null,
      quizAvailable: topic.quizAvailable,
      pageCount: topic.quizAvailable ? 0 : 4,
    },
    pages: topic.quizAvailable ? [] : [
      { number: 1, title: 'Tujuan belajar', heading: 'Apa yang akan dipelajari?', paragraphs: [topic.objective, `Pada ${phase}, mulailah dari contoh yang mudah diamati. Hubungkan ${topic.title.toLowerCase()} dengan pengalaman dan pengetahuan yang sudah kamu miliki.`] },
      { number: 2, title: 'Gagasan utama', heading: 'Pahami gagasannya', paragraphs: [topicConcept(family, topic.title), `Saat mempelajari ${topic.title.toLowerCase()}, perhatikan istilah dan contoh yang paling penting. Catat bagian yang masih ingin kamu tanyakan.`] },
      { number: 3, title: 'Ayo mencoba', heading: 'Coba kegiatan ini', paragraphs: [`Untuk menerapkan ${topic.title.toLowerCase()}, ${guide[1].charAt(0).toLowerCase()}${guide[1].slice(1)}`, `Tuliskan atau ceritakan hasil kegiatanmu. Gunakan langkah yang runtut agar teman atau guru dapat memahami caramu.`], activity: { title: 'Refleksi kegiatan', prompt: `Bagaimana pengalamanmu mencoba kegiatan tentang ${topic.title.toLowerCase()}?`, choices: ['Saya sudah mencoba', 'Saya ingin mencoba bersama guru atau teman', 'Saya ingin melihat contoh lain terlebih dahulu'] } },
      { number: 4, title: 'Refleksi', heading: 'Ceritakan kembali', paragraphs: [`Apa gagasan baru yang kamu pelajari tentang ${topic.title.toLowerCase()}? Berikan satu contoh dengan bahasamu sendiri.`, 'Jika belum yakin, kembali ke gagasan utama dan coba lagi pelan-pelan.'] },
    ],
  };
}

function catalogFor(levelId, curriculum, phaseId) {
  const phase = phaseLabel(levelId, phaseId, curriculum);
  if (!phase || !CURRICULA.some((item) => item.id === curriculum)) return null;
  const curriculumNote = levelId === 'tk' && curriculum === 'merdeka'
    ? `${CURRICULUM_NOTES[curriculum]} Untuk PAUD/TK, pilihan ditampilkan sebagai elemen atau area perkembangan dan aktivitas bermain, bukan daftar mapel formal.`
    : CURRICULUM_NOTES[curriculum];
  return {
    level: levelId,
    curriculum,
    curriculumNote,
    phase: { id: phaseId, label: phase },
    subjects: availableSubjects(levelId, curriculum, phaseId),
  };
}

module.exports = { CURRICULA, PHASES, phasesFor, gradeForPhase, catalogFor, lessonsFor, lessonPages, CURRICULUM_NOTES };
