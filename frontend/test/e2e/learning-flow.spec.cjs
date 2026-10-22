const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test.beforeEach(async ({ page }) => {
  const apiURL = `http://127.0.0.1:${process.env.E2E_API_PORT || 3211}/api`;
  const response = await fetch(`${apiURL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `browser-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`, name: 'Siswa Browser', password: 'browser-test-password-2026' }),
  });
  const account = await response.json();
  expect(response.ok, account.message || account.error).toBeTruthy();
  await page.addInitScript(({ apiURL: configuredApi, token, user }) => {
    window.CERDAS_CONFIG = { apiBaseUrl: configuredApi };
    if (!sessionStorage.getItem('cerdas-cermat-e2e-auth-seeded')) {
      localStorage.setItem('cerdas-cermat-token', token);
      localStorage.setItem('cerdas-cermat-account', JSON.stringify(user));
      sessionStorage.setItem('cerdas-cermat-e2e-auth-seeded', '1');
    }
  }, { apiURL, token: account.token, user: account.user });
});

test('kurikulum arsip memilih kelas sesuai jenjang dan menjalankan kuis dasar', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-book="sd"]').click();
  await expect(page.locator('#catalog-dialog')).toHaveClass(/is-open/);
  await page.locator('#curriculum-select').selectOption('ktsp');
  await expect(page.locator('#phase-select option')).toHaveCount(6);
  await expect(page.locator('#phase-select option').first()).toHaveText('Kelas 1');
  await page.locator('#phase-select').selectOption('kelas-1');
  await page.locator('#subject-value').selectOption('matematika');
  await page.locator('#topic-value').selectOption('kuis-50');
  await expect(page.locator('#catalog-level-copy')).toContainText('Kelas 1');
  await page.locator('#start-book').click();
  await expect(page.locator('#reader')).toHaveClass(/is-open/);
  await expect(page.locator('#question-list .question').first()).toBeVisible();
  await expect(page.locator('#question-list')).not.toContainText(/turunan|vektor|sin |cos /i);
});

test('materi membuka kuis terkait dan hasil hanya muncul setelah 50 jawaban', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-book="sd"]')).toBeVisible();
  await page.locator('[data-book="sd"]').click();
  await expect(page.locator('#catalog-dialog')).toHaveClass(/is-open/);
  await expect(page.locator('#topic-value option').first()).toContainText(/bilangan/i);
  await expect(page.locator('#topic-value option').first()).toContainText('draf');
  await page.locator('#start-book').click();
  await expect(page.locator('#reader')).toHaveClass(/is-open/);
  await expect(page.locator('#page-section-label')).toHaveText('MATERI BELAJAR');
  for (let pageNumber = 2; pageNumber <= 4; pageNumber += 1) {
    await page.locator('#next-page').click();
    await expect(page.locator('#indicator-current')).toHaveText(String(pageNumber).padStart(2, '0'));
    if (pageNumber === 3) {
      await expect(page.locator('.lesson-activity')).toBeVisible();
      await page.locator('[data-activity-submit]').click();
      await expect(page.locator('.activity-feedback')).toContainText('Pilih refleksi');
      await page.locator('input[name="lesson-activity"][value="0"]').check();
      await page.locator('[data-activity-submit]').click();
      await expect(page.locator('.activity-feedback')).toContainText('Bagus');
    }
  }
  await expect(page.locator('#finish-quiz')).toBeEnabled();
  await expect(page.locator('#finish-quiz')).toContainText('Mulai kuis');
  await page.locator('#finish-quiz').click();
  await expect(page.locator('#page-section-label')).toHaveText('LEMBAR LATIHAN');
  await expect(page.locator('#finish-quiz')).toBeDisabled();

  for (let pageNumber = 0; pageNumber < 17; pageNumber += 1) {
    const questions = page.locator('#question-list .question');
    const count = await questions.count();
    for (let index = 0; index < count; index += 1) {
      const question = questions.nth(index);
      await question.locator('.choice').first().click();
      await expect(question.locator('.question-feedback')).toBeVisible();
    }
    if (pageNumber < 16) {
      await page.locator('#next-page').click();
      await expect(page.locator('#indicator-current')).toHaveText(String(pageNumber + 2).padStart(2, '0'));
    }
  }
  await expect(page.locator('#finish-quiz')).toBeEnabled();
  await page.locator('#finish-quiz').click();
  await expect(page.locator('#results-dialog')).toHaveClass(/is-open/);
  await expect(page.locator('#result-summary')).toContainText('dari 50 jawaban benar');
});

test('aplikasi dapat dipasang dan memberi label progres offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('#sync-status')).toContainText('Online');
  await context.setOffline(true);
  await expect(page.locator('#sync-status')).toContainText('Offline');
  await context.setOffline(false);
  await expect(page.locator('#sync-status')).toContainText('Online');
});

test('antrean progres offline disinkronkan sebagai batch saat koneksi pulih', async ({ page, context }) => {
  const apiBase = `http://127.0.0.1:${process.env.E2E_API_PORT || 3211}/api`;
  await page.goto('/');
  const queued = await page.evaluate(async (apiURL) => {
    const studentId = JSON.parse(localStorage.getItem('cerdas-cermat-account')).id;
    const token = localStorage.getItem('cerdas-cermat-token');
    const catalog = await fetch(`${apiURL}/quizzes/sd/matematika/pages/1?curriculum=merdeka&phase=a`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json());
    const question = catalog.page.questions[0];
    const body = { studentId, bookId: 'sd', curriculum: 'merdeka', phase: 'a', subjectId: 'matematika', questionId: question.id, choice: 0 };
    localStorage.setItem('cerdas-cermat-offline-queue', JSON.stringify([{
      url: `${apiURL}/answer`,
      options: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      queuedAt: new Date().toISOString(),
    }]));
    return { studentId, questionId: question.id, token };
  }, apiBase);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#sync-status')).toContainText('Offline');
  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cerdas-cermat-offline-queue') || '[]').length)).toBe(0);
  const saved = await fetch(`${apiBase}/progress/${queued.studentId}?bookId=sd&curriculum=merdeka&phase=a`, { headers: { Authorization: `Bearer ${queued.token}` } }).then((response) => response.json());
  expect(saved.progress.answers[queued.questionId]).toBeTruthy();
});

test('guru hanya melihat dashboard kelas yang ditugaskan', async ({ page }) => {
  const apiBase = `http://127.0.0.1:${process.env.E2E_API_PORT || 3211}/api`;
  async function api(route, body, token) {
    const response = await fetch(`${apiBase}${route}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    expect(response.ok, data.message || data.error).toBeTruthy();
    return data;
  }

  const teacher = await api('/auth/register', { email: 'class-teacher@example.test', name: 'Guru Kelas', password: 'test-teacher-password-2026', role: 'teacher', inviteCode: 'e2e-teacher-invite' });
  const student = await api('/auth/register', { email: 'class-student@example.test', name: 'Siswa Kelas', password: 'test-student-password-2026' });
  const admin = await api('/auth/login', { email: 'e2e-admin@example.test', password: 'e2e-admin-password-2026' });
  await api('/classes', { id: 'kelas-e2e-1', name: 'Kelas E2E 1' }, admin.token);
  const assignment = await fetch(`${apiBase}/classes/kelas-e2e-1/members`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ teacherIds: [teacher.user.id], studentIds: [student.user.id] }),
  });
  expect(assignment.ok).toBeTruthy();

  await page.goto('/');
  await page.evaluate(() => { localStorage.removeItem('cerdas-cermat-token'); localStorage.removeItem('cerdas-cermat-account'); });
  await page.reload();
  await page.locator('#account-email').fill('class-teacher@example.test');
  await page.locator('#account-password').fill('test-teacher-password-2026');
  await page.locator('#account-submit').click();
  await expect(page.locator('#account-link')).toContainText('Guru Kelas');
  await page.locator('#progress-link').click();
  await expect(page.locator('#class-dashboard')).toBeVisible();
  await expect(page.locator('#class-dashboard-select option')).toHaveText('Kelas E2E 1');
  await expect(page.locator('#class-dashboard-summary')).toContainText('Kelas E2E 1');
  await expect(page.locator('#class-admin-tools')).toBeHidden();
});

test('dialog akun menjebak fokus dan mengembalikannya setelah ditutup', async ({ page }) => {
  await page.goto('/');
  const trigger = page.locator('#account-link');
  await trigger.click();
  await expect(page.locator('#account-dialog')).toHaveClass(/is-open/);
  await page.locator('#close-account').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#account-logout')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#account-dialog')).not.toHaveClass(/is-open/);
  await expect(trigger).toBeFocused();
});

test('pengunjung wajib login sebelum memakai aplikasi dan tidak dapat menutup gerbang login', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { localStorage.removeItem('cerdas-cermat-token'); localStorage.removeItem('cerdas-cermat-account'); });
  await page.reload();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await expect(page.locator('#account-dialog')).toHaveClass(/auth-required/);
  await expect(page.locator('#account-email')).toBeFocused();
  const loginCard = await page.locator('#account-dialog .catalog-dialog').evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: element.getBoundingClientRect().width, radius: style.borderRadius, background: style.backgroundColor };
  });
  expect(loginCard.width).toBeLessThanOrEqual(430);
  expect(loginCard.radius).not.toBe('5px');
  await page.locator('#account-dialog').click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('Escape');
  await expect(page.locator('#account-dialog')).toHaveClass(/is-open/);
  const loginAudit = await new AxeBuilder({ page }).include('#account-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(loginAudit.violations, JSON.stringify(loginAudit.violations.map(({ id, impact, nodes }) => ({ id, impact, elements: nodes.map((node) => node.target) })), null, 2)).toEqual([]);
  await page.locator('#account-mode-toggle').click();
  await expect(page.locator('#account-name')).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await page.locator('#account-name').fill('Akun Baru');
  await page.locator('#account-email').fill(`signup-${Date.now()}@example.test`);
  await page.locator('#account-password').fill('signup-test-password-2026');
  await page.locator('#account-submit').click();
  await expect(page.locator('main')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#account-dialog')).not.toHaveClass(/is-open/);
  await expect(page.locator('#account-link')).toContainText('Akun Baru');
});

test('audit aksesibilitas awal halaman, katalog, dan pembaca', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations.map(({ id, impact, nodes }) => ({ id, impact, elements: nodes.map((node) => node.target) })), null, 2)).toEqual([]);

  await page.locator('[data-book="sd"]').click();
  await expect(page.locator('#catalog-dialog')).toHaveClass(/is-open/);
  await expect(page.locator('#start-book')).toBeEnabled();
  results = await new AxeBuilder({ page }).include('#catalog-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations.map(({ id, impact, nodes }) => ({ id, impact, elements: nodes.map((node) => node.target) })), null, 2)).toEqual([]);
  await page.locator('#start-book').click();
  await expect(page.locator('#reader')).toHaveClass(/is-open/);
  results = await new AxeBuilder({ page }).include('#reader').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations.map(({ id, impact, nodes }) => ({ id, impact, elements: nodes.map((node) => node.target) })), null, 2)).toEqual([]);
  await page.locator('#close-reader').click();
  await page.locator('#account-link').click();
  results = await new AxeBuilder({ page }).include('#account-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations.map(({ id, impact, nodes }) => ({ id, impact, elements: nodes.map((node) => node.target) })), null, 2)).toEqual([]);
  await page.locator('#close-account').click();
  await page.locator('#progress-link').click();
  results = await new AxeBuilder({ page }).include('#progress-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations.map(({ id, impact, nodes }) => ({ id, impact, elements: nodes.map((node) => node.target) })), null, 2)).toEqual([]);
});

for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`layout tidak meluap pada viewport ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    if (viewport.width <= 900) {
      await expect(page.locator('#mobile-menu')).toBeVisible();
      await page.locator('#mobile-menu').click();
      await expect(page.locator('.topnav')).toBeVisible();
      await page.locator('[data-book="sd"]').click();
      await expect(page.locator('#catalog-dialog')).toHaveClass(/is-open/);
      const catalogWidth = await page.locator('#catalog-dialog').evaluate((element) => element.scrollWidth);
      expect(catalogWidth).toBeLessThanOrEqual(viewport.width);
      await page.locator('#start-book').click();
      await expect(page.locator('#reader')).toHaveClass(/is-open/);
      const readerWidth = await page.locator('#reader').evaluate((element) => element.scrollWidth);
      expect(readerWidth).toBeLessThanOrEqual(viewport.width);
    }
  });
}
