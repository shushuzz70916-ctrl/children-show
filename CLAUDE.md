# CLAUDE.md — 儿童展览互动弹幕系统

## 项目概述

iSTART儿童艺术展-11：07PM 互动弹幕系统：大屏幕滚动弹幕 + 手机扫码发送 + DeepSeek AI 内容审核 + WebSocket 实时推送。
部署于 Render 公网，Node.js 单进程同时服务 HTTP 和 WebSocket。
视觉风格：星空梦境主题 — 深邃夜空背景 + 毛玻璃面板 + 暖色弹幕 + 满月元素。

---

## 技术架构

```
浏览器 (index.html / send.html)
    ↕ WebSocket (ws:// 或 wss://)
    ↕ HTTP (Express 静态文件)
Node.js server.js
    ├── Express         → 静态文件 public/ + /api/qrcode
    ├── ws              → WebSocket 弹幕收发
    ├── DeepSeek API    → 内容审核 (pass/reject)
    └── data/danmaku.json → JSON 文件持久化 (保留最近 500 条)
```

### 依赖

- `express` ^4.18 — HTTP 服务器 + 静态文件
- `ws` ^8.16 — WebSocket
- `qrcode` ^1.5 — 服务端 QR 码生成（作为前端 fallback）
- `dotenv` ^16.4 — 读取 .env 环境变量

### 配置

| 环境变量 | 必须 | 说明 |
|----------|------|------|
| `DEEPSEEK_API_KEY` | 生产必须 | DeepSeek API Key，不设则跳过审核 |
| `PORT` | 否 | 默认 3000 |
| `BASE_URL` | 否 | 已不再使用（二维码改前端生成） |

---

## 目录结构

```
children-show/
├── server.js              # 后端入口
├── package.json
├── render.yaml            # Render Blueprint 部署配置
├── .env.example           # 环境变量模板
├── .gitignore             # 忽略 node_modules/ .env data/danmaku.json
├── CLAUDE.md              # 本文件
├── public/
│   ├── index.html         # 大屏幕展示页
│   └── send.html          # 手机发送页
└── data/
    └── danmaku.json       # 运行中自动生成，不提交 git
```

---

## 后端 (server.js)

### WebSocket 消息协议

所有消息均为 JSON 字符串。

**客户端 → 服务端：**

| type | 字段 | 说明 |
|------|------|------|
| `danmaku` | `text: string` (1-100字) | 发送弹幕 |

**服务端 → 客户端：**

| type | 字段 | 说明 |
|------|------|------|
| `history` | `data: [{text, time}]` | 连接时发送全部历史弹幕 |
| `new_danmaku` | `data: {text, time}` | 广播新弹幕给所有客户端 |
| `rejected` | `message: string` | 审核不通过，仅发给发送者 |
| `error` | `message: string` | 格式错误，仅发给发送者 |

### 审核流程

1. 收到 `danmaku` 消息 → 校验非空且 ≤100 字
2. 调用 DeepSeek API (`deepseek-chat` 模型)，system prompt 要求只回复 `pass` 或 `reject`
3. `pass` → 写入 `danmaku.json` (保留最近 500 条) → 广播 `new_danmaku` 给所有客户端
4. `reject` 或 API 异常 → 仅向发送者回复 `rejected`
5. **无 API Key 时跳过审核**，所有内容直接通过

### QR 码

- 前端优先：`location.origin + '/send.html'` → `api.qrserver.com` 生成 QR 图
- 服务端 fallback：`GET /api/qrcode` → 用 `x-forwarded-proto` 或 `req.protocol` + `Host` 头生成 URL → `qrcode` 库生成 base64 PNG
- `app.set('trust proxy', 1)` 确保 Render 代理后协议检测正确

---

## 前端大屏 (index.html)

### 页面元素

| 位置 | 功能 |
|------|------|
| 中央 | 标题 "iSTART儿童艺术展-11：07PM"，暖金渐变 + 浮动 + 双层光晕，68px，ZCOOL KuaiLe 字体 |
| 标题下方 (calc 50%+58px) | 毛玻璃输入框（100 字限制）+ 发送按钮 |
| 左上角 | 满月：径向渐变200px暖黄圆 + 多层扩散光晕 + 呼吸动画 (z-index: 1) |
| 右下角 | 毛玻璃二维码卡片 → 手机扫码跳转 send.html |
| 右上角 | 毛玻璃音乐开关按钮，SVG 图标（扬声器/静音） |
| 全屏 | 弹幕层 (z-index: 10)，Nunito 字体 28px bold，pointer-events: none |
| 标题层 | z-index: 5，弹幕在其上方飞过 |
| 背景 | 星空画布 (z-index: 0)：180颗闪烁星星，30颗高亮星带暖色柔光晕 |
| 整体 | Nunito 字体（UI 文字），毛玻璃面板贯穿（backdrop-filter: blur） |

### 弹幕动画

- CSS `@keyframes scroll-left`：`translateX(100vw)` → `translateX(-100%)`
- `.danmaku-item`：`font-family: Nunito; font-size: 28px; font-weight: 700`，暖色系 16 色 + `text-shadow: 0 0 18px currentColor` 发光
- 动画：`animation: scroll-left linear forwards`，时长由 JS 动态设置
- 文字颜色从 16 种暖色系预设中随机选取（珊瑚、暖金、薄荷、薰衣草等）

### 弹幕调度系统（核心逻辑）

**常量：**

| 常量 | 值 | 说明 |
|------|-----|------|
| `TOP_MARGIN` | 80 | 弹幕区域顶部留白 (px) |
| `BOTTOM_MARGIN` | 140 | 弹幕区域底部留白 (px) |
| `ROW_HEIGHT` | 50 | 每条轨道高度 (px) |
| `TARGET_MIN` | 10 | 屏幕最少保持弹幕数 |
| `TARGET_MAX` | 20 | 初始铺满 + 维持上限 |
| `MIN_DURATION` | 18 | 最短飞行时间 (s) |
| `MAX_DURATION` | 26 | 最长飞行时间 (s) |
| `LAUNCH_COOLDOWN` | 1800 | 同轨道最小发射间隔 (ms) |

**轨道管理：**
- `rowCount` = `(视口高度 - TOP_MARGIN - BOTTOM_MARGIN) / ROW_HEIGHT`，至少 8 行
- `rowFreeAt[row]`：该行下次可用的时间戳，用于防止同轨道弹幕重叠
- 窗口 resize 时重新计算行数

**两种发射路径：**

1. **用户新弹幕 (urgent)**：`launchOne(text, true)`
   - 随机选轨道，delay=0，立即飞入
   - 不受 `TARGET_MAX` 限制，不参与行等待队列
   - 适用于 `new_danmaku` 消息和初始 burst

2. **历史自动补充**：`launchOne(text)` (urgent 默认 undefined)
   - 调用 `findFreeRow()` 选最早释放的轨道
   - 等待时间上限 3 秒

**保持屏幕不空 (`maintainScreen`)：**
- 每 2 秒检查一次（`activeCount >= TARGET_MIN` 时）
- `activeCount < TARGET_MIN` 时 → 从 `danmakuHistory[historyCursor % danmakuHistory.length]` 取弹幕补充
- 遵守 `LAUNCH_COOLDOWN` 冷却
- 每条弹幕消失时 (`el.remove()`) → `activeCount--` → `scheduleMaintain(200)` 触发检查
- **弹幕池为空时不补充**，等待新弹幕到达

**WebSocket 消息处理：**

| 消息类型 | 处理 |
|----------|------|
| `history` | 填充 `danmakuHistory` → burst 启动 `min(TARGET_MAX, texts.length)` 条 → 启动 `maintainScreen` |
| `new_danmaku` | `danmakuHistory.push(text)` → `launchOne(text, true)` 立即飞入 |
| `rejected` | Toast 显示 `msg.message`，红色背景 |
| `error` | Toast 显示 `msg.message`，橙色背景 |

**发送反馈：**
- 发送后 → Toast "审核中..."（蓝色）
- 被拒 → Toast "内容不适合，请重新输入"（红色）
- 通过 → 弹幕出现在屏幕上（无额外 toast）

### 背景音乐

- 音源：`public/children-light-music.mp3`（Pixabay 免版税儿童轻音乐，尤克里里+木琴）
- HTML `<audio loop>` 循环播放，音量 0.3
- 自动播放受浏览器策略限制，页面首次点击后触发
- 右上角毛玻璃按钮切换播放/暂停，SVG 图标（扬声器/静音）

### QR 码

- 前端生成：`location.origin + '/send.html'` → `api.qrserver.com` 生成
- 加载失败时 fallback 请求 `/api/qrcode`

---

## 前端手机页 (send.html)

### 页面结构

- 居中卡片式布局，`max-width: 400px`
- 输入框（100 字限制 + 实时字数统计）
- 发送按钮
- Toast 提示区
- WebSocket 连接状态指示

### 发送流程

1. 输入文字 → 点击发送 / 回车
2. 前端校验 → WebSocket 发送 `{ type: 'danmaku', text }`
3. 显示 Toast "审核中..."（蓝色）
4. 等待服务端响应：
   - 收到 `new_danmaku` 广播 → Toast "发送成功！✨"（绿色）
   - 收到 `rejected` → Toast "内容不适合，请重新输入"（红色）
   - 收到 `error` → Toast 对应消息（橙色）

### 连接管理

- 断开后自动 3 秒重连
- 状态指示点：绿色脉冲 = 已连接，红色常亮 = 断开

---

## 数据存储

- `data/danmaku.json`：JSON 数组，每项 `{text: string, time: ISO string}`
- 最多保留 500 条，超过后自动删除旧记录
- 服务启动时自动创建（目录 + 空数组）
- `.gitignore` 中排除，不提交到仓库

---

## 部署 (Render)

- 配置文件：`render.yaml` (Blueprint 方式)
- Build: `npm install`
- Start: `node server.js`
- 需要手动在 Render 环境变量中填入 `DEEPSEEK_API_KEY`
- `BASE_URL` 已废弃，无需设置

---

## 注意事项（修改此项目时必须遵守）

1. **弹幕系统核心逻辑在 `public/index.html` 的 `// ==================== 弹幕系统 ====================` 区块中**，修改前需完整理解 `launchOne`、`maintainScreen`、`findFreeRow` 三个函数的协作关系
2. **用户新弹幕必须走 `launchOne(text, true)`**（urgent 路径），不能走历史补充路径，否则会出现延迟或不显示
3. **`activeCount` 是屏幕上弹幕数的唯一真实来源**，在 `launchOne` 的 setTimeout 回调中 ++，在移除 setTimeout 中 --，不能在其他地方修改
4. **`maintainScreen` 依赖 `activeCount < TARGET_MIN`** 触发补充，如果 `activeCount` 不准确会导致空白或过密
5. **WebSocket 广播会发给所有客户端**（包括 send.html），手机端通过收到 `new_danmaku` 作为发送成功的确认
6. **审核不通过只回复发送者**（`ws.send`），不会广播 `rejected`
7. **无 `DEEPSEEK_API_KEY` 时所有弹幕直接通过**，这是开发模式
8. **弹幕文字限制 1-100 字**，前后端均有校验
9. **`danmaku.json` 不在 git 中**，每次部署都是全新的，历史弹幕不会跨部署保留（Render 免费套餐文件系统是临时的）
10. **不要改变 Toast 颜色约定**：蓝色=审核中，绿色=成功，红色=拒绝，橙色=错误
11. **不要改变 CSS 动画 `scroll-left`**，它定义了弹幕从右到左的飞行效果
12. **不要删除 `app.set('trust proxy', 1)`**，否则 Render 代理后协议检测错误
13. **不要用 emoji 做图标**，音乐按钮等交互元素用 SVG 图标
14. **满月 `#moon` 和星空 `#starfield` 的 z-index**：星空 0 < 满月 1 < 标题 5 < 弹幕 10 < 交互元素 20-30，不要打乱层级
15. **标题字体 ZCOOL KuaiLe 在复杂汉字（如「童」）会笔画粘连**，必须保留 `-webkit-text-stroke` 和 `letter-spacing` 配置
