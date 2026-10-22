'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

let GoogleGenAI = null;
try {
  ({ GoogleGenAI } = require('@google/genai'));
} catch {
  GoogleGenAI = null;
}

const cacheFilePath = path.resolve(__dirname, '../data/ai-tutor-cache.json');
let aiCache = new Map();

async function loadAiCache() {
  try {
    const raw = await fs.readFile(cacheFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    for (const [k, v] of Object.entries(parsed)) {
      aiCache.set(k, v);
    }
  } catch {
    // Cache file optional on first run
  }
}

async function persistAiCache() {
  try {
    const obj = Object.fromEntries(aiCache.entries());
    await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
    await fs.writeFile(cacheFilePath, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.warn('[AI Tutor] Gagal menyimpan cache:', err.message);
  }
}

void loadAiCache();

function getGenAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !GoogleGenAI) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function generatePedagogicalFallback(question, choiceIndex, subject, level) {
  const chosenText = choiceIndex !== undefined && question.choices?.[choiceIndex] !== undefined
    ? question.choices[choiceIndex]
    : 'Pilihan yang Anda pilih';
  const correctText = question.answer !== undefined && question.choices?.[question.answer] !== undefined
    ? question.choices[question.answer]
    : 'Pilihan yang benar';

  return {
    cached: false,
    explanation: [
      `1. Mari amati kembali soal: "${question.prompt || question.title || ''}"`,
      `2. Analisis pilihan: Kamu memilih "${chosenText}". Pilihan ini belum tepat karena konsep utama pada materi ${subject || 'ini'} berfokus pada pemahaman langkah dasar.`,
      `3. Kunci jawaban yang tepat adalah "${correctText}". ${question.explanation || 'Jawaban ini memenuhi syarat sesuai kaidah materi.'}`,
      `4. Tips Cerdas: Selalu periksa kembali kata kunci pada soal sebelum menentukan pilihan!`,
    ].join('\n\n'),
    similarQuestion: {
      prompt: `Latihan Serupa (${subject || 'Materi'} - ${level || 'Umum'}): Perhatikan konsep di atas. Jika kondisi serupa terjadi, langkah pertama yang paling bijak adalah...`,
      choices: [
        `Menganalisis hubungan antara fakta dan konsep utama`,
        `Memilih jawaban secara acak tanpa membaca soal`,
        `Mengabaikan instruksi yang tertulis`,
        `Menebak tanpa memeriksa petunjuk yang diberikan`,
      ],
      answer: 0,
      explanation: `Langkah yang tepat adalah menganalisis hubungan konsep utama secara saksama.`,
    },
  };
}

async function getTutorExplanation({ questionId, prompt, choices, answer, choice, explanation, subject, level }) {
  const cacheKey = `${questionId}:${choice}`;
  if (aiCache.has(cacheKey)) {
    return { ...aiCache.get(cacheKey), cached: true };
  }

  const ai = getGenAiClient();
  if (!ai) {
    const fallback = generatePedagogicalFallback({ prompt, choices, answer, explanation }, choice, subject, level);
    aiCache.set(cacheKey, fallback);
    void persistAiCache();
    return fallback;
  }

  try {
    const chosenText = choice !== undefined && choices?.[choice] ? choices[choice] : 'Tidak dijawab';
    const correctText = answer !== undefined && choices?.[answer] ? choices[answer] : 'Jawaban benar';

    const systemPrompt = `Anda adalah "Tutor Cerdas Cermat", guru pembimbing belajar yang hangat, ramah anak, dan menguasai Kurikulum Merdeka Indonesia.
Siswa baru saja menjawab soal latihan dan memerlukan penjelasan langkah demi langkah yang mudah dipahami.

Instruksi Anda:
1. Berikan penjelasan langkah demi langkah mengapa pilihan siswa ("${chosenText}") belum tepat dan mengapa "${correctText}" adalah jawaban yang benar.
2. Jelaskan konsep materi ${subject || ''} (jenjang ${level || ''}) dengan bahasa yang menyemangati, analogi sederhana, dan tanpa istilah yang terlalu rumit.
3. Buatkan 1 "Soal Latihan Serupa" (multiple choice 4 pilihan) yang menguji pemahaman konsep yang sama, lengkap dengan 4 opsi, index kunci jawaban (0-3), dan pembahasannya.

Format Output WAJIB JSON persis seperti ini:
{
  "explanation": "Teks penjelasan langkah demi langkah...",
  "similarQuestion": {
    "prompt": "Pertanyaan latihan serupa...",
    "choices": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
    "answer": 0,
    "explanation": "Pembahasan soal latihan serupa..."
  }
}`;

    const userPrompt = `Soal yang dihadapi:
Pertanyaan: ${prompt}
Pilihan: ${JSON.stringify(choices)}
Pilihan siswa: ${chosenText}
Kunci jawaban: ${correctText}
Pembahasan bawaan: ${explanation || '-'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text.trim());
    const result = {
      cached: false,
      explanation: parsed.explanation || explanation,
      similarQuestion: parsed.similarQuestion || null,
    };

    aiCache.set(cacheKey, result);
    void persistAiCache();
    return result;
  } catch (err) {
    console.warn('[AI Tutor] Gemini API error, menggunakan fallback:', err.message);
    const fallback = generatePedagogicalFallback({ prompt, choices, answer, explanation }, choice, subject, level);
    aiCache.set(cacheKey, fallback);
    void persistAiCache();
    return fallback;
  }
}

module.exports = { getTutorExplanation };
