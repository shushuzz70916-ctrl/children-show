# CLAUDE.md — 儿童展览匿名角色留言板

## 项目概述

儿童艺术展-11：07pm 匿名留言互动系统：展览现场平板设备，观众选择 8 个生物角色之一，留言后查看该角色下所有人的历史留言。
部署于 Render 公网，Node.js 单进程 HTTP 服务，SQLite 持久化存储。
视觉风格：星空梦境 + 孟菲斯主题 — 深邃夜空背景 + 几何图案 + 满月元素 + 彩色偏移阴影面板。

---

## 技术架构

```
平板浏览器 (index.html SPA)
    ↕ REST API (HTTP)
Node.js server.js
    ├── Express         → 静态文件 public/ + REST API
    ├── DeepSeek API    → 内容审核 (pass/reject)
    └── SQLite (better-sqlite3) → data/messages.db
```

### 依赖

- `express` ^4.18 — HTTP 服务器 + 静态文件
- `better-sqlite3` ^11.7 — SQLite 数据库
- `dotenv` ^16.4 — 读取 .env 环境变量

### 配置

| 环境变量 | 必须 | 说明 |
|----------|------|------|
| `DEEPSEEK_API_KEY` | 生产必须 | DeepSeek API Key，不设则跳过审核 |
| `ADMIN_TOKEN` | 管理必须 | 管理后台密码，不设则所有管理接口返回 503 |
| `PORT` | 否 | 默认 3000 |

---

## 目录结构

```
children-show/
├── server.js              # 后端入口
├── package.json
├── render.yaml            # Render Blueprint 部署配置
├── .env.example           # 环境变量模板
├── .gitignore             # 忽略 node_modules/ .env data/messages.db
├── CLAUDE.md              # 本文件
├── public/
│   ├── index.html         # 平板端 SPA（角色选择 + 留言页）
│   ├── admin.html         # 管理后台（需 ADMIN_TOKEN 登录）
│   ├── children-light-music.mp3  # 背景音乐
│   └── assets/            # 7幅展品画作（PNG + SVG 双版本），复用为角色图标
└── data/
    └── messages.db        # SQLite 数据库，运行中自动生成，不提交 git
```

---

## 后端 (server.js)

### REST API 端点

| 方法 | 路径 | 请求体 | 响应 | 说明 |
|------|------|--------|------|------|
| `GET` | `/api/roles` | — | `[{id, name, alias, image}]` | 8 个角色元数据 |
| `GET` | `/api/messages/:roleId` | — | `[{id, text, created_at}]` | 按时间升序 |
| `POST` | `/api/messages` | `{role, text}` | `{id, text, created_at}` 或 `{rejected: true}` | 含 AI 审核；限流 5次/IP/分钟 |
| `DELETE` | `/api/messages/:id` | — | `{success: true}` | 删除单条留言（需 Bearer Token） |
| `POST` | `/api/clear-messages` | — | `{success: true}` | 清空所有留言（需 Bearer Token） |
| `GET` | `/api/admin/messages` | — | `[{id, role, text, created_at}]` | 全量留言，按 id 降序（需 Bearer Token） |

**鉴权方式**：管理接口需在请求头加 `Authorization: Bearer <ADMIN_TOKEN>`。

### 8 个角色（硬编码在 server.js 和 index.html）

| id | 名称 | 别名 | 图片 |
|----|------|------|------|
| `tree` | 树干 | 权力中心 | assets/大树.png |
| `moon` | 月亮 | 权力跟班 | assets/月亮.png |
| `star` | 星星 | 冷眼小队 | 无（CSS SVG 五角星） |
| `birdnest` | 鸟巢 | 谣言加工厂 | assets/鸟巢.png |
| `falcon` | 乌隼 | 悄悄话拆散王 | assets/乌隼.png |
| `wind` | 风 | 隐形谣言扩音器 | assets/风.png |
| `chameleon` | 变色龙 | — | assets/变色龙.png |
| `air` | 空气 | — | assets/空气.png |

### 审核流程

1. POST `/api/messages` → 校验 text 非空且 ≤100 字，role 在合法列表中
2. 调用 DeepSeek API (`deepseek-chat` 模型)，system prompt 要求只回复 `pass` 或 `reject`
3. `pass` → INSERT 到 SQLite → 返回新记录
4. `reject` 或 API 异常 → 返回 `{rejected: true}`
5. **无 API Key 时跳过审核**，所有内容直接通过

### SQLite 表结构

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_role ON messages(role);
CREATE INDEX idx_created ON messages(created_at);
```

---

## 前端 (index.html) — 单页 SPA

### View 1: 角色选择页

- 标题：「你最想对哪个生物说些什么？」（ZCOOL KuaiLe 字体，暖金渐变发光）
- 8 张角色卡片：2 列 × 4 行网格，孟菲斯面板（实色底 + 3px 白边框 + 紫色偏移阴影）
- 每张卡片：角色图片/图标 + 名称 + 别名
- 星星角色无图片，用 CSS 内联 SVG 五角星（黄色填充）
- 点击卡片 → 进入 View 2

### View 2: 角色留言页

**核心交互流程：**

```
进角色页 → 🔒 "先留言，才能看到大家的悄悄话哦"
              ↓
         发送留言 → 审核中 → 审核通过
              ↓
         展示该角色全部历史留言 + 60 秒倒计时
              ↓
   （发新留言 → 倒计时重置为 60 秒）
              ↓
         倒计时归零 → 自动返回角色选择页
```

**页面结构：**
- 顶部导航栏：← 返回按钮 + 角色名/别名 + → 切换角色按钮
- 留言前提示区：锁图标 + 提示文字（留言列表隐藏）
- 留言列表：`overflow-y: auto`，孟菲斯面板卡片，带文字和时间戳
- 底部倒计时条：渐变进度条 + 「X 秒后自动返回首页」
- 底部输入栏：固定底部，输入框 + 发送按钮

**空闲保护：** 进入留言页后，2 分钟内无有效输入行为（键入/删除/粘贴）→ 自动返回选择页。每次 `input` 事件重置计时，仅焦点/点击不算。发送成功后切换为 60 秒倒计时主导。

### Toast 颜色约定（不要改变）

| 状态 | 颜色 |
|------|------|
| 审核中 | 蓝色 `#45B7D1` |
| 拒绝 | 红色 `#E17055` |
| 错误 | 橙色 `#FF8E53` |

### 视觉主题（孟菲斯 + 星空梦境，保留）

- CSS 变量：`--pink`, `--yellow`, `--teal`, `--purple`, `--coral`, `--mint`, `--lavender`
- 星空深紫渐变背景 + 波点纹理层
- 50 个浮动几何图形画布（圆/三角/菱形/十字/环）
- 满月：120px 暖黄圆 + 呼吸动画（左上角）
- 2 个固定几何装饰（三角形 + 菱形）
- 孟菲斯面板：实色深紫底 + 3px 白色实线边框 + 彩色偏移阴影
- Nunito + ZCOOL KuaiLe 字体
- 音乐开关按钮（右上角，仅角色选择页显示）

### 背景音乐

- 音源：`public/children-light-music.mp3`
- HTML `<audio loop>` 循环播放，音量 0.3
- 首次点击页面触发自动播放
- 右上角按钮切换播放/暂停，SVG 图标

---

## 部署 (Render)

- 配置文件：`render.yaml` (Blueprint 方式)
- Build: `npm install`
- Start: `node server.js`
- 需在 Render 环境变量中填入 `DEEPSEEK_API_KEY` 和 `ADMIN_TOKEN`
- **套餐：starter（$7/月）**，已在 render.yaml 配置持久磁盘挂载到 `/opt/render/project/src/data`（1 GB）
- 如降回 free 套餐，持久磁盘不可用，服务重启后 messages.db 丢失

---

## 注意事项（修改此项目时必须遵守）

1. **前端是单页 SPA，两个 View 通过 JS 切换 display**，不刷新页面
2. **留言前必须先发送**：进入角色页后留言列表隐藏，只有发送成功后才会加载展示
3. **60 秒自动返回**：倒计时归零自动回角色选择页；每次新发留言倒计时重置
4. **空闲 2 分钟无有效输入自动返回**：计时由 `input` 事件驱动，仅焦点/点击不重置；防止小朋友停止输入后卡在页面
5. **星星角色无图片**，用内联 SVG 五角星（`STAR_SVG` 常量），不要删
6. **不要改变 Toast 颜色约定**：蓝=审核中，红=拒绝，橙=错误
7. **不要删除 `app.set('trust proxy', 1)`**，Render 代理后协议检测需要
8. **`data/messages.db` 不在 git 中**，`.gitignore` 已排除
9. **审核不通过只返回 `{rejected: true}`**，不保存到数据库
10. **无 `DEEPSEEK_API_KEY` 时所有留言直接通过**
11. **留言文字限制 1-100 字**，前后端均有校验
12. **角色 ID 是英文**（tree, moon, star 等），前后端保持一致
13. **← 返回按钮保留**：方便工作人员手动返回，也保留 → 切换按钮
14. **不要用 emoji 做图标**（音乐按钮用 SVG、锁图标除外）
15. **7 幅 PNG 同时保留 SVG 版本在 `assets/`**，PNG 用于线上渲染，SVG 给布展方备用
16. **管理后台在 `/admin.html`**：需要 `ADMIN_TOKEN` 登录，token 存 sessionStorage（关 tab 即失效）；支持按角色筛选、逐条删除、清空
17. **限流**：POST `/api/messages` 每个 IP 每分钟最多 5 条，超出返回 429
18. **`created_at` 格式**：统一本地时间字符串 `YYYY-MM-DD HH:MM:SS`，前端 `formatTime()` 只显示时分秒
