'use strict';

const { quizFor } = require('../data/quizzes');

const BADGE_DEFINITIONS = [
  { id: 'first_step', name: 'Langkah Pertama', icon: '🌱', description: 'Menyelesaikan tes penempatan atau kuis pertama.' },
  { id: 'streak_3', name: 'Fokus Tajam', icon: '⚡', description: 'Menjawab benar 3 soal berturut-turut.' },
  { id: 'master_topic', name: 'Penguasa Materi', icon: '🏆', description: 'Menguasai 1 topik dengan pengulangan SM-2.' },
  { id: 'quiz_complete_50', name: 'Penjelajah 50 Soal', icon: '🎖️', description: 'Menyelesaikan 50 soal latihan penuh.' },
  { id: 'perfect_100', name: 'Sempurna', icon: '⭐', description: 'Meraih skor 100% pada kuis atau tes penempatan.' },
];

function getPlacementQuestions(level = 'sd', curriculum = 'merdeka', phase = 'a', subjectId = 'matematika') {
  const quiz = quizFor(level, curriculum, phase, subjectId);
  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return [];
  }

  // Ambil 10 soal representatif: 4 mudah, 4 sedang, 2 sulit
  const mudah = quiz.questions.filter((q) => q.difficulty === 'mudah');
  const sedang = quiz.questions.filter((q) => q.difficulty === 'sedang');
  const sulit = quiz.questions.filter((q) => q.difficulty === 'sulit');

  const selected = [
    ...mudah.slice(0, 4),
    ...sedang.slice(0, 4),
    ...sulit.slice(0, 2),
  ];

  // Jika belum cukup 10, isi dari sisa soal kuis
  if (selected.length < 10) {
    const existingIds = new Set(selected.map((q) => q.id));
    for (const q of quiz.questions) {
      if (!existingIds.has(q.id)) {
        selected.push(q);
        existingIds.add(q.id);
        if (selected.length >= 10) break;
      }
    }
  }

  // Return soal tanpa kunci jawaban
  return selected.slice(0, 10).map(({ answer: _ans, ...q }) => q);
}

function evaluatePlacementTest(level = 'sd', curriculum = 'merdeka', phase = 'a', subjectId = 'matematika', answers = {}) {
  const quiz = quizFor(level, curriculum, phase, subjectId);
  if (!quiz) return { score: 0, levelNumber: 1, levelName: 'Pemula', xp: 50, correctCount: 0 };

  const questionMap = new Map(quiz.questions.map((q) => [q.id, q]));
  let correctCount = 0;
  let totalEvaluated = 0;

  for (const [qId, choice] of Object.entries(answers)) {
    const q = questionMap.get(qId);
    if (q) {
      totalEvaluated += 1;
      if (Number(choice) === q.answer) {
        correctCount += 1;
      }
    }
  }

  const scorePct = totalEvaluated > 0 ? Math.round((correctCount / totalEvaluated) * 100) : 0;
  let levelNumber = 1;
  let levelName = 'Pemula';
  let targetDifficulty = 'mudah';

  if (scorePct >= 85) {
    levelNumber = 5;
    levelName = 'Mahir Unggul';
    targetDifficulty = 'sulit';
  } else if (scorePct >= 70) {
    levelNumber = 4;
    levelName = 'Cakap';
    targetDifficulty = 'sedang';
  } else if (scorePct >= 50) {
    levelNumber = 3;
    levelName = 'Berkembang';
    targetDifficulty = 'sedang';
  } else if (scorePct >= 30) {
    levelNumber = 2;
    levelName = 'Dasar';
    targetDifficulty = 'mudah';
  } else {
    levelNumber = 1;
    levelName = 'Pemula';
    targetDifficulty = 'mudah';
  }

  const xpEarned = 50 + correctCount * 15;
  const badgesEarned = ['first_step'];
  if (scorePct === 100) badgesEarned.push('perfect_100');

  return {
    score: scorePct,
    correctCount,
    totalQuestions: totalEvaluated || 10,
    levelNumber,
    levelName,
    targetDifficulty,
    xpEarned,
    badgesEarned,
  };
}

module.exports = {
  BADGE_DEFINITIONS,
  getPlacementQuestions,
  evaluatePlacementTest,
};
