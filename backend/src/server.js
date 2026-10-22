const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { OAuth2Client } = require('google-auth-library');
const { WebSocketServer } = require('ws');
const { books, publicBook } = require('../data/books');
const { CURRICULA, phasesFor, catalogFor, lessonPages } = require('../data/curriculum-catalog');
const { quizFor } = require('../data/quizzes');
const { storybookFor, storybookPage } = require('../data/storybook');
const { createContentStore } = require('./content-store');
const { validateCatalog, validateQuestion, validateMediaAsset } = require('./validation');
const { mergeValue } = require('./state-merge');
const { calculateSM2 } = require('./sm2');
const { getTutorExplanation } = require('./ai-tutor');
const { BADGE_DEFINITIONS, getPlacementQuestions, evaluatePlacementTest } = require('./adaptive');
const { createRoom, getRoom, roomView, joinStudent, submitAnswer, nextQuestion, showReview, broadcastToRoom } = require('./live-classroom');

const port = Number(process.env.APP_PORT || (process.env.PORT && process.env.PORT !== '8080' ? process.env.PORT : 3101));
const storePath = path.resolve(process.env.PROGRESS_FILE || path.resolve(__dirname, '../data/progress.json'));
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5174,http://127.0.0.1:5174').split(',').map((origin) => origin.trim());
let store = { progress: {}, attempts: {}, readingProgress: {}, users: {}, classes: {}, bankQuestions: [] };
let writeQueue = Promise.resolve();
let databasePool = null;
let storeBaseline = null;
const sessions = new Map();
const otpStore = new Map();
const googleOAuthClient = new OAuth2Client();
const contentStore = createContentStore(path.resolve(process.env.CONTENT_FILE || path.resolve(__dirname, '../data/content.json')));
const rateWindows = new Map();
const metrics = { requests: 0, errors: 0, rateLimited: 0, storageErrors: 0, responses: { '2xx': 0, '4xx': 0, '5xx': 0 }, latencyBucketsMs: { le100: 0, le500: 0, le1000: 0, gt1000: 0 }, startedAt: Date.now() };
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1_000_000);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 10_000);
const RATE_LIMIT = Number(process.env.RATE_LIMIT || 120);
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60_000);
const developerEmail = (process.env.DEVELOPER_EMAIL || 'satriosimputra21@gmail.com').trim().toLowerCase();

async function loadStore() {
  if (process.env.DATABASE_URL) {
    let Pool;
    try {
      ({ Pool } = require('pg'));
      databasePool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_SIZE || 10), connectionTimeoutMillis: REQUEST_TIMEOUT_MS });
      await databasePool.query(await fs.readFile(path.resolve(__dirname, '../db/schema.sql'), 'utf8'));
      await databasePool.query('INSERT INTO application_state (id, payload) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING', [JSON.stringify({ progress: {}, attempts: {}, readingProgress: {}, users: {}, classes: {} })]);
      const result = await databasePool.query('SELECT payload, revision FROM application_state WHERE id = 1');
      const parsed = result.rows[0].payload;
      store = { progress: parsed.progress || {}, attempts: parsed.attempts || {}, readingProgress: parsed.readingProgress || {}, users: parsed.users || {}, classes: parsed.classes || {}, bankQuestions: parsed.bankQuestions || [] };
      storeBaseline = JSON.parse(JSON.stringify(store));
      return;
    } catch (err) {
      console.warn('[AI Studio] PostgreSQL tidak dapat digunakan, menggunakan penyimpanan lokal JSON:', err.message);
      databasePool = null;
    }
  }
  try {
    const parsed = JSON.parse(await fs.readFile(storePath, 'utf8'));
    store = { progress: parsed.progress || {}, attempts: parsed.attempts || {}, readingProgress: parsed.readingProgress || {}, users: parsed.users || {}, classes: parsed.classes || {}, bankQuestions: parsed.bankQuestions || [] };
    storeBaseline = JSON.parse(JSON.stringify(store));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Tidak dapat membaca progres tersimpan:', error.message);
  }
}

function persistStore() {
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    if (databasePool) {
      const client = await databasePool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query('SELECT payload FROM application_state WHERE id = 1 FOR UPDATE');
        const parsed = result.rows[0]?.payload || {};
        const remote = { progress: parsed.progress || {}, attempts: parsed.attempts || {}, readingProgress: parsed.readingProgress || {}, users: parsed.users || {}, classes: parsed.classes || {}, bankQuestions: parsed.bankQuestions || [] };
        const merged = mergeValue(storeBaseline, store, remote);
        await client.query('UPDATE application_state SET payload = $1::jsonb, revision = revision + 1, updated_at = now() WHERE id = 1', [JSON.stringify(merged)]);
        await syncRelationalState(client, merged, remote);
        await client.query('COMMIT');
        store = merged;
        storeBaseline = JSON.parse(JSON.stringify(merged));
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { client.release(); }
      return;
    }
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    const temporaryPath = `${storePath}.tmp`;
    const snapshot = JSON.stringify(store, null, 2);
    await fs.writeFile(temporaryPath, snapshot, 'utf8');
    await fs.rename(temporaryPath, storePath);
  });
  writeQueue.catch(() => { metrics.storageErrors += 1; });
  return writeQueue;
}

function sendJson(res, status, data) {
  let payload = data;
  if (status >= 400 && data && data.error && !data.code) {
    const code = status === 400 ? 'INVALID_REQUEST' : status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR';
    payload = { ...data, code, message: data.error };
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return;
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
        rejected = true;
        const error = new Error('Payload terlalu besar.');
        error.status = 413;
        reject(error);
      }
    });
    req.on('end', () => {
      if (rejected) return;
      try {
        const parsed = JSON.parse(body || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Format JSON tidak valid.');
        resolve(parsed);
      } catch {
        const error = new Error('Format JSON tidak valid.');
        error.status = 400;
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function validStudentId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(value);
}

function validContext(book, curriculum, phase) {
  return Boolean(book && CURRICULA.some((item) => item.id === curriculum)
    && phasesFor(book.id, curriculum).some((item) => item.id === phase));
}

function packKey(bookId, curriculum, phase, subjectId = 'matematika') {
  return subjectId === 'matematika'
    ? `${bookId}:${curriculum}:${phase}`
    : `${bookId}:${curriculum}:${phase}:${subjectId}`;
}

function getProgress(studentId, bookId, curriculum, phase, subjectId = 'matematika') {
  const studentProgress = store.progress[studentId] || {};
  return studentProgress[packKey(bookId, curriculum, phase, subjectId)] || { page: 0, answers: {} };
}

function authUser(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer ([A-Za-z0-9_-]+)$/);
  const session = match && sessions.get(match[1]);
  if (session && session.expiresAt <= Date.now()) { sessions.delete(match[1]); return null; }
  return session ? store.users[session.userId] || null : null;
}

function requireRole(user, roles) {
  if (!user) return { error: 'Masuk diperlukan untuk tindakan ini.', status: 401 };
  if (!roles.includes(user.role)) return { error: 'Peran akun tidak diizinkan untuk tindakan ini.', status: 403 };
  return null;
}

function requireOwner(user, studentId) {
  if (!user && store.users[studentId]) return { error: 'Masuk diperlukan untuk melihat progres akun.', status: 401 };
  if (user && user.role !== 'admin' && user.id !== studentId) return { error: 'Akses ke progres akun lain ditolak.', status: 403 };
  return null;
}

function safeUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function classSummary(attemptsByStudent, studentIds) {
  const groups = new Map();
  for (const studentId of studentIds) {
    const attempts = attemptsByStudent[studentId] || [];
    for (const attempt of attempts) {
      if (attempt.status !== 'completed') continue;
      const key = `${attempt.bookId}:${attempt.curriculum}:${attempt.phase}:${attempt.subjectId}`;
      const row = groups.get(key) || { bookId: attempt.bookId, curriculum: attempt.curriculum, phase: attempt.phase, subjectId: attempt.subjectId, subject: attempt.subject, topic: attempt.topic, learners: new Set(), attempts: 0, scoreTotal: 0, latestAt: '' };
      row.learners.add(studentId);
      row.attempts += 1;
      row.scoreTotal += attempt.score;
      if (attempt.completedAt > row.latestAt) row.latestAt = attempt.completedAt;
      groups.set(key, row);
    }
  }
  return [...groups.values()].map(({ learners, scoreTotal, ...row }) => ({ ...row, learners: [...learners].filter(Boolean).length, averageScore: row.attempts ? Math.round(scoreTotal / row.attempts) : 0 })).sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

function classForTeacher(classroom, userId) {
  return (classroom.teacherIds || []).includes(userId);
}

function classView(classroom) {
  return { id: classroom.id, name: classroom.name };
}

function prepareSyncOperation(operation, user) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation) || !operation.body || typeof operation.body !== 'object' || Array.isArray(operation.body)) {
    return { error: 'Setiap operasi sinkronisasi harus memiliki path dan body objek.', status: 400 };
  }
  const { path: apiPath, body } = operation;
  const { studentId } = body;
  const ownerError = requireOwner(user, studentId);
  if (ownerError) return ownerError;
  if (!validStudentId(studentId)) return { error: 'Identitas belajar tidak valid.', status: 400 };

  if (apiPath === '/api/answer') {
    const { bookId, curriculum, phase, questionId, choice, subjectId = 'matematika' } = body;
    const book = books.find((item) => item.id === bookId);
    const quiz = quizFor(bookId, curriculum, phase, subjectId);
    const question = quiz?.questions.find((item) => item.id === questionId);
    if (!validContext(book, curriculum, phase) || !quiz || !question || !Number.isInteger(choice) || choice < 0 || choice >= question.choices.length) {
      return { error: 'Jawaban sinkronisasi tidak valid.', status: 400 };
    }
    return { type: 'answer', studentId, key: packKey(bookId, curriculum, phase, subjectId), question, choice };
  }

  if (apiPath === '/api/progress') {
    const { bookId, curriculum, phase, page, subjectId = 'matematika' } = body;
    const book = books.find((item) => item.id === bookId);
    const quiz = quizFor(bookId, curriculum, phase, subjectId);
    if (!validContext(book, curriculum, phase) || !quiz || !Number.isInteger(page) || page < 0 || page >= quiz.pageCount) {
      return { error: 'Data progres sinkronisasi tidak valid.', status: 400 };
    }
    return { type: 'progress', studentId, key: packKey(bookId, curriculum, phase, subjectId), page };
  }

  if (apiPath === '/api/reading-progress') {
    const { key, page } = body;
    const maxPage = typeof key === 'string' && key.startsWith('storybook:') ? 20 : typeof key === 'string' && key.includes(':local-') ? 100 : 3;
    if (typeof key !== 'string' || !key || key.length > 240 || !Number.isInteger(page) || page < 0 || page > maxPage) {
      return { error: 'Data progres baca sinkronisasi tidak valid.', status: 400 };
    }
    return { type: 'reading-progress', studentId, key, page };
  }

  return { error: 'Path operasi sinkronisasi tidak diizinkan.', status: 400 };
}

function applySyncOperation(target, operation) {
  if (operation.type === 'answer') {
    target.progress[operation.studentId] ||= {};
    target.progress[operation.studentId][operation.key] ||= { page: 0, answers: {} };
    const question = operation.question;
    const answer = {
      choice: operation.choice,
      correct: operation.choice === question.answer,
      correctChoice: question.answer,
      explanation: question.explanation,
      answeredAt: new Date().toISOString(),
    };
    const progress = target.progress[operation.studentId][operation.key];
    progress.attemptId ||= crypto.randomUUID();
    progress.answers[question.id] = answer;
    progress.updatedAt = answer.answeredAt;
    return { correct: answer.correct, correctChoice: answer.correctChoice, explanation: answer.explanation };
  }
  if (operation.type === 'progress') {
    target.progress[operation.studentId] ||= {};
    target.progress[operation.studentId][operation.key] ||= { page: 0, answers: {} };
    target.progress[operation.studentId][operation.key].page = operation.page;
    return { saved: true, page: operation.page };
  }
  target.readingProgress[operation.studentId] ||= {};
  target.readingProgress[operation.studentId][operation.key] = { page: operation.page, updatedAt: new Date().toISOString() };
  return { saved: true, page: operation.page };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (typeof user.passwordHash !== 'string' || typeof user.salt !== 'string') return false;
  const candidate = crypto.scryptSync(password, user.salt, 64);
  return crypto.timingSafeEqual(candidate, Buffer.from(user.passwordHash, 'hex'));
}

function issueSession(user) {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
  return { token, user: safeUser(user) };
}

function rateLimitKey(req) {
  return req.socket.remoteAddress || 'unknown';
}

function rateAllowed(req) {
  const key = rateLimitKey(req);
  const now = Date.now();
  const window = rateWindows.get(key);
  if (!window || now - window.startedAt >= RATE_WINDOW_MS) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  window.count += 1;
  return window.count <= RATE_LIMIT;
}

function withRequestId(res, requestId) {
  res.setHeader('X-Request-Id', requestId);
}

function topicProgress(studentProgress, attempts) {
  const rows = new Map();
  for (const attempt of attempts) {
    if (attempt.status === 'abandoned') continue;
    const key = `${attempt.bookId}:${attempt.curriculum}:${attempt.phase}:${attempt.subjectId}`;
    const row = rows.get(key) || { bookId: attempt.bookId, curriculum: attempt.curriculum, phase: attempt.phase, subjectId: attempt.subjectId, subject: attempt.subject, topic: attempt.topic, attempts: 0, latestScore: null, latestAt: null, bestScore: 0 };
    row.attempts += 1;
    if (!row.latestAt || attempt.completedAt > row.latestAt) { row.latestAt = attempt.completedAt; row.latestScore = attempt.score; }
    row.bestScore = Math.max(row.bestScore, attempt.score);
    rows.set(key, row);
  }
  for (const [key, pack] of Object.entries(studentProgress)) {
    const row = rows.get(key) || { bookId: key.split(':')[0], subject: '', topic: '', attempts: 0, latestScore: null, latestAt: null, bestScore: 0 };
    row.answered = Object.keys(pack.answers || {}).length;
    row.lastActivityAt = Object.values(pack.answers || {}).reduce((latest, answer) => answer.answeredAt > latest ? answer.answeredAt : latest, '');
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => (b.latestAt || b.lastActivityAt || '').localeCompare(a.latestAt || a.lastActivityAt || ''));
}

function validateLearningCatalog() {
  const issues = [];
  const base = validateCatalog(books);
  issues.push(...base.issues);
  for (const book of books) for (const curriculum of CURRICULA) for (const phase of phasesFor(book.id, curriculum.id)) {
    const catalog = catalogFor(book.id, curriculum.id, phase.id);
    if (!catalog) { issues.push(`Katalog ${book.id}/${curriculum.id}/${phase.id} tidak tersedia.`); continue; }
    const subjectIds = new Set();
    for (const subject of catalog.subjects) {
      if (subjectIds.has(subject.id)) issues.push(`ID mapel ${subject.id} berulang pada ${book.id}/${curriculum.id}/${phase.id}.`);
      subjectIds.add(subject.id);
      const topicIds = new Set(subject.topics.map((topic) => topic.id));
      if (topicIds.size !== subject.topics.length) issues.push(`ID topik berulang pada ${subject.id}.`);
      const quizTopic = subject.topics.find((topic) => topic.quizAvailable);
      if (!quizTopic || subject.topics.filter((topic) => topic.quizAvailable).length !== 1) issues.push(`Mapel ${subject.id} harus memiliki satu paket kuis.`);
      for (const topic of subject.topics) {
        if (!topic.objective?.trim()) issues.push(`Tujuan belajar kosong pada ${subject.id}/${topic.id}.`);
        if (!topic.quizId || (quizTopic && topic.quizId !== quizTopic.quizId)) issues.push(`Relasi kuis tidak konsisten pada ${subject.id}/${topic.id}.`);
      }
      const quiz = quizFor(book.id, curriculum.id, phase.id, subject.id);
      if (!quiz || quiz.questions.length !== quiz.questionCount || quiz.pages.length !== quiz.pageCount) { issues.push(`Struktur paket kuis ${subject.id} tidak valid.`); continue; }
      quiz.questions.forEach((question, index) => issues.push(...validateQuestion(question, index)));
    }
  }
  return { valid: issues.length === 0, issues };
}

async function syncRelationalState(client, next, previous) {
  const ids = [...new Set([
    ...Object.keys(next.progress || {}), ...Object.keys(next.attempts || {}), ...Object.keys(next.readingProgress || {}), ...Object.keys(next.users || {}),
    ...Object.values(next.classes || {}).flatMap((classroom) => [...(classroom.studentIds || []), ...(classroom.teacherIds || [])]),
    ...Object.keys(previous.progress || {}), ...Object.keys(previous.attempts || {}), ...Object.keys(previous.readingProgress || {}),
  ])];
  for (const user of Object.values(next.users || {})) {
    await client.query(`INSERT INTO account (id,email,display_name,role,password_hash,password_salt,google_subject,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,now()))
      ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,display_name=EXCLUDED.display_name,role=EXCLUDED.role,password_hash=EXCLUDED.password_hash,password_salt=EXCLUDED.password_salt,google_subject=EXCLUDED.google_subject`,
    [user.id, user.email, user.name, user.role, user.passwordHash || null, user.salt || null, user.googleSubject || null, user.createdAt || null]);
  }
  await client.query('DELETE FROM class_teacher');
  await client.query('DELETE FROM class_student');
  await client.query('DELETE FROM learning_class');
  for (const classroom of Object.values(next.classes || {})) {
    await client.query('INSERT INTO learning_class (id, name) VALUES ($1, $2)', [classroom.id, classroom.name]);
    for (const teacherId of classroom.teacherIds || []) await client.query('INSERT INTO class_teacher (class_id, teacher_id) VALUES ($1, $2)', [classroom.id, teacherId]);
  }
  for (const id of ids) await client.query('INSERT INTO learning_identity (student_id,account_id) VALUES ($1,$2) ON CONFLICT (student_id) DO UPDATE SET account_id=COALESCE(EXCLUDED.account_id,learning_identity.account_id)', [id, next.users?.[id] ? id : null]);
  for (const classroom of Object.values(next.classes || {})) for (const studentId of classroom.studentIds || []) await client.query('INSERT INTO class_student (class_id, student_id) VALUES ($1, $2)', [classroom.id, studentId]);
  if (!ids.length) return;
  await client.query('DELETE FROM quiz_attempt_answer WHERE attempt_id IN (SELECT id FROM quiz_attempt WHERE student_id = ANY($1::text[]))', [ids]);
  await client.query('DELETE FROM progress_state WHERE student_id = ANY($1::text[])', [ids]);
  await client.query('DELETE FROM reading_progress WHERE student_id = ANY($1::text[])', [ids]);
  await client.query('DELETE FROM quiz_attempt WHERE student_id = ANY($1::text[])', [ids]);
  for (const id of ids) {
    const records = [...(next.attempts?.[id] || [])];
    const knownAttempts = new Set(records.map((attempt) => String(attempt.id)));
    for (const [packageKey, progress] of Object.entries(next.progress?.[id] || {})) {
      if (!progress.attemptId || !knownAttempts.has(progress.attemptId)) records.push({ id: progress.attemptId || `active-${id}-${packageKey}`, packageKey, status: 'started', startedAt: progress.startedAt || null, total: 50 });
    }
    for (const attempt of records) {
      const packageKey = attempt.packageKey || [attempt.bookId, attempt.curriculum, attempt.phase, attempt.subjectId].filter(Boolean).join(':');
      const status = ['started', 'completed', 'abandoned'].includes(attempt.status) ? attempt.status : Number.isInteger(attempt.score) ? 'completed' : 'abandoned';
      await client.query(`INSERT INTO quiz_attempt (id,student_id,package_key,status,score,correct_count,question_count,started_at,completed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,correct_count=EXCLUDED.correct_count,question_count=EXCLUDED.question_count,completed_at=EXCLUDED.completed_at`,
      [String(attempt.id), id, packageKey, status, attempt.score ?? null, attempt.correct ?? null, attempt.total ?? null, attempt.startedAt || null, attempt.completedAt || null]);
    }
    for (const [packageKey, progress] of Object.entries(next.progress?.[id] || {})) {
      const attemptId = progress.attemptId || `active-${id}-${packageKey}`;
      await client.query(`INSERT INTO progress_state (student_id,package_key,current_page,active_attempt_id,answer_payload,updated_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,COALESCE($6::timestamptz,now()))`,
      [id, packageKey, progress.page || 0, attemptId, JSON.stringify(progress.answers || {}), progress.updatedAt || null]);
      for (const [questionId, answer] of Object.entries(progress.answers || {})) await client.query(`INSERT INTO quiz_attempt_answer (attempt_id,question_id,choice_index,is_correct,explanation,answered_at)
        VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz,now()))`,
      [attemptId, questionId, answer.choice, typeof answer.correct === 'boolean' ? answer.correct : null, answer.explanation || null, answer.answeredAt || null]);
    }
    for (const [contentKey, raw] of Object.entries(next.readingProgress?.[id] || {})) {
      const page = typeof raw === 'object' ? raw.page : raw || 0;
      const updatedAt = typeof raw === 'object' ? raw.updatedAt : null;
      await client.query(`INSERT INTO reading_progress (student_id,content_key,current_page,updated_at) VALUES ($1,$2,$3,COALESCE($4::timestamptz,now()))`, [id, contentKey, page, updatedAt]);
    }
  }
}

async function handleApi(req, res, url, user) {
  const pathname = url.pathname;

  const publicRoute = ['GET', 'HEAD'].includes(req.method) && ['/api/health', '/api/openapi.json', '/api/auth/config', '/api/auth/dev-login', '/api/auth/accounts-by-email'].includes(pathname)
    || req.method === 'POST' && ['/api/auth/register', '/api/auth/login', '/api/auth/google', '/api/auth/dev-login', '/api/auth/forgot-password', '/api/auth/reset-password'].includes(pathname);
  if (!user && !publicRoute) {
    sendJson(res, 401, { error: 'Masuk diperlukan sebelum menggunakan layanan belajar.' });
    return;
  }

  if (pathname === '/api/auth/dev-login' && (req.method === 'POST' || req.method === 'GET')) {
    const devSecret = process.env.DEVELOPER_SECRET || 'cerdas-cermat-dev-secret-2026';
    let body = {};
    if (req.method === 'POST') {
      try { body = await readBody(req); } catch { body = {}; }
    }
    const providedSecret = req.headers['x-developer-secret'] || body.secret || url.searchParams.get('secret');

    const isOwner = user && user.email === developerEmail;
    const hasValidSecret = Boolean(providedSecret && providedSecret === devSecret);

    if (!isOwner && !hasValidSecret) {
      sendJson(res, 403, {
        error: `Akses developer ditolak. Akun developer hanya dapat diakses oleh pemilik (${developerEmail}).`,
      });
      return;
    }

    const devAccount = await seedDeveloper();
    sendJson(res, 200, issueSession(devAccount));
    return;
  }

  if (pathname === '/api/auth/config' && req.method === 'GET') {
    sendJson(res, 200, { googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID), googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
    return;
  }

  if (pathname === '/api/auth/accounts-by-email' && req.method === 'GET') {
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
    if (!email) {
      sendJson(res, 400, { error: 'Parameter email diperlukan.' });
      return;
    }
    const accounts = Object.values(store.users)
      .filter((entry) => entry.email === email)
      .map(safeUser);
    sendJson(res, 200, {
      email,
      count: accounts.length,
      maxAccounts: 4,
      canRegisterMore: accounts.length < 4,
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, role: a.role })),
    });
    return;
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const body = await readBody(req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const password = body.password;
    const requestedRole = body.role || 'student';
    const role = ['teacher', 'reviewer'].includes(requestedRole) && process.env[`${requestedRole.toUpperCase()}_INVITE_CODE`] && body.inviteCode === process.env[`${requestedRole.toUpperCase()}_INVITE_CODE`] ? requestedRole : 'student';

    if (email === developerEmail) {
      sendJson(res, 403, {
        error: 'Alamat email ini dilindungi khusus untuk akun Pengembang (Developer). Orang lain tidak diizinkan mendaftar dengan email ini.',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 80 || typeof password !== 'string' || password.length < 10 || password.length > 200) {
      sendJson(res, 400, { error: 'Email, nama, atau kata sandi tidak memenuhi ketentuan (kata sandi minimal 10 karakter).' }); return;
    }
    if (['teacher', 'reviewer'].includes(requestedRole) && role !== requestedRole) { sendJson(res, 403, { error: 'Kode undangan tidak valid atau belum dikonfigurasi.' }); return; }

    const existingAccounts = Object.values(store.users).filter((entry) => entry.email === email);
    if (existingAccounts.length >= 4) {
      sendJson(res, 409, { error: 'Batas pembuatan akun dengan email yang sama telah tercapai (maksimal 4 akun per email).' });
      return;
    }

    const id = `user-${crypto.randomUUID()}`;
    const credentials = hashPassword(password);
    const created = { id, email, name, role, salt: credentials.salt, passwordHash: credentials.hash, createdAt: new Date().toISOString() };
    store.users[id] = created;
    await persistStore();
    const session = issueSession(created);
    sendJson(res, 201, {
      ...session,
      accountIndex: existingAccounts.length + 1,
      maxAccounts: 4,
    });
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : '';

    if (!email || !password) {
      sendJson(res, 400, { error: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    const devPassword = process.env.DEVELOPER_PASSWORD || 'developer-cerdas-cermat-2026';
    if (email === developerEmail && !Object.values(store.users).some((entry) => entry.email === email)) {
      await seedDeveloper();
    }
    const existingAccounts = Object.values(store.users).filter((entry) => entry.email === email);

    // Jika pengguna memilih ID akun spesifik dari daftar profil
    if (accountId) {
      const selectedAccount = existingAccounts.find((acc) => acc.id === accountId);
      if (!selectedAccount) {
        sendJson(res, 404, { error: 'Akun yang dipilih tidak ditemukan pada email ini.' });
        return;
      }
      const isDevValid = (email === developerEmail && (password === devPassword || verifyPassword(password, selectedAccount)));
      if (!isDevValid && !verifyPassword(password, selectedAccount)) {
        sendJson(res, 401, { error: 'Kata sandi tidak sesuai untuk akun ini.' });
        return;
      }
      sendJson(res, 200, issueSession(selectedAccount));
      return;
    }

    if (!existingAccounts.length) {
      sendJson(res, 401, { error: 'Email atau kata sandi salah.' });
      return;
    }

    // Periksa akun yang cocok dengan kata sandi
    const matchingAccounts = existingAccounts.filter((acc) => {
      if (email === developerEmail && password === devPassword) return true;
      return verifyPassword(password, acc);
    });

    if (matchingAccounts.length === 0) {
      sendJson(res, 401, { error: 'Email atau kata sandi salah.' });
      return;
    }

    if (matchingAccounts.length === 1) {
      sendJson(res, 200, issueSession(matchingAccounts[0]));
      return;
    }

    // Jika lebih dari 1 akun cocok dengan email dan kata sandi yang sama
    sendJson(res, 200, {
      requiresAccountSelection: true,
      message: `Ditemukan ${matchingAccounts.length} akun dengan email ini. Silakan pilih akun yang ingin digunakan:`,
      accounts: matchingAccounts.map((acc) => safeUser(acc)),
    });
    return;
  }

  if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
    const body = await readBody(req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(res, 400, { error: 'Format email tidak valid.' });
      return;
    }

    const existingAccounts = Object.values(store.users).filter((entry) => entry.email === email);
    if (existingAccounts.length === 0) {
      sendJson(res, 404, { error: 'Tidak ditemukan akun belajar dengan alamat email tersebut.' });
      return;
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(email, {
      code: otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });

    console.log(`[AUTH OTP] Kode reset kata sandi untuk ${email}: ${otp}`);

    sendJson(res, 200, {
      sent: true,
      email,
      message: 'Kode OTP 6-digit berhasil dibuat dan dikirimkan (berlaku 10 menit).',
      accountCount: existingAccounts.length,
      accounts: existingAccounts.map(safeUser),
      debugOtp: otp,
    });
    return;
  }

  if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
    const body = await readBody(req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : '';

    if (!email || !otp || !newPassword) {
      sendJson(res, 400, { error: 'Email, kode OTP, dan kata sandi baru wajib diisi.' });
      return;
    }

    if (confirmPassword && confirmPassword !== newPassword) {
      sendJson(res, 400, { error: 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru.' });
      return;
    }

    if (newPassword.length < 10 || newPassword.length > 200) {
      sendJson(res, 400, { error: 'Kata sandi baru minimal harus 10 karakter (maksimal 200 karakter).' });
      return;
    }

    const otpRecord = otpStore.get(email);
    if (!otpRecord || Date.now() > otpRecord.expiresAt) {
      sendJson(res, 400, { error: 'Kode OTP telah kadaluarsa atau tidak valid. Silakan minta kode baru.' });
      return;
    }

    otpRecord.attempts = (otpRecord.attempts || 0) + 1;
    if (otpRecord.attempts > 5) {
      otpStore.delete(email);
      sendJson(res, 400, { error: 'Batas percobaan OTP terlampaui. Silakan minta kode baru.' });
      return;
    }

    if (otpRecord.code !== otp) {
      sendJson(res, 400, { error: 'Kode OTP yang dimasukkan tidak sesuai.' });
      return;
    }

    const existingAccounts = Object.values(store.users).filter((entry) => entry.email === email);
    if (existingAccounts.length === 0) {
      sendJson(res, 404, { error: 'Akun dengan email tersebut tidak ditemukan.' });
      return;
    }

    const targetAccounts = accountId
      ? existingAccounts.filter((acc) => acc.id === accountId)
      : existingAccounts;

    if (targetAccounts.length === 0) {
      sendJson(res, 404, { error: 'Akun yang dipilih tidak ditemukan pada email ini.' });
      return;
    }

    const credentials = hashPassword(newPassword);
    for (const acc of targetAccounts) {
      acc.salt = credentials.salt;
      acc.passwordHash = credentials.hash;
    }

    const targetUserIds = new Set(targetAccounts.map((a) => a.id));
    for (const [token, session] of sessions.entries()) {
      if (targetUserIds.has(session.userId)) {
        sessions.delete(token);
      }
    }

    await persistStore();
    otpStore.delete(email);

    sendJson(res, 200, {
      success: true,
      message: 'Kata sandi berhasil diperbarui. Silakan masuk menggunakan kata sandi baru Anda.',
      updatedCount: targetAccounts.length,
    });
    return;
  }

  if (pathname === '/api/auth/google' && req.method === 'POST') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) { sendJson(res, 503, { error: 'Login Google belum dikonfigurasi. Gunakan email dan kata sandi untuk sementara.' }); return; }
    const body = await readBody(req);
    if (typeof body.credential !== 'string' || body.credential.length > 10_000) { sendJson(res, 400, { error: 'Kredensial Google tidak valid.' }); return; }
    let claims;
    try {
      const ticket = await googleOAuthClient.verifyIdToken({ idToken: body.credential, audience: clientId });
      claims = ticket.getPayload();
    } catch (error) {
      console.warn(JSON.stringify({ level: 'warn', event: 'google_auth_rejected', reason: 'token_verification_failed' }));
      sendJson(res, 401, { error: 'Verifikasi akun Google gagal. Coba masuk kembali.' }); return;
    }
    const email = typeof claims?.email === 'string' ? claims.email.trim().toLowerCase() : '';
    const googleSubject = typeof claims?.sub === 'string' ? claims.sub : '';
    const name = typeof claims?.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 80) : email.split('@')[0].slice(0, 80);
    if (claims?.email_verified !== true || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !googleSubject || !name) {
      sendJson(res, 401, { error: 'Google harus mengonfirmasi alamat email sebelum akun dapat digunakan.' }); return;
    }
    let account = Object.values(store.users).find((entry) => entry.googleSubject === googleSubject);
    let accountChanged = false;
    if (!account) {
      account = Object.values(store.users).find((entry) => entry.email === email);
      if (account?.googleSubject && account.googleSubject !== googleSubject) {
        sendJson(res, 409, { error: 'Email ini sudah ditautkan ke akun Google lain.' }); return;
      }
      if (account) { account.googleSubject = googleSubject; accountChanged = true; }
      else {
        account = { id: `user-${crypto.randomUUID()}`, email, name, role: 'student', googleSubject, createdAt: new Date().toISOString() };
        store.users[account.id] = account;
        accountChanged = true;
      }
    }
    if (email === developerEmail) {
      const roleChanged = account.role !== 'admin';
      account.role = 'admin';
      accountChanged = true;
      if (roleChanged) for (const [token, session] of sessions) if (session.userId === account.id) sessions.delete(token);
    }
    if (accountChanged) await persistStore();
    sendJson(res, 200, issueSession(account)); return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const match = String(req.headers.authorization || '').match(/^Bearer ([A-Za-z0-9_-]+)$/);
    if (match) sessions.delete(match[1]);
    sendJson(res, 200, { loggedOut: true }); return;
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    if (!user) { sendJson(res, 401, { error: 'Sesi tidak aktif.' }); return; }
    sendJson(res, 200, { user: safeUser(user) }); return;
  }

  if (pathname === '/api/metrics' && req.method === 'GET') {
    const roleError = requireRole(user, ['admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }
    sendJson(res, 200, { ...metrics, uptimeSeconds: Math.floor((Date.now() - metrics.startedAt) / 1000), activeSessions: sessions.size }); return;
  }

  if (pathname === '/api/accounts' && req.method === 'GET') {
    const roleError = requireRole(user, ['admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }
    sendJson(res, 200, { accounts: Object.values(store.users).map(safeUser) }); return;
  }

  if (pathname === '/api/classes' && req.method === 'GET') {
    const roleError = requireRole(user, ['teacher', 'admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }
    const classrooms = Object.values(store.classes || {}).filter((classroom) => user.role === 'admin' || classForTeacher(classroom, user.id));
    sendJson(res, 200, { classes: classrooms.map((classroom) => user.role === 'admin' ? { ...classView(classroom), teacherIds: classroom.teacherIds || [], studentIds: classroom.studentIds || [] } : classView(classroom)) }); return;
  }

  if (pathname === '/api/classes' && req.method === 'POST') {
    const roleError = requireRole(user, ['admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }
    const body = await readBody(req);
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!/^[a-zA-Z0-9-]{2,80}$/.test(id) || !name || name.length > 120) { sendJson(res, 400, { error: 'ID kelas harus 2–80 karakter dan nama wajib diisi (maksimal 120 karakter).' }); return; }
    if (store.classes[id]) { sendJson(res, 409, { error: 'ID kelas sudah digunakan.' }); return; }
    store.classes[id] = { id, name, teacherIds: [], studentIds: [], createdAt: new Date().toISOString() };
    await persistStore();
    sendJson(res, 201, { classroom: classView(store.classes[id]) }); return;
  }

  const classMembersMatch = pathname.match(/^\/api\/classes\/([a-zA-Z0-9-]{2,80})\/members$/);
  if (classMembersMatch && req.method === 'PUT') {
    const roleError = requireRole(user, ['admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }
    const classroom = store.classes[classMembersMatch[1]];
    if (!classroom) { sendJson(res, 404, { error: 'Kelas tidak ditemukan.' }); return; }
    const body = await readBody(req);
    const teacherIds = body.teacherIds;
    const studentIds = body.studentIds;
    const validList = (items) => Array.isArray(items) && items.length <= 100 && items.every((id) => typeof id === 'string') && new Set(items).size === items.length;
    if (!validList(teacherIds) || !validList(studentIds) ||
      teacherIds.some((id) => store.users[id]?.role !== 'teacher') ||
      studentIds.some((id) => store.users[id]?.role !== 'student')) {
      sendJson(res, 400, { error: 'Daftar anggota harus berisi ID unik akun guru dan siswa yang valid.' }); return;
    }
    classroom.teacherIds = teacherIds;
    classroom.studentIds = studentIds;
    classroom.updatedAt = new Date().toISOString();
    await persistStore();
    sendJson(res, 200, { classroom: { ...classView(classroom), teacherIds: classroom.teacherIds, studentIds: classroom.studentIds } }); return;
  }

  if (pathname === '/api/analytics/class' && req.method === 'GET') {
    const roleError = requireRole(user, ['teacher', 'admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }
    const classId = url.searchParams.get('classId');
    const classroom = classId && store.classes[classId];
    if (!classroom) { sendJson(res, 404, { error: 'Kelas tidak ditemukan.' }); return; }
    if (user.role !== 'admin' && !classForTeacher(classroom, user.id)) { sendJson(res, 403, { error: 'Kelas ini tidak ditugaskan kepada akun guru.' }); return; }
    const summary = classSummary(store.attempts, classroom.studentIds || []);
    sendJson(res, 200, { classroom: classView(classroom), summary, privacy: 'Agregat terbatas pada siswa yang ditugaskan ke kelas; nama dan jawaban siswa tidak ditampilkan.' }); return;
  }

  const schoolMaterialMatch = pathname.match(/^\/api\/schools\/([a-zA-Z0-9-]{2,80})\/materials\/([a-zA-Z0-9._:-]+)\/pages\/(\d+)$/);
  if (schoolMaterialMatch && req.method === 'GET') {
    const [, schoolId, contentId, rawPage] = schoolMaterialMatch;
    const config = contentStore.getSchool(schoolId);
    const entry = config.contentIds.includes(contentId) ? contentStore.get(contentId) : null;
    const pages = entry?.content?.pages || entry?.pages || [];
    const pageNumber = Number(rawPage);
    const page = pages[pageNumber - 1];
    if (!entry || entry.type !== 'local-subject' || entry.status !== 'published' || !page) { sendJson(res, 404, { error: 'Materi muatan lokal tidak tersedia untuk sekolah ini.' }); return; }
    sendJson(res, 200, { material: { title: entry.title, pageCount: pages.length, publicationStatus: entry.status, source: entry.sources, reviewer: entry.reviewer, reviewedAt: entry.reviewedAt }, page: { ...page, number: pageNumber } }); return;
  }

  const schoolCatalogMatch = pathname.match(/^\/api\/schools\/([a-zA-Z0-9-]{2,80})\/catalog$/);
  if (schoolCatalogMatch && req.method === 'GET') {
    const config = contentStore.getSchool(schoolCatalogMatch[1]);
    const selected = config.contentIds.map((id) => contentStore.get(id)).filter((entry) => entry && entry.type === 'local-subject' && entry.status === 'published');
    sendJson(res, 200, { schoolId: config.schoolId, updatedAt: config.updatedAt, contentIds: config.contentIds, subjects: selected.map(({ id, title, level, phase, subjectId, topicId, objectives, sources, content }) => ({ id, title, level, phase, subjectId, topicId, objectives, sources, content })) }); return;
  }

  if (schoolCatalogMatch && req.method === 'PUT') {
    const roleError = requireRole(user, ['admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }
    const body = await readBody(req);
    if (!Array.isArray(body.contentIds) || body.contentIds.length > 100 || body.contentIds.some((id) => typeof id !== 'string')) { sendJson(res, 400, { error: 'contentIds harus berupa daftar berisi maksimal 100 ID.' }); return; }
    const validIds = new Set(contentStore.list({ status: 'published', type: 'local-subject' }).map((entry) => entry.id));
    if (body.contentIds.some((id) => !validIds.has(id))) { sendJson(res, 400, { error: 'Semua pilihan harus berupa muatan lokal yang telah dipublikasikan.' }); return; }
    const config = await contentStore.saveSchool(schoolCatalogMatch[1], body.contentIds, user.email);
    sendJson(res, 200, { saved: true, schoolId: config.schoolId, contentIds: config.contentIds }); return;
  }

  if (pathname === '/api/media' && req.method === 'GET') {
    const status = user?.role === 'admin' ? url.searchParams.get('status') || undefined : 'published';
    sendJson(res, 200, { media: contentStore.listMedia({ status }) }); return;
  }

  const mediaMatch = pathname.match(/^\/api\/media\/([a-zA-Z0-9._:-]+)$/);
  if ((pathname === '/api/media' && req.method === 'POST') || (mediaMatch && ['PUT', 'DELETE'].includes(req.method))) {
    const roleError = requireRole(user, ['admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }
    if (req.method === 'DELETE') {
      const existed = contentStore.listMedia().some((asset) => asset.id === mediaMatch[1]);
      if (!existed) { sendJson(res, 404, { error: 'Metadata media tidak ditemukan.' }); return; }
      await contentStore.saveMedia({ ...contentStore.listMedia().find((asset) => asset.id === mediaMatch[1]), status: 'archived' });
      sendJson(res, 200, { archived: true }); return;
    }
    const body = await readBody(req);
    const asset = { ...body, id: mediaMatch?.[1] || body.id || crypto.randomUUID(), status: body.status || 'draft' };
    const validation = validateMediaAsset(asset);
    if (!validation.valid) { sendJson(res, 400, { error: validation.issues.join(' ') }); return; }
    if (asset.status === 'published' && (!asset.reviewer || !asset.reviewedAt)) { sendJson(res, 409, { error: 'Media hanya dapat dipublikasikan setelah reviewer dan tanggal tinjau dicatat.' }); return; }
    const saved = await contentStore.saveMedia(asset);
    sendJson(res, mediaMatch ? 200 : 201, { media: saved }); return;
  }

  const recommendationMatch = pathname.match(/^\/api\/recommendations\/([a-zA-Z0-9-]+)$/);
  if (recommendationMatch && req.method === 'GET') {
    const studentId = recommendationMatch[1];
    const ownerError = requireOwner(user, studentId);
    if (ownerError) { sendJson(res, ownerError.status, { error: ownerError.error }); return; }
    const attempts = (store.attempts[studentId] || []).filter((attempt) => attempt.status === 'completed');
    const bestScores = new Map();
    for (const attempt of attempts) {
      const key = `${attempt.bookId}:${attempt.curriculum}:${attempt.phase}:${attempt.subjectId}`;
      bestScores.set(key, Math.max(bestScores.get(key) ?? -1, attempt.score));
    }
    const recommendations = [];
    for (const book of books) for (const curriculum of CURRICULA) for (const phase of phasesFor(book.id, curriculum.id)) {
      const catalog = catalogFor(book.id, curriculum.id, phase.id);
      for (const subject of catalog?.subjects || []) {
        const quiz = quizFor(book.id, curriculum.id, phase.id, subject.id);
        const key = `${book.id}:${curriculum.id}:${phase.id}:${subject.id}`;
        const score = bestScores.get(key);
        if (score === undefined || score < 80) recommendations.push({ bookId: book.id, curriculum: curriculum.id, phase: phase.id, subjectId: subject.id, subject: subject.name, topic: quiz.topic, bestScore: score ?? null, reason: score === undefined ? 'Belum ada percobaan tersimpan untuk topik ini.' : `Nilai tertinggi ${score}%. Ulangi latihan untuk memperkuat pemahaman.` });
      }
    }
    recommendations.sort((a, b) => Number(a.bestScore === null) - Number(b.bestScore === null) || (a.bestScore ?? 101) - (b.bestScore ?? 101));
    sendJson(res, 200, { recommendations: recommendations.slice(0, 10) }); return;
  }

  if (pathname === '/api/content' && req.method === 'GET') {
    const status = url.searchParams.get('status') || undefined;
    const type = url.searchParams.get('type') || undefined;
    const isReviewer = user && ['teacher', 'reviewer', 'admin'].includes(user.role);
    const entries = contentStore.list({ type, status: isReviewer ? status : 'published' });
    sendJson(res, 200, { contents: entries.map(({ history: _history, comments: _comments, author: _author, ...entry }) => entry) }); return;
  }

  if (pathname === '/api/content' && req.method === 'POST') {
    const roleError = requireRole(user, ['teacher', 'reviewer', 'admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }
    const body = await readBody(req);
    const result = await contentStore.save({ ...body, id: body.id || crypto.randomUUID(), schemaVersion: body.schemaVersion || 1, revision: 0, status: 'draft', reviewer: null, reviewedAt: null }, user.name, { create: true });
    if (result.error) { sendJson(res, 400, { error: result.error.join(' ') }); return; }
    if (result.conflict) { sendJson(res, 409, { error: 'ID konten sudah digunakan.' }); return; }
    sendJson(res, 201, result); return;
  }

  const contentMatch = pathname.match(/^\/api\/content\/([a-zA-Z0-9._:-]+)(?:\/(submit|approve|publish|reject|revise|comments))?$/);
  if (contentMatch && ['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    const [, contentId, action] = contentMatch;
    if (req.method === 'GET') {
      const entry = contentStore.get(contentId);
      if (!entry || (entry.status !== 'published' && !(user && ['teacher', 'reviewer', 'admin'].includes(user.role)))) { sendJson(res, 404, { error: 'Konten tidak ditemukan.' }); return; }
      if (!user || !['teacher', 'reviewer', 'admin'].includes(user.role)) {
        const { history: _history, comments: _comments, author: _author, ...publicEntry } = entry;
        sendJson(res, 200, { content: publicEntry });
      } else sendJson(res, 200, { content: entry });
      return;
    }
    const roleError = requireRole(user, action === 'approve' || action === 'publish' || action === 'reject' ? ['reviewer', 'admin'] : ['teacher', 'reviewer', 'admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }
    if (action && ['submit', 'approve', 'publish', 'reject', 'revise'].includes(action) && req.method === 'POST') {
      const body = await readBody(req);
      const result = await contentStore.transition(contentId, action, user.name, typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) : '');
      if (!result) { sendJson(res, 404, { error: 'Konten tidak ditemukan.' }); return; }
      if (result.error) { sendJson(res, 400, { error: result.error.join(' ') }); return; }
      sendJson(res, 200, result); return;
    }
    if (action === 'comments' && req.method === 'POST') {
      const body = await readBody(req);
      const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) : '';
      if (!comment) { sendJson(res, 400, { error: 'Komentar tidak boleh kosong.' }); return; }
      const result = await contentStore.addComment(contentId, user.name, comment);
      if (!result) { sendJson(res, 404, { error: 'Konten tidak ditemukan.' }); return; }
      sendJson(res, 201, { comments: result.content.comments }); return;
    }
    if (req.method === 'POST' && !action) {
      const body = await readBody(req);
      const result = await contentStore.save({ ...body, id: body.id || crypto.randomUUID(), schemaVersion: body.schemaVersion || 1, revision: 0, status: 'draft', reviewer: null, reviewedAt: null }, user.name, { create: true });
      if (result.error) { sendJson(res, 400, { error: result.error.join(' ') }); return; }
      if (result.conflict) { sendJson(res, 409, { error: 'ID konten sudah digunakan.' }); return; }
      sendJson(res, 201, result); return;
    }
    if (req.method === 'PUT' && !action) {
      const body = await readBody(req);
      const result = await contentStore.save({ ...body, id: contentId }, user.name);
      if (result.error) { sendJson(res, 400, { error: result.error.join(' ') }); return; }
      sendJson(res, 200, result); return;
    }
    if (req.method === 'DELETE' && !action) {
      if (user.role !== 'admin') { sendJson(res, 403, { error: 'Hanya admin dapat menghapus konten.' }); return; }
      if (!(await contentStore.remove(contentId))) { sendJson(res, 404, { error: 'Konten tidak ditemukan.' }); return; }
      sendJson(res, 200, { deleted: true }); return;
    }
  }

  if (pathname === '/api/health' && (req.method === 'GET' || req.method === 'HEAD')) {
    if (databasePool) {
      try { await databasePool.query('SELECT 1'); }
      catch (error) {
        console.error(JSON.stringify({ level: 'error', event: 'health_check_failed', dependency: 'postgresql', message: error.message }));
        sendJson(res, 503, { status: 'degraded', service: 'cerdas-cermat-api', storage: 'unavailable', code: 'STORAGE_UNAVAILABLE', message: 'Penyimpanan database tidak tersedia.' });
        return;
      }
    }
    sendJson(res, 200, { status: 'ok', service: 'cerdas-cermat-api', storage: databasePool ? 'postgresql' : 'json-local', checkedAt: new Date().toISOString() });
    return;
  }

  if (pathname === '/api/openapi.json' && req.method === 'GET') {
    const specification = JSON.parse(await fs.readFile(path.resolve(__dirname, '../openapi.json'), 'utf8'));
    sendJson(res, 200, specification);
    return;
  }

  if (pathname === '/api/catalog/validate' && req.method === 'GET') {
    const result = validateLearningCatalog();
    sendJson(res, result.valid ? 200 : 500, result);
    return;
  }

  if ((pathname === '/api/catalog' || pathname === '/api/books') && req.method === 'GET') {
    sendJson(res, 200, { curricula: CURRICULA, books: books.map(publicBook) });
    return;
  }

  if (pathname === '/api/storybook' && req.method === 'GET') {
    sendJson(res, 200, { title: 'Kisah Kecil Nusantara', levels: ['tk', 'sd', 'smp', 'sma'].map(storybookFor) });
    return;
  }

  const storybookCatalogMatch = pathname.match(/^\/api\/storybook\/([a-z]+)$/);
  if (storybookCatalogMatch && req.method === 'GET') {
    const catalog = storybookFor(storybookCatalogMatch[1]);
    if (!catalog) { sendJson(res, 404, { error: 'Jenjang buku cerita tidak ditemukan.' }); return; }
    sendJson(res, 200, catalog);
    return;
  }

  const storybookPageMatch = pathname.match(/^\/api\/storybook\/([a-z]+)\/pages\/(\d+)$/);
  if (storybookPageMatch && req.method === 'GET') {
    const page = storybookPage(storybookPageMatch[1], Number(storybookPageMatch[2]));
    if (!page) { sendJson(res, 404, { error: 'Halaman cerita tidak ditemukan.' }); return; }
    sendJson(res, 200, { page });
    return;
  }

  const subjectsMatch = pathname.match(/^\/api\/catalog\/([a-z]+)\/subjects$/);
  if (subjectsMatch && req.method === 'GET') {
    const curriculum = url.searchParams.get('curriculum') || 'merdeka';
    const phase = url.searchParams.get('phase');
    const catalog = catalogFor(subjectsMatch[1], curriculum, phase);
    if (!catalog) { sendJson(res, 404, { error: 'Katalog kurikulum, jenjang, atau fase tidak ditemukan.' }); return; }
    sendJson(res, 200, catalog);
    return;
  }

  const materialMatch = pathname.match(/^\/api\/materials\/([a-z]+)\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)\/pages\/(\d+)$/);
  if (materialMatch && req.method === 'GET') {
    const [, level, subject, topic, rawPage] = materialMatch;
    const curriculum = url.searchParams.get('curriculum') || 'merdeka';
    const phase = url.searchParams.get('phase');
    const content = lessonPages(level, curriculum, phase, subject, topic);
    const pageNumber = Number(rawPage);
    const page = content?.pages[pageNumber - 1];
    if (!content || content.material.quizAvailable || !page) {
      sendJson(res, 404, { error: 'Materi atau halaman tidak ditemukan.' });
      return;
    }
    sendJson(res, 200, { material: content.material, page });
    return;
  }

  const quizPageMatch = pathname.match(/^\/api\/quizzes\/([a-z]+)\/([a-zA-Z0-9-]+)\/pages\/(\d+)$/);
  if (quizPageMatch && req.method === 'GET') {
    const [, level, subjectId, rawPage] = quizPageMatch;
    const curriculum = url.searchParams.get('curriculum') || 'merdeka';
    const phase = url.searchParams.get('phase');
    const quiz = quizFor(level, curriculum, phase, subjectId);
    const pageNumber = Number(rawPage);
    const page = quiz?.pages[pageNumber - 1];
    if (!quiz || !page) {
      sendJson(res, 404, { error: 'Kuis atau halaman tidak ditemukan.' });
      return;
    }
    sendJson(res, 200, {
      quiz: {
        level: quiz.level, curriculum: quiz.curriculum, phase: quiz.phase,
        subject: quiz.subject, topic: quiz.topic, questionCount: quiz.questionCount,
        pageCount: quiz.pageCount, questionsPerPage: quiz.questionsPerPage,
        reviewStatus: quiz.reviewStatus,
      },
      page: {
        number: pageNumber,
        title: page.title,
        startQuestion: (pageNumber - 1) * quiz.questionsPerPage + 1,
        questions: page.questions.map(({ answer: _answer, ...question }) => question),
      },
    });
    return;
  }

  if (pathname === '/api/sync/progress' && req.method === 'POST') {
    const body = await readBody(req);
    if (!Array.isArray(body.operations) || body.operations.length < 1 || body.operations.length > 100) {
      sendJson(res, 400, { error: 'operations harus berisi 1 sampai 100 perubahan.' }); return;
    }
    const prepared = [];
    for (const [index, operation] of body.operations.entries()) {
      const result = prepareSyncOperation(operation, user);
      if (result.error) { sendJson(res, result.status, { error: result.error, failedIndex: index }); return; }
      prepared.push(result);
    }
    const previous = store;
    const candidate = JSON.parse(JSON.stringify(store));
    const results = prepared.map((operation) => applySyncOperation(candidate, operation));
    store = candidate;
    try { await persistStore(); }
    catch (error) { store = previous; throw error; }
    sendJson(res, 200, { saved: true, count: results.length, results }); return;
  }

  const readingProgressMatch = pathname.match(/^\/api\/reading-progress\/([a-zA-Z0-9-]+)$/);
  if (readingProgressMatch && req.method === 'GET') {
    const studentId = readingProgressMatch[1];
    const ownerError = requireOwner(user, studentId);
    if (ownerError) { sendJson(res, ownerError.status, { error: ownerError.error }); return; }
    const key = url.searchParams.get('key');
    if (!validStudentId(studentId) || !key || key.length > 240) { sendJson(res, 400, { error: 'Identitas atau kunci progres baca tidak valid.' }); return; }
    const saved = store.readingProgress[studentId]?.[key];
    sendJson(res, 200, { page: typeof saved === 'object' ? saved.page : saved || 0, updatedAt: typeof saved === 'object' ? saved.updatedAt : null });
    return;
  }

  if (pathname === '/api/reading-progress' && req.method === 'PUT') {
    const body = await readBody(req);
    const { studentId, key, page } = body;
    const ownerError = requireOwner(user, studentId);
    if (ownerError) { sendJson(res, ownerError.status, { error: ownerError.error }); return; }
    const maxPage = typeof key === 'string' && key.startsWith('storybook:') ? 20 : typeof key === 'string' && key.includes(':local-') ? 100 : 3;
    if (!validStudentId(studentId) || typeof key !== 'string' || !key || key.length > 240 || !Number.isInteger(page) || page < 0 || page > maxPage) {
      sendJson(res, 400, { error: 'Data progres baca tidak valid.' });
      return;
    }
    store.readingProgress[studentId] ||= {};
    store.readingProgress[studentId][key] = { page, updatedAt: new Date().toISOString() };
    await persistStore();
    sendJson(res, 200, { saved: true, page });
    return;
  }

  const pageMatch = pathname.match(/^\/api\/books\/([a-z]+)\/pages\/(\d+)$/);
  if (pageMatch && req.method === 'GET') {
    const book = books.find((item) => item.id === pageMatch[1]);
    const pageNumber = Number(pageMatch[2]);
    const page = book?.pages[pageNumber - 1];
    const curriculum = url.searchParams.get('curriculum') || 'merdeka';
    const phase = url.searchParams.get('phase') || book?.phases[0].id;
    if (!validContext(book, curriculum, phase) || !page) {
      sendJson(res, 404, { error: 'Paket atau halaman buku tidak ditemukan.' });
      return;
    }
    sendJson(res, 200, {
      book: publicBook(book),
      curriculum,
      phase,
      page: { number: pageNumber, title: page.title, startQuestion: (pageNumber - 1) * 3 + 1, questions: page.questions.map(({ answer: _answer, ...question }) => question) },
    });
    return;
  }

  if (pathname === '/api/progress' && req.method === 'PUT') {
    const body = await readBody(req);
    const { studentId, bookId, curriculum, phase, page, subjectId = 'matematika' } = body;
    const ownerError = requireOwner(user, studentId);
    if (ownerError) { sendJson(res, ownerError.status, { error: ownerError.error }); return; }
    const book = books.find((item) => item.id === bookId);
    const quiz = quizFor(bookId, curriculum, phase, subjectId);
    if (!validStudentId(studentId) || !validContext(book, curriculum, phase) || !quiz || !Number.isInteger(page) || page < 0 || page >= quiz.pageCount) {
      sendJson(res, 400, { error: 'Data progres tidak valid.' });
      return;
    }
    const key = packKey(bookId, curriculum, phase, subjectId);
    store.progress[studentId] ||= {};
    store.progress[studentId][key] ||= { page: 0, answers: {} };
    store.progress[studentId][key].page = page;
    await persistStore();
    sendJson(res, 200, { saved: true, page });
    return;
  }

  const progressMatch = pathname.match(/^\/api\/progress\/([a-zA-Z0-9-]+)$/);
  if (progressMatch && req.method === 'GET') {
    const studentId = progressMatch[1];
    const ownerError = requireOwner(user, studentId);
    if (ownerError) { sendJson(res, ownerError.status, { error: ownerError.error }); return; }
    if (!validStudentId(studentId)) { sendJson(res, 400, { error: 'Identitas belajar tidak valid.' }); return; }
    const bookId = url.searchParams.get('bookId');
    const curriculum = url.searchParams.get('curriculum') || 'merdeka';
    const phase = url.searchParams.get('phase');
    const subjectId = url.searchParams.get('subjectId') || 'matematika';
    if (bookId) {
      const book = books.find((item) => item.id === bookId);
      const selectedPhase = phase || book?.phases[0].id;
      if (!validContext(book, curriculum, selectedPhase) || !quizFor(bookId, curriculum, selectedPhase, subjectId)) { sendJson(res, 400, { error: 'Paket progres tidak valid.' }); return; }
      sendJson(res, 200, { progress: getProgress(studentId, bookId, curriculum, selectedPhase, subjectId) });
      return;
    }
    if (url.searchParams.get('view') === 'latest-reading') {
      const entries = Object.entries(store.readingProgress[studentId] || {}).map(([key, value]) => ({ key, page: typeof value === 'object' ? value.page : value || 0, updatedAt: typeof value === 'object' ? value.updatedAt : null }));
      entries.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      sendJson(res, 200, { latest: entries[0] || null });
      return;
    }
    if (url.searchParams.get('view') === 'topics') {
      sendJson(res, 200, { topics: topicProgress(store.progress[studentId] || {}, store.attempts[studentId] || []) });
      return;
    }
    sendJson(res, 200, { progress: store.progress[studentId] || {}, attempts: store.attempts[studentId] || [], readingProgress: store.readingProgress[studentId] || {} });
    return;
  }

  if (progressMatch && req.method === 'DELETE') {
    const studentId = progressMatch[1];
    const ownerError = requireOwner(user, studentId);
    if (ownerError) { sendJson(res, ownerError.status, { error: ownerError.error }); return; }
    if (!validStudentId(studentId)) { sendJson(res, 400, { error: 'Identitas belajar tidak valid.' }); return; }
    delete store.progress[studentId];
    delete store.attempts[studentId];
    delete store.readingProgress[studentId];
    await persistStore();
    sendJson(res, 200, { deleted: true }); return;
  }

  if (pathname === '/api/attempts' && req.method === 'POST') {
    const body = await readBody(req);
    const { studentId, bookId, curriculum, phase, subjectId = 'matematika' } = body;
    const ownerError = requireOwner(user, studentId);
    if (ownerError) { sendJson(res, ownerError.status, { error: ownerError.error }); return; }
    const book = books.find((item) => item.id === bookId);
    const quiz = quizFor(bookId, curriculum, phase, subjectId);
    if (!validStudentId(studentId) || !validContext(book, curriculum, phase) || !quiz) { sendJson(res, 400, { error: 'Paket percobaan tidak valid.' }); return; }
    const key = packKey(bookId, curriculum, phase, subjectId);
    store.progress[studentId] ||= {};
    const previous = store.progress[studentId][key];
    const attemptId = crypto.randomUUID();
    const previousResult = previous?.attemptId && (store.attempts[studentId] || []).find((attempt) => attempt.id === previous.attemptId && (attempt.status === 'completed' || (!attempt.status && Number.isInteger(attempt.score))));
    if (previous && Object.keys(previous.answers || {}).length && !previousResult) {
      store.attempts[studentId] ||= [];
      store.attempts[studentId].unshift({
        id: previous.attemptId || crypto.randomUUID(), bookId, curriculum, phase, subjectId,
        subject: quiz.subject.name, topic: quiz.topic, status: 'abandoned',
        answered: Object.keys(previous.answers).length, total: quiz.questionCount,
        startedAt: previous.startedAt || previous.updatedAt || new Date().toISOString(),
        completedAt: null,
      });
      store.attempts[studentId] = store.attempts[studentId].slice(0, 100);
    }
    store.progress[studentId][key] = { page: 0, answers: {}, attemptId, startedAt: new Date().toISOString() };
    await persistStore();
    sendJson(res, 201, { attemptId, page: 0, saved: true });
    return;
  }

  if (pathname === '/api/answer' && req.method === 'POST') {
    const body = await readBody(req);
    const { studentId, bookId, curriculum, phase, questionId, choice, subjectId = 'matematika' } = body;
    const ownerError = requireOwner(user, studentId);
    if (ownerError) { sendJson(res, ownerError.status, { error: ownerError.error }); return; }
    const book = books.find((item) => item.id === bookId);
    const quiz = quizFor(bookId, curriculum, phase, subjectId);
    const question = quiz?.questions.find((item) => item.id === questionId);
    if (!validStudentId(studentId) || !validContext(book, curriculum, phase) || !quiz || !question || !Number.isInteger(choice) || choice < 0 || choice >= question.choices.length) {
      sendJson(res, 400, { error: 'Jawaban tidak valid.' });
      return;
    }
    const key = packKey(bookId, curriculum, phase, subjectId);
    store.progress[studentId] ||= {};
    store.progress[studentId][key] ||= { page: 0, answers: {} };
    store.progress[studentId][key].attemptId ||= crypto.randomUUID();
    const answer = { choice, correct: choice === question.answer, correctChoice: question.answer, explanation: question.explanation, answeredAt: new Date().toISOString() };
    store.progress[studentId][key].answers[questionId] = answer;
    store.progress[studentId][key].updatedAt = answer.answeredAt;
    await persistStore();
    sendJson(res, 200, { correct: answer.correct, correctChoice: answer.correctChoice, explanation: answer.explanation });
    return;
  }

  if (pathname === '/api/results' && req.method === 'POST') {
    const body = await readBody(req);
    const { studentId, bookId, curriculum, phase, subjectId = 'matematika' } = body;
    const ownerError = requireOwner(user, studentId);
    if (ownerError) { sendJson(res, ownerError.status, { error: ownerError.error }); return; }
    const book = books.find((item) => item.id === bookId);
    const quiz = quizFor(bookId, curriculum, phase, subjectId);
    if (!validStudentId(studentId) || !validContext(book, curriculum, phase) || !quiz) { sendJson(res, 400, { error: 'Data hasil tidak valid.' }); return; }
    const progress = getProgress(studentId, bookId, curriculum, phase, subjectId);
    const answered = quiz.questions.filter((question) => progress.answers[question.id]);
    if (answered.length !== quiz.questionCount) {
      sendJson(res, 409, { error: `Jawab semua soal terlebih dahulu (${answered.length}/${quiz.questionCount}).`, answered: answered.length, total: quiz.questionCount });
      return;
    }
    const previousResult = progress.attemptId && (store.attempts[studentId] || []).find((item) => item.id === progress.attemptId && (item.status === 'completed' || (!item.status && Number.isInteger(item.score))));
    if (previousResult) {
      sendJson(res, 200, { result: previousResult, recommendation: previousResult.score === 100 ? 'Hebat! Coba materi berikutnya.' : `Ulangi materi ${quiz.topic} untuk memperkuat pemahaman.` });
      return;
    }
    const correct = answered.filter((question) => progress.answers[question.id].correct).length;
    const attempt = {
      id: progress.attemptId || crypto.randomUUID(),
      bookId,
      curriculum,
      phase,
      subjectId,
      subject: quiz.subject.name,
      topic: quiz.topic,
      correct,
      total: quiz.questionCount,
      score: Math.round((correct / quiz.questionCount) * 100),
      status: 'completed',
      startedAt: progress.startedAt || null,
      completedAt: new Date().toISOString(),
    };
    store.attempts[studentId] ||= [];
    store.attempts[studentId].unshift(attempt);
    store.attempts[studentId] = store.attempts[studentId].slice(0, 100);
    await persistStore();
    sendJson(res, 200, { result: attempt, recommendation: correct === quiz.questionCount ? 'Hebat! Coba materi berikutnya.' : `Ulangi materi ${quiz.topic} untuk memperkuat pemahaman.` });
    return;
  }

  // Pillar A: Adaptive Profile
  if (pathname === '/api/adaptive/profile' && req.method === 'GET') {
    const studentId = url.searchParams.get('studentId') || user?.id;
    const student = studentId ? store.users[studentId] : user;
    const adaptive = student?.adaptive || {
      xp: 0,
      levelNumber: 1,
      levelName: 'Pemula',
      targetDifficulty: 'mudah',
      badges: [],
      streak: 0,
      placementCompleted: false,
      totalAnswered: 0,
    };
    const sm2Items = Object.values(student?.sm2 || {});
    const masteredCount = sm2Items.filter((item) => item.mastered).length;
    sendJson(res, 200, {
      profile: adaptive,
      masteredCount,
      totalTracked: sm2Items.length,
      badgesCatalog: BADGE_DEFINITIONS,
    });
    return;
  }

  // Pillar A: Placement Test Questions
  if (pathname === '/api/adaptive/placement' && req.method === 'GET') {
    const level = url.searchParams.get('level') || 'sd';
    const curriculum = url.searchParams.get('curriculum') || 'merdeka';
    const phase = url.searchParams.get('phase') || 'a';
    const subjectId = url.searchParams.get('subjectId') || 'matematika';
    const questions = getPlacementQuestions(level, curriculum, phase, subjectId);
    sendJson(res, 200, { questions, count: questions.length });
    return;
  }

  // Pillar A: Submit Placement Test
  if (pathname === '/api/adaptive/placement/submit' && req.method === 'POST') {
    const body = await readBody(req);
    const { studentId, level = 'sd', curriculum = 'merdeka', phase = 'a', subjectId = 'matematika', answers = {} } = body;
    const targetUserId = studentId || user?.id;
    const evaluation = evaluatePlacementTest(level, curriculum, phase, subjectId, answers);

    if (targetUserId && store.users[targetUserId]) {
      const u = store.users[targetUserId];
      u.adaptive = u.adaptive || { badges: [], streak: 0, totalAnswered: 0 };
      u.adaptive.levelNumber = evaluation.levelNumber;
      u.adaptive.levelName = evaluation.levelName;
      u.adaptive.targetDifficulty = evaluation.targetDifficulty;
      u.adaptive.xp = (u.adaptive.xp || 0) + evaluation.xpEarned;
      u.adaptive.placementCompleted = true;
      u.adaptive.totalAnswered = (u.adaptive.totalAnswered || 0) + (evaluation.totalQuestions || 10);
      const existingBadges = new Set(u.adaptive.badges || []);
      for (const b of evaluation.badgesEarned) existingBadges.add(b);
      u.adaptive.badges = [...existingBadges];
      await persistStore();
    }

    sendJson(res, 200, {
      result: evaluation,
      message: `Tes penempatan selesai! Level awal Anda: Level ${evaluation.levelNumber} (${evaluation.levelName}). +${evaluation.xpEarned} XP!`,
    });
    return;
  }

  // Pillar A: Next Adaptive Question
  if (pathname === '/api/adaptive/next-question' && req.method === 'GET') {
    const level = url.searchParams.get('level') || 'sd';
    const curriculum = url.searchParams.get('curriculum') || 'merdeka';
    const phase = url.searchParams.get('phase') || 'a';
    const subjectId = url.searchParams.get('subjectId') || 'matematika';
    const studentId = url.searchParams.get('studentId') || user?.id;
    const excluded = (url.searchParams.get('excludeIds') || '').split(',').filter(Boolean);

    const quiz = quizFor(level, curriculum, phase, subjectId);
    if (!quiz) {
      sendJson(res, 404, { error: 'Kuis tidak ditemukan untuk jenjang dan mapel tersebut.' });
      return;
    }

    const student = studentId ? store.users[studentId] : user;
    const targetDifficulty = student?.adaptive?.targetDifficulty || 'mudah';

    // Combine quiz questions and approved custom bank questions for this subject/level
    const customMatch = (store.bankQuestions || []).filter((q) => q.level === level && q.subjectId === subjectId);
    const pool = [...(quiz.questions || []), ...customMatch];

    // Priority 1: Match targetDifficulty and not yet in excluded
    let available = pool.filter((q) => !excluded.includes(q.id) && q.difficulty === targetDifficulty);
    // Priority 2: Not yet in excluded
    if (!available.length) available = pool.filter((q) => !excluded.includes(q.id));
    // Priority 3: Fallback to all questions
    if (!available.length) available = pool;

    const chosen = available[Math.floor(Math.random() * available.length)];
    if (!chosen) {
      sendJson(res, 404, { error: 'Tidak ada soal tersedia.' });
      return;
    }

    sendJson(res, 200, {
      question: {
        id: chosen.id,
        prompt: chosen.prompt,
        choices: chosen.choices,
        difficulty: chosen.difficulty || targetDifficulty,
        subjectId,
        level,
        topic: quiz.topic,
        cpKdTag: chosen.cpKdTag || null,
      },
    });
    return;
  }

  // Pillar A: Submit Adaptive Answer
  if (pathname === '/api/adaptive/answer' && req.method === 'POST') {
    const body = await readBody(req);
    const { studentId, questionId, choice, level = 'sd', curriculum = 'merdeka', phase = 'a', subjectId = 'matematika' } = body;
    const targetUserId = studentId || user?.id;

    const quiz = quizFor(level, curriculum, phase, subjectId);
    const customMatch = (store.bankQuestions || []).find((q) => q.id === questionId);
    const question = quiz?.questions?.find((q) => q.id === questionId) || customMatch;

    if (!question) {
      sendJson(res, 404, { error: 'Pertanyaan tidak ditemukan.' });
      return;
    }

    const isCorrect = Number(choice) === question.answer;
    let studentAdaptive = null;

    if (targetUserId && store.users[targetUserId]) {
      const u = store.users[targetUserId];
      u.adaptive = u.adaptive || {
        xp: 0,
        levelNumber: 1,
        levelName: 'Pemula',
        targetDifficulty: 'mudah',
        badges: [],
        streak: 0,
        placementCompleted: false,
        totalAnswered: 0,
      };
      u.adaptive.totalAnswered = (u.adaptive.totalAnswered || 0) + 1;

      if (isCorrect) {
        u.adaptive.xp += 15;
        u.adaptive.streak += 1;
        if (u.adaptive.streak >= 3 && !u.adaptive.badges.includes('streak_3')) {
          u.adaptive.badges.push('streak_3');
        }
        if (u.adaptive.totalAnswered >= 50 && !u.adaptive.badges.includes('quiz_complete_50')) {
          u.adaptive.badges.push('quiz_complete_50');
        }
        // Adaptive level up based on XP
        const calculatedLevel = Math.min(5, 1 + Math.floor(u.adaptive.xp / 100));
        if (calculatedLevel > u.adaptive.levelNumber) {
          u.adaptive.levelNumber = calculatedLevel;
          const levelNames = ['Pemula', 'Dasar', 'Berkembang', 'Cakap', 'Mahir Unggul'];
          u.adaptive.levelName = levelNames[calculatedLevel - 1];
          u.adaptive.targetDifficulty = calculatedLevel >= 4 ? 'sulit' : calculatedLevel >= 3 ? 'sedang' : 'mudah';
        }
      } else {
        u.adaptive.streak = 0;
        // Level adjustment downward if struggled
        if (u.adaptive.levelNumber > 1 && u.adaptive.xp % 100 < 20) {
          u.adaptive.levelNumber -= 1;
          const levelNames = ['Pemula', 'Dasar', 'Berkembang', 'Cakap', 'Mahir Unggul'];
          u.adaptive.levelName = levelNames[u.adaptive.levelNumber - 1];
          u.adaptive.targetDifficulty = u.adaptive.levelNumber >= 4 ? 'sulit' : u.adaptive.levelNumber >= 3 ? 'sedang' : 'mudah';
        }

        // Add to Spaced Repetition (SM-2) queue
        u.sm2 = u.sm2 || {};
        if (!u.sm2[questionId]) {
          u.sm2[questionId] = {
            questionId,
            prompt: question.prompt,
            choices: question.choices,
            answer: question.answer,
            explanation: question.explanation,
            subjectId,
            level,
            repetitions: 0,
            easeFactor: 2.5,
            interval: 1,
            streak: 0,
            mastered: false,
            nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          };
        }
      }

      await persistStore();
      studentAdaptive = u.adaptive;
    }

    sendJson(res, 200, {
      isCorrect,
      correctAnswer: question.answer,
      explanation: question.explanation,
      adaptive: studentAdaptive,
      completed50: studentAdaptive ? studentAdaptive.totalAnswered >= 50 : false,
    });
    return;
  }

  // Pillar B: AI Tutor Step-by-Step & Similar Practice Question
  if (pathname === '/api/ai/tutor' && req.method === 'POST') {
    const body = await readBody(req);
    const { questionId, prompt, choices, answer, choice, explanation, subject, level } = body;
    try {
      const tutorResult = await getTutorExplanation({
        questionId: questionId || 'generic',
        prompt: prompt || 'Pertanyaan',
        choices: choices || [],
        answer: answer !== undefined ? answer : 0,
        choice: choice !== undefined ? choice : 0,
        explanation: explanation || 'Penjelasan materi',
        subject: subject || 'Mata Pelajaran',
        level: level || 'Jenjang',
      });
      sendJson(res, 200, tutorResult);
    } catch (err) {
      console.warn('[AI Tutor Endpoint Error]', err.message);
      sendJson(res, 500, { error: 'Gagal memanggil Tutor AI: ' + err.message });
    }
    return;
  }

  // Pillar B: SM-2 Spaced Repetition Queue
  if (pathname === '/api/sm2/queue' && req.method === 'GET') {
    const studentId = url.searchParams.get('studentId') || user?.id;
    const student = studentId ? store.users[studentId] : user;
    const queue = Object.values(student?.sm2 || {}).filter((item) => !item.mastered);
    sendJson(res, 200, {
      queue,
      count: queue.length,
      dueCount: queue.filter((item) => !item.nextReviewDate || new Date(item.nextReviewDate) <= new Date()).length,
    });
    return;
  }

  // Pillar B: SM-2 Reschedule ("Paham?")
  if (pathname === '/api/sm2/reschedule' && req.method === 'POST') {
    const body = await readBody(req);
    const { studentId, questionId, understood, quality } = body;
    const targetUserId = studentId || user?.id;

    if (!targetUserId || !store.users[targetUserId]) {
      sendJson(res, 404, { error: 'Akun siswa tidak ditemukan.' });
      return;
    }

    const u = store.users[targetUserId];
    u.sm2 = u.sm2 || {};
    const current = u.sm2[questionId] || {
      questionId,
      repetitions: 0,
      easeFactor: 2.5,
      interval: 1,
      streak: 0,
      mastered: false,
    };

    // Quality: 4-5 if understood, 1-2 if not
    const q = quality !== undefined ? quality : (understood ? 4 : 2);
    const updated = calculateSM2(current, q);
    u.sm2[questionId] = { ...current, ...updated };

    if (updated.mastered) {
      u.adaptive = u.adaptive || { badges: [] };
      u.adaptive.badges = u.adaptive.badges || [];
      if (!u.adaptive.badges.includes('master_topic')) {
        u.adaptive.badges.push('master_topic');
      }
    }

    await persistStore();
    sendJson(res, 200, {
      sm2: u.sm2[questionId],
      mastered: updated.mastered,
      streak: updated.streak,
      nextReviewDate: updated.nextReviewDate,
    });
    return;
  }

  // Pillar B: Spaced Repetition Mastery Map (Peta Penguasaan)
  if (pathname === '/api/sm2/mastery-map' && req.method === 'GET') {
    const studentId = url.searchParams.get('studentId') || user?.id;
    const student = studentId ? store.users[studentId] : user;
    const sm2Items = Object.values(student?.sm2 || {});
    const mastered = sm2Items.filter((i) => i.mastered);
    const inProgress = sm2Items.filter((i) => !i.mastered);

    // Group by subject
    const bySubject = {};
    for (const item of sm2Items) {
      const sub = item.subjectId || 'umum';
      if (!bySubject[sub]) bySubject[sub] = { total: 0, mastered: 0, inProgress: 0 };
      bySubject[sub].total += 1;
      if (item.mastered) bySubject[sub].mastered += 1;
      else bySubject[sub].inProgress += 1;
    }

    sendJson(res, 200, {
      totalTracked: sm2Items.length,
      masteredCount: mastered.length,
      inProgressCount: inProgress.length,
      bySubject,
      masteredItems: mastered,
      inProgressItems: inProgress,
    });
    return;
  }

  // Pillar C: Teacher CMS Question Bank (Tambah Soal & List Soal)
  if (pathname === '/api/cms/questions' && req.method === 'POST') {
    const roleError = requireRole(user, ['teacher', 'admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }

    const body = await readBody(req);
    const { prompt, choices, answer, explanation, cpKdTag, difficulty, subjectId, level } = body;

    // Automatic validation: format, 4 choices, valid answer, explanation
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      sendJson(res, 400, { error: 'Soal (prompt) harus berupa teks minimal 5 karakter.' });
      return;
    }
    if (!Array.isArray(choices) || choices.length !== 4 || choices.some((c) => typeof c !== 'string' || !c.trim())) {
      sendJson(res, 400, { error: 'Soal harus memiliki tepat 4 opsi pilihan teks yang tidak kosong.' });
      return;
    }
    const answerIndex = Number(answer);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
      sendJson(res, 400, { error: 'Kunci jawaban harus berupa indeks opsi antara 0 dan 3.' });
      return;
    }
    if (!explanation || typeof explanation !== 'string' || explanation.trim().length < 5) {
      sendJson(res, 400, { error: 'Pembahasan soal wajib diisi minimal 5 karakter.' });
      return;
    }
    if (!cpKdTag || typeof cpKdTag !== 'string' || cpKdTag.trim().length < 2) {
      sendJson(res, 400, { error: 'Tag Capaian Pembelajaran (CP) / Kompetensi Dasar (KD) wajib diisi.' });
      return;
    }

    const validDifficulties = ['mudah', 'sedang', 'sulit'];
    const chosenDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'sedang';

    const newQuestion = {
      id: `q-bank-${crypto.randomUUID()}`,
      prompt: prompt.trim(),
      choices: choices.map((c) => c.trim()),
      answer: answerIndex,
      explanation: explanation.trim(),
      cpKdTag: cpKdTag.trim().toUpperCase(),
      difficulty: chosenDifficulty,
      subjectId: subjectId || 'matematika',
      level: level || 'sd',
      author: user?.name || 'Guru',
      authorId: user?.id || null,
      status: 'approved',
      createdAt: new Date().toISOString(),
    };

    store.bankQuestions = store.bankQuestions || [];
    store.bankQuestions.unshift(newQuestion);
    await persistStore();

    sendJson(res, 201, {
      question: newQuestion,
      message: 'Soal berhasil divalidasi dan disimpan ke Bank Soal!',
    });
    return;
  }

  if (pathname === '/api/cms/questions' && req.method === 'GET') {
    const subjectId = url.searchParams.get('subjectId');
    const level = url.searchParams.get('level');
    const difficulty = url.searchParams.get('difficulty');
    const cpKdTag = url.searchParams.get('cpKdTag');

    let questions = store.bankQuestions || [];
    if (subjectId) questions = questions.filter((q) => q.subjectId === subjectId);
    if (level) questions = questions.filter((q) => q.level === level);
    if (difficulty) questions = questions.filter((q) => q.difficulty === difficulty);
    if (cpKdTag) questions = questions.filter((q) => q.cpKdTag && q.cpKdTag.includes(cpKdTag.toUpperCase()));

    sendJson(res, 200, { questions, total: questions.length });
    return;
  }

  // Pillar C: Live Classroom Quiz Management
  if (pathname === '/api/live/create-room' && req.method === 'POST') {
    const roleError = requireRole(user, ['teacher', 'admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }

    const body = await readBody(req);
    const room = createRoom(user.id, user.name, body);
    sendJson(res, 201, { room });
    return;
  }

  if (pathname.startsWith('/api/live/room/') && req.method === 'GET') {
    const pin = pathname.replace('/api/live/room/', '').trim();
    const room = getRoom(pin);
    if (!room) {
      sendJson(res, 404, { error: 'Ruang kuis kelas dengan PIN tersebut tidak ditemukan.' });
      return;
    }
    sendJson(res, 200, { room: roomView(room) });
    return;
  }

  if (pathname === '/api/live/join' && req.method === 'POST') {
    const body = await readBody(req);
    const { pin, studentId, studentName } = body;
    const finalStudentId = studentId || user?.id || `student-${crypto.randomUUID()}`;
    const finalName = studentName || user?.name || 'Siswa';
    const result = joinStudent(pin, finalStudentId, finalName);
    if (result.error) {
      sendJson(res, result.status || 400, result);
      return;
    }
    sendJson(res, 200, { ...result, studentId: finalStudentId });
    return;
  }

  if (pathname === '/api/live/submit-answer' && req.method === 'POST') {
    const body = await readBody(req);
    const { pin, studentId, questionIndex, choiceIndex, timeTakenMs } = body;
    const finalStudentId = studentId || user?.id;
    const result = submitAnswer(pin, finalStudentId, questionIndex, choiceIndex, timeTakenMs);
    if (result.error) {
      sendJson(res, result.status || 400, result);
      return;
    }
    sendJson(res, 200, result);
    return;
  }

  if (pathname === '/api/live/next-question' && req.method === 'POST') {
    const roleError = requireRole(user, ['teacher', 'admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }

    const body = await readBody(req);
    const { pin } = body;
    const result = nextQuestion(pin, user.id);
    if (result.error) {
      sendJson(res, result.status || 400, result);
      return;
    }
    sendJson(res, 200, result);
    return;
  }

  if (pathname === '/api/live/show-review' && req.method === 'POST') {
    const roleError = requireRole(user, ['teacher', 'admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }

    const body = await readBody(req);
    const { pin } = body;
    const result = showReview(pin, user.id);
    if (result.error) {
      sendJson(res, result.status || 400, result);
      return;
    }
    sendJson(res, 200, result);
    return;
  }

  // Pillar C: Teacher Class Dashboard with Remedial Recommendations
  const remedialMatch = pathname.match(/^\/api\/classes\/([a-zA-Z0-9_-]+)\/remedial$/);
  if (remedialMatch && req.method === 'GET') {
    const roleError = requireRole(user, ['teacher', 'admin']);
    if (roleError) { sendJson(res, roleError.status, { error: roleError.error }); return; }

    const classId = remedialMatch[1];
    const classroom = store.classes[classId];
    if (!classroom) {
      sendJson(res, 404, { error: 'Kelas tidak ditemukan.' });
      return;
    }

    const studentIds = classroom.studentIds || [];
    const recommendations = [];

    for (const sid of studentIds) {
      const studentUser = store.users[sid];
      const studentAttempts = (store.attempts[sid] || []).filter((a) => a.status === 'completed');
      const studentSM2 = Object.values(studentUser?.sm2 || {});
      const weakTopics = [];

      for (const attempt of studentAttempts) {
        if (attempt.score < 70 && !weakTopics.some((t) => t.topic === attempt.topic)) {
          weakTopics.push({
            topic: attempt.topic,
            subject: attempt.subject,
            score: attempt.score,
            reason: `Skor kuis ${attempt.score}% (di bawah KKM 70%)`,
          });
        }
      }

      // Check SM-2 items needing review
      const unmasteredCount = studentSM2.filter((i) => !i.mastered).length;
      if (unmasteredCount > 0 && weakTopics.length === 0) {
        weakTopics.push({
          topic: 'Pengulangan Soal Esensial',
          subject: 'Review Berkala',
          score: 65,
          reason: `${unmasteredCount} konsep sedang dalam antrean pengulangan SM-2`,
        });
      }

      recommendations.push({
        studentId: sid,
        studentName: studentUser?.name || 'Siswa',
        adaptiveLevel: studentUser?.adaptive?.levelName || 'Pemula',
        xp: studentUser?.adaptive?.xp || 0,
        needsRemedial: weakTopics.length > 0,
        weakTopics,
        recommendedAction: weakTopics.length > 0
          ? `Tugaskan latihan remedial intensif pada ${weakTopics.map((w) => w.topic).join(', ')}.`
          : 'Pemahaman materi tuntas. Berikan materi pengayaan.',
      });
    }

    sendJson(res, 200, {
      classId,
      className: classroom.name,
      totalStudents: studentIds.length,
      remedialCount: recommendations.filter((r) => r.needsRemedial).length,
      recommendations,
    });
    return;
  }

  sendJson(res, 404, { error: 'Rute API tidak ditemukan.' });
}

const frontendDir = path.resolve(__dirname, '../../frontend');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

async function serveFrontend(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  let requestedPath;
  try {
    requestedPath = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
  let filePath = path.resolve(frontendDir, relativePath);
  const pathFromRoot = path.relative(frontendDir, filePath);
  if (pathFromRoot.startsWith('..') || path.isAbsolute(pathFromRoot)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    let stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fs.stat(filePath);
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const contents = await fs.readFile(filePath);
    const isCodeOrDoc = ['.html', '.js', '.json', '.webmanifest'].includes(ext);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': isCodeOrDoc ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
    });
    res.end(req.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    if (!path.extname(relativePath)) {
      try {
        const indexPath = path.resolve(frontendDir, 'index.html');
        const contents = await fs.readFile(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(req.method === 'HEAD' ? undefined : contents);
        return;
      } catch {}
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('File frontend tidak ditemukan.');
  }
}

const server = http.createServer(async (req, res) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  metrics.requests += 1;
  withRequestId(res, requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.on('finish', () => {
    if (res.statusCode >= 400) metrics.errors += 1;
    const durationMs = Date.now() - startedAt;
    const statusGroup = `${Math.floor(res.statusCode / 100)}xx`;
    if (metrics.responses[statusGroup] !== undefined) metrics.responses[statusGroup] += 1;
    metrics.latencyBucketsMs[durationMs <= 100 ? 'le100' : durationMs <= 500 ? 'le500' : durationMs <= 1000 ? 'le1000' : 'gt1000'] += 1;
    console.log(JSON.stringify({ level: res.statusCode >= 500 ? 'error' : 'info', event: 'http_request', requestId, method: req.method, path: String(req.url || '').split('?')[0], status: res.statusCode, durationMs }));
  });

  const origin = req.headers.origin;
  const isAllowedOrigin = !origin ||
    allowedOrigins.includes(origin) ||
    allowedOrigins.includes('*') ||
    origin === `http://${req.headers.host}` ||
    origin === `https://${req.headers.host}` ||
    process.env.NODE_ENV !== 'production';

  if (origin && !isAllowedOrigin) { sendJson(res, 403, { error: 'Origin tidak diizinkan.' }); return; }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (!url.pathname.startsWith('/api/')) {
    await serveFrontend(req, res, url);
    return;
  }

  if (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY_TLS === '1' && req.headers['x-forwarded-proto'] !== 'https') {
    sendJson(res, 400, { error: 'Koneksi HTTPS diperlukan.' }); return;
  }
  if (!rateAllowed(req)) {
    metrics.rateLimited += 1;
    res.setHeader('Retry-After', String(Math.ceil(RATE_WINDOW_MS / 1000)));
    sendJson(res, 429, { error: 'Terlalu banyak permintaan. Coba lagi sebentar.' }); return;
  }
  try {
    await handleApi(req, res, url, authUser(req));
  } catch (error) {
    if (!error.status || error.status >= 500) console.error(JSON.stringify({ level: 'error', event: 'api_error', requestId, message: error.message }));
    if (!res.headersSent) sendJson(res, error.status || 500, { error: error.status ? error.message : 'Terjadi kesalahan pada server.' });
  }
});

server.timeout = REQUEST_TIMEOUT_MS;
server.requestTimeout = REQUEST_TIMEOUT_MS;

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/ws/live-class') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  } catch {
    socket.destroy();
  }
});

wss.on('connection', (ws, request) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const pin = url.searchParams.get('pin');
    const studentId = url.searchParams.get('studentId');
    const studentName = url.searchParams.get('studentName') || 'Siswa';
    const isTeacher = url.searchParams.get('teacher') === '1';

    if (!pin) {
      ws.close(1008, 'PIN required');
      return;
    }
    const room = getRoom(pin);
    if (!room) {
      ws.close(1008, 'Room not found');
      return;
    }

    room.sockets.add(ws);
    ws.roomPin = pin;
    ws.isTeacher = isTeacher;
    ws.studentId = studentId;

    if (studentId && !isTeacher) {
      joinStudent(pin, studentId, studentName, ws);
    }

    try {
      ws.send(JSON.stringify({ event: 'room_state', data: roomView(room) }));
    } catch {}

    ws.on('message', (msgData) => {
      try {
        const msg = JSON.parse(msgData.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {}
    });

    ws.on('close', () => {
      room.sockets.delete(ws);
      if (studentId && !isTeacher) {
        const s = room.students.get(studentId);
        if (s) s.isConnected = false;
        broadcastToRoom(room, 'student_left', { studentId, leaderboard: roomView(room).leaderboard });
      }
    });
  } catch (err) {
    console.warn('[WS Connection Error]', err.message);
  }
});

const rateCleanup = setInterval(() => {
  const expiredBefore = Date.now() - RATE_WINDOW_MS;
  for (const [key, window] of rateWindows) if (window.startedAt < expiredBefore) rateWindows.delete(key);
  for (const [token, session] of sessions) if (session.expiresAt <= Date.now()) sessions.delete(token);
}, RATE_WINDOW_MS).unref();

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (password && password.length < 12) throw new Error('ADMIN_PASSWORD harus terdiri dari sedikitnya 12 karakter.');
  if (!email || !password) return;
  const credentials = hashPassword(password);
  const account = Object.values(store.users).find((entry) => entry.email === email);
  if (account) {
    account.role = 'admin';
    account.salt = credentials.salt;
    account.passwordHash = credentials.hash;
  } else {
    const id = `user-${crypto.randomUUID()}`;
    store.users[id] = { id, email, name: 'Administrator', role: 'admin', salt: credentials.salt, passwordHash: credentials.hash, createdAt: new Date().toISOString() };
  }
  await persistStore();
}

async function seedDeveloper() {
  const email = developerEmail;
  let devAccount = Object.values(store.users).find((entry) => entry.email === email);
  if (devAccount) {
    devAccount.role = 'admin';
    devAccount.name = devAccount.name || 'Satrio S Utomo (Developer)';
  } else {
    const id = 'user-dev-satrio';
    const credentials = hashPassword('developer-cerdas-cermat-2026');
    devAccount = {
      id,
      email,
      name: 'Satrio S Utomo (Developer)',
      role: 'admin',
      salt: credentials.salt,
      passwordHash: credentials.hash,
      createdAt: new Date().toISOString(),
    };
    store.users[id] = devAccount;
  }
  await persistStore();
  return devAccount;
}

async function start() {
  await Promise.all([loadStore(), contentStore.load()]);
  await seedAdmin();
  await seedDeveloper();
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.DATABASE_URL) console.warn('[AI Studio] DATABASE_URL tidak dikonfigurasi, menggunakan penyimpanan lokal JSON.');
    if (process.env.TRUST_PROXY_TLS !== '1') console.warn('[AI Studio] TRUST_PROXY_TLS tidak aktif.');
    if (allowedOrigins.length && !allowedOrigins.some((origin) => !origin.startsWith('https://'))) console.warn('[AI Studio] CORS_ORIGIN production.');
  }
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => console.log(JSON.stringify({ level: 'info', event: 'service_started', service: 'cerdas-cermat-app', host, port, storage: databasePool ? 'postgres' : 'json-local' })));
}

if (require.main === module) start().catch((error) => {
  console.error(JSON.stringify({ level: 'fatal', event: 'startup_failed', message: error.message }));
  process.exitCode = 1;
});

module.exports = { server, start, handleApi, validateCatalog, serveFrontend };
