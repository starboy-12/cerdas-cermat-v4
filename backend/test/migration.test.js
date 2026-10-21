'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePayload } = require('../scripts/migrate-json-to-postgres');

test('migrasi memvalidasi data progres dan keanggotaan kelas serta menghitung manifest', () => {
  const payload = {
    progress: { student1: { 'sd:merdeka:a': { page: 2, answers: { question1: { choice: 1 } } } } },
    attempts: { student1: [{ id: 'attempt1' }] },
    readingProgress: { student1: { 'sd:lesson:topic1': { page: 3 } } },
    users: {
      teacher1: { role: 'teacher' },
      student1: { role: 'student' },
    },
    classes: { 'class-a': { id: 'class-a', name: 'Kelas A', teacherIds: ['teacher1'], studentIds: ['student1'] } },
  };

  const result = validatePayload(payload);
  assert.deepEqual([...result.studentIds], ['student1']);
  assert.equal(result.expectedPacks, 1);
  assert.equal(result.expectedAnswers, 1);
  assert.equal(result.expectedAttempts, 1);
  assert.equal(result.expectedReading, 1);
});

test('migrasi menolak jawaban, halaman, dan anggota kelas yang tidak valid', () => {
  const base = { progress: {}, attempts: {}, readingProgress: {}, users: {}, classes: {} };
  assert.throws(() => validatePayload({ ...base, progress: { student1: { pack: { page: -1, answers: {} } } } }), /nomor halaman tidak valid/);
  assert.throws(() => validatePayload({ ...base, progress: { student1: { pack: { page: 0, answers: { question1: { choice: 8 } } } } } }), /Jawaban question1 tidak valid/);
  assert.throws(() => validatePayload({ ...base, classes: { 'class-a': { id: 'class-a', name: 'Kelas A', teacherIds: ['missing'], studentIds: [] } } }), /Akun guru missing/);
});
