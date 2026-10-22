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

test('Perlindungan Akun Developer: Hanya pemilik yang dapat masuk, orang lain ditolak', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cerdas-dev-auth-'));
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
      DEVELOPER_EMAIL: 'satriosimputra21@gmail.com',
      DEVELOPER_PASSWORD: 'rahasia-developer-satrio-2026',
      DEVELOPER_SECRET: 'kunci-khusus-developer-satrio',
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

  async function request(route, { method = 'GET', body, token, headers = {} } = {}) {
    const finalHeaders = { ...headers };
    if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
    const res = await fetch(`${base}${route}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json() };
  }

  // 1. Orang lain / publik tidak boleh bisa mengakses dev-login tanpa hak akses
  const devLoginUnauthorized = await request('/auth/dev-login', { method: 'POST' });
  assert.equal(devLoginUnauthorized.status, 403, 'dev-login tanpa kredensial harus ditolak 403');
  assert.match(devLoginUnauthorized.data.error, /Akses developer ditolak/);

  // 2. Orang lain tidak boleh bisa mendaftar dengan email developer
  const registerDevEmail = await request('/auth/register', {
    method: 'POST',
    body: {
      email: 'satriosimputra21@gmail.com',
      name: 'Penyusup Akun',
      password: 'kata-sandi-orang-lain-2026',
      role: 'student',
    },
  });
  assert.equal(registerDevEmail.status, 403, 'Pendaftaran dengan email developer harus ditolak 403');
  assert.match(registerDevEmail.data.error, /dilindungi khusus untuk akun Pengembang/);

  // 3. Orang lain yang mencoba masuk dengan email developer dan kata sandi salah harus DITOLAK
  const wrongPasswordLogin = await request('/auth/login', {
    method: 'POST',
    body: {
      email: 'satriosimputra21@gmail.com',
      password: 'password-salah-12345678',
    },
  });
  assert.equal(wrongPasswordLogin.status, 401, 'Login developer dengan kata sandi salah harus ditolak 401');
  assert.match(wrongPasswordLogin.data.error, /Email atau kata sandi salah/);

  // 4. Pengembang yang memasukkan kata sandi yang BENAR berhasil masuk
  const devLoginSuccess = await request('/auth/login', {
    method: 'POST',
    body: {
      email: 'satriosimputra21@gmail.com',
      password: 'rahasia-developer-satrio-2026',
    },
  });
  assert.equal(devLoginSuccess.status, 200, 'Login developer dengan sandi yang benar harus berhasil 200');
  assert.equal(devLoginSuccess.data.user.email, 'satriosimputra21@gmail.com');
  assert.equal(devLoginSuccess.data.user.role, 'admin');
  const devToken = devLoginSuccess.data.token;

  // 5. Verifikasi bahwa sesi developer memiliki akses admin
  const adminAccountsCheck = await request('/accounts', { token: devToken });
  assert.equal(adminAccountsCheck.status, 200, 'Developer harus dapat mengakses endpoint admin');

  // 6. Akses dev-login dengan developer secret yang valid diperbolehkan
  const devLoginWithSecret = await request('/auth/dev-login', {
    method: 'POST',
    headers: { 'x-developer-secret': 'kunci-khusus-developer-satrio' },
  });
  assert.equal(devLoginWithSecret.status, 200, 'dev-login dengan secret valid harus berhasil');
  assert.equal(devLoginWithSecret.data.user.email, 'satriosimputra21@gmail.com');

  // 7. Pengguna biasa mendaftar dan masuk tidak mendapat peran developer/admin
  const studentRegister = await request('/auth/register', {
    method: 'POST',
    body: {
      email: 'siswa_biasa@example.com',
      name: 'Siswa Rajin',
      password: 'kata-sandi-siswa-2026',
      role: 'student',
    },
  });
  assert.equal(studentRegister.status, 201);
  assert.equal(studentRegister.data.user.role, 'student');
  const studentToken = studentRegister.data.token;

  // Siswa biasa dilarang mengakses data akun admin
  const studentForbiddenCheck = await request('/accounts', { token: studentToken });
  assert.equal(studentForbiddenCheck.status, 403, 'Siswa biasa tidak boleh mengakses data akun');
});
