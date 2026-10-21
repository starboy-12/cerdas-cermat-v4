'use strict';

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/;

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function validateQuestion(question, index = 0) {
  const issues = [];
  const at = `questions[${index}]`;
  if (!isPlainObject(question)) return [`${at} harus berupa objek.`];
  if (!validId(question.id)) issues.push(`${at}.id tidak valid.`);
  if (typeof question.prompt !== 'string' || !question.prompt.trim()) issues.push(`${at}.prompt wajib diisi.`);
  if (!Array.isArray(question.choices) || question.choices.length < 2 || question.choices.length > 6 || question.choices.some((choice) => typeof choice !== 'string' || !choice.trim())) {
    issues.push(`${at}.choices harus berisi 2 sampai 6 pilihan teks.`);
  } else if (new Set(question.choices.map((choice) => choice.trim())).size !== question.choices.length) {
    issues.push(`${at}.choices tidak boleh berulang.`);
  }
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= (question.choices || []).length) issues.push(`${at}.answer harus menunjuk pilihan yang tersedia.`);
  if (!['mudah', 'sedang', 'sulit'].includes(question.difficulty)) issues.push(`${at}.difficulty harus mudah, sedang, atau sulit.`);
  if (typeof question.explanation !== 'string' || !question.explanation.trim()) issues.push(`${at}.explanation wajib diisi.`);
  return issues;
}

function validateContent(content) {
  const issues = [];
  if (!isPlainObject(content)) return { valid: false, issues: ['Konten harus berupa objek.'] };
  for (const field of ['id', 'type', 'title', 'curriculum', 'level', 'phase', 'subjectId', 'topicId']) {
    if (typeof content[field] !== 'string' || !content[field].trim()) issues.push(`${field} wajib diisi.`);
  }
  if (!['material', 'quiz', 'local-subject', 'lesson'].includes(content.type)) issues.push('type harus material, quiz, local-subject, atau lesson.');
  if (!Number.isInteger(content.schemaVersion) || content.schemaVersion < 1) issues.push('schemaVersion harus berupa bilangan bulat positif.');
  if (!['draft', 'in_review', 'approved', 'rejected', 'published', 'archived'].includes(content.status)) issues.push('status publikasi tidak dikenal.');
  if (!Array.isArray(content.objectives) || content.objectives.some((item) => typeof item !== 'string' || !item.trim())) issues.push('objectives harus berupa daftar teks.');
  if (!Array.isArray(content.sources) || content.sources.length === 0 || content.sources.some((item) => !isPlainObject(item) || typeof item.title !== 'string' || typeof item.url !== 'string')) issues.push('sources harus memuat sedikitnya satu entri title dan url.');
  if (content.reviewedAt !== null && content.reviewedAt !== undefined && Number.isNaN(Date.parse(content.reviewedAt))) issues.push('reviewedAt harus berupa tanggal ISO atau null.');
  if (content.reviewer !== null && content.reviewer !== undefined && typeof content.reviewer !== 'string') issues.push('reviewer harus berupa teks atau null.');
  if (content.status === 'published' && (!content.reviewer || !content.reviewedAt)) issues.push('Konten terbit wajib memiliki reviewer dan tanggal tinjau.');
  if (content.type === 'quiz') {
    if (!Array.isArray(content.questions) || content.questions.length === 0) issues.push('Kuis harus memiliki soal.');
    else content.questions.forEach((question, index) => issues.push(...validateQuestion(question, index)));
  }
  if (content.type === 'local-subject') {
    const pages = content.content?.pages || content.pages;
    if (!Array.isArray(pages) || pages.length === 0 || pages.length > 100) issues.push('Muatan lokal harus memiliki 1 sampai 100 halaman.');
    else pages.forEach((page, index) => {
      if (!isPlainObject(page) || typeof page.title !== 'string' || !page.title.trim() || !Array.isArray(page.paragraphs) || page.paragraphs.length === 0 || page.paragraphs.some((paragraph) => typeof paragraph !== 'string' || !paragraph.trim())) issues.push(`pages[${index}] harus berisi title dan paragraphs.`);
    });
  }
  return { valid: issues.length === 0, issues };
}

function validateMediaAsset(asset) {
  const issues = [];
  if (!isPlainObject(asset)) return { valid: false, issues: ['Media harus berupa objek.'] };
  for (const field of ['id', 'uri', 'altText', 'licenseName', 'sourceUri']) if (typeof asset[field] !== 'string' || !asset[field].trim()) issues.push(`${field} wajib diisi.`);
  if (asset.uri && !(/^(https:\/\/|\/assets\/)/.test(asset.uri)) || asset.uri?.includes('..')) issues.push('uri media harus berupa URL HTTPS atau path /assets/ lokal yang aman.');
  if (asset.licenseUri && !/^https?:\/\//.test(asset.licenseUri)) issues.push('licenseUri harus berupa URL HTTP(S).');
  if (asset.sourceUri && !/^https?:\/\//.test(asset.sourceUri)) issues.push('sourceUri harus berupa URL HTTP(S).');
  if (!['draft', 'published', 'archived'].includes(asset.status)) issues.push('status media harus draft, published, atau archived.');
  if (asset.reviewedAt && Number.isNaN(Date.parse(asset.reviewedAt))) issues.push('reviewedAt harus berupa tanggal ISO.');
  return { valid: issues.length === 0, issues };
}

function validateCatalog(catalog) {
  const issues = [];
  if (!Array.isArray(catalog)) return { valid: false, issues: ['Katalog harus berupa daftar jenjang.'] };
  const levelIds = new Set();
  for (const level of catalog) {
    if (!isPlainObject(level) || !validId(level.id) || !Array.isArray(level.phases)) {
      issues.push('Setiap jenjang harus memiliki id dan daftar fase.');
      continue;
    }
    if (levelIds.has(level.id)) issues.push(`ID jenjang ${level.id} berulang.`);
    levelIds.add(level.id);
    const phaseIds = new Set();
    for (const phase of level.phases) {
      if (!isPlainObject(phase) || !validId(phase.id)) { issues.push(`Fase pada ${level.id} tidak valid.`); continue; }
      if (phaseIds.has(phase.id)) issues.push(`ID fase ${phase.id} berulang pada ${level.id}.`);
      phaseIds.add(phase.id);
    }
  }
  return { valid: issues.length === 0, issues };
}

module.exports = { isPlainObject, validId, validateQuestion, validateContent, validateCatalog, validateMediaAsset };
