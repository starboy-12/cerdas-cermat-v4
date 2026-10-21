(function attachComponents(root, factory) {
  const components = factory();
  if (typeof module === 'object' && module.exports) module.exports = components;
  if (root) root.CerdasUI = components;
}(typeof window === 'undefined' ? globalThis : window, function createComponents() {
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function renderActivity(activity) {
    if (!activity || typeof activity.prompt !== 'string' || !activity.prompt.trim() || !Array.isArray(activity.choices) || activity.choices.length < 2 || activity.choices.length > 5 || activity.choices.some((choice) => typeof choice !== 'string' || !choice.trim())) return '';
    const choices = activity.choices.map((choice, index) => `<label><input type="radio" name="lesson-activity" value="${index}" /> ${escapeHtml(choice)}</label>`).join('');
    return `<section class="lesson-activity" aria-labelledby="lesson-activity-title"><h3 id="lesson-activity-title">${escapeHtml(activity.title || 'Ayo mencoba')}</h3><p>${escapeHtml(activity.prompt)}</p><fieldset><legend>Pilih refleksi yang sesuai</legend>${choices}</fieldset><button type="button" class="catalog-cancel" data-activity-submit>Catat refleksi</button><p class="activity-feedback" role="status" aria-live="polite"></p></section>`;
  }

  function activityFeedback(choice) {
    if (choice === 'tried') return 'Bagus, kamu sudah mencoba. Ceritakan langkahmu kepada teman atau guru.';
    if (choice === 'help') return 'Tidak apa-apa meminta bantuan. Coba bahas langkah pertama bersama guru atau teman.';
    if (choice === 'again') return 'Pilih satu contoh dari halaman ini dan coba lagi dengan pelan-pelan.';
    return 'Pilih refleksi terlebih dahulu.';
  }

  function isCompletedQuiz(attempts, context) {
    return attempts.some((attempt) => attempt.subjectId === context.subjectId && attempt.bookId === context.bookId && attempt.phase === context.phase && attempt.curriculum === context.curriculum && (attempt.status === 'completed' || (!attempt.status && Number.isInteger(attempt.score))));
  }

  function quizProgressLabel(completed, answered, total) {
    return completed ? ' · selesai' : ` · ${answered}/${total} dijawab`;
  }

  function publicationLabel(status) {
    return status === 'published' ? '' : ' · draf';
  }

  return { escapeHtml, renderActivity, activityFeedback, isCompletedQuiz, quizProgressLabel, publicationLabel };
}));
