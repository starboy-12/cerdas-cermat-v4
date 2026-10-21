'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateContent, validateQuestion, validateCatalog } = require('../src/validation');
const { mergeValue } = require('../src/state-merge');

test('soal menolak kunci, pilihan, dan tingkat kesulitan yang tidak valid', () => {
  const valid = { id: 'q-1', prompt: 'Berapakah 1 + 1?', choices: ['1', '2', '3', '4'], answer: 1, difficulty: 'mudah', explanation: 'Satu ditambah satu sama dengan dua.' };
  assert.deepEqual(validateQuestion(valid), []);
  assert.ok(validateQuestion({ ...valid, answer: 4 }).some((issue) => issue.includes('answer')));
  assert.ok(validateQuestion({ ...valid, difficulty: 'ekstra' }).some((issue) => issue.includes('difficulty')));
  assert.ok(validateQuestion({ ...valid, choices: ['sama', 'sama'] }).some((issue) => issue.includes('berulang')));
});

test('dokumen konten memerlukan status, sumber, tujuan, dan soal yang valid', () => {
  const content = { id: 'materi-1', schemaVersion: 1, type: 'material', title: 'Bilangan', curriculum: 'merdeka', level: 'sd', phase: 'a', subjectId: 'matematika', topicId: 'bilangan-1', objectives: ['Mengenali bilangan.'], sources: [{ title: 'Sumber', url: 'https://example.test' }], status: 'draft', reviewer: null, reviewedAt: null };
  assert.equal(validateContent(content).valid, true);
  assert.equal(validateContent({ ...content, status: 'live' }).valid, false);
  assert.equal(validateContent({ ...content, type: 'quiz', questions: [] }).valid, false);
});

test('validasi katalog mencegah ID fase yang berulang', () => {
  assert.equal(validateCatalog([{ id: 'sd', phases: [{ id: 'a' }, { id: 'b' }] }]).valid, true);
  assert.equal(validateCatalog([{ id: 'sd', phases: [{ id: 'a' }, { id: 'a' }] }]).valid, false);
});

test('penggabungan state konkuren mempertahankan jawaban dan percobaan dari dua penulis', () => {
  const baseline = { progress: { student: { pack: { answers: {}, page: 0 } } }, attempts: { student: [] } };
  const writerA = { progress: { student: { pack: { answers: { q1: { choice: 1 } }, page: 1 } } }, attempts: { student: [{ id: 'attempt-a' }] } };
  const writerB = { progress: { student: { pack: { answers: { q2: { choice: 2 } }, page: 2 } } }, attempts: { student: [{ id: 'attempt-b' }] } };
  const merged = mergeValue(baseline, writerA, writerB);
  assert.deepEqual(Object.keys(merged.progress.student.pack.answers).sort(), ['q1', 'q2']);
  assert.deepEqual(merged.attempts.student.map((entry) => entry.id).sort(), ['attempt-a', 'attempt-b']);
});
