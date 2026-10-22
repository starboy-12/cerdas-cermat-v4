'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { once } = require('node:events');

async function freePort() {
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return port;
}

test('Alur Lupa Kata Sandi dan Reset Kata Sandi dengan OTP', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cerdas-reset-api-'));
  await fs.writeFile(path.join(directory, 'progress.json'), JSON.stringify({
    progress: {}, attempts: {}, readingProgress: {}, users: {}, classes: {},
  }));

  const port = await freePort();
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      PROGRESS_FILE: path.join(directory, 'progress.json'),
      CONTENT_FILE: path.join(directory, 'content.json'),
      RATE_LIMIT: '500',
    },
    stdio: 'ignore',
  });

  t.after(async () => {
    child.kill();
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
    await fs.rm(directory, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${port}/api`;
  let healthy = false;
  for (let index = 0; index < 60; index += 1) {
    try { if ((await fetch(`${base}/health`)).ok) { healthy = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(healthy, true, 'server API harus mulai');

  async function post(route, body) {
    const res = await fetch(`${base}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  }

  // 1. Email tidak valid
  const resInvalidEmail = await post('/auth/forgot-password', { email: 'bukan-email' });
  assert.equal(resInvalidEmail.status, 400);

  // 2. Email belum terdaftar
  const resNotFound = await post('/auth/forgot-password', { email: 'siswa-baru@sekolah.test' });
  assert.equal(resNotFound.status, 404);

  // 3. Daftarkan akun baru
  const email = 'siswa-reset@sekolah.test';
  const oldPassword = 'kata-sandi-lama-1234';
  const registerRes = await post('/auth/register', {
    email,
    name: 'Budi Santoso',
    password: oldPassword,
  });
  assert.equal(registerRes.status, 201, 'pendaftaran akun berhasil');

  // 4. Minta kode OTP
  const forgotRes = await post('/auth/forgot-password', { email });
  assert.equal(forgotRes.status, 200);
  assert.equal(forgotRes.data.sent, true);
  assert.match(forgotRes.data.debugOtp, /^\d{6}$/);
  const otp = forgotRes.data.debugOtp;

  // 5. Coba reset dengan OTP salah
  const wrongOtpRes = await post('/auth/reset-password', {
    email,
    otp: '000000',
    newPassword: 'kata-sandi-baru-5678',
    confirmPassword: 'kata-sandi-baru-5678',
  });
  assert.equal(wrongOtpRes.status, 400);
  assert.match(wrongOtpRes.data.error, /OTP/);

  // 6. Coba reset dengan kata sandi kurang dari 10 karakter
  const shortPassRes = await post('/auth/reset-password', {
    email,
    otp,
    newPassword: 'pendek',
    confirmPassword: 'pendek',
  });
  assert.equal(shortPassRes.status, 400);

  // 7. Coba reset dengan konfirmasi kata sandi tidak cocok
  const mismatchRes = await post('/auth/reset-password', {
    email,
    otp,
    newPassword: 'kata-sandi-baru-5678',
    confirmPassword: 'kata-sandi-beda-9999',
  });
  assert.equal(mismatchRes.status, 400);

  // 8. Reset berhasil dengan OTP benar dan kata sandi valid
  const newPassword = 'kata-sandi-baru-5678';
  const resetSuccessRes = await post('/auth/reset-password', {
    email,
    otp,
    newPassword,
    confirmPassword: newPassword,
  });
  assert.equal(resetSuccessRes.status, 200);
  assert.equal(resetSuccessRes.data.success, true);

  // 9. Login dengan kata sandi lama harus ditolak
  const oldLoginRes = await post('/auth/login', { email, password: oldPassword });
  assert.equal(oldLoginRes.status, 401);

  // 10. Login dengan kata sandi baru harus berhasil
  const newLoginRes = await post('/auth/login', { email, password: newPassword });
  assert.equal(newLoginRes.status, 200);
  assert.ok(newLoginRes.data.token);
  assert.equal(newLoginRes.data.user.email, email);
});
