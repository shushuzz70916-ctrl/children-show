require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      mediaSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10kb' }));

const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const MODERATION_TIMEOUT_MS = 8000;
const UNLOCK_TOKEN_TTL_MS = 10 * 60 * 1000;

if (IS_PRODUCTION && !ADMIN_TOKEN) {
  console.error('生产环境必须配置 ADMIN_TOKEN');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'messages.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_role ON messages(role);
  CREATE INDEX IF NOT EXISTS idx_created ON messages(created_at);
`);

const ROLES = [
  { id: 'tree',      name: '树干',   alias: '权力中心',       image: 'assets/大树.png' },
  { id: 'moon',      name: '月亮',   alias: '权力跟班',       image: 'assets/月亮.png' },
  { id: 'star',      name: '星星',   alias: '冷眼小队',       image: null },
  { id: 'birdnest',  name: '鸟巢',   alias: '谣言加工厂',     image: 'assets/鸟巢.png' },
  { id: 'falcon',    name: '乌隼',   alias: '悄悄话拆散王',   image: 'assets/乌隼.png' },
  { id: 'wind',      name: '风',     alias: '隐形谣言扩音器', image: 'assets/风.png' },
  { id: 'chameleon', name: '变色龙', alias: '',               image: 'assets/变色龙.png' },
  { id: 'air',       name: '空气',   alias: '',               image: 'assets/空气.png' },
];

const VALID_ROLES = new Set(ROLES.map(r => r.id));

// ---- Helpers ----

function localDateStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function checkAdminAuth(req, res) {
  if (!ADMIN_TOKEN) {
    res.status(503).json({ error: '未配置管理员密码，请在 Render 环境变量中设置 ADMIN_TOKEN' });
    return false;
  }
  const ip = req.ip || 'unknown';
  if (isAdminAuthLimited(ip)) {
    res.status(429).json({ error: '管理员验证失败次数过多，请稍后再试' });
    return false;
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== ADMIN_TOKEN) {
    recordAdminAuthFailure(ip);
    res.status(401).json({ error: '无权限' });
    return false;
  }
  clearAdminAuthFailures(ip);
  return true;
}

// Simple in-memory rate limiter: max 5 messages per IP per minute
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const times = (rateLimitMap.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, times);
    return true;
  }
  times.push(now);
  rateLimitMap.set(ip, times);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of rateLimitMap.entries()) {
    const fresh = times.filter(t => now - t < RATE_WINDOW_MS);
    if (fresh.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, fresh);
  }
}, 5 * 60 * 1000);

const adminFailureMap = new Map();
const ADMIN_FAILURE_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_FAILURE_LIMIT = 5;

function freshAdminFailures(ip) {
  const now = Date.now();
  return (adminFailureMap.get(ip) || []).filter(t => now - t < ADMIN_FAILURE_WINDOW_MS);
}

function isAdminAuthLimited(ip) {
  return freshAdminFailures(ip).length >= ADMIN_FAILURE_LIMIT;
}

function recordAdminAuthFailure(ip) {
  const times = freshAdminFailures(ip);
  times.push(Date.now());
  adminFailureMap.set(ip, times);
}

function clearAdminAuthFailures(ip) {
  adminFailureMap.delete(ip);
}

setInterval(() => {
  for (const ip of adminFailureMap.keys()) {
    const fresh = freshAdminFailures(ip);
    if (fresh.length === 0) adminFailureMap.delete(ip);
    else adminFailureMap.set(ip, fresh);
  }
}, 5 * 60 * 1000);

const unlockTokens = new Map();

function createUnlockToken(role) {
  const token = crypto.randomBytes(24).toString('base64url');
  const expiresAt = Date.now() + UNLOCK_TOKEN_TTL_MS;
  unlockTokens.set(token, { role, expiresAt });
  return { token, expiresAt };
}

function isValidUnlockToken(role, token) {
  if (!token) return false;
  const record = unlockTokens.get(token);
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    unlockTokens.delete(token);
    return false;
  }
  return record.role === role;
}

setInterval(() => {
  const now = Date.now();
  for (const [token, record] of unlockTokens.entries()) {
    if (record.expiresAt < now) unlockTokens.delete(token);
  }
}, 5 * 60 * 1000);

// ---- DeepSeek moderation ----
async function moderateContent(text) {
  if (process.env.NODE_ENV === 'test' && process.env.SKIP_MODERATION_FOR_TEST === 'true') {
    return true;
  }
  if (!DEEPSEEK_API_KEY) {
    console.warn('DEEPSEEK_API_KEY not set, rejecting new messages');
    return false;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              '你是儿童内容审核员，判断留言是否适合儿童观看，不能包含脏话、暴力、色情、价值观错误、歧视等内容。只回复 pass 或 reject，不要回复其他内容。',
          },
          { role: 'user', content: text },
        ],
        max_tokens: 10,
        temperature: 0,
      }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    const result = data?.choices?.[0]?.message?.content?.trim().toLowerCase();
    return result === 'pass';
  } catch (err) {
    console.error('Moderation API error:', err.message);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// ---- API ----

app.get('/api/roles', (_req, res) => {
  res.json(ROLES);
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/messages/:roleId', (req, res) => {
  const { roleId } = req.params;
  if (!VALID_ROLES.has(roleId)) {
    return res.status(400).json({ error: '无效的角色' });
  }
  if (!isValidUnlockToken(roleId, req.query.unlockToken)) {
    return res.status(403).json({ error: '请先留言解锁' });
  }
  const rows = db.prepare(
    'SELECT id, text, created_at FROM messages WHERE role = ? ORDER BY id ASC'
  ).all(roleId);
  res.json(rows);
});

app.post('/api/messages', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: '发送太频繁，请稍后再试' });
  }

  const { role, text } = req.body || {};
  const trimmed = (text || '').trim();

  if (!trimmed || trimmed.length > 100) {
    return res.status(400).json({ error: '内容不能为空或超过100字' });
  }
  if (!VALID_ROLES.has(role)) {
    return res.status(400).json({ error: '无效的角色' });
  }

  const approved = await moderateContent(trimmed);
  if (!approved) {
    return res.json({ rejected: true });
  }

  const createdAt = localDateStr();
  const result = db.prepare('INSERT INTO messages (role, text, created_at) VALUES (?, ?, ?)').run(role, trimmed, createdAt);
  const unlock = createUnlockToken(role);
  res.json({
    id: result.lastInsertRowid,
    text: trimmed,
    created_at: createdAt,
    unlockToken: unlock.token,
    unlockExpiresAt: unlock.expiresAt,
  });
});

// Admin: delete one message
app.delete('/api/messages/:id', (req, res) => {
  if (!checkAdminAuth(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: '无效的 ID' });
  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  res.json({ success: true });
});

// Admin: clear all messages
app.post('/api/clear-messages', (req, res) => {
  if (!checkAdminAuth(req, res)) return;
  db.exec('DELETE FROM messages');
  res.json({ success: true });
});

// Admin: test content moderation
app.post('/api/admin/moderate-test', async (req, res) => {
  if (!checkAdminAuth(req, res)) return;
  const { text } = req.body || {};
  const trimmed = (text || '').trim();
  if (!trimmed || trimmed.length > 100) {
    return res.status(400).json({ error: '内容不能为空或超过100字' });
  }
  if (!DEEPSEEK_API_KEY) {
    return res.json({ configured: false, message: '未配置 DEEPSEEK_API_KEY，所有内容直接通过' });
  }
  const approved = await moderateContent(trimmed);
  res.json({ configured: true, text: trimmed, result: approved ? 'pass' : 'reject' });
});

// Admin: list all messages
app.get('/api/admin/messages', (req, res) => {
  if (!checkAdminAuth(req, res)) return;
  const rows = db.prepare(
    'SELECT id, role, text, created_at FROM messages ORDER BY id DESC'
  ).all();
  res.json(rows);
});

app.listen(PORT, () => {
  console.log(`儿童展览匿名留言板已启动: http://localhost:${PORT}`);
});
