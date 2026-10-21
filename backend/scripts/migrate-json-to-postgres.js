'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const progressFile = path.resolve(process.env.PROGRESS_FILE || path.join(root, 'data/progress.json'));
const importId = process.env.IMPORT_ID || `progress-json-${new Date().toISOString().replace(/[:.]/g, '-')}`;

function plainObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function requireObject(value, label) { if (!plainObject(value)) throw new Error(`${label} harus berupa objek JSON.`); }
function safePage(value, label) { if (!Number.isInteger(value) || value < 0) throw new Error(`${label} memiliki nomor halaman tidak valid.`); }

function validatePayload(payload) {
  for (const field of ['progress', 'attempts', 'readingProgress', 'users', 'classes']) requireObject(payload[field], field);
  const studentIds = new Set([...Object.keys(payload.progress), ...Object.keys(payload.attempts), ...Object.keys(payload.readingProgress)]);
  for (const [classId, classroom] of Object.entries(payload.classes)) {
    if (!plainObject(classroom) || classroom.id !== classId || typeof classroom.name !== 'string' || !classroom.name.trim() || !Array.isArray(classroom.teacherIds) || !Array.isArray(classroom.studentIds)) throw new Error(`Kelas ${classId} tidak valid.`);
    if (new Set(classroom.teacherIds).size !== classroom.teacherIds.length || new Set(classroom.studentIds).size !== classroom.studentIds.length) throw new Error(`Daftar anggota kelas ${classId} memiliki duplikat.`);
    for (const teacherId of classroom.teacherIds) if (payload.users[teacherId]?.role !== 'teacher') throw new Error(`Akun guru ${teacherId} pada kelas ${classId} tidak valid.`);
    for (const studentId of classroom.studentIds) {
      if (payload.users[studentId]?.role !== 'student') throw new Error(`Akun siswa ${studentId} pada kelas ${classId} tidak valid.`);
      studentIds.add(studentId);
    }
  }
  let expectedPacks = 0, expectedAnswers = 0, expectedAttempts = 0, expectedReading = 0;
  for (const [studentId, packs] of Object.entries(payload.progress)) {
    requireObject(packs, `progress.${studentId}`);
    for (const [key, pack] of Object.entries(packs)) {
      requireObject(pack, `progress.${studentId}.${key}`); requireObject(pack.answers || {}, `answers.${key}`);
      safePage(pack.page, `progress.${studentId}.${key}.page`); expectedPacks += 1; expectedAnswers += Object.keys(pack.answers || {}).length;
      for (const [questionId, answer] of Object.entries(pack.answers || {})) {
        if (!plainObject(answer) || !Number.isInteger(answer.choice) || answer.choice < 0 || answer.choice > 5) throw new Error(`Jawaban ${questionId} tidak valid.`);
      }
    }
  }
  for (const [studentId, attempts] of Object.entries(payload.attempts)) {
    if (!Array.isArray(attempts)) throw new Error(`attempts.${studentId} harus berupa daftar.`);
    expectedAttempts += attempts.length;
  }
  for (const [studentId, reading] of Object.entries(payload.readingProgress)) {
    requireObject(reading, `readingProgress.${studentId}`);
    for (const [key, page] of Object.entries(reading)) safePage(typeof page === 'object' ? page.page : page, `readingProgress.${key}`);
    expectedReading += Object.keys(reading).length;
  }
  return { studentIds, expectedPacks, expectedAnswers, expectedAttempts, expectedReading };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL wajib diatur.');
  let payload = { progress: {}, attempts: {}, readingProgress: {}, users: {}, classes: {} };
  try { payload = { ...payload, ...JSON.parse(await fs.readFile(progressFile, 'utf8')) }; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { studentIds, expectedPacks, expectedAnswers, expectedAttempts, expectedReading } = validatePayload(payload);

  let Client;
  try { ({ Client } = require('pg')); }
  catch { throw new Error('Dependency pg belum tersedia. Jalankan npm install di backend/.'); }
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== '0' } : undefined });
  await client.connect();
  try {
    await client.query(await fs.readFile(path.join(root, 'db/schema.sql'), 'utf8'));
    await client.query('BEGIN');
    await client.query('INSERT INTO application_state (id, payload, revision) VALUES (1, $1::jsonb, 1) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, revision = application_state.revision + 1, updated_at = now()', [JSON.stringify(payload)]);

    for (const user of Object.values(payload.users)) {
      await client.query(`INSERT INTO account (id,email,display_name,role,password_hash,password_salt,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,now()))
        ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, display_name=EXCLUDED.display_name, role=EXCLUDED.role, password_hash=EXCLUDED.password_hash, password_salt=EXCLUDED.password_salt`,
      [user.id, user.email, user.name, user.role, user.passwordHash, user.salt, user.createdAt || null]);
      studentIds.add(user.id);
    }
    for (const studentId of studentIds) {
      const accountId = payload.users[studentId] ? studentId : null;
      await client.query('INSERT INTO learning_identity (student_id,account_id) VALUES ($1,$2) ON CONFLICT (student_id) DO UPDATE SET account_id=COALESCE(EXCLUDED.account_id,learning_identity.account_id)', [studentId, accountId]);
    }
    for (const classroom of Object.values(payload.classes)) {
      await client.query('INSERT INTO learning_class (id,name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name', [classroom.id, classroom.name]);
      for (const teacherId of classroom.teacherIds) await client.query('INSERT INTO class_teacher (class_id,teacher_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [classroom.id, teacherId]);
      for (const studentId of classroom.studentIds) await client.query('INSERT INTO class_student (class_id,student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [classroom.id, studentId]);
    }

    for (const [studentId, records] of Object.entries(payload.attempts)) for (const item of records) {
      const status = item.status || (Number.isInteger(item.score) ? 'completed' : 'abandoned');
      const attemptId = String(item.id || `${importId}-${studentId}-${expectedAttempts}`);
      await client.query(`INSERT INTO quiz_attempt (id,student_id,package_key,status,score,correct_count,question_count,started_at,completed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [attemptId, studentId, [item.bookId,item.curriculum,item.phase,item.subjectId].filter(Boolean).join(':'), status, item.score ?? null, item.correct ?? null, item.total ?? null, item.startedAt || null, item.completedAt || null]);
    }

    for (const [studentId, packs] of Object.entries(payload.progress)) for (const [packageKey, progress] of Object.entries(packs)) {
      let activeAttemptId = progress.attemptId || `${importId}-${studentId}-${packageKey}`;
      if (Object.keys(progress.answers || {}).length && !progress.attemptId) {
        await client.query(`INSERT INTO quiz_attempt (id,student_id,package_key,status,question_count,started_at)
          VALUES ($1,$2,$3,'started',50,$4) ON CONFLICT (id) DO NOTHING`, [activeAttemptId, studentId, packageKey, progress.startedAt || null]);
      } else if (progress.attemptId) {
        await client.query(`INSERT INTO quiz_attempt (id,student_id,package_key,status,question_count,started_at)
          VALUES ($1,$2,$3,'started',50,$4) ON CONFLICT (id) DO NOTHING`, [activeAttemptId, studentId, packageKey, progress.startedAt || null]);
      }
      await client.query(`INSERT INTO progress_state (student_id,package_key,current_page,active_attempt_id,answer_payload,updated_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,COALESCE($6::timestamptz,now()))
        ON CONFLICT (student_id,package_key) DO UPDATE SET current_page=EXCLUDED.current_page, active_attempt_id=EXCLUDED.active_attempt_id, answer_payload=EXCLUDED.answer_payload, updated_at=EXCLUDED.updated_at`,
      [studentId, packageKey, progress.page || 0, activeAttemptId, JSON.stringify(progress.answers || {}), progress.updatedAt || null]);
      for (const [questionId, answer] of Object.entries(progress.answers || {})) {
        await client.query(`INSERT INTO quiz_attempt_answer (attempt_id,question_id,choice_index,is_correct,explanation,answered_at)
          VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz,now())) ON CONFLICT (attempt_id,question_id) DO UPDATE SET choice_index=EXCLUDED.choice_index,is_correct=EXCLUDED.is_correct,explanation=EXCLUDED.explanation,answered_at=EXCLUDED.answered_at`,
        [activeAttemptId, questionId, answer.choice, typeof answer.correct === 'boolean' ? answer.correct : null, answer.explanation || null, answer.answeredAt || null]);
      }
    }

    for (const [studentId, records] of Object.entries(payload.readingProgress)) for (const [contentKey, value] of Object.entries(records)) {
      const page = typeof value === 'object' ? value.page : value;
      await client.query(`INSERT INTO reading_progress (student_id,content_key,current_page) VALUES ($1,$2,$3)
        ON CONFLICT (student_id,content_key) DO UPDATE SET current_page=EXCLUDED.current_page,updated_at=now()`, [studentId, contentKey, page]);
    }

    const importedStudents = [...studentIds];
    const result = await client.query(`SELECT
      (SELECT count(*) FROM progress_state WHERE student_id = ANY($1::text[])) AS packs,
      (SELECT count(*) FROM quiz_attempt_answer WHERE attempt_id IN (SELECT id FROM quiz_attempt WHERE student_id = ANY($1::text[]))) AS answers,
      (SELECT count(*) FROM quiz_attempt WHERE student_id = ANY($1::text[])) AS attempts,
      (SELECT count(*) FROM reading_progress WHERE student_id = ANY($1::text[])) AS reading`, [importedStudents]);
    const counts = Object.fromEntries(Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)]));
    if (counts.packs < expectedPacks || counts.answers < expectedAnswers || counts.attempts < expectedAttempts || counts.reading < expectedReading) {
      throw new Error(`Pemeriksaan integritas gagal: ${JSON.stringify({ expectedPacks, expectedAnswers, expectedAttempts, expectedReading, counts })}`);
    }
    const manifest = { source: progressFile, importId, expectedPacks, expectedAnswers, expectedAttempts, expectedReading, resultingCounts: counts };
    await client.query('INSERT INTO legacy_import (id,source_file,manifest) VALUES ($1,$2,$3::jsonb) ON CONFLICT (id) DO UPDATE SET imported_at=now(), manifest=EXCLUDED.manifest', [importId, path.basename(progressFile), JSON.stringify(manifest)]);
    await client.query('COMMIT');
    process.stdout.write(`${JSON.stringify({ status: 'ok', ...manifest })}\n`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Migrasi dihentikan: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { validatePayload };
