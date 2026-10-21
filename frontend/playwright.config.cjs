const { defineConfig } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const workspace = path.resolve(__dirname, '..');
const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cerdas-cermat-e2e-'));
const apiPort = Number(process.env.E2E_API_PORT || 3211);
const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 5211);
const baseURL = `http://127.0.0.1:${frontendPort}`;
const apiURL = `http://127.0.0.1:${apiPort}/api`;

module.exports = defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  use: { baseURL, browserName: 'chromium', headless: true, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node backend/src/server.js',
      cwd: workspace,
      url: `${apiURL}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { PORT: String(apiPort), CORS_ORIGIN: baseURL, PROGRESS_FILE: path.join(dataDirectory, 'progress.json'), CONTENT_FILE: path.join(dataDirectory, 'content.json'), RATE_LIMIT: '1000', TEACHER_INVITE_CODE: 'e2e-teacher-invite', ADMIN_EMAIL: 'e2e-admin@example.test', ADMIN_PASSWORD: 'e2e-admin-password-2026' },
      stdout: 'ignore', stderr: 'pipe',
    },
    {
      command: 'node frontend/server.js',
      cwd: workspace,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { FRONTEND_PORT: String(frontendPort), FRONTEND_HOST: '127.0.0.1' },
      stdout: 'ignore', stderr: 'pipe',
    },
  ],
});
