const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHealth(baseUrl, child) {
  const deadline = Date.now() + 5000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${baseUrl}/healthz`);
      if (res.ok) return;
      lastError = new Error(`healthz status ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await wait(100);
  }
  throw lastError || new Error('server did not become healthy');
}

async function startServer(env = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'children-show-security-'));
  fs.copyFileSync(path.join(projectRoot, 'server.js'), path.join(tmp, 'server.js'));
  copyDir(path.join(projectRoot, 'public'), path.join(tmp, 'public'));
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');

  const port = 33000 + Math.floor(Math.random() * 2000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: tmp,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      ADMIN_TOKEN: 'audit-token',
      DEEPSEEK_API_KEY: '',
      SKIP_MODERATION_FOR_TEST: 'true',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const output = [];
  child.stdout.on('data', chunk => output.push(chunk.toString()));
  child.stderr.on('data', chunk => output.push(chunk.toString()));

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl, child);
  return { tmp, child, baseUrl, output };
}

async function stopServer(child) {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await wait(100);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

async function requestJson(baseUrl, pathName, options = {}) {
  const res = await fetch(`${baseUrl}${pathName}`, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  return { res, body };
}

async function assertProductionRequiresAdminToken() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'children-show-prod-'));
  fs.copyFileSync(path.join(projectRoot, 'server.js'), path.join(tmp, 'server.js'));
  copyDir(path.join(projectRoot, 'public'), path.join(tmp, 'public'));
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');

  const child = spawn(process.execPath, ['server.js'], {
    cwd: tmp,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(35000 + Math.floor(Math.random() * 2000)),
      ADMIN_TOKEN: '',
      DEEPSEEK_API_KEY: 'test-key',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const exited = await new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 1000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
  if (!exited) {
    child.kill('SIGKILL');
  }
  assert.strictEqual(exited, true, 'production server must exit quickly without ADMIN_TOKEN');
  assert.notStrictEqual(child.exitCode, 0, 'production server must refuse to start without ADMIN_TOKEN');
}

async function main() {
  await assertProductionRequiresAdminToken();

  const { child, baseUrl } = await startServer();
  try {
    const health = await requestJson(baseUrl, '/healthz');
    assert.strictEqual(health.res.status, 200, 'GET /healthz should return 200');
    assert.deepStrictEqual(health.body, { ok: true }, 'GET /healthz should return { ok: true }');

    const home = await fetch(`${baseUrl}/`);
    assert.strictEqual(home.headers.get('x-powered-by'), null, 'Express x-powered-by header should be hidden');
    assert.ok(home.headers.get('content-security-policy'), 'Content-Security-Policy header should exist');
    assert.strictEqual(home.headers.get('x-content-type-options'), 'nosniff', 'nosniff header should exist');

    const blockedRead = await requestJson(baseUrl, '/api/messages/tree');
    assert.strictEqual(blockedRead.res.status, 403, 'message history should require an unlock token');

    const created = await requestJson(baseUrl, '/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'tree', text: '<img src=x onerror=alert(1)>安全测试' }),
    });
    assert.strictEqual(created.res.status, 200, 'valid message should be accepted in test mode');
    assert.ok(created.body.unlockToken, 'POST /api/messages should return an unlock token');

    const unlockedRead = await requestJson(
      baseUrl,
      `/api/messages/tree?unlockToken=${encodeURIComponent(created.body.unlockToken)}`
    );
    assert.strictEqual(unlockedRead.res.status, 200, 'valid unlock token should read message history');
    assert.ok(Array.isArray(unlockedRead.body), 'unlocked message history should be an array');
    assert.ok(unlockedRead.body.some(m => m.text.includes('onerror')), 'stored text should remain retrievable as text');

    const noModeration = await startServer({
      ADMIN_TOKEN: 'no-moderation-token',
      DEEPSEEK_API_KEY: '',
      SKIP_MODERATION_FOR_TEST: 'false',
    });
    try {
      const rejected = await requestJson(noModeration.baseUrl, '/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'tree', text: '缺审核 key 时不应保存' }),
      });
      assert.strictEqual(rejected.res.status, 200, 'missing moderation key should still return a handled response');
      assert.strictEqual(rejected.body.rejected, true, 'missing moderation key should reject new public messages');
    } finally {
      await stopServer(noModeration.child);
    }

    const adminStatuses = [];
    for (let i = 0; i < 8; i += 1) {
      const attempt = await requestJson(baseUrl, '/api/admin/messages', {
        headers: { Authorization: 'Bearer wrong-token' },
      });
      adminStatuses.push(attempt.res.status);
    }
    assert.ok(adminStatuses.includes(429), `admin auth failures should become rate limited, got ${adminStatuses.join(',')}`);
  } finally {
    await stopServer(child);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
