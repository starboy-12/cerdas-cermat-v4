const alphabet = [
  ['A', 'ayam'], ['B', 'bebek'], ['C', 'capung'], ['D', 'domba'], ['E', 'elang'],
  ['F', 'flamingo'], ['G', 'gajah'], ['H', 'harimau'], ['I', 'ikan'], ['J', 'jerapah'],
  ['K', 'kucing'], ['L', 'lebah'], ['M', 'merpati'], ['N', 'nyamuk'], ['O', 'orangutan'],
  ['P', 'penyu'], ['Q', 'quokka'], ['R', 'rusa'], ['S', 'sapi'], ['T', 'tupai'],
  ['U', 'ular'], ['V', 'vicuña'], ['W', 'walabi'], ['X', 'xerus'], ['Y', 'yak'], ['Z', 'zebra'],
].map(([letter, word]) => ({ letter, word }));

const themes = [
  { id: 'history', title: 'Sejarah dan jejak masa lalu', shortTitle: 'Sejarah', illustration: 'history' },
  { id: 'faith', title: 'Agama, syukur, dan budi pekerti', shortTitle: 'Agama & budi pekerti', illustration: 'values' },
  { id: 'islam-history', title: 'Sejarah Islam dan hijrah', shortTitle: 'Sejarah Islam', illustration: 'islam-history' },
  { id: 'prophets', title: 'Kisah para nabi', shortTitle: 'Kisah para nabi', illustration: 'prophets' },
  { id: 'alphabet', title: 'Petualangan huruf A–Z', shortTitle: 'Huruf A–Z', illustration: 'alphabet' },
  { id: 'animals', title: 'Sahabat hewan dan alam', shortTitle: 'Hewan', illustration: 'animals' },
];

const LEVEL_STORIES = {
  tk: [
    {
      title: 'Kotak kenangan Nara',
      story: ['Nara menemukan kotak foto milik Nenek. Ada foto rumah lama, sepeda kecil, dan kebun yang dulu masih luas.', '“Ini cerita masa lalu keluarga kita,” kata Nenek. Nara membandingkan foto itu dengan rumah mereka hari ini.'],
      learn: ['Foto dan cerita orang yang mengalami suatu kejadian dapat membantu kita mengenal masa lalu.', 'Masa lalu terjadi dahulu; masa kini adalah waktu yang sedang kita jalani.'],
      prompt: 'Apa benda lama yang pernah kamu lihat bersama keluarga?',
    },
    {
      title: 'Hati Rani yang bersyukur',
      story: ['Sebelum makan, Rani berhenti sejenak untuk bersyukur sesuai kebiasaan keluarganya. Ia lalu berbagi buah dengan Bima.', 'Bima berterima kasih. Rani senang karena rasa syukur membuatnya ingat untuk menjaga dan berbagi hal baik.'],
      learn: ['Setiap keluarga dapat memiliki cara berdoa dan beribadah yang berbeda. Kita belajar menghormatinya.', 'Bersyukur, berkata jujur, dan menolong teman adalah contoh budi pekerti baik.'],
      prompt: 'Sebutkan satu hal yang kamu syukuri hari ini.',
    },
    {
      title: 'Perjalanan ke Madinah',
      story: ['Pada masa Nabi Muhammad SAW, beliau dan para sahabat berpindah dari Makkah ke Madinah. Perjalanan penting ini disebut hijrah.', 'Penduduk Madinah menyambut para pendatang dan membantu mereka. Mereka belajar menjadi tetangga yang ramah dan saling berbagi.'],
      learn: ['Hijrah mengajarkan keberanian, kesabaran, dan saling menolong.', 'Kaum yang datang dari Makkah disebut Muhajirin. Warga Madinah yang menolong mereka disebut Ansar.'],
      prompt: 'Bagaimana caramu menyambut teman baru di kelas?',
      reference: 'Al-Qur’an, Surah At-Tawbah [9]:40 dan Al-Hashr [59]:9.',
    },
    {
      title: 'Nabi Adam dan Nabi Nuh',
      story: ['Nabi Adam belajar memohon ampun kepada Allah setelah melakukan kesalahan. Allah menerima tobatnya.', 'Nabi Nuh membuat bahtera atas petunjuk Allah. Bahtera itu menjadi tempat aman bagi orang-orang beriman dan berbagai makhluk.'],
      learn: ['Kisah Nabi Adam mengajarkan kita mengakui kesalahan dan memohon ampun.', 'Kisah Nabi Nuh mengajarkan keteguhan mengikuti petunjuk Allah.'],
      prompt: 'Apa yang bisa kamu lakukan setelah berbuat salah?',
      reference: 'Al-Qur’an, Surah Al-Baqarah [2]:37 dan Hud [11]:37–40.',
    },
    {
      title: 'Lili dan kebun huruf',
      story: ['Lili berjalan di kebun yang jalannya berurutan dari A sampai Z. Di dekat A berkokok ayam, lalu di B berenang bebek.', 'Lili menyebut bunyi huruf sambil mencari benda dan hewan. Ia membaca pelan-pelan dari awal sampai akhir.'],
      learn: ['A–Z adalah 26 huruf dalam urutan abjad. Huruf membantu kita membaca dan menulis kata.', 'Coba bunyikan huruf awal pada nama sendiri, nama hewan, dan benda di rumah.'],
      prompt: 'Huruf apa yang terdengar di awal namamu?',
    },
    {
      title: 'Kiki menjaga kebun kecil',
      story: ['Kiki melihat kupu-kupu di bunga dan burung mencari ranting. Ia juga melihat semut berjalan membawa makanan.', 'Kakak mengingatkan Kiki untuk melihat hewan dengan tenang dan tidak merusak tempat tinggalnya. Kiki menjaga jarak dan mengagumi mereka.'],
      learn: ['Hewan membutuhkan makanan, air, dan tempat yang aman.', 'Kita dapat menyayangi hewan dengan lembut dan menjaga alam di sekitarnya.'],
      prompt: 'Bagaimana caramu menjaga hewan di sekitarmu?',
    },
  ],
  sd: [
    {
      title: 'Peta kecil kampung Bima',
      story: ['Bima mewawancarai Kakek tentang kampungnya dahulu. Kakek bercerita bahwa jalan yang sekarang ramai dulu berupa jalan tanah.', 'Bima melihat foto lama, lalu menggambar peta sederhana. Ia menulis sumber ceritanya: wawancara dengan Kakek dan foto keluarga.'],
      learn: ['Sejarah mempelajari kehidupan dan peristiwa masa lalu. Foto, benda, dokumen, dan kesaksian dapat menjadi sumber sejarah.', 'Catat siapa yang memberi informasi dan kapan sumber itu dibuat agar ceritanya lebih jelas.'],
      prompt: 'Sumber apa yang bisa kamu tanyakan untuk mengetahui sejarah keluargamu?',
    },
    {
      title: 'Bekal baik untuk Sita',
      story: ['Sita dan teman-temannya menyiapkan bekal untuk kegiatan kelas. Sebelum makan, mereka berdoa menurut keyakinan masing-masing dan saling memberi ruang.', 'Saat satu kotak bekal tertinggal, Sita mengajak teman-teman membagi makanan dengan adil. Mereka berterima kasih dan membereskan kelas bersama.'],
      learn: ['Ibadah dan doa adalah bagian penting dari kehidupan beragama. Cara dan waktunya mengikuti ajaran serta kebiasaan keluarga masing-masing.', 'Menghargai teman, jujur, berbagi, dan bertanggung jawab dapat dipraktikkan setiap hari.'],
      prompt: 'Apa tindakan kecil yang menunjukkan rasa hormat kepada teman?',
    },
    {
      title: 'Hijrah dan persaudaraan di Madinah',
      story: ['Nabi Muhammad SAW dan Abu Bakar melakukan perjalanan dari Makkah menuju Madinah. Al-Qur’an mengingatkan peristiwa ketika keduanya berada di dalam gua.', 'Warga Madinah menyambut kaum Muhajirin. Mereka dikenal sebagai Ansar karena menolong saudara seiman yang datang.'],
      learn: ['Hijrah adalah peristiwa penting dalam sejarah Islam dan perjalanan Nabi Muhammad SAW.', 'QS. Al-Hashr [59]:9 menggambarkan sikap warga yang menerima para pendatang dan mendahulukan kepentingan mereka.'],
      prompt: 'Tuliskan urutan sederhana peristiwa hijrah dan satu sikap baik yang ditunjukkan warga Madinah.',
      reference: 'Al-Qur’an, Surah At-Tawbah [9]:40 dan Al-Hashr [59]:9; Sahih al-Bukhari 3911.',
    },
    {
      title: 'Nabi Yusuf memilih memaafkan',
      story: ['Nabi Yusuf melewati masa sulit dan kemudian bertemu kembali dengan saudara-saudaranya. Mereka menyadari kesalahan yang pernah dilakukan.', 'Nabi Yusuf tidak membalas dengan keburukan. Ia mengatakan bahwa tidak ada celaan bagi mereka pada hari itu dan berharap Allah mengampuni mereka.'],
      learn: ['Al-Qur’an menceritakan kesabaran Nabi Yusuf menghadapi kesulitan.', 'Sikap memaafkan dapat membuka jalan untuk memperbaiki hubungan, sambil tetap belajar bertanggung jawab.'],
      prompt: 'Mengapa meminta maaf dan memaafkan dapat membantu memperbaiki persahabatan?',
      reference: 'Al-Qur’an, Surah Yusuf [12]:89–92.',
    },
    {
      title: 'Misi 26 huruf Danu',
      story: ['Danu menerima kartu A sampai Z. Ia memasangkan setiap kartu dengan kata: A untuk ayam, B untuk bebek, C untuk capung, dan seterusnya.', 'Beberapa kata, seperti quokka dan xerus, berasal dari nama hewan yang belum pernah Danu lihat. Ia mencari tahu cara membacanya di buku.'],
      learn: ['Abjad Indonesia memakai 26 huruf dari A sampai Z. Kata tersusun dari huruf-huruf yang dibaca berurutan.', 'Gunakan daftar A–Z di halaman ini untuk berlatih mengenali huruf awal kata. Q, V, dan X dipakai pada contoh kata serapan atau nama.'],
      prompt: 'Pilih tiga huruf, lalu temukan kata lain yang dimulai dengan huruf itu.',
    },
    {
      title: 'Mira mengamati kolam',
      story: ['Mira mencatat hewan yang ia lihat di sekitar kolam: ikan di air, capung terbang, dan katak di tepi.', 'Ia menggambar tempat hidup masing-masing. Gurunya menjelaskan bahwa setiap hewan memiliki kebutuhan dan cara bergerak yang berbeda.'],
      learn: ['Tempat hidup hewan disebut habitat. Ada hewan yang hidup di air, darat, atau dapat berpindah di antara keduanya.', 'Mengamati tanpa mengganggu membantu kita mengenal hewan dengan aman.'],
      prompt: 'Hewan apa yang pernah kamu amati? Di mana tempat hidupnya?',
    },
  ],
  smp: [
    {
      title: 'Dua cerita tentang jembatan',
      story: ['Di perpustakaan, Sari membaca wawancara warga dan melihat foto lama sebuah jembatan. Kedua sumber menggambarkan perubahan kampung, tetapi dibuat pada waktu yang berbeda.', 'Sari mencatat siapa pembuat sumber, kapan dibuat, dan informasi apa yang dapat diperiksa. Ia tidak langsung menganggap satu cerita mewakili semua pengalaman warga.'],
      learn: ['Sejarawan menafsirkan sumber dengan melihat konteks, tujuan, dan keterbatasannya.', 'Membandingkan kesaksian, foto, arsip, dan bukti lain membantu menyusun penjelasan yang lebih bertanggung jawab.'],
      prompt: 'Apa yang perlu diperiksa sebelum memakai sebuah sumber sejarah?',
    },
    {
      title: 'Ruang hening untuk semua',
      story: ['Kelas Arga membuat sudut tenang untuk berdoa, merenung, atau menenangkan diri. Mereka bermusyawarah agar jadwal kegiatan tidak mengganggu waktu ibadah teman.', 'Ketika terjadi salah paham, Arga mendengarkan penjelasan lebih dulu. Kelas kemudian menyepakati cara berbicara yang santun dan saling menjaga ruang.'],
      learn: ['Ajaran agama membimbing pemeluknya dalam beribadah dan berbuat baik. Pemahaman rinci sebaiknya dipelajari dari guru agama dan sumber yang sesuai keyakinan.', 'Sikap hormat, kejujuran, kepedulian, dan dialog membantu hidup bersama di tengah perbedaan.'],
      prompt: 'Bagaimana cara berdialog dengan hormat saat pendapat berbeda?',
    },
    {
      title: 'Hijrah sebagai perubahan masyarakat',
      story: ['Dalam diskusi sejarah, kelompok Sari membaca ayat tentang Nabi Muhammad SAW dan seorang sahabat yang berada di gua, lalu membaca ayat tentang warga Madinah yang menerima para pendatang.', 'Mereka menyusun urutan peristiwa hijrah dan membedakan keterangan sumber dari kesimpulan mereka sendiri. Catatan itu menunjukkan bahwa perjalanan tersebut juga diikuti tumbuhnya ikatan sosial baru.'],
      learn: ['QS. At-Tawbah [9]:40 menuturkan peristiwa di gua; QS. Al-Hashr [59]:9 menonjolkan sikap warga Madinah kepada kaum Muhajirin.', 'Saat mempelajari sejarah Islam, periksa jenis sumber dan konteksnya. Jangan menyamakan kutipan sumber dengan tafsir atau kesimpulan penulis.'],
      prompt: 'Informasi mana pada kisah ini berasal dari ayat, dan mana yang merupakan kesimpulan kelompok?',
      reference: 'Al-Qur’an, Surah At-Tawbah [9]:40 dan Al-Hashr [59]:9; Sahih al-Bukhari 3911.',
    },
    {
      title: 'Nabi Musa menyampaikan kebenaran',
      story: ['Allah memberi Nabi Musa tugas untuk menyampaikan pesan kepada Fir’aun. Nabi Musa berdoa agar hatinya dilapangkan, urusannya dimudahkan, dan perkataannya dipahami.', 'Nabi Musa dan Nabi Harun diperintahkan berbicara dengan lemah lembut. Kisah ini menunjukkan keberanian yang disertai doa dan cara berbicara yang baik.'],
      learn: ['QS. Taha [20]:25–36 memuat doa Nabi Musa; ayat 43–44 memuat perintah berbicara dengan lemah lembut kepada Fir’aun.', 'Keberanian menyampaikan kebenaran dapat berjalan bersama sikap santun dan persiapan yang matang.'],
      prompt: 'Bagaimana menyampaikan pendapat yang kuat tanpa merendahkan orang lain?',
      reference: 'Al-Qur’an, Surah Taha [20]:25–36 dan 43–44.',
    },
    {
      title: 'Kode huruf di perpustakaan',
      story: ['Kelompok Raka membuat petunjuk A–Z untuk menemukan buku. Mereka mengurutkan kata berdasarkan huruf pertama, lalu memeriksa huruf berikutnya jika kata awalnya sama.', 'Saat menemukan nama seperti quokka, vicuña, dan xerus, mereka menandai bahwa itu nama hewan dari bahasa lain. Teman-teman berlatih mengucapkan dan mencari artinya.'],
      learn: ['Urutan abjad dipakai dalam indeks, kamus, dan katalog. Jika huruf pertama sama, bandingkan huruf berikutnya.', 'Tidak semua contoh kata berawalan Q, V, dan X berasal dari kosakata asli Indonesia; sebagian adalah kata serapan atau nama.'],
      prompt: 'Urutkan nama temanmu berdasarkan abjad. Huruf mana yang menentukan urutannya?',
    },
    {
      title: 'Catatan perjalanan penyu',
      story: ['Nisa mengikuti pengamatan penyu bersama pendamping konservasi. Mereka melihat dari jarak aman dan mencatat waktu, cuaca, serta perilaku yang tampak.', 'Nisa belajar bahwa pengamatan singkat tidak cukup untuk menyimpulkan semua hal tentang penyu. Data perlu dikumpulkan dengan cara yang aman dan konsisten.'],
      learn: ['Hewan memiliki ciri, kebutuhan, dan hubungan dengan habitatnya. Perubahan habitat dapat memengaruhi kelangsungan hidupnya.', 'Pengamatan ilmiah mencatat bukti dan batas pengamatan, serta mengutamakan keselamatan hewan dan manusia.'],
      prompt: 'Informasi apa yang sebaiknya dicatat saat mengamati hewan?',
    },
  ],
  sma: [
    {
      title: 'Arsip di ujung gang',
      story: ['Maya meneliti perubahan sebuah pasar dari arsip foto, berita, dan wawancara pedagang. Beberapa sumber menyebut tanggal renovasi berbeda karena memakai patokan peristiwa yang tidak sama.', 'Ia membuat tabel asal sumber, waktu pembuatan, sudut pandang, dan hal yang belum terjawab. Kesimpulannya menyebut bukti yang mendukung sekaligus keterbatasan data.'],
      learn: ['Penelitian sejarah membangun argumen dari sumber yang diuji, bukan hanya mengumpulkan cerita.', 'Kritik sumber, konteks, perbandingan bukti, dan pengakuan atas ketidakpastian membuat narasi lebih dapat dipertanggungjawabkan.'],
      prompt: 'Bagaimana kamu membedakan fakta sumber dengan tafsir penulis?',
    },
    {
      title: 'Kebaikan yang direncanakan',
      story: ['Kelompok Laila merancang kegiatan berbagi di lingkungan sekolah. Mereka meminta saran pembina agama dan warga agar bantuan sesuai kebutuhan dan tidak melanggar kebiasaan ibadah.', 'Setelah kegiatan, mereka mengevaluasi dampaknya. Laila menyimpulkan bahwa niat baik perlu disertai pengetahuan, tanggung jawab, dan penghormatan kepada penerima.'],
      learn: ['Agama memiliki ajaran dan tata ibadah yang dipelajari melalui sumber tepercaya sesuai tradisi masing-masing.', 'Nilai seperti kasih sayang, amanah, keadilan, dan kepedulian dapat diterapkan dengan mempertimbangkan konteks dan martabat orang lain.'],
      prompt: 'Bagaimana memastikan kegiatan menolong benar-benar sesuai kebutuhan orang?',
    },
    {
      title: 'Menelaah peristiwa hijrah',
      story: ['Maya membandingkan beberapa sumber awal tentang hijrah Nabi Muhammad SAW. Ia mencatat bahwa QS. At-Tawbah [9]:40 menyebut peristiwa di gua, sementara QS. Al-Hashr [59]:9 memuji penduduk yang menerima para pendatang.', 'Ia lalu membaca riwayat Sahih al-Bukhari tentang kedatangan Nabi di Madinah. Dalam laporannya, Maya memisahkan isi sumber, konteks, dan tafsir yang ia gunakan.'],
      learn: ['Hijrah dapat dipelajari sebagai perjalanan keagamaan sekaligus perubahan sosial yang membentuk komunitas Muslim di Madinah.', 'Kajian sejarah yang cermat menyebutkan sumber untuk setiap klaim dan menjelaskan batas informasi yang tersedia.'],
      prompt: 'Bagaimana cara menunjukkan bahwa sebuah kesimpulan sejarah didukung oleh sumber?',
      reference: 'Al-Qur’an, Surah At-Tawbah [9]:40 dan Al-Hashr [59]:9; Sahih al-Bukhari 3911 dan 4093.',
    },
    {
      title: 'Nabi Ibrahim mengajak berpikir',
      story: ['Nabi Ibrahim mengajak kaumnya memikirkan apakah berhala yang mereka sembah mampu memberi manfaat. Ia menunjukkan bahwa benda buatan tidak layak disembah.', 'Kaumnya memutuskan untuk membakarnya, tetapi Allah menjadikan api itu dingin dan aman baginya. Maya membaca kisah tersebut sambil menandai bagian pesan dan bagian peristiwa.'],
      learn: ['QS. Al-Anbiya [21]:51–70 menceritakan seruan Nabi Ibrahim dan pertolongan Allah kepadanya.', 'Kisah ini mengajak pembaca memahami keteguhan tauhid dan menelaah ayat dengan bimbingan guru atau sumber tafsir tepercaya.'],
      prompt: 'Apa perbedaan antara menyebut isi ayat dan menjelaskan tafsir atas suatu ayat?',
      reference: 'Al-Qur’an, Surah Al-Anbiya [21]:51–70.',
    },
    {
      title: 'Abjad sebagai alat temu',
      story: ['Tim jurnalistik sekolah menyusun indeks nama narasumber A–Z supaya pembaca cepat menemukan informasi. Mereka memeriksa ejaan nama dan menyepakati aturan untuk gelar serta nama keluarga.', 'Dalam daftar satwa, mereka mempertahankan nama lokal, lalu menambahkan nama ilmiah atau asal kata bila diperlukan. Indeks sederhana pun menjadi alat untuk menelusuri pengetahuan.'],
      learn: ['Pengurutan alfabetis memudahkan pencarian data; aturan pengurutan harus diterapkan konsisten.', 'Nama umum dapat berbeda antarwilayah dan bahasa. Catat sumber, ejaan, serta konteks istilah agar tidak mengaburkan makna.'],
      prompt: 'Di bidang apa saja urutan A–Z membantu mengelola informasi?',
    },
    {
      title: 'Koridor bagi satwa',
      story: ['Rafi dan kelompoknya memetakan burung, serangga, dan mamalia kecil di sekitar ruang hijau kota. Mereka membandingkan catatan beberapa hari dan membaca laporan pengelola setempat.', 'Peta menunjukkan bahwa jalur hijau yang terhubung memberi ruang berpindah bagi satwa. Kelompok itu menyampaikan usulan dan menjelaskan data serta keterbatasan pengamatan mereka.'],
      learn: ['Keanekaragaman hayati dipengaruhi hubungan antarorganisme dan kondisi habitat.', 'Solusi konservasi perlu memakai bukti, melibatkan masyarakat, serta menimbang dampak dan kebutuhan ekologi setempat.'],
      prompt: 'Data apa yang perlu ditambah sebelum mengusulkan perubahan habitat?',
    },
  ],
};

const STORYBOOK_EXTENSIONS = {
  tk: {
    'islam-history': {
      title: 'Jejak awal Islam dan perjalanan hijrah',
      pages: [
        { title: 'Wahyu pertama di Gua Hira', kind: 'Kisah', paragraphs: ['Nabi Muhammad SAW senang beribadah dan merenung di Gua Hira. Di sana, beliau menerima wahyu pertama dari Allah.', 'Wahyu pertama mengajak manusia membaca dengan menyebut nama Allah. Dari awal kisah Islam, kita belajar bahwa mencari ilmu adalah hal yang baik.'], illustration: 'first-revelation', illustrationAlt: 'Gua di pegunungan Hira saat fajar dan cahaya lembut, tanpa menggambarkan sosok manusia atau malaikat.', reference: 'Al-Qur’an, Surah Al-‘Alaq [96]:1–5; Sahih al-Bukhari 3.' },
        { title: 'Berangkat dengan harapan', kind: 'Kisah', paragraphs: ['Kemudian Nabi Muhammad SAW dan para sahabat berpindah dari Makkah menuju Madinah. Perjalanan penting ini disebut hijrah.', 'Al-Qur’an menceritakan bahwa Nabi berada di dalam gua bersama seorang sahabat. Beliau menguatkan sahabatnya agar tidak bersedih dan tetap percaya kepada pertolongan Allah.'], illustration: 'islam-history', illustrationAlt: 'Peta bergambar perjalanan hijrah dari Makkah menuju Madinah.', reference: 'Al-Qur’an, Surah At-Tawbah [9]:40; Sahih al-Bukhari 4093.' },
        { title: 'Madinah membuka pintu', kind: 'Kisah', paragraphs: ['Penduduk Madinah menyambut kaum Muhajirin yang datang dari Makkah. Mereka menolong dan berbagi apa yang dimiliki.', 'Para penolong itu disebut Ansar. Kota baru menjadi rumah bersama bagi orang-orang yang ingin hidup saling menjaga.'], illustration: 'madinah-welcome', illustrationAlt: 'Rumah-rumah Madinah, pohon kurma, dan bekal berbagi sebagai lambang sambutan hangat.', reference: 'Al-Qur’an, Surah Al-Hashr [59]:9; Sahih al-Bukhari 3911.' },
        { title: 'Makna hijrah', kind: 'Makna cerita', paragraphs: ['Hijrah bukan sekadar perjalanan jauh. Kisah ini mengajarkan keberanian, kesabaran, persahabatan, dan kerelaan menolong.', 'Kita dapat meneladaninya dengan menyambut teman baru, berbagi, dan tetap melakukan hal baik meski sedang menghadapi kesulitan.'], takeaway: 'Berpindah menuju keadaan yang lebih baik membutuhkan harapan dan dukungan bersama.', prompt: 'Bagaimana kamu bisa membuat teman baru merasa diterima?', illustration: 'madinah-welcome', illustrationAlt: 'Lambang persahabatan dan saling menolong di lingkungan Madinah.', reference: 'Al-Qur’an, Surah At-Tawbah [9]:40 dan Al-Hashr [59]:9.' },
      ],
    },
    prophets: {
      title: 'Nabi Adam dan Nabi Nuh: belajar dan teguh',
      pages: [
        { title: 'Nabi Adam mengakui kesalahan', kind: 'Kisah Nabi Adam', paragraphs: ['Nabi Adam menerima petunjuk dari Allah. Ketika melakukan kesalahan, beliau tidak berpura-pura bahwa semuanya baik-baik saja.', 'Nabi Adam memohon ampun kepada Allah. Allah menerima tobatnya dan memberinya petunjuk.'], illustration: 'adam-garden', illustrationAlt: 'Taman, jalan pulang, dan tunas hijau sebagai lambang belajar dari kesalahan.', reference: 'Al-Qur’an, Surah Al-Baqarah [2]:37.' },
        { title: 'Berani memperbaiki diri', kind: 'Makna kisah Nabi Adam', paragraphs: ['Setiap orang dapat melakukan kesalahan. Kita belajar mengakuinya, meminta maaf kepada orang yang terkena dampaknya, lalu berusaha memperbaiki keadaan.', 'Memohon ampun kepada Allah dan melakukan kebaikan membantu kita belajar menjadi lebih baik.'], takeaway: 'Kesalahan dapat menjadi awal untuk belajar jika kita jujur dan mau memperbaiki diri.', prompt: 'Apa yang dapat kamu lakukan setelah tidak sengaja menyakiti teman?', illustration: 'adam-garden', illustrationAlt: 'Jalan kecil di taman menuju tunas yang tumbuh kembali.', reference: 'Al-Qur’an, Surah Al-Baqarah [2]:37.' },
        { title: 'Nabi Nuh membuat bahtera', kind: 'Kisah Nabi Nuh', paragraphs: ['Allah memberi Nabi Nuh petunjuk untuk membuat bahtera. Pekerjaan itu besar dan tidak mudah, tetapi Nabi Nuh tetap tekun mengerjakannya.', 'Saat pertolongan Allah datang, Nabi Nuh mengajak orang-orang beriman masuk ke bahtera. Berbagai makhluk juga dibawa ke tempat yang aman.'], illustration: 'noah-ark', illustrationAlt: 'Bahtera kayu di atas air dengan beberapa hewan berpasangan, tanpa menggambarkan Nabi Nuh.', reference: 'Al-Qur’an, Surah Hud [11]:37–40.' },
        { title: 'Tekun menjaga kehidupan', kind: 'Makna kisah Nabi Nuh', paragraphs: ['Nabi Nuh menunjukkan keteguhan dalam mengikuti petunjuk Allah. Kisah bahtera juga mengingatkan kita bahwa kehidupan perlu dijaga.', 'Kita dapat meneladaninya dengan menyayangi makhluk hidup, menjaga lingkungan, dan tetap berusaha melakukan kebaikan.'], takeaway: 'Tetaplah tekun dan sayangi kehidupan di sekitar kita.', prompt: 'Sebutkan satu cara sederhana menjaga hewan atau alam.', illustration: 'noah-ark', illustrationAlt: 'Bahtera dan hewan-hewan sebagai lambang keselamatan dan kepedulian.', reference: 'Al-Qur’an, Surah Hud [11]:37–40.' },
      ],
    },
  },
  sd: {
    'islam-history': {
      title: 'Dari wahyu pertama hingga Madinah',
      pages: [
        { title: 'Wahyu pertama', kind: 'Kisah', paragraphs: ['Nabi Muhammad SAW menerima wahyu pertama saat berada di Gua Hira. Surah Al-‘Alaq dimulai dengan ajakan membaca atas nama Allah.', 'Pesan ini menjadi pengingat bahwa ilmu, membaca, dan belajar memiliki tempat penting dalam kehidupan umat Islam.'], illustration: 'first-revelation', illustrationAlt: 'Gua Hira di pegunungan saat fajar, tanpa menggambarkan Nabi atau malaikat.', reference: 'Al-Qur’an, Surah Al-‘Alaq [96]:1–5; Sahih al-Bukhari 3.' },
        { title: 'Perjalanan hijrah', kind: 'Kisah', paragraphs: ['Ketika Nabi Muhammad SAW dan para pengikutnya berpindah dari Makkah ke Madinah, perjalanan itu dikenal sebagai hijrah. Abu Bakar menemani Nabi dalam perjalanan.', 'Al-Qur’an mengingatkan peristiwa ketika keduanya berada di dalam gua. Kisah ini menggambarkan keyakinan dan keteguhan ketika menghadapi masa sulit.'], illustration: 'islam-history', illustrationAlt: 'Peta jalur perjalanan dari Makkah ke Madinah.', reference: 'Al-Qur’an, Surah At-Tawbah [9]:40; Sahih al-Bukhari 4093.' },
        { title: 'Muhajirin dan Ansar', kind: 'Kisah', paragraphs: ['Kaum Muslim yang meninggalkan Makkah disebut Muhajirin. Penduduk Madinah yang menyambut dan membantu mereka dikenal sebagai Ansar.', 'Al-Qur’an memuji penduduk yang mencintai para pendatang dan bersedia berbagi, bahkan ketika mereka sendiri membutuhkan.'], illustration: 'madinah-welcome', illustrationAlt: 'Lingkungan Madinah dan bekal yang dibagi bersama sebagai lambang pertolongan Ansar.', reference: 'Al-Qur’an, Surah Al-Hashr [59]:9; Sahih al-Bukhari 3911.' },
        { title: 'Apa yang dapat kita teladani?', kind: 'Makna cerita', paragraphs: ['Hijrah menjadi peristiwa penting dalam sejarah Islam. Perjalanan itu membawa kaum Muslim ke tempat baru dan mempertemukan Muhajirin dengan Ansar.', 'Keberanian, keteguhan, dan kebiasaan saling menolong membantu sebuah masyarakat menjadi kuat.'], takeaway: 'Perubahan besar dapat dijalani dengan iman, usaha, dan dukungan dari orang lain.', prompt: 'Tuliskan urutan hijrah dan satu contoh sikap Ansar yang dapat dilakukan di sekolah.', illustration: 'madinah-welcome', illustrationAlt: 'Lambang masyarakat yang menyambut dan menolong pendatang.', reference: 'Al-Qur’an, Surah At-Tawbah [9]:40 dan Al-Hashr [59]:9.' },
      ],
    },
    prophets: {
      title: 'Nabi Yusuf: sabar, amanah, dan memaafkan',
      pages: [
        { title: 'Mimpi dan harapan Yusuf', kind: 'Kisah Nabi Yusuf', paragraphs: ['Saat masih muda, Nabi Yusuf menceritakan sebuah mimpi kepada ayahnya, Nabi Ya’qub. Ayahnya menasihati Yusuf agar menjaga ceritanya dan tetap dekat kepada Allah.', 'Kisah ini dimulai dari keluarga yang saling menyayangi, tetapi kemudian menghadapi ujian dan perpisahan.'], illustration: 'yusuf-story', illustrationAlt: 'Rangkaian simbol kisah Nabi Yusuf: mimpi berbintang, sumur, gandum, dan pertemuan kembali; tanpa tokoh.', reference: 'Al-Qur’an, Surah Yusuf [12]:4–6.' },
        { title: 'Tetap sabar dalam ujian', kind: 'Kisah Nabi Yusuf', paragraphs: ['Nabi Yusuf mengalami perlakuan tidak baik dari saudara-saudaranya dan terpisah dari keluarganya. Nabi Ya’qub bersedih, tetapi tetap bersabar dan berharap kepada Allah.', 'Yusuf kemudian menjalani kehidupan yang jauh dari rumah. Ia tetap berusaha jujur dan menjaga diri.'], illustration: 'yusuf-well', illustrationAlt: 'Rangkaian simbol kisah Nabi Yusuf: mimpi berbintang, sumur, gandum, dan pertemuan kembali; tanpa tokoh.', reference: 'Al-Qur’an, Surah Yusuf [12]:15–18 dan 21–22.' },
        { title: 'Menjadi pribadi yang dipercaya', kind: 'Kisah Nabi Yusuf', paragraphs: ['Ketika tumbuh dewasa, Nabi Yusuf dikenal memiliki pengetahuan dan dipercaya mengelola persediaan makanan.', 'Saat masa sulit datang, persiapan yang baik membantu banyak orang mendapatkan bahan pangan. Yusuf menggunakan kemampuannya untuk melayani masyarakat.'], illustration: 'yusuf-grain', illustrationAlt: 'Rangkaian simbol kisah Nabi Yusuf: mimpi berbintang, sumur, gandum, dan pertemuan kembali; tanpa tokoh.', reference: 'Al-Qur’an, Surah Yusuf [12]:43–49 dan 54–56.' },
        { title: 'Pertemuan dan maaf', kind: 'Kisah Nabi Yusuf', paragraphs: ['Bertahun-tahun kemudian, Nabi Yusuf bertemu kembali dengan saudara-saudaranya. Mereka menyadari kesalahan masa lalu dan meminta ampun.', 'Nabi Yusuf tidak membalas dendam. Ia memberi maaf dan berharap Allah mengampuni mereka. Keluarga yang lama berpisah akhirnya dapat berkumpul kembali.'], illustration: 'yusuf-reunion', illustrationAlt: 'Rangkaian simbol kisah Nabi Yusuf: mimpi berbintang, sumur, gandum, dan pertemuan kembali; tanpa tokoh.', reference: 'Al-Qur’an, Surah Yusuf [12]:89–100.' },
        { title: 'Makna kisah Nabi Yusuf', kind: 'Makna cerita', paragraphs: ['Kisah Nabi Yusuf mengajarkan kesabaran saat keadaan sulit, kejujuran ketika diberi tanggung jawab, dan keberanian memaafkan.', 'Memaafkan bukan berarti kesalahan tidak penting. Kita tetap perlu mengakui kesalahan dan belajar agar tidak mengulanginya.'], takeaway: 'Kesabaran dan amanah membuat kita tetap berbuat baik; memaafkan membuka jalan untuk berdamai.', prompt: 'Bagaimana cara memperbaiki hubungan setelah terjadi pertengkaran?', illustration: 'yusuf-reunion', illustrationAlt: 'Rangkaian simbol kisah Nabi Yusuf: mimpi berbintang, sumur, gandum, dan pertemuan kembali; tanpa tokoh.', reference: 'Al-Qur’an, Surah Yusuf [12]:89–100.' },
      ],
    },
  },
  smp: {
    'islam-history': {
      title: 'Hijrah dan lahirnya masyarakat Madinah',
      pages: [
        { title: 'Wahyu dan awal risalah', kind: 'Kisah sejarah', paragraphs: ['Riwayat Sahih al-Bukhari menceritakan bahwa wahyu pertama diterima Nabi Muhammad SAW di Gua Hira. Surah Al-‘Alaq memuat ajakan membaca dan belajar.', 'Dalam mempelajari awal Islam, kita dapat membedakan isi Al-Qur’an dari keterangan riwayat tentang keadaan saat wahyu diterima.'], illustration: 'first-revelation', illustrationAlt: 'Gua Hira dan alat tulis sebagai simbol awal risalah dan ilmu.', reference: 'Al-Qur’an, Surah Al-‘Alaq [96]:1–5; Sahih al-Bukhari 3.' },
        { title: 'Perjalanan yang penuh keyakinan', kind: 'Kisah sejarah', paragraphs: ['Hijrah membawa Nabi Muhammad SAW dan kaum Muslim dari Makkah menuju Madinah. Dalam perjalanan itu, Nabi ditemani Abu Bakar dan mereka sempat berada di sebuah gua.', 'Surah At-Tawbah menggambarkan Nabi menenangkan sahabatnya. Riwayat Bukhari memberi rincian perjalanan, sehingga pembaca dapat membandingkan jenis informasi dalam kedua sumber.'], illustration: 'islam-history', illustrationAlt: 'Peta jalur hijrah Makkah–Madinah dengan penanda gua di tengah perjalanan.', reference: 'Al-Qur’an, Surah At-Tawbah [9]:40; Sahih al-Bukhari 4093.' },
        { title: 'Membangun persaudaraan', kind: 'Kisah sejarah', paragraphs: ['Di Madinah, para pendatang disambut oleh warga setempat. Al-Qur’an menggambarkan mereka mencintai orang yang berhijrah dan mengutamakan berbagi.', 'Riwayat kedatangan Nabi di Madinah juga mencatat sambutan kaum Ansar. Dukungan itu membantu komunitas baru membangun kehidupan bersama.'], illustration: 'madinah-welcome', illustrationAlt: 'Rumah, kebun kurma, dan tempat berbagi sebagai gambaran dukungan masyarakat Madinah.', reference: 'Al-Qur’an, Surah Al-Hashr [59]:9; Sahih al-Bukhari 3911.' },
        { title: 'Membaca peristiwa melalui sumber', kind: 'Makna sejarah', paragraphs: ['Satu peristiwa dapat diceritakan dari beberapa sumber dengan tujuan dan rincian yang berbeda. Pembaca perlu memeriksa siapa yang menyampaikan, apa yang disebutkan, dan apa yang belum dijelaskan.', 'Jangan menyamakan isi sumber dengan tafsir kita. Tunjukkan bagian yang merupakan keterangan sumber dan bagian yang merupakan kesimpulan.'], takeaway: 'Sejarah yang cermat menyebutkan bukti dan batas pengetahuan.', prompt: 'Bandingkan informasi tentang hijrah di At-Tawbah 9:40 dan Al-Hashr 59:9. Apa fokus masing-masing ayat?', illustration: 'islam-history', illustrationAlt: 'Peta dan gulungan catatan sebagai simbol membaca sejarah dari sumber.', reference: 'Al-Qur’an, Surah At-Tawbah [9]:40 dan Al-Hashr [59]:9; Sahih al-Bukhari 3911 dan 4093.' },
      ],
    },
    prophets: {
      title: 'Nabi Musa: doa, keberanian, dan pertolongan',
      pages: [
        { title: 'Doa sebelum menjalankan tugas', kind: 'Kisah Nabi Musa', paragraphs: ['Allah memberi Nabi Musa tugas untuk menyampaikan pesan kepada Fir’aun. Sebelum berangkat, Nabi Musa berdoa agar hatinya dilapangkan dan urusannya dimudahkan.', 'Ia juga memohon agar perkataannya mudah dipahami dan meminta Nabi Harun membantu tugas tersebut.'], illustration: 'musa-call', illustrationAlt: 'Gunung, tongkat, dan cahaya fajar sebagai lambang panggilan Nabi Musa, tanpa sosok manusia.', reference: 'Al-Qur’an, Surah Taha [20]:25–36.' },
        { title: 'Berbicara dengan lembut', kind: 'Kisah Nabi Musa', paragraphs: ['Nabi Musa dan Nabi Harun diperintahkan menyampaikan pesan kepada Fir’aun dengan perkataan yang lemah lembut.', 'Kelembutan tidak berarti mengabaikan kebenaran. Kisah ini menunjukkan bahwa cara berbicara yang santun dapat menyertai keberanian menyampaikan pesan.'], illustration: 'musa-dialogue', illustrationAlt: 'Dua lengkung gerbang dan sulur tanaman sebagai lambang dialog yang santun.', reference: 'Al-Qur’an, Surah Taha [20]:43–48.' },
        { title: 'Teguh saat menghadapi bahaya', kind: 'Kisah Nabi Musa', paragraphs: ['Nabi Musa dan orang-orang yang bersamanya dikejar oleh pasukan Fir’aun hingga sampai ke laut. Mereka menghadapi keadaan yang tampak sangat sulit.', 'Dengan pertolongan Allah, laut terbelah dan Nabi Musa bersama orang-orang beriman dapat menyeberang dengan selamat.'], illustration: 'musa-sea', illustrationAlt: 'Laut terbelah dengan jalur aman dan tongkat di tepi, tanpa menggambarkan Nabi Musa.', reference: 'Al-Qur’an, Surah Asy-Syu‘ara [26]:60–66.' },
        { title: 'Melihat pesan dalam kisah', kind: 'Makna cerita', paragraphs: ['Doa, persiapan, keberanian, dan pertolongan Allah muncul dalam beberapa bagian kisah Nabi Musa.', 'Saat membaca kisah agama, pahami ayat dalam konteksnya dan tanyakan kepada guru jika ingin mempelajari tafsir yang lebih mendalam.'], takeaway: 'Keberanian dapat berjalan bersama doa, ikhtiar, dan tutur kata yang santun.', prompt: 'Bagaimana menerapkan keberanian dan komunikasi yang santun saat menghadapi masalah?', illustration: 'musa-sea', illustrationAlt: 'Jalan yang terbuka di tengah laut sebagai lambang keteguhan.', reference: 'Al-Qur’an, Surah Taha [20]:25–36 dan 43–48; Asy-Syu‘ara [26]:60–66.' },
      ],
    },
  },
  sma: {
    'islam-history': {
      title: 'Awal Islam: wahyu, hijrah, dan komunitas',
      pages: [
        { title: 'Wahyu dan pengetahuan', kind: 'Kisah sejarah', paragraphs: ['Surah Al-‘Alaq memuat ajakan membaca atas nama Allah dan mengingatkan bahwa manusia diajari melalui pena. Riwayat Sahih al-Bukhari menjelaskan bahwa awal wahyu diterima Nabi Muhammad SAW di Gua Hira.', 'Dua sumber tersebut memberi jenis keterangan yang berbeda: satu adalah ayat Al-Qur’an, satu lagi adalah riwayat tentang peristiwa penerimaan wahyu.'], illustration: 'first-revelation', illustrationAlt: 'Gua Hira di antara pegunungan dengan pena dan gulungan sebagai lambang wahyu serta pengetahuan.', reference: 'Al-Qur’an, Surah Al-‘Alaq [96]:1–5; Sahih al-Bukhari 3.' },
        { title: 'Hijrah dari Makkah', kind: 'Kisah sejarah', paragraphs: ['Nabi Muhammad SAW dan kaum Muslim berpindah dari Makkah menuju Madinah. Dalam perjalanan, Nabi ditemani Abu Bakar dan keduanya berada di dalam gua.', 'Al-Qur’an menekankan keteguhan dan penguatan hati, sementara riwayat Bukhari memuat rincian perjalanan. Membaca keduanya bersama membantu kita memahami peristiwa dari sudut yang saling melengkapi.'], illustration: 'islam-history', illustrationAlt: 'Peta jalur hijrah Makkah–Madinah dengan jalur gurun dan penanda gua.', reference: 'Al-Qur’an, Surah At-Tawbah [9]:40; Sahih al-Bukhari 4093.' },
        { title: 'Madinah sebagai rumah bersama', kind: 'Kisah sejarah', paragraphs: ['Penduduk Madinah menerima kaum Muhajirin. QS. Al-Hashr [59]:9 menonjolkan kecintaan mereka kepada para pendatang dan kesediaan berbagi.', 'Sahih al-Bukhari 3911 meriwayatkan kedatangan Nabi di Madinah dan sambutan kaum Ansar. Dukungan sosial menjadi bagian penting dari kehidupan komunitas baru.'], illustration: 'madinah-welcome', illustrationAlt: 'Kota dengan rumah dan kebun kurma sebagai lambang kehidupan bersama di Madinah.', reference: 'Al-Qur’an, Surah Al-Hashr [59]:9; Sahih al-Bukhari 3911.' },
        { title: 'Menyusun argumen sejarah', kind: 'Kajian sumber', paragraphs: ['Penulis sejarah dapat menggunakan ayat, hadis, dan karya sejarah kemudian. Setiap jenis sumber memiliki tujuan, cara penyampaian, dan konteks yang perlu diperiksa.', 'Argumen yang kuat memisahkan kutipan sumber, penjelasan konteks, dan kesimpulan penulis. Ketika sumber tidak menyebut suatu rincian, kita tidak seharusnya mengisinya sebagai fakta pasti.'], takeaway: 'Sebutkan sumber untuk setiap klaim dan jelaskan batas bukti yang digunakan.', prompt: 'Susun satu klaim tentang hijrah, lalu tulis sumber yang mendukung dan bagian yang masih perlu diteliti.', illustration: 'history-scroll', illustrationAlt: 'Gulungan catatan, peta, dan pena sebagai lambang penelitian sejarah.', reference: 'Al-Qur’an, Surah At-Tawbah [9]:40 dan Al-Hashr [59]:9; Sahih al-Bukhari 3911 dan 4093.' },
      ],
    },
    prophets: {
      title: 'Nabi Ibrahim: tauhid, keberanian, dan doa',
      pages: [
        { title: 'Mengajak kaumnya berpikir', kind: 'Kisah Nabi Ibrahim', paragraphs: ['Nabi Ibrahim mengajak kaumnya memikirkan apakah berhala yang mereka sembah dapat memberi manfaat atau pertolongan.', 'Ia menggunakan pertanyaan untuk menunjukkan bahwa benda buatan tidak layak disembah. Kisah ini menggambarkan keteguhan Nabi Ibrahim menyeru kepada tauhid.'], illustration: 'ibrahim-sky', illustrationAlt: 'Langit malam dengan bintang, bulan, dan matahari sebagai lambang ajakan Nabi Ibrahim untuk berpikir.', reference: 'Al-Qur’an, Surah Al-Anbiya [21]:51–67.' },
        { title: 'Pertolongan Allah', kind: 'Kisah Nabi Ibrahim', paragraphs: ['Kaumnya memutuskan untuk membakar Nabi Ibrahim. Allah menjadikan api itu dingin dan aman baginya.', 'Al-Qur’an menuturkan peristiwa ini sebagai pertolongan Allah. Kita membaca kisahnya dengan memperhatikan ayat dan tidak menambahkan rincian yang tidak disebutkan sumber.'], illustration: 'ibrahim-fire', illustrationAlt: 'Api yang berubah menjadi cahaya hangat di antara batu-batu, tanpa menampilkan Nabi Ibrahim.', reference: 'Al-Qur’an, Surah Al-Anbiya [21]:68–70.' },
        { title: 'Doa bagi Makkah dan keluarga', kind: 'Kisah Nabi Ibrahim', paragraphs: ['Nabi Ibrahim berdoa agar Makkah menjadi negeri yang aman dan agar dirinya serta keturunannya dijauhkan dari penyembahan berhala.', 'Dalam doanya, Nabi Ibrahim juga memohon agar dirinya dan keturunannya menegakkan salat serta agar Allah menerima doa mereka.'], illustration: 'ibrahim-prayer', illustrationAlt: 'Lembah Makkah, rumah suci, dan langit senja sebagai lambang doa Nabi Ibrahim.', reference: 'Al-Qur’an, Surah Ibrahim [14]:35–41.' },
        { title: 'Membaca kisah dengan teliti', kind: 'Makna dan telaah', paragraphs: ['Kisah Nabi Ibrahim menampilkan keteguhan tauhid, penggunaan akal untuk mengajak berpikir, serta doa bagi keamanan dan keluarga.', 'Dalam telaah tingkat lanjut, bedakan pesan utama ayat dari tafsir dan rincian yang berasal dari sumber lain. Sampaikan perbedaan itu dengan hormat.'], takeaway: 'Belajar agama perlu keteguhan, keterbukaan untuk berpikir, dan kehati-hatian pada sumber.', prompt: 'Bagaimana membedakan pesan yang jelas tertulis dalam ayat dari penjelasan penafsir?', illustration: 'ibrahim-prayer', illustrationAlt: 'Lembah Makkah dan lembar catatan sebagai lambang doa serta pembelajaran.', reference: 'Al-Qur’an, Surah Al-Anbiya [21]:51–70 dan Ibrahim [14]:35–41.' },
      ],
    },
  },
};

const LEVEL_LABELS = { tk: 'TK', sd: 'SD', smp: 'SMP', sma: 'SMA' };

function lessonContent(level, index) {
  const base = LEVEL_STORIES[level][index];
  const extension = STORYBOOK_EXTENSIONS[level]?.[themes[index].id];
  return extension ? { ...base, ...extension } : base;
}

function pageCountForLesson(lesson, theme) {
  return lesson.pages?.length || (theme.id === 'alphabet' ? 3 : 2);
}

function storybookFor(level) {
  const lessons = LEVEL_STORIES[level];
  if (!lessons) return null;
  let nextPage = 1;
  const catalogLessons = lessons.map((_lesson, index) => {
    const lesson = lessonContent(level, index);
    const theme = themes[index];
    const pageCount = pageCountForLesson(lesson, theme);
    const firstPage = nextPage;
    nextPage += pageCount;
    return {
      id: theme.id,
      title: lesson.title,
      category: theme.shortTitle,
      themeTitle: theme.title,
      page: firstPage,
      pageCount,
      pageTitles: lesson.pages?.map((page) => page.title) || [],
      illustration: theme.illustration,
    };
  });
  return {
    id: 'kisah-kecil-nusantara',
    title: 'Kisah Kecil Nusantara',
    level: LEVEL_LABELS[level],
    levelId: level,
    description: 'Cerita bergambar tentang sejarah, agama Islam, kisah para nabi, huruf A–Z, serta hewan.',
    pageCount: nextPage - 1,
    lessons: catalogLessons,
  };
}

function storybookPage(level, rawPage) {
  const lessons = LEVEL_STORIES[level];
  const totalPages = lessons?.reduce((total, _lesson, index) => total + pageCountForLesson(lessonContent(level, index), themes[index]), 0) || 0;
  if (!lessons || !Number.isInteger(rawPage) || rawPage < 1 || rawPage > totalPages) return null;
  let firstPage = 1;
  let lessonIndex = -1;
  let pageIndex = -1;
  for (let index = 0; index < lessons.length; index += 1) {
    const pageCount = pageCountForLesson(lessonContent(level, index), themes[index]);
    if (rawPage >= firstPage && rawPage < firstPage + pageCount) {
      lessonIndex = index;
      pageIndex = rawPage - firstPage;
      break;
    }
    firstPage += pageCount;
  }
  if (lessonIndex < 0) return null;
  const lesson = lessonContent(level, lessonIndex);
  const theme = themes[lessonIndex];
  const page = lesson.pages?.[pageIndex];
  const lessonPageCount = pageCountForLesson(lesson, theme);
  const isAlphabetList = theme.id === 'alphabet' && pageIndex > 0;
  const alphabetRange = pageIndex === 1 ? alphabet.slice(0, 13) : alphabet.slice(13);
  const illustration = page?.illustration || theme.illustration;
  const defaultIllustrationAlt = {
    history: 'Panorama desa lama sebagai gambaran kehidupan masa lalu.',
    values: 'Dua anak saling berbagi makanan.',
    'islam-history': 'Peta simbolis perjalanan hijrah dari Makkah menuju Madinah, tanpa menggambarkan sosok manusia.',
    prophets: 'Simbol kisah para nabi tanpa menggambarkan sosok nabi.',
    alphabet: 'Huruf A sampai Z yang dihias dengan gambar hewan.',
    animals: 'Poster bergambar hewan yang hidup di kolam dan tepian.',
  };
  return {
    number: rawPage,
    lessonId: theme.id,
    lessonPageIndex: pageIndex,
    lessonPageCount,
    title: page?.title || (pageIndex === 0 ? lesson.title : (theme.id === 'alphabet' ? (pageIndex === 1 ? 'Huruf A–M' : 'Huruf N–Z') : 'Yang kita pelajari')),
    category: theme.shortTitle,
    section: theme.title,
    kind: page?.kind || (pageIndex === 0 ? 'Kisah' : (isAlphabetList ? 'Belajar huruf' : 'Yang kita pelajari')),
    paragraphs: page?.paragraphs || (pageIndex === 0
      ? lesson.story
      : (isAlphabetList
        ? [
          pageIndex === 1 ? 'Kita mulai dari A sampai M. Perhatikan bentuk huruf dan bunyi awal pada setiap nama hewan.' : 'Sekarang lanjutkan dari N sampai Z. Beberapa nama hewan berasal dari bahasa lain dan dapat kita cari bersama.',
          'Bacalah hurufnya, sebutkan namanya, lalu coba temukan hewan atau kata lain yang kamu kenal.',
        ]
        : lesson.learn)),
    prompt: page ? page.prompt : lesson.prompt,
    takeaway: page?.takeaway,
    reference: page?.reference ?? lesson.reference,
    illustration,
    illustrationAlt: page?.illustrationAlt || defaultIllustrationAlt[illustration],
    alphabet: isAlphabetList ? alphabetRange : undefined,
  };
}

module.exports = { storybookFor, storybookPage, LEVEL_LABELS };
