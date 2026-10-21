const { books } = require('./books');
const { catalogFor } = require('./curriculum-catalog');

const PAGE_SIZE = 3;
const QUESTION_COUNT = 50;
const quizCache = new Map();

function randomFor(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

function compose(prompt, answer, distractors, explanation) {
  return { prompt, answer: String(answer), distractors: distractors.map(String), explanation };
}

const scenarios = {
  values: [
    ['teman lupa membawa alat tulis', 'menawarkan untuk berbagi alat tulis'],
    ['kamu tidak sengaja merusak barang kelas', 'mengakui kejadian dan membantu memperbaikinya'],
    ['menemukan barang milik orang lain', 'menyerahkannya kepada pemilik atau guru'],
    ['teman tampak sedih', 'menanyakan keadaannya dengan ramah'],
    ['pendapatmu berbeda dengan teman', 'mendengarkan lalu menyampaikan pendapat dengan sopan'],
    ['ruang belajar selesai digunakan', 'merapikan kembali barang yang dipakai'],
    ['kelompok mendapat tugas bersama', 'melaksanakan bagian tugas yang disepakati'],
    ['kamu berjanji membantu teman', 'menepati janji atau memberi kabar jika ada kendala'],
    ['teman sedang berbicara', 'menunggu giliran untuk menanggapi'],
    ['teman memiliki kebiasaan berbeda', 'menghormati perbedaan selama tetap saling menjaga'],
  ],
  civic: [
    ['aturan dibuat agar kegiatan bersama tertib', 'mengikuti aturan dan mengingatkan dengan santun'],
    ['hak setiap murid untuk belajar', 'memberi kesempatan teman belajar dengan tenang'],
    ['kewajiban menjaga fasilitas umum', 'menggunakan dan merawat fasilitas dengan bertanggung jawab'],
    ['teman berasal dari latar budaya berbeda', 'menghargai perbedaan dan bekerja sama'],
    ['kelas perlu menentukan kegiatan bersama', 'bermusyawarah dan menerima keputusan yang disepakati'],
    ['lingkungan membutuhkan kerja bakti', 'ikut bergotong royong sesuai kemampuan'],
    ['ada pendapat yang belum didengar', 'memberi kesempatan semua orang menyampaikan pendapat'],
    ['kesepakatan kelas sudah dibuat', 'menjalankan kesepakatan dengan tanggung jawab'],
    ['melihat perlakuan yang tidak adil', 'mencari bantuan dan menyampaikan masalah dengan aman'],
    ['menggunakan simbol atau lagu kebangsaan', 'menunjukkan sikap hormat sesuai aturan'],
  ],
  foundation: [
    ['bermain bersama teman', 'bergiliran dan berbagi alat bermain'],
    ['belum memahami sebuah kegiatan', 'bertanya kepada guru atau orang dewasa tepercaya'],
    ['melihat benda dengan bentuk berbeda', 'mengamati lalu mengelompokkan berdasarkan cirinya'],
    ['ingin menceritakan pengalaman', 'menyampaikan cerita secara bergantian'],
    ['akan menggunakan alat bermain', 'memeriksa alat dan menggunakannya dengan aman'],
    ['menyelesaikan susunan balok', 'mencoba cara lain jika susunannya belum seimbang'],
    ['teman membutuhkan bantuan', 'menawarkan bantuan dengan cara yang aman'],
    ['selesai melakukan kegiatan', 'mengembalikan alat ke tempatnya'],
    ['tubuh terasa lelah saat bermain', 'beristirahat dan memberi tahu orang dewasa'],
    ['mendengar cerita bersama', 'menyimak lalu menyampaikan bagian yang diingat'],
  ],
  movement: [
    ['akan melakukan aktivitas fisik', 'melakukan pemanasan ringan terlebih dahulu'],
    ['merasa haus setelah bergerak', 'minum air yang cukup'],
    ['merasakan nyeri saat berolahraga', 'berhenti dan memberi tahu guru atau orang dewasa'],
    ['selesai menggunakan alat olahraga', 'mengembalikan alat dengan tertib'],
    ['akan berlari di lapangan', 'memeriksa ruang gerak dan alas kaki'],
    ['tangan kotor sebelum makan', 'mencuci tangan dengan sabun dan air mengalir'],
    ['tubuh lelah setelah aktivitas', 'beristirahat dan tidur cukup'],
    ['bermain permainan beregu', 'mengikuti aturan dan menjaga keselamatan bersama'],
    ['memilih makanan untuk tubuh', 'memilih makanan beragam dan bergizi seimbang'],
    ['akan menyeberang jalan', 'menggunakan tempat penyeberangan dan melihat keadaan sekitar'],
  ],
  science: [
    ['menguji pengaruh cahaya pada pertumbuhan tanaman', 'mengubah jumlah cahaya saja dan menjaga faktor lain tetap'],
    ['mencatat perubahan yang terlihat', 'menulis hasil pengamatan tanpa menambahkan dugaan'],
    ['hasil pengukuran berbeda', 'mengulang pengukuran dengan cara dan alat yang sama'],
    ['membandingkan dua bahan', 'menggunakan ukuran yang sama agar perbandingan adil'],
    ['mengamati makhluk hidup di habitatnya', 'mencatat ciri dan lingkungan tanpa merusak habitat'],
    ['membuat kesimpulan dari percobaan', 'menggunakan bukti yang terkumpul untuk mendukung kesimpulan'],
    ['melakukan percobaan dengan alat', 'mengikuti petunjuk keselamatan dan arahan guru'],
    ['menyajikan hasil dalam tabel', 'menulis judul, satuan, dan data dengan jelas'],
    ['menyelidiki perubahan suatu benda', 'mencatat keadaan sebelum dan sesudah perlakuan'],
    ['menemukan data yang tidak sesuai dugaan', 'tetap mencatat data dan memeriksa prosedurnya'],
  ],
  society: [
    ['membaca peta wilayah', 'memeriksa judul, simbol, legenda, dan arah mata angin'],
    ['meneliti peristiwa masa lalu', 'membandingkan sumber dan memeriksa asal informasinya'],
    ['membahas kebutuhan dan keinginan', 'membedakan kebutuhan pokok dari keinginan tambahan'],
    ['membuat garis waktu', 'menyusun peristiwa menurut urutan waktunya'],
    ['mencari informasi tentang daerah', 'mencatat sumber dan membedakan fakta dari pendapat'],
    ['mempelajari kegiatan ekonomi', 'mengenali hubungan produsen, penjual, dan pembeli'],
    ['membandingkan dua lingkungan', 'memperhatikan kondisi tempat dan kegiatan penduduknya'],
    ['mengamati perubahan sosial', 'mencari bukti perubahan dan faktor yang memengaruhinya'],
    ['mewawancarai narasumber', 'meminta izin dan mencatat keterangan secara akurat'],
    ['mendengar pandangan kelompok berbeda', 'menyimak dan membahasnya dengan sikap saling menghormati'],
  ],
  arts: [
    ['membuat gambar dengan fokus tertentu', 'memilih garis, bentuk, atau warna untuk menyampaikan gagasan'],
    ['mendengar pola bunyi', 'memperhatikan ketukan dan pengulangan iramanya'],
    ['menampilkan gerak bersama kelompok', 'menyesuaikan gerak dengan irama dan ruang yang aman'],
    ['memilih bahan untuk karya', 'memastikan bahan aman dan sesuai rancangan'],
    ['memberi tanggapan terhadap karya teman', 'menyampaikan hal yang diamati dengan bahasa santun'],
    ['menata unsur dalam sebuah karya', 'mengatur bentuk dan ruang agar gagasan mudah terlihat'],
    ['membuat karya dari budaya setempat', 'mencari tahu makna dan menghargai sumber budayanya'],
    ['berlatih memainkan pola musik', 'mengulang bagian sulit secara bertahap'],
    ['karya belum sesuai rancangan', 'mencoba perubahan dan menilai hasilnya kembali'],
    ['menyaksikan karya pertunjukan', 'mengamati pilihan gerak, bunyi, atau bentuk yang digunakan'],
  ],
  digital: [
    ['menyusun algoritma sederhana', 'mengurutkan instruksi agar tujuan tercapai'],
    ['program memberi hasil yang keliru', 'memeriksa langkah dan menguji perbaikan satu per satu'],
    ['membuat kata sandi', 'menggunakan kata sandi kuat dan tidak membagikannya'],
    ['menerima pesan yang meminta data pribadi', 'tidak membagikannya dan meminta bantuan orang tepercaya'],
    ['menemukan informasi daring', 'memeriksa sumber, tanggal, dan membandingkan dengan sumber lain'],
    ['menggunakan hasil dari kecerdasan artifisial', 'memeriksa kebenarannya dan bertanggung jawab atas hasil akhir'],
    ['membuat pengulangan dalam algoritma', 'memakai pengulangan untuk langkah yang dilakukan berkali-kali'],
    ['membagikan foto orang lain', 'meminta izin sebelum membagikan foto tersebut'],
    ['menyimpan data dalam tabel', 'memberi nama kolom dan format data secara konsisten'],
    ['menggunakan perangkat bersama', 'menjaga perangkat dan keluar dari akun setelah selesai'],
  ],
  creative: [
    ['membuat produk untuk kebutuhan tertentu', 'menentukan kebutuhan pengguna sebelum membuat rancangan'],
    ['memilih bahan dan alat', 'memeriksa fungsi dan keselamatan alat terlebih dahulu'],
    ['rancangan produk sudah selesai', 'membuat purwarupa untuk menguji gagasan'],
    ['purwarupa belum berfungsi baik', 'mencatat masalah lalu mengubah bagian yang diperlukan'],
    ['menghitung biaya produksi', 'menjumlahkan biaya bahan dan kebutuhan produksi lain'],
    ['menghasilkan produk untuk dijual', 'menjelaskan manfaat dan harga dengan jujur'],
    ['bahan yang direncanakan tidak tersedia', 'memilih bahan pengganti yang aman dan sesuai fungsi'],
    ['menerima saran dari pengguna', 'menilai saran dan menggunakannya untuk memperbaiki produk'],
    ['bekerja di ruang produksi', 'menjaga kebersihan dan mengikuti prosedur kerja aman'],
    ['menilai mutu hasil produksi', 'membandingkan hasil dengan kriteria yang disepakati'],
  ],
};

function languageQuestion(subject, topic, index, round) {
  const variationIndex = (index % 10 + round * 3) % 10;
  const variants = [
    ['membaca petunjuk sebelum memulai kegiatan', 'memahami langkah agar kegiatan dilakukan dengan tepat'],
    ['menyimak penjelasan teman sampai selesai', 'menangkap informasi sebelum memberi tanggapan'],
    ['menulis paragraf untuk pembaca tertentu', 'menyesuaikan isi dan pilihan kata dengan tujuan'],
    ['menemukan gagasan utama dalam bacaan', 'memperhatikan hal yang paling banyak dibahas'],
    ['memeriksa fakta dalam teks informasi', 'mencari bukti dan sumber yang dapat diperiksa'],
    ['menyusun cerita berdasarkan urutan', 'mengatur peristiwa agar mudah diikuti pembaca'],
    ['berdiskusi tentang sebuah pendapat', 'menyampaikan alasan dan mendengarkan tanggapan'],
    ['merevisi tulisan setelah mendapat masukan', 'memeriksa kejelasan isi dan memperbaiki bagian yang perlu'],
    ['memilih judul bacaan', 'memilih judul yang mewakili gagasan utama'],
    ['mengutip kalimat dari sumber', 'menyebutkan sumber dan tidak mengakuinya sebagai karya sendiri'],
  ];
  if (subject.id === 'english') {
    const english = [
      ['memperkenalkan diri, ungkapan yang sesuai adalah …', 'My name is …', ['Where is my book?', 'I am under the table.', 'Close the window.'], '“My name is …” digunakan untuk menyebutkan nama diri.'],
      ['menyapa teman pada pagi hari, ungkapan yang tepat adalah …', 'Good morning.', ['Good night.', 'See you yesterday.', 'I am a pencil.'], '“Good morning” adalah salam pada pagi hari.'],
      ['kalimat yang menyatakan kesukaan adalah …', 'I like reading.', ['I reads yesterday.', 'Like I window.', 'Reading are blue.'], '“I like …” dapat digunakan untuk menyatakan kesukaan.'],
      ['kata yang tepat untuk melengkapi “She … a student.” adalah …', 'is', ['are', 'am', 'be'], 'Subjek “she” menggunakan kata kerja bantu “is”.'],
      ['instruksi “Open your book” berarti …', 'Buka bukumu.', ['Tutup bukumu.', 'Tulislah namamu.', 'Ambil tasmu.'], '“Open” berarti membuka dan “your book” berarti bukumu.'],
      ['kata yang berlawanan makna dengan “big” adalah …', 'small', ['tall', 'long', 'wide'], '“Small” berarti kecil, berlawanan dengan “big”.'],
      ['kalimat tanya yang meminta nama adalah …', 'What is your name?', ['Where is your bag?', 'How old is the table?', 'This is my name.'], '“What is your name?” menanyakan nama seseorang.'],
      ['kata ganti untuk menggantikan nama seorang laki-laki adalah …', 'he', ['they', 'we', 'it'], '“He” biasa digunakan sebagai kata ganti orang laki-laki tunggal.'],
      ['kalimat yang menggunakan bentuk jamak dengan tepat adalah …', 'These are my books.', ['These is my books.', 'This are my book.', 'Those am my books.'], '“These” dan “are” sesuai untuk benda jamak yang dekat.'],
      ['jawaban yang sesuai untuk “Thank you” adalah …', 'You’re welcome.', ['Good afternoon.', 'I am ten.', 'How many books?'], '“You’re welcome” adalah tanggapan yang lazim untuk “Thank you”.'],
    ];
    const [prompt, answer, distractors, explanation] = english[variationIndex % english.length];
    const context = ['latihan percakapan', 'kegiatan membaca', 'tugas kelas', 'belajar mandiri', 'diskusi kelompok'][round];
    return compose(`Dalam ${context}, pada materi ${topic.toLowerCase()}, ${prompt}`, answer, distractors, explanation);
  }
  const [activity, correct] = variants[variationIndex];
  const wrong = [
    'mengabaikan isi dan langsung menebak',
    'mengubah informasi tanpa memeriksa maksudnya',
    'menyela sebelum informasi selesai disampaikan',
  ];
  const options = [correct, ...wrong].filter((value, optionIndex, values) => values.indexOf(value) === optionIndex);
  const context = ['latihan percakapan', 'kegiatan membaca', 'tugas kelas', 'belajar mandiri', 'diskusi kelompok'][round];
  return compose(`Dalam ${context}, pada materi ${topic.toLowerCase()}, ketika ${activity}, tindakan yang paling membantu adalah …`, options[0], options.slice(1), `Cara tersebut membantu pembaca atau pendengar memahami ${topic.toLowerCase()} dengan lebih tepat.`);
}

function advancedMathQuestion(topic, index, random) {
  const type = index % 5;
  if (type === 0) {
    const coefficient = 2 + Math.floor(random() * 6);
    const offset = Math.floor(random() * 13) - 6;
    const x = 1 + Math.floor(random() * 5);
    const answer = coefficient * x + offset;
    return compose(`Untuk ${topic.toLowerCase()}, jika f(x) = ${coefficient}x ${offset < 0 ? `− ${Math.abs(offset)}` : `+ ${offset}`}, berapakah f(${x})?`, answer, [answer + coefficient, answer - coefficient, coefficient * (x + offset)], `Substitusi x = ${x}: f(${x}) = ${coefficient} × ${x} ${offset < 0 ? `− ${Math.abs(offset)}` : `+ ${offset}`} = ${answer}.`);
  }
  if (type === 1) {
    const angle = [0, 30, 45, 60, 90][Math.floor(random() * 5)];
    const isCos = random() >= 0.5;
    const values = isCos
      ? { 0: '1', 30: '√3/2', 45: '√2/2', 60: '1/2', 90: '0' }
      : { 0: '0', 30: '1/2', 45: '√2/2', 60: '√3/2', 90: '1' };
    const answer = values[angle];
    return compose(`Nilai ${isCos ? 'cos' : 'sin'} ${angle}° pada ${topic.toLowerCase()} adalah …`, answer, ['0', '1/2', '√2/2', '√3/2', '1'].filter((value) => value !== answer).slice(0, 3), `Nilai ${isCos ? 'cos' : 'sin'} ${angle}° adalah ${answer}.`);
  }
  if (type === 2) {
    const a = Math.floor(random() * 9) - 4;
    const b = Math.floor(random() * 9) - 4;
    const c = Math.floor(random() * 9) - 4;
    const d = Math.floor(random() * 9) - 4;
    const answer = `(${a + c}, ${b + d})`;
    return compose(`Hasil penjumlahan vektor (${a}, ${b}) + (${c}, ${d}) pada ${topic.toLowerCase()} adalah …`, answer, [`(${a + c}, ${b - d})`, `(${a - c}, ${b + d})`, `(${b + d}, ${a + c})`], `Jumlahkan komponen sejenis: (${a} + ${c}, ${b} + ${d}) = ${answer}.`);
  }
  if (type === 3) {
    const coefficient = 1 + Math.floor(random() * 6);
    const power = 2 + Math.floor(random() * 4);
    const answer = `${coefficient * power}x^${power - 1}`;
    return compose(`Turunan dari ${coefficient}x^${power} pada ${topic.toLowerCase()} adalah …`, answer, [`${coefficient}x^${power - 1}`, `${coefficient * power}x^${power}`, `${coefficient * (power - 1)}x^${power}`], `Gunakan aturan pangkat: turunan ax^n adalah an x^(n−1), sehingga hasilnya ${answer}.`);
  }
  const red = 1 + Math.floor(random() * 5);
  const blue = 2 + Math.floor(random() * 6);
  const divisor = (a, b) => b === 0 ? a : divisor(b, a % b);
  const common = divisor(red, red + blue);
  const answer = `${red / common}/${(red + blue) / common}`;
  const distractors = [`${blue}/${red + blue}`, `1/${red + blue}`, `${red}/${red + blue}`].filter((value) => value !== answer);
  return compose(`Di dalam wadah ada ${red} benda merah dan ${blue} benda biru. Peluang mengambil benda merah pada ${topic.toLowerCase()} adalah …`, answer, distractors, `Peluang = banyak hasil yang diinginkan ÷ jumlah seluruh hasil = ${red}/${red + blue} = ${answer}.`);
}

function createDraftQuestion({ level, phase, curriculum, subject, topic, index }) {
  const random = randomFor(hash(`${level}:${phase}:${curriculum}:${subject.id}:${index}`));
  const family = subject.family;
  const round = Math.floor(index / 10);
  let item;
  if (family === 'math') {
    item = advancedMathQuestion(topic, index, random);
  } else if (family === 'language') {
    item = languageQuestion(subject, topic, index, round);
  } else if (scenarios[family]) {
    const scenarioIndex = (index % 10 + round * 3) % 10;
    const [situation, correct] = scenarios[family][scenarioIndex];
    const incorrect = family === 'values'
      ? ['menyalahkan orang lain tanpa mendengarkan', 'mengabaikan keadaan dan pergi begitu saja', 'mengambil keputusan tanpa memikirkan dampaknya']
      : family === 'foundation'
        ? ['terburu-buru tanpa memperhatikan keadaan', 'mengganggu teman dan mengambil alatnya', 'diam saja meski membutuhkan bantuan']
        : family === 'movement'
          ? ['memaksakan diri dan mengabaikan keselamatan', 'menggunakan alat tanpa memeriksa keadaannya', 'tidak peduli pada kebersihan dan aturan']
          : family === 'science'
            ? ['mengubah banyak hal sekaligus tanpa mencatat', 'mengabaikan hasil yang tidak sesuai dugaan', 'membuat kesimpulan tanpa melihat data']
            : family === 'society'
              ? ['mengandalkan dugaan tanpa memeriksa sumber', 'mengabaikan keterangan yang berbeda', 'menyebarkan informasi tanpa mengetahui asalnya']
              : family === 'arts'
                ? ['menyalin karya orang lain tanpa izin', 'mengabaikan keselamatan dan bahan yang digunakan', 'menilai karya tanpa mengamati unsur di dalamnya']
                : family === 'digital'
                  ? ['membagikan semua informasi tanpa memeriksa risikonya', 'mengabaikan kesalahan dan terus menjalankan program', 'memercayai setiap keluaran tanpa pemeriksaan']
                  : ['memulai tanpa rancangan atau memperhatikan kebutuhan', 'mengabaikan keselamatan alat dan bahan', 'tetap memakai hasil tanpa menguji fungsinya'];
    const sentenceLead = family === 'values' ? 'Sikap yang paling tepat' : family === 'foundation' ? 'Langkah yang paling sesuai' : 'Tindakan yang paling tepat';
    const context = ['kegiatan belajar', 'kerja kelompok', 'latihan mandiri', 'kegiatan di rumah', 'diskusi kelas'][round];
    item = compose(`Saat ${context}, pada materi ${topic.toLowerCase()}, ketika ${situation}, ${sentenceLead} adalah …`, correct, incorrect, `Tindakan itu sesuai dengan gagasan ${topic.toLowerCase()} dan membantu mengambil keputusan yang bertanggung jawab.`);
  } else {
    item = languageQuestion(subject, topic, index, round);
  }

  const unique = [...new Set([item.answer, ...item.distractors])];
  let fallback = 1;
  while (unique.length < 4) {
    const option = `Kemungkinan ${fallback} tidak sesuai dengan ${topic.toLowerCase()}`;
    if (!unique.includes(option)) unique.push(option);
    fallback += 1;
  }
  const choices = unique.slice(0, 4);
  for (let position = choices.length - 1; position > 0; position -= 1) {
    const swap = Math.floor(random() * (position + 1));
    [choices[position], choices[swap]] = [choices[swap], choices[position]];
  }
  return {
    id: `${level}-${phase}-${subject.id}-q${String(index + 1).padStart(2, '0')}`,
    prompt: item.prompt,
    choices,
    answer: choices.indexOf(item.answer),
    explanation: item.explanation,
    reviewStatus: 'Draf otomatis · perlu telaah guru',
  };
}

function quizFor(levelId, curriculum, phaseId, subjectId) {
  const cacheKey = `${levelId}:${curriculum}:${phaseId}:${subjectId}`;
  if (quizCache.has(cacheKey)) return quizCache.get(cacheKey);
  const book = books.find((item) => item.id === levelId);
  const catalog = catalogFor(levelId, curriculum, phaseId);
  const subject = catalog?.subjects.find((item) => item.id === subjectId);
  if (!book || !subject) return null;
  const isMath = subjectId === 'matematika';
  const generatedQuestions = isMath
    ? book.questions
    : Array.from({ length: QUESTION_COUNT }, (_, index) => createDraftQuestion({
      level: levelId, phase: phaseId, curriculum, subject,
      topic: subject.topics[index % subject.topics.length].title,
      index,
    }));
  const questions = generatedQuestions.map((question, index) => ({
    ...question,
    difficulty: index % 3 === 0 ? 'mudah' : index % 3 === 1 ? 'sedang' : 'sulit',
    reviewStatus: 'draft',
  }));
  const pages = [];
  for (let index = 0; index < questions.length; index += PAGE_SIZE) {
    const pageQuestions = questions.slice(index, index + PAGE_SIZE);
    const first = index + 1;
    const last = index + pageQuestions.length;
    pages.push({ title: `Latihan ${String(first).padStart(2, '0')}–${String(last).padStart(2, '0')}`, questions: pageQuestions });
  }
  const quiz = {
    id: subject.topics.find((topic) => topic.quizAvailable)?.quizId || `${levelId}-${curriculum}-${phaseId}-${subjectId}-quiz`,
    level: levelId,
    curriculum,
    phase: catalog.phase,
    subject: { id: subject.id, name: subject.name },
    topicId: subject.topics.find((topic) => topic.quizAvailable)?.id || 'kuis-50',
    topic: subject.topics[0]?.title || 'Latihan campuran',
    questionCount: questions.length,
    pageCount: pages.length,
    questionsPerPage: PAGE_SIZE,
    reviewStatus: 'Draf · seluruh bank soal perlu ditelaah guru sebelum digunakan sebagai penilaian resmi.',
    publicationStatus: 'draft',
    source: { title: isMath ? 'Bank latihan Matematika Cerdas Cermat' : 'Bank soal draf otomatis', url: '' },
    reviewer: null,
    reviewedAt: null,
    pages,
    questions,
  };
  quizCache.set(cacheKey, quiz);
  return quiz;
}

module.exports = { quizFor, QUESTION_COUNT, PAGE_SIZE };
