'use strict';

const crypto = require('node:crypto');
const { quizFor } = require('../data/quizzes');

// In-memory room store for live sessions
const rooms = new Map();

function generatePin() {
  let pin = '';
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(pin));
  return pin;
}

function createRoom(teacherId, teacherName, { title = 'Kuis Kelas Live', level = 'sd', curriculum = 'merdeka', phase = 'a', subjectId = 'matematika', questionCount = 5 } = {}) {
  const pin = generatePin();
  const quiz = quizFor(level, curriculum, phase, subjectId);
  const questions = (quiz?.questions || []).slice(0, Math.min(questionCount || 5, (quiz?.questions || []).length));

  const room = {
    pin,
    teacherId,
    teacherName,
    title,
    level,
    curriculum,
    phase,
    subjectId,
    status: 'waiting', // 'waiting' | 'active' | 'question_review' | 'finished'
    currentQuestionIndex: -1,
    questions,
    students: new Map(), // studentId -> { name, score, answers: {}, isConnected: true }
    createdAt: Date.now(),
    sockets: new Set(),
  };

  rooms.set(pin, room);
  return roomView(room);
}

function getRoom(pin) {
  return rooms.get(pin) || null;
}

function roomView(room) {
  const studentsList = [...room.students.values()].map((s) => ({
    id: s.id,
    name: s.name,
    score: s.score || 0,
    answeredCurrent: room.currentQuestionIndex >= 0 ? s.answers[room.currentQuestionIndex] !== undefined : false,
    isConnected: s.isConnected,
  })).sort((a, b) => b.score - a.score);

  const currentQ = room.questions[room.currentQuestionIndex];
  const questionPayload = currentQ ? {
    index: room.currentQuestionIndex,
    total: room.questions.length,
    id: currentQ.id,
    prompt: currentQ.prompt,
    choices: currentQ.choices,
    difficulty: currentQ.difficulty,
    timeLimitSeconds: 20,
    // Only reveal answer if question is completed or in review
    answer: room.status === 'question_review' || room.status === 'finished' ? currentQ.answer : undefined,
    explanation: room.status === 'question_review' || room.status === 'finished' ? currentQ.explanation : undefined,
  } : null;

  return {
    pin: room.pin,
    teacherName: room.teacherName,
    title: room.title,
    status: room.status,
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: room.questions.length,
    currentQuestion: questionPayload,
    students: studentsList,
    leaderboard: studentsList.slice(0, 10),
  };
}

function broadcastToRoom(room, eventName, payload) {
  const message = JSON.stringify({ event: eventName, data: payload });
  for (const ws of room.sockets) {
    if (ws.readyState === 1 /* OPEN */) {
      try { ws.send(message); } catch {}
    }
  }
}

function joinStudent(pin, studentId, studentName, ws = null) {
  const room = rooms.get(pin);
  if (!room) return { error: 'Kode PIN kelas tidak ditemukan.', status: 404 };
  if (room.status === 'finished') return { error: 'Kuis kelas ini telah selesai.', status: 400 };

  let student = room.students.get(studentId);
  if (!student) {
    student = { id: studentId, name: studentName || 'Siswa', score: 0, answers: {}, isConnected: true };
    room.students.set(studentId, student);
  } else {
    student.isConnected = true;
    if (studentName) student.name = studentName;
  }

  if (ws) {
    room.sockets.add(ws);
    ws.roomPin = pin;
    ws.studentId = studentId;
  }

  const view = roomView(room);
  broadcastToRoom(room, 'student_joined', { student: { id: student.id, name: student.name }, room: view });
  return { room: view };
}

function submitAnswer(pin, studentId, questionIndex, choiceIndex, timeTakenMs = 5000) {
  const room = rooms.get(pin);
  if (!room || room.status !== 'active') return { error: 'Kuis tidak sedang menerima jawaban.', status: 400 };
  if (room.currentQuestionIndex !== questionIndex) return { error: 'Pertanyaan sudah berganti.', status: 400 };

  const student = room.students.get(studentId);
  if (!student) return { error: 'Siswa belum terdaftar di ruang kuis ini.', status: 404 };

  if (student.answers[questionIndex] !== undefined) {
    return { error: 'Jawaban untuk soal ini sudah dikirimkan.', status: 409 };
  }

  const currentQ = room.questions[questionIndex];
  const isCorrect = Number(choiceIndex) === currentQ.answer;

  // Skor: 100 poin benar + bonus kecepatan hingga 50 poin
  let points = 0;
  if (isCorrect) {
    const timeLimitMs = 20000;
    const speedBonus = Math.max(0, Math.round(((timeLimitMs - Math.min(timeTakenMs, timeLimitMs)) / timeLimitMs) * 50));
    points = 100 + speedBonus;
    student.score = (student.score || 0) + points;
  }

  student.answers[questionIndex] = {
    choice: Number(choiceIndex),
    correct: isCorrect,
    points,
    timeTakenMs,
  };

  const view = roomView(room);
  broadcastToRoom(room, 'answer_received', {
    studentId,
    answeredCount: [...room.students.values()].filter((s) => s.answers[questionIndex] !== undefined).length,
    totalStudents: room.students.size,
    leaderboard: view.leaderboard,
  });

  return { success: true, points, isCorrect, currentScore: student.score };
}

function nextQuestion(pin, teacherId) {
  const room = rooms.get(pin);
  if (!room) return { error: 'Ruang tidak ditemukan.', status: 404 };
  if (room.teacherId !== teacherId) return { error: 'Hanya guru pembuat ruang yang dapat mengubah soal.', status: 403 };

  room.currentQuestionIndex += 1;
  if (room.currentQuestionIndex >= room.questions.length) {
    room.status = 'finished';
  } else {
    room.status = 'active';
  }

  const view = roomView(room);
  broadcastToRoom(room, room.status === 'finished' ? 'quiz_finished' : 'new_question', view);
  return { room: view };
}

function showReview(pin, teacherId) {
  const room = rooms.get(pin);
  if (!room) return { error: 'Ruang tidak ditemukan.', status: 404 };
  if (room.teacherId !== teacherId) return { error: 'Hanya guru yang dapat menampilkan pembahasan.', status: 403 };

  room.status = 'question_review';
  const view = roomView(room);
  broadcastToRoom(room, 'question_review', view);
  return { room: view };
}

module.exports = {
  createRoom,
  getRoom,
  roomView,
  joinStudent,
  submitAnswer,
  nextQuestion,
  showReview,
  broadcastToRoom,
};
