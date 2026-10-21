'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { once } = require('node:events');
const { quizFor } = require('../data/quizzes');

async function freePort() {
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return port;
}

test('API memvalidasi katalog, progres, autentikasi, dan workflow review', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cerdas-cermat-api-'));
  await fs.writeFile(path.join(directory, 'progress.json'), JSON.stringify({
    progress: {}, attempts: {}, readingProgress: {},
    users: { 'existing-admin': { id: 'existing-admin', email: 'admin@example.test', name: 'Admin Sebelumnya', role: 'student', salt: 'salt-lama', passwordHash: 'hash-lama' } },
    classes: {},
  }));
  const port = await freePort();
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      PROGRESS_FILE: path.join(directory, 'progress.json'),
      CONTENT_FILE: path.join(directory, 'content.json'),
      TEACHER_INVITE_CODE: 'test-teacher-invite',
      REVIEWER_INVITE_CODE: 'test-reviewer-invite',
      ADMIN_EMAIL: 'admin@example.test',
      ADMIN_PASSWORD: 'password-admin-uji-2026',
      CORS_ORIGIN: 'http://localhost:5174',
      RATE_LIMIT: '500',
    },
    stdio: 'ignore',
  });
  t.after(async () => {
    child.kill();
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
    await fs.rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}/api`;
  let healthy = false;
  for (let index = 0; index < 60; index += 1) {
    try { if ((await fetch(`${base}/health`)).ok) { healthy = true; break; } } catch { /* Tunggu server selesai memuat penyimpanan. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(healthy, true, 'server API harus mulai');

  let defaultToken = '';
  async function call(route, { method = 'GET', body, token, unauthenticated = false } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const requestToken = token || (!unauthenticated ? defaultToken : '');
    if (requestToken) headers.Authorization = `Bearer ${requestToken}`;
    const response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function register(email, role = 'student', inviteCode) {
    return call('/auth/register', { method: 'POST', body: { email, name: 'Pengguna Uji', password: 'kata-sandi-uji-2026', role, inviteCode } });
  }

  assert.deepEqual((await call('/auth/config', { unauthenticated: true })).body, { googleEnabled: false, googleClientId: '' });
  assert.equal((await call('/catalog', { unauthenticated: true })).status, 401, 'katalog belajar harus memerlukan login');
  assert.equal((await call('/auth/google', { method: 'POST', body: { credential: 'not-a-google-token' }, unauthenticated: true })).status, 503);

  const student = await register('student@example.test');
  assert.equal(student.status, 201);
  const token = student.body.token;
  const studentId = student.body.user.id;
  defaultToken = token;

  const catalog = await call('/catalog');
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.books.length, 4);
  const validation = await call('/catalog/validate');
  assert.equal(validation.status, 200, validation.body.issues?.slice(0, 3).join('; '));

  const quizPage = await call('/quizzes/sd/matematika/pages/1?curriculum=merdeka&phase=a');
  assert.equal(quizPage.status, 200);
  assert.equal(quizPage.body.page.questions.length, 3);
  assert.equal('answer' in quizPage.body.page.questions[0], false, 'kunci jawaban tidak dikirim ke klien');
  assert.ok(['mudah', 'sedang', 'sulit'].includes(quizPage.body.page.questions[0].difficulty));
  assert.equal((await call('/quizzes/sd/matematika/pages/99?curriculum=merdeka&phase=a')).status, 404);

  assert.equal((await call(`/progress/${studentId}`, { unauthenticated: true })).status, 401);
  assert.equal((await call('/progress/other-student-0001', { token })).status, 403);
  const incomplete = await call('/results', { method: 'POST', token, body: { studentId, bookId: 'sd', curriculum: 'merdeka', phase: 'a', subjectId: 'matematika' } });
  assert.equal(incomplete.status, 409);
  assert.equal(incomplete.body.code, 'CONFLICT');

  const pages = await Promise.all([1, 2, 3, 4].map((page) => call(`/quizzes/sd/matematika/pages/${page}?curriculum=merdeka&phase=a`)));
  const firstTen = pages.flatMap((page) => page.body.page.questions).slice(0, 10);
  const savedAnswers = await Promise.all(firstTen.map((question, index) => call('/answer', {
    method: 'POST', token,
    body: { studentId, bookId: 'sd', curriculum: 'merdeka', phase: 'a', subjectId: 'matematika', questionId: question.id, choice: index % 4 },
  })));
  assert.ok(savedAnswers.every((answer) => answer.status === 200));
  const progress = await call(`/progress/${studentId}?bookId=sd&curriculum=merdeka&phase=a&subjectId=matematika`, { token });
  assert.equal(Object.keys(progress.body.progress.answers).length, 10, 'penulisan paralel tidak boleh kehilangan jawaban');
  assert.equal((await call('/results', { method: 'POST', token, body: { studentId, bookId: 'sd', curriculum: 'merdeka', phase: 'a', subjectId: 'matematika' } })).status, 409);
  assert.equal((await call('/answer', { method: 'POST', token, body: { studentId, bookId: 'sd', curriculum: 'merdeka', phase: 'a', subjectId: 'matematika', questionId: 'sd-a-matematika-q01', choice: 9 } })).status, 400);

  const syncBody = { studentId, bookId: 'sd', curriculum: 'merdeka', phase: 'a', subjectId: 'matematika' };
  const syncQuestionId = pages[3].body.page.questions[1].id;
  const rejectedSync = await call('/sync/progress', { method: 'POST', token, body: { operations: [
    { path: '/api/answer', body: { ...syncBody, questionId: syncQuestionId, choice: 1 } },
    { path: '/api/reading-progress', body: { studentId, key: 'sd:matematika:bilangan-1', page: 99 } },
  ] } });
  assert.equal(rejectedSync.status, 400);
  assert.equal(rejectedSync.body.failedIndex, 1);
  assert.equal((await call(`/progress/${studentId}?bookId=sd&curriculum=merdeka&phase=a`, { token })).body.progress.answers[syncQuestionId], undefined, 'batch gagal tidak boleh menyimpan perubahan parsial');
  const synced = await call('/sync/progress', { method: 'POST', token, body: { operations: [
    { path: '/api/answer', body: { ...syncBody, questionId: syncQuestionId, choice: 1 } },
    { path: '/api/progress', body: { ...syncBody, page: 1 } },
    { path: '/api/reading-progress', body: { studentId, key: 'sd:matematika:bilangan-1', page: 2 } },
  ] } });
  assert.equal(synced.status, 200);
  assert.equal(synced.body.count, 3);
  const syncedProgress = await call(`/progress/${studentId}?bookId=sd&curriculum=merdeka&phase=a`, { token });
  assert.ok(syncedProgress.body.progress.answers[syncQuestionId]);
  assert.equal(syncedProgress.body.progress.page, 1);
  assert.equal((await call(`/reading-progress/${studentId}?key=sd%3Amatematika%3Abilangan-1`, { token })).body.page, 2);

  const newAttempt = await call('/attempts', { method: 'POST', token, body: { studentId, bookId: 'sd', curriculum: 'merdeka', phase: 'a', subjectId: 'matematika' } });
  assert.equal(newAttempt.status, 201);
  assert.equal(newAttempt.body.saved, true);
  const attempts = await call(`/progress/${studentId}`, { token });
  assert.equal(attempts.body.attempts[0].status, 'abandoned');
  assert.equal(Object.keys((await call(`/progress/${studentId}?bookId=sd&curriculum=merdeka&phase=a`, { token })).body.progress.answers).length, 0);

  const completeQuizPages = await Promise.all(Array.from({ length: 17 }, (_, index) => call(`/quizzes/sd/matematika/pages/${index + 1}?curriculum=merdeka&phase=a`)));
  const allQuestions = completeQuizPages.flatMap((page) => page.body.page.questions);
  const expectedQuestions = quizFor('sd', 'merdeka', 'a', 'matematika').questions;
  const completedAnswers = await Promise.all(allQuestions.map((question) => call('/answer', {
    method: 'POST', token,
    body: { ...syncBody, questionId: question.id, choice: (expectedQuestions.find((item) => item.id === question.id).answer + 1) % question.choices.length },
  })));
  assert.equal(completedAnswers.length, 50);
  assert.ok(completedAnswers.every((answer) => answer.status === 200));
  const completedResult = await call('/results', { method: 'POST', token, body: syncBody });
  assert.equal(completedResult.body.result.status, 'completed');
  assert.equal(completedResult.body.result.score, 0);
  assert.match(completedResult.body.recommendation, /Ulangi materi/);
  const recommendations = await call(`/recommendations/${studentId}`, { token });
  assert.ok(recommendations.body.recommendations.some((item) => item.bookId === 'sd' && item.subjectId === 'matematika' && item.bestScore === 0));

  const teacher = await register('teacher@example.test', 'teacher', 'test-teacher-invite');
  assert.equal(teacher.body.user.role, 'teacher');
  const reviewer = await register('reviewer@example.test', 'reviewer', 'test-reviewer-invite');
  assert.equal(reviewer.body.user.role, 'reviewer');
  const draft = { id: 'uji-materi-1', schemaVersion: 1, type: 'material', title: 'Materi uji', curriculum: 'merdeka', level: 'sd', phase: 'a', subjectId: 'matematika', topicId: 'bilangan-1', objectives: ['Mengenali bilangan.'], sources: [{ title: 'Dokumen sumber', url: 'https://example.test/sumber' }], status: 'draft', reviewer: null, reviewedAt: null };
  const created = await call('/content', { method: 'POST', token: teacher.body.token, body: draft });
  assert.equal(created.status, 201, created.body.message);
  assert.equal(created.body.content.status, 'draft');
  assert.equal((await call(`/content/${draft.id}/submit`, { method: 'POST', token: teacher.body.token, body: {} })).body.content.status, 'in_review');
  assert.equal((await call(`/content/${draft.id}/approve`, { method: 'POST', token: teacher.body.token, body: {} })).status, 403);
  const approved = await call(`/content/${draft.id}/approve`, { method: 'POST', token: reviewer.body.token, body: { comment: 'Tujuan dan sumber sudah diperiksa.' } });
  assert.equal(approved.body.content.status, 'approved');
  const published = await call(`/content/${draft.id}/publish`, { method: 'POST', token: reviewer.body.token, body: {} });
  assert.equal(published.body.content.status, 'published');
  assert.equal((await call(`/content/${draft.id}`, { unauthenticated: true })).status, 401);
  assert.equal((await call(`/content/${draft.id}`)).status, 200);
  assert.equal((await call(`/content/${draft.id}`, { token: reviewer.body.token })).body.content.history.length, 4);
  const publicContent = (await call(`/content/${draft.id}`)).body.content;
  assert.equal('author' in publicContent, false);
  assert.equal('history' in publicContent, false);

  const localDraft = { id: 'mulok-sd-1', schemaVersion: 1, type: 'local-subject', title: 'Bahasa Daerah', curriculum: 'merdeka', level: 'sd', phase: 'a', subjectId: 'mulok', topicId: 'bahasa-lokal', objectives: ['Mengenal sapaan daerah.'], sources: [{ title: 'Dokumen kurikulum daerah', url: 'https://example.test/mulok' }], status: 'draft', reviewer: null, reviewedAt: null, content: { pages: [{ title: 'Sapaan', paragraphs: ['Setiap daerah memiliki ungkapan sapaan.'] }] } };
  assert.equal((await call('/content', { method: 'POST', token: teacher.body.token, body: localDraft })).status, 201);
  await call(`/content/${localDraft.id}/submit`, { method: 'POST', token: teacher.body.token, body: {} });
  await call(`/content/${localDraft.id}/approve`, { method: 'POST', token: reviewer.body.token, body: {} });
  await call(`/content/${localDraft.id}/publish`, { method: 'POST', token: reviewer.body.token, body: {} });
  const admin = await call('/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'password-admin-uji-2026' } });
  assert.equal(admin.status, 200);
  assert.equal(admin.body.user.id, 'existing-admin', 'akun email admin yang sudah ada harus dipromosikan dan dipakai ulang');
  assert.equal(admin.body.user.role, 'admin');
  const classroom = await call('/classes', { method: 'POST', token: admin.body.token, body: { id: 'kelas-uji-1', name: 'Kelas Uji 1' } });
  assert.equal(classroom.status, 201);
  const accounts = await call('/accounts', { token: admin.body.token });
  assert.ok(accounts.body.accounts.some((account) => account.id === studentId && account.role === 'student'));
  assert.equal((await call('/classes/kelas-uji-1/members', { method: 'PUT', token: admin.body.token, body: { teacherIds: [teacher.body.user.id], studentIds: [studentId] } })).status, 200);
  const assignedClasses = await call('/classes', { token: teacher.body.token });
  assert.deepEqual(assignedClasses.body.classes.map((item) => item.id), ['kelas-uji-1']);
  const classAnalytics = await call('/analytics/class?classId=kelas-uji-1', { token: teacher.body.token });
  assert.equal(classAnalytics.status, 200);
  assert.equal(classAnalytics.body.summary.find((item) => item.bookId === 'sd' && item.subjectId === 'matematika').learners, 1);
  assert.equal(JSON.stringify(classAnalytics.body).includes(studentId), false, 'hasil kelas tidak boleh mengekspos ID siswa');
  assert.equal((await call('/analytics/class?classId=kelas-uji-1', { token: reviewer.body.token })).status, 403);
  assert.equal((await call('/accounts', { token: teacher.body.token })).status, 403);
  assert.equal('studentIds' in assignedClasses.body.classes[0], false, 'daftar siswa hanya boleh dibuka admin');
  assert.equal((await call('/analytics/class', { token: teacher.body.token })).status, 404);
  assert.equal((await call('/schools/sd-sekolah/catalog', { method: 'PUT', token: teacher.body.token, body: { contentIds: [localDraft.id] } })).status, 403);
  assert.equal((await call('/schools/sd-sekolah/catalog', { method: 'PUT', token: admin.body.token, body: { contentIds: [localDraft.id] } })).body.saved, true);
  assert.equal((await call('/schools/sd-sekolah/materials/mulok-sd-1/pages/1')).body.page.title, 'Sapaan');
  const media = await call('/media', { method: 'POST', token: admin.body.token, body: { id: 'media-one', uri: '/assets/one.svg', altText: 'Ilustrasi pohon', licenseName: 'CC BY', licenseUri: 'https://example.test/license', sourceUri: 'https://example.test/asset', creator: 'Ilustrator', reviewer: 'Penelaah', reviewedAt: new Date().toISOString(), status: 'published' } });
  assert.equal(media.status, 201);
  assert.equal((await call('/media')).body.media.length, 1);
  assert.equal((await call('/analytics/class', { token: teacher.body.token })).status, 404);
  const metrics = await call('/metrics', { token: admin.body.token });
  assert.equal(metrics.status, 200);
  assert.ok(metrics.body.requests >= 1);
  assert.ok(metrics.body.responses['2xx'] >= 1);
  assert.equal(Object.keys(metrics.body.latencyBucketsMs).length, 4);
  const openapi = await call('/openapi.json');
  assert.equal(openapi.body.openapi, '3.1.0');
  assert.ok(openapi.body.paths['/sync/progress']);
  assert.ok(openapi.body.paths['/classes/{classId}/members']);
  assert.equal((await call(`/progress/${studentId}`, { method: 'DELETE', token: teacher.body.token })).status, 403);
  assert.equal((await call(`/progress/${studentId}`, { method: 'DELETE', token })).body.deleted, true);
});
