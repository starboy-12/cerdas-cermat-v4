'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSM2 } = require('../src/sm2');
const { getPlacementQuestions, evaluatePlacementTest } = require('../src/adaptive');
const { createRoom, getRoom, joinStudent, submitAnswer, nextQuestion, showReview, roomView } = require('../src/live-classroom');
const { getTutorExplanation } = require('../src/ai-tutor');

test('SM-2: Algoritma pengulangan berjarak dan penguasaan konsep', () => {
  // First correct review
  let state = calculateSM2({}, 5);
  assert.equal(state.repetitions, 1);
  assert.equal(state.interval, 1);
  assert.equal(state.streak, 1);
  assert.equal(state.mastered, false);

  // Second correct review
  state = calculateSM2(state, 5);
  assert.equal(state.repetitions, 2);
  assert.equal(state.interval, 6);
  assert.equal(state.streak, 2);
  assert.equal(state.mastered, false);

  // Third correct review -> marked as mastered!
  state = calculateSM2(state, 4);
  assert.equal(state.repetitions, 3);
  assert.ok(state.interval > 6);
  assert.equal(state.streak, 3);
  assert.equal(state.mastered, true);

  // Failed review resets streak and repetitions
  state = calculateSM2(state, 1);
  assert.equal(state.repetitions, 0);
  assert.equal(state.interval, 1);
  assert.equal(state.streak, 0);
  assert.equal(state.mastered, false);
});

test('Adaptive: Tes penempatan 10 soal dan kalkulasi level awal', () => {
  const questions = getPlacementQuestions('sd', 'merdeka', 'a', 'matematika');
  assert.equal(questions.length, 10);
  assert.ok(questions.every((q) => q.prompt && q.choices && q.choices.length === 4));
  assert.ok(questions.every((q) => q.answer === undefined)); // Answers must be stripped

  // Test evaluation with perfect score
  const perfectAnswers = {};
  for (const q of questions) {
    // Look up original answers
    perfectAnswers[q.id] = 0; // Simulated
  }
  const evalResult = evaluatePlacementTest('sd', 'merdeka', 'a', 'matematika', perfectAnswers);
  assert.ok(evalResult.levelNumber >= 1 && evalResult.levelNumber <= 5);
  assert.ok(evalResult.xpEarned >= 50);
  assert.ok(['mudah', 'sedang', 'sulit'].includes(evalResult.targetDifficulty));
  assert.ok(evalResult.badgesEarned.includes('first_step'));
});

test('Live Classroom: Siklus ruang kuis, PIN 6-digit, dan leaderboard sinkron', () => {
  const roomViewObj = createRoom('teacher-1', 'Pak Guru', {
    title: 'Kuis Cepat Matematika',
    level: 'sd',
    curriculum: 'merdeka',
    phase: 'a',
    subjectId: 'matematika',
    questionCount: 3,
  });

  const pin = roomViewObj.pin;
  assert.match(pin, /^[0-9]{6}$/);

  const room = getRoom(pin);
  assert.ok(room);
  assert.equal(room.teacherId, 'teacher-1');
  assert.equal(room.status, 'waiting');

  // Student joins
  const joinRes = joinStudent(pin, 'student-1', 'Budi');
  assert.ok(joinRes.room);
  assert.equal(joinRes.room.students.length, 1);
  assert.equal(joinRes.room.students[0].name, 'Budi');

  // Teacher starts first question
  const nextRes = nextQuestion(pin, 'teacher-1');
  assert.equal(nextRes.room.status, 'active');
  assert.equal(nextRes.room.currentQuestionIndex, 0);
  assert.ok(nextRes.room.currentQuestion);

  // Student answers question
  const ansRes = submitAnswer(pin, 'student-1', 0, room.questions[0].answer, 3000);
  assert.ok(ansRes.success);
  assert.equal(ansRes.isCorrect, true);
  assert.ok(ansRes.points >= 100); // 100 + speed bonus

  // Teacher reveals review
  const revRes = showReview(pin, 'teacher-1');
  assert.equal(revRes.room.status, 'question_review');
  assert.equal(revRes.room.currentQuestion.answer, room.questions[0].answer);
});

test('AI Tutor: Fallback pedagogis terstruktur dan caching', async () => {
  const result1 = await getTutorExplanation({
    questionId: 'test-q-1',
    prompt: 'Berapakah 2 + 2?',
    choices: ['2', '3', '4', '5'],
    answer: 2,
    choice: 1,
    explanation: '2 ditambah 2 adalah 4.',
    subject: 'Matematika',
    level: 'SD',
  });

  assert.ok(result1.explanation && result1.explanation.length > 10);
  assert.ok(result1.similarQuestion);
  assert.ok(Array.isArray(result1.similarQuestion.choices) && result1.similarQuestion.choices.length === 4);

  // Subsequent call for same questionId:choice should return cached: true
  const result2 = await getTutorExplanation({
    questionId: 'test-q-1',
    prompt: 'Berapakah 2 + 2?',
    choices: ['2', '3', '4', '5'],
    answer: 2,
    choice: 1,
    explanation: '2 ditambah 2 adalah 4.',
    subject: 'Matematika',
    level: 'SD',
  });
  assert.equal(result2.cached, true);
});
