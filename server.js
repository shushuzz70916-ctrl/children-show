require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'danmaku.json');
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// Ensure data directory and file exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

function loadDanmaku() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveDanmaku(text) {
  const list = loadDanmaku();
  list.push({ text, time: new Date().toISOString() });
  // Keep last 500 entries to avoid file growing too large
  const trimmed = list.slice(-500);
  fs.writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  return trimmed;
}

async function moderateContent(text) {
  if (!DEEPSEEK_API_KEY) {
    // No API key configured — allow all content in dev mode
    console.warn('⚠ DEEPSEEK_API_KEY not set, skipping moderation');
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
              '你是儿童内容审核员，判断弹幕是否适合儿童观看，不能包含脏话、暴力、色情、价值观错误、歧视等内容。只回复 pass 或 reject，不要回复其他内容。',
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
    // If API fails, reject to be safe in production
    return false;
  }
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// QR code generation endpoint
app.get('/api/qrcode', async (req, res) => {
  try {
    const host = req.get('host');
    const sendUrl = `${req.protocol}://${host}/send.html`;
    const qrDataUrl = await QRCode.toDataURL(sendUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#FF6B6B', light: '#FFFFFF' },
    });
    res.json({ url: sendUrl, qrcode: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'QR code generation failed' });
  }
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send existing danmaku history to new client
  const history = loadDanmaku();
  ws.send(JSON.stringify({ type: 'history', data: history }));

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'danmaku') {
      const text = (msg.text || '').trim();
      if (!text || text.length > 100) {
        ws.send(JSON.stringify({ type: 'error', message: '内容不能为空或超过100字' }));
        return;
      }

      // AI moderation
      const approved = await moderateContent(text);
      if (!approved) {
        ws.send(JSON.stringify({ type: 'rejected', message: '内容不适合，请重新输入' }));
        return;
      }

      // Save and broadcast
      const updatedList = saveDanmaku(text);
      const newEntry = updatedList[updatedList.length - 1];

      // Broadcast to ALL connected clients
      const broadcast = JSON.stringify({ type: 'new_danmaku', data: newEntry });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(broadcast);
        }
      });
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`✨ 儿童展览弹幕系统已启动: http://localhost:${PORT}`);
});
