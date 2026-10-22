const API = (window.CERDAS_CONFIG?.apiBaseUrl || `${window.location.origin}/api`).replace(/\/$/, '');
const letters = ['A', 'B', 'C', 'D'];
const state = {
  books: [], curricula: [], activeBook: null, catalogBook: null,
  curriculumCatalog: null, activeMaterial: null, materialPages: [], mode: 'quiz', catalogRequestId: 0,
  storyCatalog: null, storyLessonId: '', storyRequestId: 0,
  curriculum: 'merdeka', phase: '', page: 0, busy: false,
  transitionId: 0, largeType: false, sound: false, studentId: getStudentId(), progress: readProgress(),
  ...readAuthState(),
  accountMode: 'login', authRequired: false, appLoaded: false, googleLoginEnabled: false, googleButtonRendered: false, offlineQueue: readOfflineQueue(), syncing: false, schoolId: getSchoolId(), schoolCatalog: [], classRows: [], accountRows: [], progressSnapshot: null, dialogReturnFocus: null, catalogReturnFocus: null, storyReturnFocus: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const bookGrid = $('#book-grid');
const reader = $('#reader');
const rightPage = $('#right-page');
const flip = $('#page-flip');
const catalogDialog = $('#catalog-dialog');
const storybookDialog = $('#storybook-dialog');
const resultsDialog = $('#results-dialog');
let toastTimer;
let swipeStart = null;

function getStudentId() {
  try {
    const account = JSON.parse(localStorage.getItem('cerdas-cermat-account') || 'null');
    return localStorage.getItem('cerdas-cermat-token') && account?.id ? account.id : '';
  } catch { return ''; }
}

function getSchoolId() { try { return localStorage.getItem('cerdas-cermat-school-id') || ''; } catch { return ''; } }

function readAuthState() {
  try { return { token: localStorage.getItem('cerdas-cermat-token') || '', account: JSON.parse(localStorage.getItem('cerdas-cermat-account') || 'null') }; }
  catch { return { token: '', account: null }; }
}

function readProgress() {
  try {
    const id = getStudentId();
    return id ? JSON.parse(localStorage.getItem(`cerdas-cermat-progress:${id}`) || '{}') : {};
  } catch { return {}; }
}

function readOfflineQueue() {
  try { return JSON.parse(localStorage.getItem('cerdas-cermat-offline-queue') || '[]'); } catch { return []; }
}

function saveOfflineQueue() {
  try { localStorage.setItem('cerdas-cermat-offline-queue', JSON.stringify(state.offlineQueue)); } catch { showToast('Penyimpanan perangkat penuh. Hubungkan ke internet untuk menyimpan progres.'); }
}

function saveProgress() {
  try { localStorage.setItem(`cerdas-cermat-progress:${state.studentId}`, JSON.stringify(state.progress)); } catch { /* Cache lokal bersifat tambahan; API tetap menjadi penyimpanan utama saat online. */ }
}

function escaped(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function safeJson(response) {
  const contentType = response?.headers?.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }
  return {};
}

function setSyncStatus(online, detail = '') {
  const status = $('#sync-status');
  if (!status) return;
  const waiting = state.offlineQueue.length;
  status.classList.toggle('is-offline', !online || waiting > 0);
  status.textContent = !online ? `Offline${waiting ? ` · ${waiting} menunggu` : ''}` : waiting ? `${state.syncing ? 'Menyinkronkan' : 'Menunggu sinkronisasi'} · ${waiting}` : detail || 'Online';
  status.title = waiting ? `${waiting} perubahan tersimpan di perangkat dan menunggu sinkronisasi.` : online ? 'API tersambung.' : 'Konten yang pernah dibuka dapat tersedia di perangkat ini.';
}

function updateAccountControls() {
  $('#account-link').textContent = state.account ? `${state.account.name} · Akun` : 'Masuk';
  const teacherCmsBtn = $('#teacher-cms-link');
  if (teacherCmsBtn) {
    teacherCmsBtn.hidden = !state.account || !['teacher', 'admin'].includes(state.account.role);
  }
  if (window.CerdasPillars?.loadAdaptiveProfile) {
    window.CerdasPillars.loadAdaptiveProfile();
  }
}

function cacheKey(url) { return `cerdas-cermat-cache:${url}`; }

function storeCachedRead(url, data) {
  try { localStorage.setItem(cacheKey(url), JSON.stringify({ savedAt: Date.now(), data })); } catch { /* Cache offline bersifat tambahan. */ }
}

function readCachedRead(url) {
  try { return JSON.parse(localStorage.getItem(cacheKey(url)) || 'null')?.data || null; } catch { return null; }
}

function updateAnsweredFromSync(item, result) {
  if (!item.url.endsWith('/api/answer')) return;
  try {
    const body = JSON.parse(item.options.body);
    const key = body.subjectId === 'matematika' ? `${body.bookId}:${body.curriculum}:${body.phase}` : `${body.bookId}:${body.curriculum}:${body.phase}:${body.subjectId}`;
    state.progress[key] ||= { answers: {}, page: 0 };
    const prior = state.progress[key].answers[body.questionId] || {};
    state.progress[key].answers[body.questionId] = { ...prior, correct: result.correct, correctChoice: result.correctChoice, explanation: result.explanation, pending: false };
    saveProgress();
    if (state.activeBook?.id === body.bookId && state.activeMaterial?.subject.id === body.subjectId) {
      const question = document.querySelector(`[data-question="${CSS.escape(body.questionId)}"]`);
      if (question) {
        question.querySelectorAll('.choice').forEach((button, index) => {
          button.classList.remove('is-correct', 'is-wrong', 'is-selected');
          button.disabled = true;
          if (index === result.correctChoice) button.classList.add('is-correct');
          if (index === body.choice && !result.correct) button.classList.add('is-wrong');
          if (index === body.choice && result.correct) button.classList.add('is-selected');
        });
        const feedback = question.querySelector('.question-feedback');
        if (feedback) { feedback.classList.toggle('is-wrong', !result.correct); feedback.textContent = `${result.correct ? 'Benar.' : 'Belum tepat.'} ${result.explanation}`; }
      }
    }
  } catch { /* Antrian yang tidak dapat dibaca akan dicoba ulang dari penyimpanan lokal. */ }
}

async function flushOfflineQueue() {
  if (state.syncing || !state.account || !state.token || !navigator.onLine || !state.offlineQueue.length) return;
  state.syncing = true;
  setSyncStatus(true);
  try {
    while (state.offlineQueue.length && navigator.onLine) {
      const batch = [];
      for (const queued of state.offlineQueue.slice(0, 100)) {
        try {
          const body = JSON.parse(queued.options.body);
          if (state.account && body.studentId !== state.account.id) break;
          batch.push({ path: new URL(queued.url, location.href).pathname, body });
        } catch { break; }
      }
      if (!batch.length) break;
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (state.token) headers.set('Authorization', `Bearer ${state.token}`);
      const response = await fetch(`${API}/sync/progress`, { method: 'POST', headers, body: JSON.stringify({ operations: batch }) });
      const data = await safeJson(response);
      if (!response.ok) { showToast(`Sinkronisasi gagal: ${data.message || data.error || 'coba lagi nanti.'}`); break; }
      batch.forEach((operation, index) => updateAnsweredFromSync(state.offlineQueue[index], data.results[index]));
      state.offlineQueue.splice(0, batch.length);
      saveOfflineQueue();
    }
  } catch (error) { showToast(`Sinkronisasi gagal: ${error.message}`); }
  finally {
    state.syncing = false;
    setSyncStatus(navigator.onLine);
    if (state.offlineQueue.length && navigator.onLine) showToast('Sebagian progres masih menunggu sinkronisasi.');
  }
}

async function request(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set('Authorization', `Bearer ${state.token}`);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  let response = null;
  try {
    response = await fetch(url, { ...options, method, headers, signal: controller.signal });
    const data = await safeJson(response);
    if (!response.ok) {
      const error = new Error(data.message || data.error || 'Terjadi kesalahan pada layanan.');
      error.status = response.status; error.code = data.code;
      throw error;
    }
    setSyncStatus(true);
    if (method === 'GET') storeCachedRead(url, data);
    else void flushOfflineQueue();
    return data;
  } catch (error) {
    if (method === 'GET') {
      const cached = readCachedRead(url);
      if (cached) { setSyncStatus(false); return { ...cached, _offline: true }; }
    }
    const queueable = !response && ['PUT', 'POST'].includes(method) && /\/api\/(answer|progress|reading-progress)$/.test(new URL(url, location.href).pathname);
    if (queueable) {
      state.offlineQueue.push({ url, options: { ...options, method, headers: Object.fromEntries(headers.entries()) }, queuedAt: new Date().toISOString() });
      saveOfflineQueue(); setSyncStatus(false); showToast('Progres tersimpan di perangkat dan akan disinkronkan saat online.');
      return { saved: false, queued: true, pending: true };
    }
    setSyncStatus(navigator.onLine);
    if (error && error.name === 'AbortError') error.message = 'Permintaan melewati batas waktu. Periksa koneksi lalu coba lagi.';
    throw error;
  } finally { clearTimeout(timeout); }
}

function contextKey(book = state.activeBook, curriculum = state.curriculum, phase = state.phase, subjectId = state.activeMaterial?.subject.id || 'matematika') {
  const base = `${book.id}:${curriculum}:${phase}`;
  return subjectId === 'matematika' ? base : `${base}:${subjectId}`;
}

function activePageCount() {
  return state.mode === 'lesson' ? (state.materialPages.length || 4) : (state.activeBook?.pageCount || 0);
}

function currentBookProgress() {
  const key = contextKey();
  if (!state.progress[key]) state.progress[key] = { answers: {}, page: 0 };
  return state.progress[key];
}

function pageSavedAnswers() {
  return currentBookProgress().answers;
}

function renderBooks() {
  bookGrid.innerHTML = state.books.map((book) => {
    const answered = Object.entries(state.progress)
      .filter(([key]) => key.startsWith(`${book.id}:`))
      .reduce((sum, [, saved]) => sum + Object.keys(saved.answers || {}).length, 0);
    return `<button class="book-card" type="button" data-book="${escaped(book.id)}">
      <span class="book-3d" style="--book-color:${book.color};--book-accent:${book.accent}">
        <span class="book-spine-title">Cerdas Cermat&nbsp; ${escaped(book.level)}</span>
        <span class="book-crest">✳</span><span class="book-overline">PETA MATERI</span>
        <span class="book-name">Cerdas<br />Cermat</span><span class="book-rule"></span><span class="book-level">${escaped(book.level)}</span>
        <span class="book-motto">${escaped(book.tagline.toUpperCase())}</span><span class="book-base"></span>
      </span><span class="book-card-label">${escaped(book.level)} · ${answered} JAWABAN TERSIMPAN</span></button>`;
  }).join('');
}

async function loadSubjectOptions(preferredSubject = '', preferredTopic = '') {
  const book = state.catalogBook;
  if (!book) return;
  const requestId = ++state.catalogRequestId;
  const curriculum = $('#curriculum-select').value;
  const phase = $('#phase-select').value;
  $('#subject-value').disabled = true;
  $('#topic-value').disabled = true;
  $('#start-book').disabled = true;
  try {
    const query = new URLSearchParams({ curriculum, phase });
    const catalog = await request(`${API}/catalog/${book.id}/subjects?${query}`);
    if (requestId !== state.catalogRequestId || state.catalogBook !== book) return;
    try { state.progressSnapshot = await request(`${API}/progress/${encodeURIComponent(state.studentId)}`); } catch { state.progressSnapshot = null; }
    state.schoolCatalog = [];
    if (state.schoolId) {
      try {
        const school = await request(`${API}/schools/${encodeURIComponent(state.schoolId)}/catalog`);
        state.schoolCatalog = (school.subjects || []).filter((item) => item.level === book.id && item.phase === phase && (!item.curriculum || item.curriculum === curriculum));
        catalog.subjects.push(...state.schoolCatalog.map((item) => ({
          id: `local-${item.id}`, name: item.title, availability: 'local', availabilityLabel: 'Muatan lokal sekolah', family: 'society', localContentId: item.id,
          topics: [{ id: item.topicId || `local-topic-${item.id}`, title: item.title, objective: item.objectives?.[0] || item.title, quizAvailable: false, publicationStatus: 'published', localContentId: item.id }],
        })));
      } catch { /* Pilihan lokal sekolah hanya ditambahkan saat katalog sekolah tersedia. */ }
    }
    state.curriculumCatalog = catalog;
    const selectedPhase = curriculumPhasesFor(book, curriculum).find((item) => item.id === phase);
    if (selectedPhase) $('#phase-select').selectedOptions[0].textContent = phaseDisplayLabel(book, selectedPhase, curriculum);
    $('#subject-value').innerHTML = catalog.subjects.map((subject) => `<option value="${escaped(subject.id)}">${escaped(subject.name)} · ${escaped(subject.availabilityLabel)}</option>`).join('');
    const preferred = catalog.subjects.find((subject) => subject.id === preferredSubject)
      || catalog.subjects.find((subject) => subject.id === 'matematika')
      || catalog.subjects[0];
    if (!preferred) throw new Error('Belum ada mata pelajaran pada fase ini.');
    $('#subject-value').value = preferred.id;
    renderTopicOptions(preferred.id, preferredTopic);
    $('#catalog-level-copy').textContent = `Buku ${book.level} · ${catalog.phase.label}. Pilih mata pelajaran dan materi untuk mulai belajar.`;
    $('#catalog-note').textContent = catalog.curriculumNote;
  } catch (error) {
    if (requestId === state.catalogRequestId) {
      $('#catalog-level-copy').textContent = error.message;
      $('#subject-value').innerHTML = '';
      $('#topic-value').innerHTML = '';
    }
  } finally {
    if (requestId === state.catalogRequestId) {
      $('#subject-value').disabled = false;
      $('#topic-value').disabled = false;
      $('#start-book').disabled = !$('#topic-value').value;
    }
  }
}

function renderTopicOptions(subjectId, preferredTopic = '') {
  const subject = state.curriculumCatalog?.subjects.find((item) => item.id === subjectId);
  if (!subject) return;
  const book = state.catalogBook;
  const curriculum = $('#curriculum-select').value;
  const phase = $('#phase-select').value;
  const base = book ? `${book.id}:${curriculum}:${phase}` : '';
  const key = subject.id === 'matematika' ? base : `${base}:${subject.id}`;
  const savedPack = state.progressSnapshot?.progress?.[key] || state.progress[key];
  $('#topic-value').innerHTML = subject.topics.map((topic) => {
    const readKey = `${base}:${subject.id}:${topic.id}`;
    const savedRead = state.progressSnapshot?.readingProgress?.[readKey];
    const readPage = typeof savedRead === 'object' ? savedRead.page : savedRead;
    const completedQuiz = window.CerdasUI.isCompletedQuiz(state.progressSnapshot?.attempts || [], { subjectId: subject.id, bookId: book?.id, phase, curriculum });
    const status = topic.quizAvailable
      ? window.CerdasUI.quizProgressLabel(completedQuiz, Object.keys(savedPack?.answers || {}).length, book?.questionCount || 50)
      : Number(readPage) >= 3 ? ' · selesai dibaca' : Number(readPage) > 0 ? ' · lanjutkan membaca' : '';
    const publication = window.CerdasUI.publicationLabel(topic.publicationStatus);
    return `<option value="${escaped(topic.id)}">${escaped(topic.title)}${topic.quizAvailable ? ' · 50 soal' : ''}${status}${publication}</option>`;
  }).join('');
  $('#topic-value').value = subject.topics.some((topic) => topic.id === preferredTopic) ? preferredTopic : subject.topics[0]?.id || '';
}

function renderContents(pages, activeIndex = 0) {
  $('#contents-list').innerHTML = pages.map((page, index) => `<button type="button" class="contents-item ${index === activeIndex ? 'active' : ''}" data-goto-page="${index}"><span>${escaped(page.title)}</span><span class="leader"></span><span class="contents-page">${String(index + 1).padStart(2, '0')}</span></button>`).join('');
}

function curriculumPhasesFor(book, curriculum) {
  return book.curriculumPhases?.[curriculum] || book.phases;
}

function phaseDisplayLabel(_book, phase) {
  return phase.label;
}

function renderPhaseOptions(book, selectedPhase, curriculum) {
  const phases = curriculumPhasesFor(book, curriculum);
  $('#phase-select').innerHTML = phases.map((phase) => `<option value="${escaped(phase.id)}">${escaped(phaseDisplayLabel(book, phase))}</option>`).join('');
  const resolvedPhase = phases.some((phase) => phase.id === selectedPhase) ? selectedPhase : phases[0]?.id || '';
  $('#phase-select').value = resolvedPhase;
  $('#phase-field-label').querySelector('span').textContent = curriculum === 'merdeka'
    ? (book.id === 'tk' ? 'Fase / kelompok usia' : 'Fase / kelas')
    : (book.id === 'tk' ? 'Kelompok usia' : 'Kelas');
  $('#subject-field-label').querySelector('span').textContent = book.id === 'tk' ? 'Elemen / area belajar' : 'Mata pelajaran';
  $('#topic-field-label').querySelector('span').textContent = book.id === 'tk' ? 'Materi / aktivitas' : 'Materi';
  return resolvedPhase;
}

function openCatalog(bookId) {
  const book = state.books.find((item) => item.id === bookId);
  if (!book) return;
  state.catalogBook = book;
  state.catalogReturnFocus = document.activeElement;
  $('#catalog-level-copy').textContent = `Menyiapkan materi buku ${book.level}…`;
  $('#curriculum-select').innerHTML = state.curricula.map((item) => `<option value="${escaped(item.id)}">${escaped(item.name)}${item.status === 'Arsip' ? ' · Arsip' : ''}</option>`).join('');
  $('#curriculum-select').value = state.curricula.some((item) => item.id === state.curriculum) ? state.curriculum : 'merdeka';
  const selectedPhase = renderPhaseOptions(book, state.phase || book.defaultPhase, $('#curriculum-select').value);
  $('#catalog-note').textContent = 'Memuat peta mata pelajaran dan materi…';
  catalogDialog.classList.add('is-open');
  catalogDialog.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('#curriculum-select').focus();
  loadSubjectOptions();
}

function closeCatalog() {
  catalogDialog.classList.remove('is-open');
  catalogDialog.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.catalogRequestId += 1;
  state.catalogBook = null;
  state.catalogReturnFocus?.focus?.();
}

function renderStoryOptions(catalog) {
  state.storyCatalog = catalog;
  state.storyLessonId ||= catalog.lessons[0]?.id || '';
  $('#storybook-level-copy').textContent = `${catalog.level} · ${catalog.lessons.length} bab, ${catalog.pageCount} halaman bergambar. Pilih satu kisah untuk mulai membaca.`;
  $('#storybook-lessons').innerHTML = catalog.lessons.map((lesson) => `<button class="storybook-lesson-option ${lesson.id === state.storyLessonId ? 'is-selected' : ''}" type="button" data-story-lesson="${escaped(lesson.id)}" aria-pressed="${lesson.id === state.storyLessonId}">
    <span class="storybook-lesson-number">${String(catalog.lessons.indexOf(lesson) + 1).padStart(2, '0')}</span><span class="storybook-lesson-text"><strong>${escaped(lesson.category)}</strong><span>${escaped(lesson.title)}</span></span><span class="storybook-lesson-arrow" aria-hidden="true">→</span>
  </button>`).join('');
  $('#start-storybook').disabled = !catalog.lessons.some((lesson) => lesson.id === state.storyLessonId);
}

async function loadStoryCatalog(level = $('#storybook-level').value) {
  const requestId = ++state.storyRequestId;
  state.storyLessonId = '';
  $('#start-storybook').disabled = true;
  $('#storybook-lessons').innerHTML = '<p>Memuat daftar cerita…</p>';
  try {
    const catalog = await request(`${API}/storybook/${encodeURIComponent(level)}`);
    if (requestId !== state.storyRequestId) return;
    state.storyLessonId = catalog.lessons[0]?.id || '';
    renderStoryOptions(catalog);
  } catch (error) {
    if (requestId === state.storyRequestId) $('#storybook-lessons').innerHTML = `<p class="storybook-error">${escaped(error.message)}</p>`;
  }
}

function openStorybookDialog() {
  state.storyReturnFocus = document.activeElement;
  storybookDialog.classList.add('is-open');
  storybookDialog.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  loadStoryCatalog();
  $('#storybook-level').focus();
}

function closeStorybookDialog() {
  storybookDialog.classList.remove('is-open');
  storybookDialog.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.storyRequestId += 1;
  state.storyReturnFocus?.focus?.();
}

function storyContents(catalog) {
  return catalog.lessons.flatMap((lesson) => Array.from({ length: lesson.pageCount }, (_, pageIndex) => ({
    title: lesson.pageTitles?.[pageIndex]
      ? `${lesson.category} · ${lesson.pageTitles[pageIndex]}`
      : (pageIndex === 0
        ? `${lesson.category} · ${lesson.title}`
        : (lesson.id === 'alphabet' ? `${lesson.category} · Huruf ${pageIndex === 1 ? 'A–M' : 'N–Z'}` : `${lesson.category} · Yang kita pelajari`)),
  })));
}

async function openStorybook() {
  const catalog = state.storyCatalog;
  const lesson = catalog?.lessons.find((item) => item.id === state.storyLessonId);
  if (!catalog || !lesson) return;
  state.transitionId += 1;
  state.busy = false;
  state.activeBook = { id: 'storybook', title: catalog.title, level: catalog.level, levelId: catalog.levelId, pageCount: catalog.pageCount };
  state.activeMaterial = { id: lesson.id, subject: { id: 'storybook', name: lesson.category } };
  state.mode = 'storybook';
  state.curriculum = 'cerita';
  state.phase = catalog.levelId;
  state.storyLessonId = lesson.id;
  const progressKey = `storybook:${catalog.levelId}:${lesson.id}`;
  let savedPage = 0;
  try {
    const saved = await request(`${API}/reading-progress/${encodeURIComponent(state.studentId)}?key=${encodeURIComponent(progressKey)}`);
    savedPage = Math.max(0, Math.min(Number(saved.page) || 0, lesson.pageCount - 1));
  } catch { /* Buku cerita tetap dapat dibaca jika backend progres tidak tersedia. */ }
  state.page = lesson.page - 1 + savedPage;
  $('#open-book').dataset.level = catalog.levelId;
  $('#reader-book-title').textContent = catalog.title;
  $('#reader-level').textContent = catalog.level;
  $('#left-level-label').textContent = `Cerita bergambar · ${catalog.level}`;
  $('#reader-subject').textContent = lesson.category;
  renderContents(storyContents(catalog), state.page);
  closeStorybookDialog();
  reader.classList.add('is-open');
  reader.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  await loadPage(state.page);
  $('#close-reader').focus();
}

async function openBook(bookId = state.catalogBook?.id, curriculum = $('#curriculum-select').value, phase = $('#phase-select').value, subjectId = $('#subject-value').value, topicId = $('#topic-value').value) {
  const book = state.books.find((item) => item.id === bookId);
  const subject = state.curriculumCatalog?.subjects.find((item) => item.id === subjectId);
  const topic = subject?.topics.find((item) => item.id === topicId);
  if (!book || !subject || !topic) return;
  state.transitionId += 1;
  state.busy = false;
  state.activeBook = book;
  state.activeMaterial = { ...topic, subject };
  state.curriculum = curriculum;
  state.phase = phase;
  $('#open-book').dataset.level = book.id;
  state.mode = topic.quizAvailable ? 'quiz' : 'lesson';
  state.materialPages = [];
  const query = new URLSearchParams({ curriculum, phase });
  const key = contextKey(book, curriculum, phase, subjectId);
  if (state.mode === 'quiz') {
    const cached = state.progress[key] || { answers: {}, page: 0 };
    try {
      const query = new URLSearchParams({ bookId, curriculum, phase, subjectId });
      const data = await request(`${API}/progress/${encodeURIComponent(state.studentId)}?${query}`);
      state.progress[key] = data.progress;
    } catch (error) {
      state.progress[key] = cached;
      showToast(`Progres lokal dibuka. ${error.message}`);
    }
    const saved = currentBookProgress();
    state.page = Math.max(0, Math.min(saved.page || 0, book.pageCount - 1));
  } else {
    try {
      const progressKey = `${bookId}:${curriculum}:${phase}:${subjectId}:${topicId}`;
      const data = await request(`${API}/reading-progress/${encodeURIComponent(state.studentId)}?key=${encodeURIComponent(progressKey)}`);
      state.page = Math.max(0, Math.min(Number(data.page) || 0, 3));
      state.materialProgressKey = progressKey;
    } catch { state.page = 0; }
  }
  $('#reader-book-title').textContent = book.title;
  $('#reader-level').textContent = book.level;
  $('#left-level-label').textContent = `${state.curricula.find((item) => item.id === curriculum)?.name || 'Kurikulum Merdeka'} · ${state.curriculumCatalog?.phase.label || phase}`;
  $('#reader-subject').textContent = subject.name;
  if (state.mode === 'lesson') {
    try {
      const pageUrl = topic.localContentId
        ? `${API}/schools/${encodeURIComponent(state.schoolId)}/materials/${encodeURIComponent(topic.localContentId)}/pages/1`
        : `${API}/materials/${bookId}/${subjectId}/${topicId}/pages/1?${query}`;
      const response = await request(pageUrl);
      state.materialPages = Array.from({ length: response.material.pageCount }, (_, index) => ({ number: index + 1, title: response.material.pages?.[index]?.title || ['Tujuan belajar', 'Gagasan utama', 'Ayo mencoba', 'Refleksi'][index] || `Halaman ${index + 1}` }));
      state.page = Math.min(state.page, Math.max(0, state.materialPages.length - 1));
    } catch (error) {
      showRetryToast(error.message, () => openBook(bookId, curriculum, phase, subjectId, topicId));
      state.activeBook = null;
      return;
    }
  }
  const contents = state.mode === 'quiz' ? book.pages : state.materialPages;
  renderContents(contents, state.page);
  closeCatalog();
  reader.classList.add('is-open');
  reader.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  await loadPage(state.page);
  $('#close-reader').focus();
}

function renderQuestions(page) {
  $('#question-list').classList.remove('lesson-content');
  const answers = pageSavedAnswers();
  $('#question-list').innerHTML = page.questions.map((question, index) => {
    const answer = answers[question.id];
    const answered = Boolean(answer);
    const feedback = answered ? `<div class="question-feedback ${answer.pending ? 'is-pending' : answer.correct ? '' : 'is-wrong'}" role="status" aria-live="polite">${answer.pending ? 'Tersimpan di perangkat. Menunggu pemeriksaan saat online.' : `${answer.correct ? 'Benar.' : 'Belum tepat.'} ${escaped(answer.explanation)}`}</div>` : '';
    return `<article class="question" data-question="${escaped(question.id)}">
      <p class="question-prompt"><span class="question-index">${(page.startQuestion || ((state.page * 3) + 1)) + index}.</span>${escaped(question.prompt)}</p>
      <div class="choice-list">${question.choices.map((choice, choiceIndex) => {
        let className = 'choice';
        if (answered && !answer.pending && choiceIndex === answer.correctChoice) className += ' is-correct';
        if (answered && !answer.pending && choiceIndex === answer.choice && !answer.correct) className += ' is-wrong';
        if (answered && (answer.pending || answer.correct) && choiceIndex === answer.choice) className += ' is-selected';
        return `<button type="button" class="${className}" data-choice="${choiceIndex}" data-question-id="${escaped(question.id)}" ${answered ? 'disabled' : ''}><span class="choice-letter">${letters[choiceIndex]}.</span><span>${escaped(choice)}</span></button>`;
      }).join('')}</div>${feedback}
    </article>`;
  }).join('');
  updateFinishButton();
}

function renderLesson(page) {
  const content = $('#question-list');
  content.classList.add('lesson-content');
  content.innerHTML = `<p class="lesson-lead">${escaped(page.paragraphs[0] || '')}</p>${(page.paragraphs.slice(1)).map((paragraph) => `<p>${escaped(paragraph)}</p>`).join('')}${window.CerdasUI.renderActivity(page.activity)}<span class="lesson-review">Materi ringkas awal · perlu telaah guru</span>`;
  const reviewBadge = content.querySelector('.lesson-review');
  if (reviewBadge) reviewBadge.textContent = state.activeMaterial.publicationStatus === 'published' ? 'Materi tervalidasi dan dipublikasikan' : 'Draf materi · perlu ditelaah guru';
  updateFinishButton();
}

const storyIllustrationSources = {
  history: '/assets/storybook/history-scroll.jpg',
  values: '/assets/storybook/values-sharing.png',
  'first-revelation': '/assets/storybook/first-revelation.svg',
  'islam-history': '/assets/storybook/hijrah-map.svg',
  'madinah-welcome': '/assets/storybook/madinah-welcome.svg',
  'adam-garden': '/assets/storybook/adam-garden.svg',
  'noah-ark': '/assets/storybook/noah-ark.svg',
  'yusuf-story': '/assets/storybook/yusuf-story.svg',
  'yusuf-well': '/assets/storybook/yusuf-story.svg',
  'yusuf-grain': '/assets/storybook/yusuf-story.svg',
  'yusuf-reunion': '/assets/storybook/yusuf-story.svg',
  'musa-call': '/assets/storybook/musa-story.svg',
  'musa-dialogue': '/assets/storybook/musa-story.svg',
  'musa-sea': '/assets/storybook/musa-story.svg',
  'ibrahim-sky': '/assets/storybook/ibrahim-story.svg',
  'ibrahim-fire': '/assets/storybook/ibrahim-story.svg',
  'ibrahim-prayer': '/assets/storybook/ibrahim-story.svg',
  'history-scroll': '/assets/storybook/history-scroll.jpg',
  prophets: '/assets/storybook/prophets-symbols.svg',
  alphabet: '/assets/storybook/alphabet-animals.png',
  animals: '/assets/storybook/animals-habitat.jpg',
};

function storyIllustration(type, alt) {
  const source = storyIllustrationSources[type] || storyIllustrationSources.animals;
  return `<img class="story-illustration story-illustration--${escaped(type)}" src="${source}" alt="${escaped(alt)}" loading="lazy" />`;
}

function renderStoryPage(page) {
  const content = $('#question-list');
  content.classList.remove('lesson-content');
  const paragraphs = page.paragraphs.map((paragraph, index) => `<p${index === 0 ? ' class="story-lead"' : ''}>${escaped(paragraph)}</p>`).join('');
  const alphabet = page.alphabet ? `<div class="alphabet-grid" aria-label="Contoh kata dari huruf A sampai Z">${page.alphabet.map(({ letter, word }) => `<span><b>${escaped(letter)}</b><small>${escaped(word)}</small></span>`).join('')}</div>` : '';
  const takeaway = page.takeaway ? `<aside class="story-meaning"><strong>Makna</strong><span>${escaped(page.takeaway)}</span></aside>` : '';
  const reference = page.reference ? `<p class="story-reference"><strong>Rujukan</strong>${escaped(page.reference)}</p>` : '';
  const prompt = page.prompt ? `<p class="story-prompt"><strong>Ayo pikirkan</strong>${escaped(page.prompt)}</p>` : '';
  content.innerHTML = `<figure class="story-figure">${storyIllustration(page.illustration, page.illustrationAlt)}<figcaption>${escaped(page.section)} · ${escaped(page.kind)}</figcaption></figure><div class="story-copy">${paragraphs}${alphabet}${takeaway}${reference}${prompt}</div>`;
  updateFinishButton();
}

function updateFinishButton() {
  const lastPage = state.activeBook && state.page === (state.mode === 'lesson' ? (state.materialPages.length || 4) - 1 : state.activeBook.pageCount - 1);
  const answers = state.mode === 'quiz' ? Object.values(currentBookProgress().answers || {}) : [];
  const answeredCount = answers.length;
  const pendingAnswers = answers.some((answer) => answer.pending);
  const complete = answeredCount === state.activeBook?.questionCount && !pendingAnswers;
  $('#next-page').hidden = Boolean(lastPage);
  $('#finish-quiz').hidden = !lastPage;
  $('#finish-quiz').disabled = !lastPage || (state.mode === 'quiz' && !complete);
  $('#finish-quiz').innerHTML = state.mode === 'lesson' || state.mode === 'storybook' ? 'Selesai membaca <span aria-hidden="true">✓</span>' : 'Selesaikan kuis <span aria-hidden="true">✓</span>';
  if (state.mode === 'quiz' && lastPage && !complete) $('#finish-quiz').textContent = pendingAnswers ? 'Menunggu sinkronisasi' : `Jawab semua soal (${answeredCount}/${state.activeBook.questionCount})`;
  if (state.mode === 'lesson' && state.activeMaterial?.quizId) {
    $('#finish-quiz').innerHTML = 'Mulai kuis · 50 soal <span aria-hidden="true">→</span>';
  }
  $('#restart-quiz').hidden = state.mode !== 'quiz';
}

function saveInBackground(url, options) {
  request(url, options).catch((error) => showRetryToast(`Progres belum tersimpan: ${error.message}`, () => saveInBackground(url, options)));
}

async function loadPage(pageIndex, shouldAnimate = false, direction = 'forward') {
  if (!state.activeBook || state.busy || pageIndex < 0 || pageIndex >= activePageCount()) return;
  $('#open-book').dataset.mode = state.mode;
  $('#page-instruction').hidden = state.mode === 'storybook' || (state.activeBook.id === 'tk' && state.mode === 'quiz');
  const transitionId = ++state.transitionId;
  const book = state.activeBook;
  const curriculum = state.curriculum;
  const phase = state.phase;
  state.busy = shouldAnimate;
  if (shouldAnimate) {
    flip.classList.remove('is-flipping', 'backwards');
    const front = flip.querySelector('.flip-front');
    front.innerHTML = rightPage.innerHTML;
    front.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    void flip.offsetWidth;
    flip.classList.add('is-flipping');
    if (direction === 'backward') flip.classList.add('backwards');
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 730;
    await new Promise((resolve) => window.setTimeout(resolve, duration));
  }
  try {
    const query = new URLSearchParams({ curriculum, phase });
    let page;
    if (state.mode === 'storybook') {
      const response = await request(`${API}/storybook/${book.levelId}/pages/${pageIndex + 1}`);
      page = response.page;
    } else if (state.mode === 'lesson') {
      const { subject, id: topicId } = state.activeMaterial;
      const response = state.activeMaterial.localContentId
        ? await request(`${API}/schools/${encodeURIComponent(state.schoolId)}/materials/${encodeURIComponent(state.activeMaterial.localContentId)}/pages/${pageIndex + 1}`)
        : await request(`${API}/materials/${book.id}/${subject.id}/${topicId}/pages/${pageIndex + 1}?${query}`);
      page = response.page;
    } else {
      const subjectId = state.activeMaterial.subject.id;
      const response = await request(`${API}/quizzes/${book.id}/${subjectId}/pages/${pageIndex + 1}?${query}`);
      page = response.page;
    }
    if (transitionId !== state.transitionId || state.activeBook !== book) return;
    state.page = pageIndex;
    if (state.mode === 'storybook') state.activeMaterial = { id: page.lessonId, subject: { id: 'storybook', name: page.category } };
    $('#reader-subject').textContent = state.activeMaterial.subject.name;
    $('#page-book-label').textContent = state.activeBook.title;
    $('#page-counter').textContent = `Halaman ${pageIndex + 1}`;
    const totalPages = state.mode === 'lesson' ? (state.materialPages.length || 4) : state.activeBook.pageCount;
    $('#page-progress-count').textContent = `${String(pageIndex + 1).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`;
    $('#page-section-label').textContent = state.mode === 'storybook'
      ? `CERITA BERGAMBAR · ${page.category.toUpperCase()}`
      : state.mode === 'lesson'
        ? 'MATERI BELAJAR'
        : (state.activeMaterial?.subject.id === 'matematika' ? 'LEMBAR LATIHAN' : 'KUIS LATIHAN · DRAF');
    $('#quiz-page-title').textContent = page.title;
    $('#right-page-number').textContent = state.mode === 'lesson' || state.mode === 'storybook' ? String(pageIndex + 1) : String(page.startQuestion);
    $('#page-instruction').textContent = state.mode === 'lesson' ? 'Baca, pahami, lalu ceritakan kembali.' : 'Lingkari jawaban yang paling tepat.';
    $('#reader-progress-text').textContent = state.mode === 'lesson' || state.mode === 'storybook' ? `Halaman ${pageIndex + 1} dari ${totalPages}` : `Halaman ${pageIndex + 1} dari ${totalPages} · ${state.activeBook.questionCount} soal`;
    $('#progress-fill').style.width = `${((pageIndex + 1) / totalPages) * 100}%`;
    $('#indicator-current').textContent = String(pageIndex + 1).padStart(2, '0');
    $('#indicator-total').textContent = String(totalPages).padStart(2, '0');
    $('#previous-page').disabled = pageIndex === 0;
    if (state.mode === 'storybook') {
      renderStoryPage(page);
      const storyProgressKey = `storybook:${book.levelId}:${page.lessonId}`;
      saveInBackground(`${API}/reading-progress`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: state.studentId, key: storyProgressKey, page: page.lessonPageIndex }) });
    } else if (state.mode === 'lesson') {
      renderLesson(page);
      saveInBackground(`${API}/reading-progress`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: state.studentId, key: state.materialProgressKey, page: pageIndex }) });
    } else {
      renderQuestions(page);
      const saved = currentBookProgress();
      saved.page = pageIndex;
      saveProgress();
      saveInBackground(`${API}/progress`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: state.studentId, bookId: state.activeBook.id, curriculum: state.curriculum, phase: state.phase, subjectId: state.activeMaterial.subject.id, page: pageIndex }) });
    }
    $('#contents-list').querySelectorAll('.contents-item').forEach((item, index) => item.classList.toggle('active', index === pageIndex));
    if (state.sound && shouldAnimate) playPageSound();
    renderBooks();
  } catch (error) {
    if (transitionId === state.transitionId) showRetryToast(error.message, () => loadPage(pageIndex, false, direction));
  } finally {
    if (transitionId === state.transitionId && shouldAnimate) {
      flip.classList.remove('is-flipping', 'backwards');
      flip.style.display = 'none';
      void flip.offsetWidth;
      flip.style.display = '';
    }
    if (transitionId === state.transitionId) state.busy = false;
  }
}

function playPageSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const buffer = context.createBuffer(1, context.sampleRate * 0.13, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length) ** 2;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = 'lowpass'; filter.frequency.value = 1350; gain.gain.value = 0.12;
    source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(context.destination); source.start();
    source.onended = () => context.close();
  } catch { /* Suara halaman opsional; animasi tetap berjalan. */ }
}

async function chooseAnswer(button) {
  if (state.busy || button.disabled) return;
  const questionId = button.dataset.questionId;
  const choice = Number(button.dataset.choice);
  const questionCard = button.closest('.question');
  const bookId = state.activeBook.id;
  const curriculum = state.curriculum;
  const phase = state.phase;
  const subjectId = state.activeMaterial.subject.id;
  const savedKey = contextKey(state.activeBook, curriculum, phase, subjectId);
  questionCard.querySelectorAll('.choice').forEach((choiceButton) => { choiceButton.disabled = true; });
  try {
    const result = await request(`${API}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: state.studentId, bookId, curriculum, phase, subjectId, questionId, choice }) });
    state.progress[savedKey] ||= { answers: {}, page: 0 };
    if (result.pending) {
      state.progress[savedKey].answers[questionId] = { choice, pending: true };
      saveProgress();
      questionCard.querySelectorAll('.choice').forEach((choiceButton) => { choiceButton.disabled = true; if (Number(choiceButton.dataset.choice) === choice) choiceButton.classList.add('is-selected'); });
      const pending = document.createElement('div'); pending.className = 'question-feedback is-pending'; pending.setAttribute('role', 'status'); pending.setAttribute('aria-live', 'polite'); pending.textContent = 'Tersimpan di perangkat. Menunggu pemeriksaan saat online.'; questionCard.append(pending);
      updateFinishButton();
      return;
    }
    state.progress[savedKey].answers[questionId] = { choice, correct: result.correct, correctChoice: result.correctChoice, explanation: result.explanation };
    saveProgress();
    questionCard.querySelectorAll('.choice').forEach((choiceButton, index) => {
      choiceButton.disabled = true;
      if (index === result.correctChoice) choiceButton.classList.add('is-correct');
      if (index === choice && !result.correct) choiceButton.classList.add('is-wrong');
      if (index === choice && result.correct) choiceButton.classList.add('is-selected');
    });
    const feedback = document.createElement('div');
    feedback.className = `question-feedback ${result.correct ? '' : 'is-wrong'}`;
    feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');

    if (result.correct) {
      feedback.textContent = `Benar. ${result.explanation}`;
    } else {
      feedback.innerHTML = `
        <p style="margin:0 0 6px;"><strong>Belum tepat.</strong> ${escaped(result.explanation)}</p>
        <div class="feedback-sm2-actions" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px;">
          <span style="font-size:9.5px;color:#71746b;">Paham materi ini?</span>
          <button type="button" class="sm2-action-btn" data-action="understood" data-qid="${escaped(questionId)}" style="border:1px solid #759273;background:#eef5ec;border-radius:3px;padding:3px 8px;font-size:9.5px;cursor:pointer;color:#284f2c;">✓ Paham (Jadwalkan SM-2)</button>
          <button type="button" class="sm2-action-btn" data-action="ai-tutor" data-qid="${escaped(questionId)}" data-explanation="${escaped(result.explanation)}" style="border:1px solid #c9a444;background:#fff8e6;border-radius:3px;padding:3px 8px;font-size:9.5px;cursor:pointer;color:#775211;">✨ Tanya Tutor AI</button>
        </div>
      `;
    }
    questionCard.append(feedback);

    // Call adaptive answer API in background to update XP, streaks, and SM-2 queue
    fetch(`${API}/adaptive/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(window.CerdasPillars ? {} : {}) },
      body: JSON.stringify({
        studentId: state.studentId,
        questionId,
        choice,
        level: bookId,
        curriculum,
        phase,
        subjectId,
      }),
    }).then((res) => res.json()).then((adaptiveRes) => {
      if (adaptiveRes.adaptive) {
        const lvlEl = document.querySelector('#user-adaptive-level');
        const xpEl = document.querySelector('#user-adaptive-xp');
        if (lvlEl && xpEl) {
          lvlEl.textContent = `Level ${adaptiveRes.adaptive.levelNumber} (${adaptiveRes.adaptive.levelName})`;
          xpEl.textContent = `${adaptiveRes.adaptive.xp} XP`;
        }
      }
      if (adaptiveRes.completed50) {
        showToast('🎖️ Selamat! Kamu telah menyelesaikan 50 soal! Lencana "Penjelajah 50 Soal" terbuka.');
      }
    }).catch(() => {});

    if (result.correct) showToast('Jawabanmu benar. +15 XP! Hebat!');
    else showToast('Belum tepat. Coba baca pembahasan atau Tanya Tutor AI.');
    updateFinishButton();
    renderBooks();
  } catch (error) {
    questionCard.querySelectorAll('.choice').forEach((choiceButton) => { choiceButton.disabled = false; });
    showRetryToast(error.message, () => chooseAnswer(button));
  }
}

async function finishQuiz() {
  if (!state.activeBook) return;
  if (state.mode === 'storybook') {
    showToast('Cerita selesai dibaca. Pilih bab lain dari daftar isi kapan saja.');
    closeReader();
    return;
  }
  if (state.mode === 'lesson') {
    const subject = state.activeMaterial.subject;
    const quizTopic = subject.topics?.find((topic) => topic.quizAvailable && topic.quizId === state.activeMaterial.quizId && (!state.activeMaterial.nextTopicId || topic.id === state.activeMaterial.nextTopicId));
    if (!quizTopic) {
      showToast('Materi selesai dibaca. Pilih materi lain dari rak buku.');
      closeReader();
      return;
    }
    $('#finish-quiz').disabled = true;
    state.mode = 'quiz';
    state.activeMaterial = { ...quizTopic, subject };
    state.materialPages = [];
    const progressKey = contextKey();
    try {
      const query = new URLSearchParams({ bookId: state.activeBook.id, curriculum: state.curriculum, phase: state.phase, subjectId: subject.id });
      const saved = await request(`${API}/progress/${encodeURIComponent(state.studentId)}?${query}`);
      state.progress[progressKey] = saved.progress;
    } catch { /* Gunakan progres kuis yang sudah tersimpan di peramban. */ }
    state.page = Math.max(0, Math.min(currentBookProgress().page || 0, state.activeBook.pageCount - 1));
    renderContents(state.activeBook.pages, state.page);
    $('#finish-quiz').disabled = false;
    await loadPage(state.page);
    showToast(`Materi selesai. Kuis ${subject.name} dimulai.`);
    return;
  }
  if (Object.values(currentBookProgress().answers || {}).some((answer) => answer.pending)) {
    showToast('Jawaban tersimpan di perangkat dan menunggu sinkronisasi. Hasil belum dapat dihitung.');
    return;
  }
  try {
    const data = await request(`${API}/results`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: state.studentId, bookId: state.activeBook.id, curriculum: state.curriculum, phase: state.phase, subjectId: state.activeMaterial.subject.id }) });
    $('#result-score').textContent = String(data.result.score);
    $('#result-summary').textContent = `${data.result.correct} dari ${data.result.total} jawaban benar · ${data.result.subject} · ${data.result.topic}`;
    $('#result-recommendation').textContent = data.recommendation;
    resultsDialog.classList.add('is-open');
    resultsDialog.setAttribute('aria-hidden', 'false');
    $('#close-results').focus();
  } catch (error) {
    showRetryToast(error.message, finishQuiz);
  }
}

async function restartQuiz() {
  if (!state.activeBook || state.mode !== 'quiz') return;
  const confirmed = window.confirm('Mulai percobaan baru? Hasil yang sudah selesai tetap tersimpan, dan jawaban percobaan aktif akan diarsipkan.');
  if (!confirmed) return;
  try {
    const result = await request(`${API}/attempts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: state.studentId, bookId: state.activeBook.id, curriculum: state.curriculum, phase: state.phase, subjectId: state.activeMaterial.subject.id }) });
    const key = contextKey();
    state.progress[key] = { page: 0, answers: {}, attemptId: result.attemptId };
    saveProgress(); state.page = 0;
    renderContents(state.activeBook.pages, 0);
    await loadPage(0);
    showToast('Percobaan baru dimulai. Hasil sebelumnya tetap tersimpan.');
  } catch (error) { showRetryToast(`Percobaan baru belum dimulai: ${error.message}`, restartQuiz); }
}

function closeReader() {
  const focusBookId = state.activeBook?.id;
  state.transitionId += 1;
  flip.classList.remove('is-flipping', 'backwards');
  flip.style.display = 'none';
  void flip.offsetWidth;
  flip.style.display = '';
  reader.classList.remove('is-open');
  reader.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.activeBook = null;
  state.busy = false;
  renderBooks();
  if (focusBookId === 'storybook') $('#open-storybook').focus();
  else document.querySelector(`[data-book="${CSS.escape(focusBookId || '')}"]`)?.focus();
}

function closeResults() {
  resultsDialog.classList.remove('is-open');
  resultsDialog.setAttribute('aria-hidden', 'true');
  if (reader.classList.contains('is-open')) $('#close-reader').focus();
}

function showToast(message) {
  const toast = $('#toast');
  $('#toast-message').textContent = message;
  $('#toast-retry').hidden = true;
  $('#toast-retry').onclick = null;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function showRetryToast(message, retry) {
  showToast(message);
  const button = $('#toast-retry');
  button.hidden = false;
  button.onclick = () => { button.hidden = true; button.onclick = null; clearTimeout(toastTimer); $('#toast').classList.remove('is-visible'); retry(); };
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => $('#toast').classList.remove('is-visible'), 7000);
}

function renderGoogleButton() {
  const section = $('#google-login-section');
  const shouldShow = !state.account && state.accountMode === 'login' && state.googleLoginEnabled;
  section.hidden = !shouldShow;
  $('#account-auth-divider').hidden = !shouldShow;
  if (!shouldShow || state.googleButtonRendered || !window.google?.accounts?.id) return;
  window.google.accounts.id.renderButton($('#google-login-button'), { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: Math.min(300, $('#google-login-section').clientWidth), locale: 'id' });
  state.googleButtonRendered = true;
}

async function loadGoogleLogin() {
  if (state.account || state.googleLoginEnabled) return;
  try {
    const config = await request(`${API}/auth/config`);
    if (!config.googleEnabled || !config.googleClientId) return;
    state.googleLoginEnabled = true;
    const render = () => renderGoogleButton();
    if (window.google?.accounts?.id) { render(); return; }
    const existing = document.querySelector('#google-identity-services');
    const script = existing || document.createElement('script');
    if (!existing) {
      script.id = 'google-identity-services';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.google.accounts.id.initialize({ client_id: config.googleClientId, callback: handleGoogleCredential, auto_select: false });
        render();
      };
      script.onerror = () => { $('#google-login-note').textContent = 'Tombol Google tidak dapat dimuat. Masuk dengan email dan kata sandi.'; };
      document.head.append(script);
    } else {
      script.addEventListener('load', () => {
        window.google.accounts.id.initialize({ client_id: config.googleClientId, callback: handleGoogleCredential, auto_select: false });
        render();
      }, { once: true });
    }
  } catch (error) {
    $('#google-login-note').textContent = `Login Google belum dapat diperiksa: ${error.message}`;
  }
}

function openAccountDialog() {
  state.dialogReturnFocus = document.activeElement;
  const dialog = $('#account-dialog');
  const signedIn = Boolean(state.account);
  $('#account-error').textContent = '';
  $('#account-form').hidden = signedIn;
  $('#account-session-actions').hidden = !signedIn;
  const pickerEl = $('#account-picker');
  if (pickerEl) pickerEl.hidden = true;
  $('#close-account').hidden = false;

  const mode = state.accountMode || 'login';
  const isRegister = mode === 'register';

  const kicker = dialog.querySelector('.auth-kicker');
  if (kicker) {
    kicker.textContent = signedIn ? 'AKUN AKTIF' : isRegister ? 'PENDAFTARAN AKUN (MAKS 4 PER EMAIL)' : 'RUANG BELAJAR CERDAS CERMAT';
  }

  $('#account-name-label').hidden = !isRegister;
  $('#account-role-field').hidden = !isRegister;
  $('#account-invite-field').hidden = !isRegister || $('#account-role').value === 'student';

  $('#account-name').disabled = !isRegister;
  $('#account-name').required = isRegister;

  $('#account-email-label').hidden = false;
  $('#account-email').disabled = false;
  $('#account-email').required = true;
  $('#account-email').readOnly = false;

  const hintEl = $('#account-email-hint');
  if (hintEl) hintEl.hidden = !isRegister;

  $('#account-password-label').hidden = false;
  $('#account-password').disabled = false;
  $('#account-password').required = true;

  const forgotRow = $('#account-password-wrapper');
  if (forgotRow) forgotRow.hidden = signedIn || isRegister;

  $('#google-login-section').hidden = signedIn;
  $('#account-auth-divider').hidden = signedIn;
  $('#account-mode-toggle').hidden = signedIn;

  if (signedIn) {
    $('#account-title').textContent = `Halo, ${state.account.name}.`;
    const roleText = state.account.role === 'admin' ? 'Admin / Developer' : state.account.role === 'teacher' ? 'Guru' : state.account.role === 'reviewer' ? 'Reviewer' : 'Siswa';
    $('#account-copy').textContent = `${state.account.email} · ${roleText}. Progres tersimpan di akun ini.`;
    const nameEl = $('#account-display-name');
    if (nameEl) nameEl.textContent = state.account.name;
    const metaEl = $('#account-display-meta');
    if (metaEl) metaEl.textContent = `${state.account.email} · ${roleText}`;
  } else if (isRegister) {
    $('#account-title').textContent = 'Buat akun belajar.';
    $('#account-copy').textContent = 'Daftar untuk menyimpan progres bacaan dan kuis belajarmu (maksimal 4 akun per email).';
    $('#account-submit').textContent = 'Buat Akun (Maks 4)';
    $('#account-mode-toggle').innerHTML = 'Sudah punya akun? <span>Masuk</span>';
  } else {
    $('#account-title').textContent = 'Masuk ke akun belajar.';
    $('#account-copy').textContent = 'Masuk untuk melanjutkan perjalanan belajarmu.';
    $('#account-submit').textContent = 'Masuk ke Akun';
    $('#account-mode-toggle').innerHTML = 'Belum punya akun? <span>Buat akun</span>';
  }

  dialog.classList.toggle('auth-required', false);
  dialog.classList.add('is-open');
  dialog.setAttribute('aria-hidden', 'false');

  if (signedIn) {
    $('#account-logout').focus();
  } else if (isRegister) {
    $('#account-name').focus();
  } else {
    $('#account-email').focus();
  }
  if (!signedIn) renderGoogleButton();
}

const resetState = {
  email: '',
  expectedOtp: '',
  accounts: [],
  selectedAccountId: '',
};

function openResetPasswordDialog() {
  state.dialogReturnFocus = document.activeElement;
  const resetDialog = $('#reset-password-dialog');
  const accountDialog = $('#account-dialog');
  if (accountDialog && accountDialog.classList.contains('is-open')) {
    accountDialog.classList.remove('is-open');
    accountDialog.setAttribute('aria-hidden', 'true');
  }

  const existingEmail = $('#account-email')?.value?.trim() || '';
  if (existingEmail) {
    $('#reset-email').value = existingEmail;
  }
  $('#reset-step1-error').textContent = '';
  $('#reset-step2-error').textContent = '';

  $('#reset-request-form').hidden = false;
  $('#reset-verify-form').hidden = true;
  $('#reset-success-view').hidden = true;
  $('#reset-password-title').innerHTML = 'Atur ulang <em>kata sandi.</em>';
  $('#reset-password-copy').textContent = 'Masukkan email terdaftar untuk menerima kode verifikasi OTP 6-digit.';

  resetDialog.classList.add('is-open');
  resetDialog.setAttribute('aria-hidden', 'false');
  $('#reset-email').focus();
}

function closeResetPasswordDialog() {
  const dialog = $('#reset-password-dialog');
  dialog.classList.remove('is-open');
  dialog.setAttribute('aria-hidden', 'true');
  (state.dialogReturnFocus || $('#account-link')).focus?.();
}

async function submitResetRequest(event) {
  event?.preventDefault();
  const errorEl = $('#reset-step1-error');
  errorEl.textContent = '';
  const email = $('#reset-email').value.trim().toLowerCase();
  const submitBtn = $('#reset-request-submit');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorEl.textContent = 'Format email tidak valid. Masukkan email yang benar.';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Mengirim kode OTP…';

  try {
    const response = await fetch(`${API}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Gagal mengirim kode OTP.');
    }

    resetState.email = email;
    resetState.expectedOtp = String(data.debugOtp || '');
    resetState.accounts = data.accounts || [];

    $('#reset-sent-notice').textContent = `Kode OTP 6-digit telah dikirim ke ${email}.`;
    const demoEl = $('#reset-demo-code');
    if (data.debugOtp) {
      demoEl.textContent = `Kode OTP (Demo): ${data.debugOtp}`;
      demoEl.hidden = false;
      $('#account-otp-input').value = data.debugOtp;
    } else {
      demoEl.hidden = true;
      $('#account-otp-input').value = '';
    }

    const pickerBox = $('#reset-account-picker');
    const selectEl = $('#reset-account-select');
    if (resetState.accounts.length > 1) {
      pickerBox.hidden = false;
      selectEl.innerHTML = `
        <option value="">Semua profil (${resetState.accounts.length} akun terdaftar)</option>
        ${resetState.accounts.map((acc) => `<option value="${escaped(acc.id)}">${escaped(acc.name)} · ${acc.role === 'admin' ? 'Admin' : acc.role === 'teacher' ? 'Guru' : acc.role === 'reviewer' ? 'Reviewer' : 'Siswa'}</option>`).join('')}
      `;
    } else {
      pickerBox.hidden = true;
      selectEl.innerHTML = '';
    }

    $('#reset-request-form').hidden = true;
    $('#reset-verify-form').hidden = false;
    $('#reset-success-view').hidden = true;
    $('#reset-password-title').innerHTML = 'Verifikasi <em>kode OTP.</em>';
    $('#reset-password-copy').textContent = 'Masukkan kode 6 digit dan buat kata sandi baru untuk akunmu.';
    $('#account-new-password').value = '';
    $('#account-confirm-password').value = '';
    $('#account-otp-input').focus();
    showToast(`Kode OTP berhasil dikirim ke ${email}.`);
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Kirim Kode OTP';
  }
}

async function resendResetOtp() {
  const errorEl = $('#reset-step2-error');
  errorEl.textContent = '';
  const email = resetState.email;
  if (!email) return;

  const resendBtn = $('#reset-resend-otp');
  resendBtn.disabled = true;
  resendBtn.textContent = 'Mengirim ulang…';

  try {
    const response = await fetch(`${API}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await safeJson(response);
    if (!response.ok) throw new Error(data.message || data.error || 'Gagal mengirim ulang OTP.');

    resetState.expectedOtp = String(data.debugOtp || '');
    const demoEl = $('#reset-demo-code');
    if (data.debugOtp) {
      demoEl.textContent = `Kode OTP (Demo): ${data.debugOtp}`;
      demoEl.hidden = false;
      $('#account-otp-input').value = data.debugOtp;
    }
    showToast('Kode OTP baru telah dikirim.');
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    resendBtn.disabled = false;
    resendBtn.textContent = 'Kirim ulang kode OTP';
  }
}

async function submitResetVerify(event) {
  event.preventDefault();
  const errorEl = $('#reset-step2-error');
  errorEl.textContent = '';

  const otp = $('#account-otp-input').value.trim();
  const newPassword = $('#account-new-password').value;
  const confirmPassword = $('#account-confirm-password').value;
  const accountId = $('#reset-account-select')?.value || '';

  // 1. Verifikasi kecocokan format kode OTP
  if (!/^\d{6}$/.test(otp)) {
    errorEl.textContent = 'Kode OTP harus berupa 6 digit angka.';
    $('#account-otp-input').focus();
    return;
  }

  // 2. Verifikasi kecocokan kode OTP yang dihasilkan di sisi klien
  if (resetState.expectedOtp && otp !== resetState.expectedOtp) {
    errorEl.textContent = 'Kode OTP yang dimasukkan tidak sesuai. Silakan periksa kembali kode Anda.';
    $('#account-otp-input').focus();
    return;
  }

  // 3. Validasi panjang account-new-password minimal 10 karakter
  if (!newPassword || newPassword.length < 10) {
    errorEl.textContent = 'Kata sandi baru minimal harus 10 karakter.';
    $('#account-new-password').focus();
    return;
  }

  // 4. Validasi kecocokan account-new-password dan account-confirm-password sebelum request API
  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru.';
    $('#account-confirm-password').focus();
    return;
  }

  const submitBtn = $('#reset-verify-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Menyimpan kata sandi baru…';

  try {
    const response = await fetch(`${API}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: resetState.email,
        otp,
        newPassword,
        confirmPassword,
        accountId,
      }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Gagal mengatur ulang kata sandi.');
    }

    $('#reset-verify-form').hidden = true;
    $('#reset-success-view').hidden = false;
    $('#reset-password-title').innerHTML = 'Sandi <em>diperbarui!</em>';
    $('#reset-password-copy').textContent = 'Kata sandi akun belajar Anda telah berhasil disimpan.';
    showToast('Kata sandi berhasil diperbarui!');
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simpan Kata Sandi Baru';
  }
}

function closeAccountDialog() {
  const dialog = $('#account-dialog');
  dialog.classList.remove('is-open');
  dialog.setAttribute('aria-hidden', 'true');
  (state.dialogReturnFocus || $('#account-link')).focus?.();
}

function openUtilityDialog(id, initialFocus) {
  state.dialogReturnFocus = document.activeElement;
  const dialog = $(`#${id}`); dialog.classList.add('is-open'); dialog.setAttribute('aria-hidden', 'false');
  (initialFocus ? $(initialFocus, dialog) : dialog.querySelector('button,input,textarea,select')).focus();
}

function closeUtilityDialog(id, returnFocus = '#account-link') {
  const dialog = $(`#${id}`); dialog.classList.remove('is-open'); dialog.setAttribute('aria-hidden', 'true');
  const target = returnFocus && $(returnFocus) && !$(returnFocus).hidden ? $(returnFocus) : state.dialogReturnFocus;
  target?.focus?.();
}

async function loadProgressSummary() {
  const summary = $('#progress-summary');
  const suggestions = $('#recommendations-list');
  $('#class-dashboard').hidden = true;
  $('#class-admin-tools').hidden = true;
  $('#school-code').value = state.schoolId;
  $('#save-school-catalog').hidden = state.account?.role !== 'admin';
  summary.textContent = 'Memuat progres…'; suggestions.textContent = 'Memuat rekomendasi…';
  openUtilityDialog('progress-dialog', '#close-progress');
  try {
    const [data, topicData, recommendationData] = await Promise.all([
      request(`${API}/progress/${encodeURIComponent(state.studentId)}`),
      request(`${API}/progress/${encodeURIComponent(state.studentId)}?view=topics`),
      request(`${API}/recommendations/${encodeURIComponent(state.studentId)}`),
    ]);
    const attempts = data.attempts || [];
    const topics = topicData.topics || [];
    const totalAnswers = Object.values(data.progress || {}).reduce((sum, pack) => sum + Object.keys(pack.answers || {}).length, 0);
    const readingCount = Object.keys(data.readingProgress || {}).length;
    summary.innerHTML = `<div class="progress-row"><strong>${totalAnswers} jawaban · ${attempts.filter((item) => item.status === 'completed' || !item.status).length} kuis selesai · ${readingCount} materi/cerita dibaca</strong><span>Identitas: ${state.account ? escaped(state.account.name) : 'tamu anonim di peramban ini'}</span></div>${topics.length ? topics.map((item) => `<div class="progress-row"><strong>${escaped(item.subject || item.subjectId || item.bookId)} · ${escaped(item.phase || '')}</strong><span>${item.latestScore === null ? `${item.answered || 0} jawaban tersimpan` : `Nilai terakhir ${item.latestScore}% · tertinggi ${item.bestScore}%`}${item.latestAt ? ` · ${new Date(item.latestAt).toLocaleDateString('id-ID')}` : ''}</span></div>`).join('') : '<div class="progress-row">Belum ada aktivitas kuis. Mulai dari rak buku.</div>'}${attempts.slice(0, 8).map((item) => `<div class="progress-row"><strong>${escaped(item.subject)} · ${item.status === 'abandoned' ? 'percobaan dihentikan' : `${item.score}%`}</strong><span>${item.completedAt ? new Date(item.completedAt).toLocaleString('id-ID') : `${item.answered || 0}/${item.total} soal dijawab`}</span></div>`).join('')}`;
    const list = recommendationData.recommendations || [];
    suggestions.innerHTML = list.length ? list.slice(0, 5).map((item) => `<div class="progress-row"><strong>${escaped(item.subject)} · ${escaped(item.topic)}</strong><span>${escaped(item.reason)}</span></div>`).join('') : '<div class="progress-row">Semua topik yang pernah dicoba sudah dikuasai dengan baik.</div>';
    if (state.account && ['teacher', 'admin'].includes(state.account.role)) await loadClassDashboard();
  } catch (error) {
    summary.innerHTML = `<div class="progress-row"><strong>Progres belum dapat dimuat.</strong><span>${escaped(error.message)}${state.account ? '' : ' Progres lokal masih tersimpan di perangkat.'}</span></div>`;
    const answered = Object.values(state.progress).reduce((sum, pack) => sum + Object.keys(pack.answers || {}).length, 0);
    suggestions.textContent = `${answered} jawaban tercatat di perangkat ini.`;
  }
}

async function loadClassDashboard() {
  const panel = $('#class-dashboard');
  const adminTools = $('#class-admin-tools');
  const summary = $('#class-dashboard-summary');
  const select = $('#class-dashboard-select');
  const isAdmin = state.account?.role === 'admin';
  panel.hidden = false;
  adminTools.hidden = !isAdmin;
  summary.textContent = 'Memuat kelas yang ditugaskan…';
  try {
    const result = await request(`${API}/classes`);
    state.classRows = result.classes || [];
    select.innerHTML = state.classRows.map((classroom) => `<option value="${escaped(classroom.id)}">${escaped(classroom.name)}</option>`).join('');
    if (isAdmin) await loadClassAdminOptions();
    if (!state.classRows.length) {
      summary.textContent = isAdmin ? 'Belum ada kelas. Buat kelas untuk mulai mengelola penugasan.' : 'Belum ada kelas yang ditugaskan ke akun ini.';
      return;
    }
    await loadClassSummary(select.value || state.classRows[0].id);
  } catch (error) { summary.textContent = `Ringkasan kelas belum dapat dimuat: ${error.message}`; }
}

async function loadClassAdminOptions() {
  const result = await request(`${API}/accounts`);
  state.accountRows = result.accounts || [];
  renderClassMembers();
}

function renderClassMembers() {
  const classroom = state.classRows.find((item) => item.id === $('#class-dashboard-select').value);
  const teachers = $('#class-teachers');
  const students = $('#class-students');
  const teacherIds = new Set(classroom?.teacherIds || []);
  const studentIds = new Set(classroom?.studentIds || []);
  teachers.innerHTML = state.accountRows.filter((item) => item.role === 'teacher').map((item) => `<option value="${escaped(item.id)}" ${teacherIds.has(item.id) ? 'selected' : ''}>${escaped(item.name)} · ${escaped(item.email)}</option>`).join('');
  students.innerHTML = state.accountRows.filter((item) => item.role === 'student').map((item) => `<option value="${escaped(item.id)}" ${studentIds.has(item.id) ? 'selected' : ''}>${escaped(item.name)} · ${escaped(item.email)}</option>`).join('');
}

async function loadClassSummary(classId) {
  const summary = $('#class-dashboard-summary');
  if (!classId) { summary.textContent = 'Pilih kelas yang ditugaskan.'; return; }
  summary.textContent = 'Memuat ringkasan kelas…';
  try {
    const query = new URLSearchParams({ classId });
    const result = await request(`${API}/analytics/class?${query}`);
    const rows = (result.summary || []).slice(0, 8);
    summary.innerHTML = `<p>${escaped(result.classroom.name)} · agregat hanya untuk anggota kelas yang ditugaskan.</p>${rows.map((item) => `<div class="progress-row"><strong>${escaped(item.subject)} · ${escaped(item.phase)}</strong><span>${item.learners} siswa · ${item.attempts} percobaan · rata-rata ${item.averageScore}%</span></div>`).join('') || '<div class="progress-row">Belum ada hasil belajar pada kelas ini.</div>'}`;
  } catch (error) { summary.textContent = `Ringkasan kelas belum dapat dimuat: ${error.message}`; }
}

async function createClass() {
  try {
    const id = $('#new-class-id').value.trim();
    const name = $('#new-class-name').value.trim();
    await request(`${API}/classes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) });
    $('#new-class-id').value = ''; $('#new-class-name').value = '';
    showToast('Kelas dibuat. Pilih kelas untuk mengatur penugasannya.');
    await loadClassDashboard();
    $('#class-dashboard-select').value = id;
    renderClassMembers();
    await loadClassSummary(id);
  } catch (error) { showToast(`Kelas belum dibuat: ${error.message}`); }
}

async function saveClassMembers() {
  const classId = $('#class-dashboard-select').value;
  if (!classId) { showToast('Pilih atau buat kelas terlebih dahulu.'); return; }
  const values = (selector) => [...$(selector).selectedOptions].map((item) => item.value);
  try {
    const result = await request(`${API}/classes/${encodeURIComponent(classId)}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherIds: values('#class-teachers'), studentIds: values('#class-students') }),
    });
    state.classRows = state.classRows.map((classroom) => classroom.id === classId ? result.classroom : classroom);
    showToast('Penugasan kelas tersimpan.');
    await loadClassSummary(classId);
  } catch (error) { showToast(`Penugasan belum tersimpan: ${error.message}`); }
}

async function establishSession(data) {
  state.token = data.token;
  state.account = data.user;
  state.studentId = data.user.id;
  localStorage.setItem('cerdas-cermat-token', state.token);
  localStorage.setItem('cerdas-cermat-account', JSON.stringify(state.account));
  localStorage.removeItem('cerdas-cermat-logged-out');
  state.progress = readProgress();
  state.progressSnapshot = null;
  state.offlineQueue = state.offlineQueue.filter((item) => {
    try { return JSON.parse(item.options.body).studentId === state.studentId; }
    catch { return false; }
  });
  saveOfflineQueue();
  state.authRequired = false;
  state.appLoaded = false;
  const mainEl = $('main');
  if (mainEl) mainEl.inert = false;
  updateAccountControls();
  closeAccountDialog();
  $('#google-login-section').hidden = true;
  $('#account-auth-divider').hidden = true;
  await loadApplication();
  setSyncStatus(navigator.onLine);
  void flushOfflineQueue();
  showToast(`Masuk sebagai ${data.user.name}.`);
}

function showAccountPicker(email, password, accounts, message) {
  $('#account-form').hidden = true;
  const pickerEl = $('#account-picker');
  pickerEl.hidden = false;
  $('#account-picker-desc').textContent = message || 'Email ini memiliki beberapa akun. Pilih profil untuk masuk:';
  const listEl = $('#account-picker-list');
  listEl.innerHTML = accounts.map((acc) => {
    const roleText = acc.role === 'admin' ? 'Admin' : acc.role === 'teacher' ? 'Guru' : acc.role === 'reviewer' ? 'Reviewer' : 'Siswa';
    return `
      <div class="account-picker-card">
        <div class="account-picker-meta">
          <strong>${escaped(acc.name)}</strong>
          <span>${escaped(acc.email)} · ${roleText}</span>
        </div>
        <button type="button" class="catalog-start account-select-btn" data-account-id="${escaped(acc.id)}">Pilih</button>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.account-select-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const accountId = btn.dataset.accountId;
      btn.disabled = true;
      btn.textContent = 'Masuk…';
      try {
        const response = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, accountId }),
        });
        const data = await safeJson(response);
        if (!response.ok) throw new Error(data.error || 'Gagal masuk ke akun yang dipilih.');
        pickerEl.hidden = true;
        await establishSession(data);
      } catch (err) {
        $('#account-error').textContent = err.message;
        pickerEl.hidden = true;
        $('#account-form').hidden = false;
      }
    });
  });
}

async function submitAccount(event) {
  event.preventDefault();
  $('#account-error').textContent = '';
  const submitBtn = $('#account-submit');
  const registering = state.accountMode === 'register';
  const email = $('#account-email').value.trim();
  const password = $('#account-password').value;

  if (!email || !password) {
    $('#account-error').textContent = 'Email dan kata sandi wajib diisi.';
    return;
  }

  const body = { email, password };
  if (registering) {
    const name = $('#account-name').value.trim();
    if (!name) {
      $('#account-error').textContent = 'Nama lengkap wajib diisi.';
      return;
    }
    Object.assign(body, {
      name,
      role: $('#account-role').value,
      inviteCode: $('#account-invite').value.trim(),
    });
  }

  submitBtn.disabled = true;
  submitBtn.textContent = registering ? 'Mendaftarkan akun…' : 'Memeriksa akun…';

  try {
    const response = await fetch(`${API}/auth/${registering ? 'register' : 'login'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data.message || data.error || (response.status === 401 ? 'Email atau kata sandi salah.' : 'Autentikasi gagal.'));
    }

    if (data.requiresAccountSelection && Array.isArray(data.accounts)) {
      showAccountPicker(email, password, data.accounts, data.message);
      return;
    }

    if (data.token && data.user) {
      await establishSession(data);
      if (registering) {
        showToast(`Akun "${data.user.name}" berhasil dibuat (${data.accountIndex || 1}/4 untuk email ini)!`);
      }
    }
  } catch (error) {
    $('#account-error').textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = registering ? 'Buat Akun (Maks 4)' : 'Masuk ke Akun';
  }
}

async function handleGoogleCredential(credentialResponse) {
  $('#account-error').textContent = '';
  try {
    const response = await fetch(`${API}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: credentialResponse.credential }),
    });
    const data = await safeJson(response);
    if (!response.ok) throw new Error(data.message || data.error || 'Login Google gagal.');
    await establishSession(data);
  } catch (error) { $('#account-error').textContent = error.message; }
}

async function loginAsDeveloper(showNotification = true, secret = '') {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (secret) headers['x-developer-secret'] = secret;
    const response = await fetch(`${API}/auth/dev-login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Akses developer ditolak.');
    }
    if (data.token && data.user) {
      await establishSession(data);
      if (showNotification) showToast('Mode Developer aktif. Selamat datang, Satrio S Utomo! ✨');
      return true;
    }
  } catch (error) {
    if (showNotification) showToast(`Akses developer ditolak: ${error.message}`);
  }
  return false;
}

async function logoutAccount() {
  try {
    await request(`${API}/auth/logout`, { method: 'POST' });
  } catch {
    /* Token sisi server berakhir saat proses dimulai ulang. */
  }
  localStorage.removeItem('cerdas-cermat-token');
  localStorage.removeItem('cerdas-cermat-account');
  localStorage.setItem('cerdas-cermat-logged-out', 'true');
  state.token = '';
  state.account = null;
  state.studentId = '';
  state.progress = {};
  state.progressSnapshot = null;
  state.authRequired = false;
  state.appLoaded = false;
  const mainEl = $('main');
  if (mainEl) mainEl.inert = false;
  state.accountMode = 'login';
  updateAccountControls();
  await loadApplication();
  showToast('Kamu telah berhasil keluar dari akun.');
  openAccountDialog();
}

async function deleteProgress() {
  if (!window.confirm('Hapus semua progres baca, jawaban, dan hasil kuis untuk identitas ini? Tindakan ini tidak dapat dibatalkan.')) return;
  try {
    await request(`${API}/progress/${encodeURIComponent(state.studentId)}`, { method: 'DELETE' });
    state.progress = {}; saveProgress();
    state.offlineQueue = state.offlineQueue.filter((item) => { try { return JSON.parse(item.options.body).studentId !== state.studentId; } catch { return true; } });
    saveOfflineQueue();
    showToast('Progres dihapus.'); await loadProgressSummary();
  } catch (error) { showToast(`Progres belum dihapus: ${error.message}`); }
}

async function loadSchoolCatalog() {
  const schoolId = $('#school-code').value.trim();
  if (!/^[a-zA-Z0-9-]{2,80}$/.test(schoolId)) { $('#school-subject-list').textContent = 'Masukkan kode sekolah yang terdiri dari 2–80 huruf, angka, atau tanda hubung.'; return; }
  state.schoolId = schoolId; localStorage.setItem('cerdas-cermat-school-id', schoolId);
  $('#school-subject-list').textContent = 'Memuat pilihan sekolah…';
  try {
    const [school, available] = await Promise.all([
      request(`${API}/schools/${encodeURIComponent(schoolId)}/catalog`),
      request(`${API}/content?type=local-subject&status=published`),
    ]);
    const selected = new Set(school.contentIds || []);
    const isAdmin = state.account?.role === 'admin';
    const items = available.contents || [];
    $('#school-subject-list').innerHTML = items.length ? items.map((item) => `<label class="progress-row"><strong><input type="checkbox" data-school-content="${escaped(item.id)}" ${selected.has(item.id) ? 'checked' : ''} ${isAdmin ? '' : 'disabled'} /> ${escaped(item.title)}</strong><span>${escaped(item.level)} · ${escaped(item.phase)} · ${escaped(item.objectives?.[0] || '')}</span></label>`).join('') : '<div class="progress-row">Belum ada muatan lokal yang dipublikasikan untuk dipilih.</div>';
    $('#save-school-catalog').hidden = !isAdmin || !items.length;
    showToast(`Pilihan muatan lokal untuk ${schoolId} dimuat.`);
  } catch (error) { $('#school-subject-list').textContent = error.message; }
}

async function saveSchoolCatalog() {
  const schoolId = $('#school-code').value.trim();
  const contentIds = [...$('#school-subject-list').querySelectorAll('[data-school-content]:checked')].map((input) => input.dataset.schoolContent);
  try {
    await request(`${API}/schools/${encodeURIComponent(schoolId)}/catalog`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentIds }) });
    state.schoolId = schoolId; localStorage.setItem('cerdas-cermat-school-id', schoolId);
    showToast('Pilihan muatan lokal sekolah disimpan. Buka ulang katalog untuk melihatnya.');
  } catch (error) { showToast(`Pilihan sekolah belum tersimpan: ${error.message}`); }
}

async function resumeLatestReading() {
  try {
    const { latest } = await request(`${API}/progress/${encodeURIComponent(state.studentId)}?view=latest-reading`);
    if (!latest) { showToast('Belum ada materi yang bisa dilanjutkan.'); return; }
    if (latest.key.startsWith('storybook:')) {
      const [, levelId, lessonId] = latest.key.split(':');
      state.storyCatalog = await request(`${API}/storybook/${encodeURIComponent(levelId)}`);
      state.storyLessonId = lessonId;
      await openStorybook();
      return;
    }
    const [bookId, curriculum, phase, subjectId, topicId] = latest.key.split(':');
    const book = state.books.find((item) => item.id === bookId);
    if (!book || !curriculum || !phase || !subjectId || !topicId) { showToast('Materi terakhir tidak tersedia di katalog saat ini.'); return; }
    openCatalog(bookId);
    $('#curriculum-select').value = curriculum;
    const selectedPhase = renderPhaseOptions(book, phase, curriculum);
    await loadSubjectOptions(subjectId, topicId);
    await openBook(bookId, curriculum, selectedPhase, subjectId, topicId);
    showToast('Membuka materi terakhir yang kamu baca.');
  } catch (error) { showRetryToast(`Materi terakhir belum dapat dibuka: ${error.message}`, resumeLatestReading); }
}

function changePage(direction) {
  const target = state.page + direction;
  if (!state.activeBook || state.busy || target < 0 || target >= activePageCount()) return;
  loadPage(target, true, direction < 0 ? 'backward' : 'forward');
}

bookGrid.addEventListener('click', (event) => {
  const card = event.target.closest('[data-book]');
  if (card) openCatalog(card.dataset.book);
});

$('#start-book').addEventListener('click', () => openBook());
$('#close-catalog').addEventListener('click', closeCatalog);
$('#cancel-catalog').addEventListener('click', closeCatalog);
catalogDialog.addEventListener('click', (event) => { if (event.target === catalogDialog) closeCatalog(); });
$('#open-storybook').addEventListener('click', openStorybookDialog);
$('#close-storybook').addEventListener('click', closeStorybookDialog);
$('#cancel-storybook').addEventListener('click', closeStorybookDialog);
storybookDialog.addEventListener('click', (event) => { if (event.target === storybookDialog) closeStorybookDialog(); });
$('#storybook-level').addEventListener('change', () => loadStoryCatalog());
$('#storybook-lessons').addEventListener('click', (event) => {
  const choice = event.target.closest('[data-story-lesson]');
  if (!choice) return;
  state.storyLessonId = choice.dataset.storyLesson;
  $('#storybook-lessons').querySelectorAll('[data-story-lesson]').forEach((item) => {
    const selected = item === choice;
    item.classList.toggle('is-selected', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  $('#start-storybook').disabled = false;
});
$('#start-storybook').addEventListener('click', openStorybook);
$('#curriculum-select').addEventListener('change', () => {
  if (state.catalogBook) renderPhaseOptions(state.catalogBook, $('#phase-select').value, $('#curriculum-select').value);
  loadSubjectOptions($('#subject-value').value, $('#topic-value').value);
});
$('#phase-select').addEventListener('change', () => loadSubjectOptions($('#subject-value').value, $('#topic-value').value));
$('#subject-value').addEventListener('change', () => renderTopicOptions($('#subject-value').value));

$('#contents-list').addEventListener('click', (event) => {
  const target = event.target.closest('[data-goto-page]');
  if (!target) return;
  const page = Number(target.dataset.gotoPage);
  if (page === state.page || state.busy) return;
  $('#open-book').classList.remove('show-contents');
  $('#contents-toggle').setAttribute('aria-expanded', 'false');
  loadPage(page, true, page < state.page ? 'backward' : 'forward');
});
$('#question-list').addEventListener('click', (event) => {
  if (event.target.closest('[data-activity-submit]')) {
    const selected = $('#question-list input[name="lesson-activity"]:checked');
    const feedback = $('#question-list .activity-feedback');
    const options = { 0: 'tried', 1: 'help', 2: 'again' };
    feedback.textContent = window.CerdasUI.activityFeedback(selected ? options[selected.value] : '');
    return;
  }
  const choice = event.target.closest('[data-choice]');
  if (choice) chooseAnswer(choice);
});
$('#previous-page').addEventListener('click', () => changePage(-1));
$('#next-page').addEventListener('click', () => changePage(1));
$('#finish-quiz').addEventListener('click', finishQuiz);
$('#close-reader').addEventListener('click', closeReader);
$('#contents-toggle').addEventListener('click', () => {
  const open = $('#open-book').classList.toggle('show-contents');
  $('#contents-toggle').setAttribute('aria-expanded', String(open));
  $('#contents-toggle').setAttribute('aria-label', open ? 'Tutup daftar isi' : 'Buka daftar isi');
});
$('#font-toggle').addEventListener('click', () => {
  state.largeType = !state.largeType;
  $('#open-book').classList.toggle('large-type', state.largeType);
  $('#font-toggle').setAttribute('aria-label', state.largeType ? 'A+ Kembalikan ukuran teks' : 'A+ Perbesar teks');
});
$('#sound-toggle').addEventListener('click', () => {
  state.sound = !state.sound;
  $('#sound-toggle').classList.toggle('sound-on', state.sound);
  showToast(state.sound ? 'Suara halaman aktif.' : 'Suara halaman dimatikan.');
});
$('#progress-link')?.addEventListener('click', loadProgressSummary);
$('#resume-link').addEventListener('click', resumeLatestReading);
$('#copy-donation-number').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText('087779026118');
    showToast('Nomor DANA berhasil disalin.');
  } catch (error) {
    showToast('Nomor tidak dapat disalin otomatis. Silakan salin nomor yang tertera.');
  }
});
$('#close-progress').addEventListener('click', () => closeUtilityDialog('progress-dialog'));
$('#close-progress-action').addEventListener('click', () => closeUtilityDialog('progress-dialog'));
$('#clear-progress').addEventListener('click', deleteProgress);
$('#class-dashboard-select').addEventListener('change', () => {
  if (state.account?.role === 'admin') renderClassMembers();
  void loadClassSummary($('#class-dashboard-select').value);
});
$('#create-class').addEventListener('click', createClass);
$('#save-class-members').addEventListener('click', saveClassMembers);
$('#load-school-catalog').addEventListener('click', loadSchoolCatalog);
$('#save-school-catalog').addEventListener('click', saveSchoolCatalog);
$('#account-link').addEventListener('click', openAccountDialog);
$('#close-account').addEventListener('click', closeAccountDialog);
$('#account-mode-toggle').addEventListener('click', () => {
  state.accountMode = state.accountMode === 'login' ? 'register' : 'login';
  openAccountDialog();
});
$('#account-picker-back')?.addEventListener('click', () => {
  const pickerEl = $('#account-picker');
  if (pickerEl) pickerEl.hidden = true;
  $('#account-form').hidden = false;
});
$('#account-create-another-btn')?.addEventListener('click', () => {
  const currentEmail = state.account?.email || '';
  state.accountMode = 'register';
  state.account = null;
  state.token = '';
  localStorage.removeItem('cerdas-cermat-token');
  localStorage.removeItem('cerdas-cermat-account');
  openAccountDialog();
  if (currentEmail) {
    $('#account-email').value = currentEmail;
  }
  $('#account-name').focus();
});
$('#account-role').addEventListener('change', () => { $('#account-invite-field').hidden = $('#account-role').value === 'student'; });
$('#account-form').addEventListener('submit', submitAccount);
$('#account-logout').addEventListener('click', logoutAccount);
$('#account-dialog').addEventListener('click', (event) => { if (event.target === $('#account-dialog')) closeAccountDialog(); });

// Reset Password Dialog Event Listeners
$('#account-forgot-link')?.addEventListener('click', openResetPasswordDialog);
$('#forgot-password-link')?.addEventListener('click', openResetPasswordDialog);
$('#close-reset-password')?.addEventListener('click', closeResetPasswordDialog);
$('#reset-cancel-step1')?.addEventListener('click', () => {
  closeResetPasswordDialog();
  openAccountDialog();
});
$('#reset-back-to-step1')?.addEventListener('click', () => {
  $('#reset-verify-form').hidden = true;
  $('#reset-request-form').hidden = false;
  $('#reset-step1-error').textContent = '';
  $('#reset-email').focus();
});
$('#reset-request-form')?.addEventListener('submit', submitResetRequest);
$('#reset-verify-form')?.addEventListener('submit', submitResetVerify);
$('#reset-resend-otp')?.addEventListener('click', resendResetOtp);
$('#reset-success-login-btn')?.addEventListener('click', () => {
  closeResetPasswordDialog();
  state.accountMode = 'login';
  openAccountDialog();
  if (resetState.email) {
    $('#account-email').value = resetState.email;
  }
  $('#account-password').value = '';
  $('#account-password').focus();
});
$('#reset-password-dialog')?.addEventListener('click', (event) => {
  if (event.target === $('#reset-password-dialog')) closeResetPasswordDialog();
});

$('#restart-quiz').addEventListener('click', restartQuiz);
$('#mobile-menu').addEventListener('click', (event) => {
  const menu = $('.topnav');
  const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
  event.currentTarget.setAttribute('aria-expanded', String(!expanded));
  menu.classList.toggle('menu-open', !expanded);
});
$('#close-results').addEventListener('click', closeResults);
$('#review-book').addEventListener('click', closeResults);
$('#finish-results').addEventListener('click', () => { closeResults(); closeReader(); });

$('#open-book').addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  swipeStart = { x: event.clientX, y: event.clientY };
});
$('#open-book').addEventListener('pointerup', (event) => {
  if (!swipeStart) return;
  const deltaX = event.clientX - swipeStart.x;
  const deltaY = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
  changePage(deltaX < 0 ? 1 : -1);
});
document.addEventListener('keydown', (event) => {
  if (catalogDialog.classList.contains('is-open') && event.key === 'Escape') { closeCatalog(); return; }
  if (storybookDialog.classList.contains('is-open') && event.key === 'Escape') { closeStorybookDialog(); return; }
  if (resultsDialog.classList.contains('is-open') && event.key === 'Escape') { closeResults(); return; }
  const openUtility = ['account-dialog', 'progress-dialog', 'reset-password-dialog'].map((id) => $(`#${id}`)).find((dialog) => dialog?.classList.contains('is-open'));
  if (openUtility && event.key === 'Escape') {
    if (openUtility.id === 'account-dialog') closeAccountDialog();
    else if (openUtility.id === 'reset-password-dialog') closeResetPasswordDialog();
    else closeUtilityDialog(openUtility.id, '#account-link');
    return;
  }
  const activeOverlay = [catalogDialog, storybookDialog, openUtility, resultsDialog, reader].find((dialog) => dialog?.classList.contains('is-open'));
  if (activeOverlay && event.key === 'Tab') {
    const dialog = activeOverlay.querySelector('[role="dialog"]') || activeOverlay;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[href], [tabindex]:not([tabindex="-1"])')].filter((item) => !item.closest('[hidden]') && item.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if (!reader.classList.contains('is-open')) return;
  if (event.key === 'Escape') closeReader();
  if (event.key === 'ArrowRight') changePage(1);
  if (event.key === 'ArrowLeft') changePage(-1);
});

async function loadApplication() {
  if (!state.account) {
    state.appLoaded = false;
    bookGrid.innerHTML = `
      <div class="loading-books guest-prompt-card">
        <p><strong>Selamat datang di Perpustakaan Cerdas Cermat!</strong></p>
        <p>Silakan masuk atau buat akun belajar untuk mulai membaca buku dan mengerjakan kuis.</p>
        <button type="button" class="catalog-start" id="guest-login-btn" style="display:inline-block;margin-top:12px;padding:9px 24px;min-height:38px;font-size:13px;border-radius:8px;cursor:pointer;">Masuk ke Akun</button>
      </div>
    `;
    $('#guest-login-btn')?.addEventListener('click', openAccountDialog);
    return;
  }
  if (state.appLoaded) return;
  state.appLoaded = true;
  try {
    const data = await request(`${API}/catalog`);
    state.books = data.books;
    state.curricula = data.curricula;
    renderBooks();
    const requestedBook = new URLSearchParams(window.location.search).get('buku');
    if (state.books.some((book) => book.id === requestedBook)) openCatalog(requestedBook);
  } catch (error) {
    bookGrid.innerHTML = `<p class="loading-books">${escaped(error.message)}</p>`;
  }
}

async function init() {
  updateAccountControls();
  setSyncStatus(navigator.onLine);
  window.addEventListener('online', () => { setSyncStatus(true); if (state.account) { showToast('Koneksi kembali. Menyinkronkan progres…'); void flushOfflineQueue(); } });
  window.addEventListener('offline', () => { setSyncStatus(false); if (state.account) showToast('Offline. Progres baru akan disimpan di perangkat sementara.'); });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((reg) => reg.update()).catch(() => setSyncStatus(navigator.onLine, 'Online'));
  }

  if (state.token && localStorage.getItem('cerdas-cermat-logged-out') !== 'true') {
    try {
      const current = await request(`${API}/auth/me`);
      state.account = current.user;
      state.studentId = current.user.id;
      state.progress = readProgress();
      const mainEl = $('main');
      if (mainEl) mainEl.inert = false;
      updateAccountControls();
      await loadApplication();
      void flushOfflineQueue();
      return;
    } catch {
      if (!navigator.onLine && state.account?.id) {
        const mainEl = $('main');
        if (mainEl) mainEl.inert = false;
        updateAccountControls();
        await loadApplication();
        return;
      }
      state.token = ''; state.account = null;
      localStorage.removeItem('cerdas-cermat-token'); localStorage.removeItem('cerdas-cermat-account');
      state.studentId = ''; state.progress = {};
    }
  }

  // Sesi belum aktif (tamu / pengunjung baru): jangan aktifkan akun developer secara otomatis
  state.authRequired = false;
  const mainEl = $('main');
  if (mainEl) mainEl.inert = false;
  updateAccountControls();
  await loadApplication();
}

init();
