'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { activityFeedback, escapeHtml, isCompletedQuiz, publicationLabel, quizProgressLabel, renderActivity } = require('../ui-components');

test('activity component renders accessible, escaped reflection choices', () => {
  const markup = renderActivity({
    title: '<refleksi>',
    prompt: 'Apa yang kamu coba?',
    choices: ['Sudah mencoba', 'Perlu bantuan', 'Contoh lain'],
  });

  assert.match(markup, /<fieldset><legend>Pilih refleksi yang sesuai<\/legend>/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /&lt;refleksi&gt;/);
  assert.doesNotMatch(markup, /<refleksi>/);
  assert.equal((markup.match(/type="radio"/g) || []).length, 3);
});

test('activity component rejects malformed choice lists', () => {
  assert.equal(renderActivity({ prompt: 'Coba', choices: ['Satu'] }), '');
  assert.equal(renderActivity({ prompt: 'Coba', choices: ['Satu', { html: '<b>' }] }), '');
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

test('reflection feedback distinguishes try, help, and retry actions', () => {
  assert.match(activityFeedback('tried'), /Bagus/);
  assert.match(activityFeedback('help'), /meminta bantuan/);
  assert.match(activityFeedback('again'), /coba lagi/);
  assert.match(activityFeedback(''), /Pilih refleksi/);
});

test('topic labels distinguish draft, answered, and completed quizzes', () => {
  const context = { subjectId: 'matematika', bookId: 'sd', phase: 'a', curriculum: 'merdeka' };
  const attempts = [
    { ...context, status: 'abandoned', score: 80 },
    { ...context, status: 'started', score: 90 },
  ];
  assert.equal(isCompletedQuiz(attempts, context), false);
  assert.equal(quizProgressLabel(false, 12, 50), ' · 12/50 dijawab');
  assert.equal(publicationLabel('draft'), ' · draf');
  assert.equal(publicationLabel('published'), '');
  assert.equal(isCompletedQuiz([...attempts, { ...context, status: 'completed', score: 100 }], context), true);
  assert.equal(isCompletedQuiz([{ ...context, score: 100 }], context), true, 'mendukung hasil lama tanpa status');
  assert.equal(quizProgressLabel(true, 12, 50), ' · selesai');
});
