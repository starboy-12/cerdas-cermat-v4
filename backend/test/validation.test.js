'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateContent, validateQuestion, validateCatalog } = require('../src/validation');
const { mergeValue } = require('../src/state-merge');
const { CURRICULA, catalogFor, phasesFor } = require('../data/curriculum-catalog');
const { quizFor } = require('../data/quizzes');

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

test('fase kurikulum sesuai kelas dan setiap katalog memiliki mapel yang dapat dipakai', () => {
  assert.deepEqual(
    CURRICULA.filter((item) => ['kbk', 'ktsp'].includes(item.id)).map((item) => item.name),
    ['Kurikulum 2004 (KBK)', 'Kurikulum 2006 (KTSP)'],
  );
  assert.deepEqual(phasesFor('sd', 'merdeka').map((phase) => phase.id), ['a', 'b', 'c']);
  for (const curriculum of CURRICULA.map((item) => item.id)) {
    for (const [level, expectedCount] of [['tk', curriculum === 'merdeka' ? 1 : 2], ['sd', curriculum === 'merdeka' ? 3 : 6], ['smp', curriculum === 'merdeka' ? 1 : 3], ['sma', curriculum === 'merdeka' ? 2 : 3]]) {
      const phases = phasesFor(level, curriculum);
      assert.equal(phases.length, expectedCount, `${curriculum}/${level} mempunyai pilihan jenjang yang benar`);
      assert.equal(new Set(phases.map((phase) => phase.id)).size, phases.length);
      for (const phase of phases) {
        const catalog = catalogFor(level, curriculum, phase.id);
        assert.ok(catalog, `${curriculum}/${level}/${phase.id} tersedia`);
        assert.ok(catalog.subjects.length > 0, `${curriculum}/${level}/${phase.id} memiliki mata pelajaran`);
        assert.ok(catalog.subjects.every((subject) => subject.topics.length > 0));
        assert.equal(quizFor(level, curriculum, phase.id, catalog.subjects[0].id).questions.length, 50);
      }
    }
  }
  const gradeOneMath = quizFor('sd', 'ktsp', 'kelas-1', 'matematika');
  assert.ok(gradeOneMath.questions.every((question) => !/×|÷|turunan|sin |cos |vektor/i.test(question.prompt)));
  assert.ok(gradeOneMath.questions.every((question) => question.choices.length === 4 && question.choices[question.answer]));
  assert.ok(quizFor('sma', 'ktsp', 'kelas-12', 'matematika').questions.some((question) => /turunan|vektor|peluang/i.test(question.prompt)));
});

test('penggabungan state konkuren mempertahankan jawaban dan percobaan dari dua penulis', () => {
  const baseline = { progress: { student: { pack: { answers: {}, page: 0 } } }, attempts: { student: [] } };
  const writerA = { progress: { student: { pack: { answers: { q1: { choice: 1 } }, page: 1 } } }, attempts: { student: [{ id: 'attempt-a' }] } };
  const writerB = { progress: { student: { pack: { answers: { q2: { choice: 2 } }, page: 2 } } }, attempts: { student: [{ id: 'attempt-b' }] } };
  const merged = mergeValue(baseline, writerA, writerB);
  assert.deepEqual(Object.keys(merged.progress.student.pack.answers).sort(), ['q1', 'q2']);
  assert.deepEqual(merged.attempts.student.map((entry) => entry.id).sort(), ['attempt-a', 'attempt-b']);
});
