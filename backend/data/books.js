const { CURRICULA, phasesFor } = require('./curriculum-catalog');

function randomFor(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function choicesFor(answer, distractors, random) {
  const values = [String(answer)];
  for (const candidate of distractors) {
    const value = String(candidate);
    if (!values.includes(value)) values.push(value);
    if (values.length === 4) break;
  }
  let fallback = 1;
  while (values.length < 4) {
    const value = String(Number(answer) + fallback * (fallback % 2 ? -1 : 1));
    if (!values.includes(value)) values.push(value);
    fallback += 1;
  }
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return { choices: values, answer: values.indexOf(String(answer)) };
}

function createQuestion(book, number) {
  const random = randomFor(number * 97 + book.seed);
  let prompt;
  let answer;
  let distractors;
  let explanation;

  if (book.id === 'tk') {
    const first = 1 + Math.floor(random() * 5);
    const second = 1 + Math.floor(random() * (9 - first));
    answer = first + second;
    prompt = `Ada ${first} benda. Lalu ditambah ${second} benda. Berapa jumlahnya?`;
    distractors = [answer - 1, answer + 1, answer + 2];
    explanation = `${first} + ${second} = ${answer}. Kita menghitung semua benda bersama-sama.`;
  } else if (book.id === 'sd') {
    const operation = number % 4;
    if (operation === 0) {
      const first = 24 + Math.floor(random() * 176);
      const second = 11 + Math.floor(random() * 89);
      answer = first + second;
      prompt = `Hasil dari ${first} + ${second} adalah …`;
      explanation = `${first} + ${second} = ${answer}.`;
    } else if (operation === 1) {
      const first = 60 + Math.floor(random() * 240);
      const second = 10 + Math.floor(random() * (first - 9));
      answer = first - second;
      prompt = `Hasil dari ${first} − ${second} adalah …`;
      explanation = `${first} − ${second} = ${answer}.`;
    } else if (operation === 2) {
      const first = 2 + Math.floor(random() * 11);
      const second = 2 + Math.floor(random() * 11);
      answer = first * second;
      prompt = `Hasil dari ${first} × ${second} adalah …`;
      explanation = `${first} × ${second} = ${answer}.`;
    } else {
      const divisor = 2 + Math.floor(random() * 10);
      const quotient = 2 + Math.floor(random() * 12);
      answer = quotient;
      prompt = `Hasil dari ${divisor * quotient} ÷ ${divisor} adalah …`;
      explanation = `${divisor * quotient} ÷ ${divisor} = ${answer}.`;
    }
    distractors = [answer + 1, Math.max(0, answer - 1), answer + 10];
  } else if (book.id === 'smp') {
    const coefficient = 2 + Math.floor(random() * 8);
    const solution = Math.floor(random() * 17) - 5;
    const offset = Math.floor(random() * 25) - 12;
    const result = coefficient * solution + offset;
    answer = solution;
    prompt = `Jika ${coefficient}x ${offset < 0 ? `− ${Math.abs(offset)}` : `+ ${offset}`} = ${result}, nilai x adalah …`;
    distractors = [solution + 1, solution - 1, solution + 2];
    explanation = `${coefficient}x ${offset < 0 ? `− ${Math.abs(offset)}` : `+ ${offset}`} = ${result}. Pindahkan konstanta, lalu bagi dengan ${coefficient}; x = ${solution}.`;
  } else {
    const coefficient = 1 + Math.floor(random() * 5);
    const x = 1 + Math.floor(random() * 8);
    const offset = Math.floor(random() * 17) - 8;
    answer = coefficient * x + offset;
    prompt = `Diketahui f(x) = ${coefficient}x ${offset < 0 ? `− ${Math.abs(offset)}` : `+ ${offset}`}. Nilai f(${x}) adalah …`;
    distractors = [answer + coefficient, answer - coefficient, coefficient * x - offset];
    explanation = `Substitusikan x = ${x}: f(${x}) = ${coefficient} × ${x} ${offset < 0 ? `− ${Math.abs(offset)}` : `+ ${offset}`} = ${answer}.`;
  }

  return {
    id: `${book.id}-q${String(number).padStart(2, '0')}`,
    prompt,
    ...choicesFor(answer, distractors, random),
    explanation,
  };
}

const levelDefinitions = [
  { id: 'tk', level: 'TK', phaseLabel: 'Fase Fondasi', phases: [{ id: 'fondasi', label: 'Fase Fondasi' }], color: '#bc8427', accent: '#f4d98f', tagline: 'Belajar · Bermain · Berprestasi', topic: 'Berhitung dan operasi dasar', objective: 'Mengenal bilangan dan penjumlahan sederhana.' },
  { id: 'sd', level: 'SD', phaseLabel: 'Fase A', phases: [{ id: 'a', label: 'Fase A · Kelas 1–2' }, { id: 'b', label: 'Fase B · Kelas 3–4' }, { id: 'c', label: 'Fase C · Kelas 5–6' }], color: '#a3382c', accent: '#f0c878', tagline: 'Belajar · Tumbuh · Sukses', topic: 'Operasi hitung', objective: 'Melatih penjumlahan, pengurangan, perkalian, dan pembagian.' },
  { id: 'smp', level: 'SMP', phaseLabel: 'Fase D', phases: [{ id: 'd', label: 'Fase D · Kelas 7–9' }], color: '#235b88', accent: '#f3ce74', tagline: 'Berpikir · Berlatih · Berprestasi', topic: 'Persamaan linear', objective: 'Menyelesaikan persamaan linear satu variabel.' },
  { id: 'sma', level: 'SMA', phaseLabel: 'Fase E', phases: [{ id: 'e', label: 'Fase E · Kelas 10' }, { id: 'f', label: 'Fase F · Kelas 11–12' }], color: '#275c42', accent: '#e2c982', tagline: 'Maju · Berilmu · Berkarakter', topic: 'Fungsi linear', objective: 'Mengevaluasi fungsi linear dengan substitusi nilai.' },
];

const books = levelDefinitions.map((definition, bookIndex) => {
  const seededDefinition = { ...definition, seed: (bookIndex + 1) * 1009 };
  const questions = Array.from({ length: 50 }, (_, index) => createQuestion(seededDefinition, index + 1));
  const pages = [];
  for (let index = 0; index < questions.length; index += 3) {
    const pageQuestions = questions.slice(index, index + 3);
    const first = index + 1;
    const last = index + pageQuestions.length;
    pages.push({ title: `Latihan ${String(first).padStart(2, '0')}–${String(last).padStart(2, '0')}`, questions: pageQuestions });
  }
  return {
    ...seededDefinition,
    title: 'Cerdas Cermat',
    subject: 'Matematika',
    curriculumIds: CURRICULA.map((curriculum) => curriculum.id),
    questionCount: questions.length,
    questions,
    pages,
  };
});

function publicBook(book) {
  return {
    id: book.id,
    level: book.level,
    title: book.title,
    tagline: book.tagline,
    color: book.color,
    accent: book.accent,
    subject: book.subject,
    topic: book.topic,
    objective: book.objective,
    phases: book.phases,
    defaultPhase: book.phases[0].id,
    curriculumPhases: Object.fromEntries(CURRICULA.map(({ id }) => [id, phasesFor(book.id, id)])),
    pageCount: book.pages.length,
    questionCount: book.questionCount,
    questionsPerPage: 3,
    pages: book.pages.map((page, index) => ({ number: index + 1, title: page.title, count: page.questions.length })),
  };
}

function questionById(bookId, questionId) {
  const book = books.find((item) => item.id === bookId);
  return book?.questions.find((question) => question.id === questionId);
}

module.exports = { books, publicBook, questionById, CURRICULA };
