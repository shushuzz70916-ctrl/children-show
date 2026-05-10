require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

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
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== ADMIN_TOKEN) {
    res.status(401).json({ error: '无权限' });
    return false;
  }
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

// ---- DeepSeek moderation ----
async function moderateContent(text) {
  if (!DEEPSEEK_API_KEY) {
    console.warn('DEEPSEEK_API_KEY not set, skipping moderation');
    return true;
  }
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
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
    const data = await response.json();
    const result = data?.choices?.[0]?.message?.content?.trim().toLowerCase();
    return result === 'pass';
  } catch (err) {
    console.error('Moderation API error:', err.message);
    return false;
  }
}

// ---- API ----

app.get('/api/roles', (_req, res) => {
  res.json(ROLES);
});

app.get('/api/messages/:roleId', (req, res) => {
  const { roleId } = req.params;
  if (!VALID_ROLES.has(roleId)) {
    return res.status(400).json({ error: '无效的角色' });
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
  res.json({ id: result.lastInsertRowid, text: trimmed, created_at: createdAt });
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
