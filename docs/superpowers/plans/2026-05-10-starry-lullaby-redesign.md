# Starry Lullaby UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Memphis+starry-night visual theme with Starry Lullaby (deep blue gradient + dense warm-gold starfield + 3D card depth)

**Architecture:** Single-file CSS/HTML refactor of `public/index.html`. Remove old decorative elements (polka-bg, geofield canvas, geo decorations), replace with CSS starfield + repositioned moon. All component styles updated for new color system and depth layering. No JS logic changes, no server changes.

**Tech Stack:** Vanilla CSS (no framework), static HTML

---

### Task 1: Remove HTML decorative elements, add starfield layer

**Files:**
- Modify: `public/index.html:476-484`

- [ ] **Step 1: Replace old decorative HTML with new starfield structure**

Replace lines 476-484 (from `<div id="polka-bg">` through `<div class="geo-diamond-bl">`):
```html
  <!-- 星空背景 -->
  <div id="starfield-deep"></div>
  <div id="starfield-mid"></div>
  <!-- 月光环境光 -->
  <div id="moon-ambient"></div>
  <div id="moon"></div>
```

Remove lines as listed:
- `<div id="polka-bg"></div>` (line 477)
- `<canvas id="geofield"></canvas>` (line 478)
- `<div id="moon"></div>` (line 479) — re-added after starfield divs
- `<div class="geo-triangle-tr"></div>` (line 484)
- `<div class="geo-diamond-bl"></div>` (line 485)

- [ ] **Step 2: Verify page still loads without errors**

Refresh `http://localhost:3000` and check browser console for errors.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "refactor: remove old decorative HTML, add starfield layer containers"
```

---

### Task 2: Replace CSS design tokens and background

**Files:**
- Modify: `public/index.html:9-34` (CSS variables)
- Modify: `public/index.html:37-56` (body, polka-bg, geofield)
- Modify: `public/index.html:58-113` (moon, geo decorations)

- [ ] **Step 1: Replace CSS variables**

Replace lines 9-22:
```css
    :root {
      --bg-deep: #060E24;
      --bg-mid: #0D1A3E;
      --bg-light: #142050;
      --gold: #D4A030;
      --gold-light: #FFE8A0;
      --gold-dark: #C09028;
      --card-bg: linear-gradient(135deg, rgba(18,30,60,0.75) 0%, rgba(10,20,45,0.8) 100%);
      --card-border: rgba(255,215,100,0.18);
      --card-highlight: rgba(255,235,160,0.35);
      --text: rgba(255,255,255,0.9);
      --text-muted: rgba(255,210,130,0.4);
    }
```

- [ ] **Step 2: Replace body background and remove polka-bg/geofield CSS**

Replace body background (line 31):
```css
      background: linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-mid) 35%, var(--bg-light) 65%, var(--bg-deep) 100%);
```

Remove polka-bg CSS block (lines 37-47: `#polka-bg { ... }`).

Remove geofield CSS block (lines 49-56: `#geofield { ... }`).

- [ ] **Step 3: Add starfield CSS (two-layer dense stars)**

Insert after body CSS:
```css
    /* ========== 星空点阵（浓密） ========== */
    #starfield-deep {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 0; pointer-events: none;
      opacity: 0.7;
      background-image:
        radial-gradient(0.6px 0.6px at 5% 10%, rgba(255,230,160,0.3), transparent),
        radial-gradient(0.5px 0.5px at 12% 30%, rgba(255,255,255,0.2), transparent),
        radial-gradient(0.5px 0.5px at 22% 8%, rgba(255,220,140,0.25), transparent),
        radial-gradient(0.4px 0.4px at 30% 25%, rgba(255,255,255,0.15), transparent),
        radial-gradient(0.7px 0.7px at 42% 28%, rgba(255,255,255,0.35), transparent),
        radial-gradient(0.4px 0.4px at 58% 18%, rgba(255,255,255,0.15), transparent),
        radial-gradient(0.5px 0.5px at 68% 32%, rgba(255,230,160,0.25), transparent),
        radial-gradient(0.4px 0.4px at 78% 20%, rgba(255,255,255,0.18), transparent),
        radial-gradient(0.6px 0.6px at 88% 30%, rgba(255,220,140,0.28), transparent),
        radial-gradient(0.5px 0.5px at 15% 45%, rgba(255,255,255,0.22), transparent),
        radial-gradient(0.4px 0.4px at 35% 48%, rgba(255,255,255,0.15), transparent),
        radial-gradient(0.6px 0.6px at 55% 42%, rgba(255,230,160,0.28), transparent),
        radial-gradient(0.5px 0.5px at 72% 45%, rgba(255,255,255,0.2), transparent),
        radial-gradient(0.4px 0.4px at 90% 44%, rgba(255,255,255,0.12), transparent);
    }
    #starfield-mid {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 0; pointer-events: none;
      background-image:
        radial-gradient(1.8px 1.8px at 10% 15%, rgba(255,235,160,0.75), transparent),
        radial-gradient(2.2px 2.2px at 25% 22%, rgba(255,240,170,0.8), transparent),
        radial-gradient(1.4px 1.4px at 38% 10%, rgba(255,225,150,0.65), transparent),
        radial-gradient(2.0px 2.0px at 50% 6%, rgba(255,230,155,0.7), transparent),
        radial-gradient(1.6px 1.6px at 62% 18%, rgba(255,235,160,0.75), transparent),
        radial-gradient(1.2px 1.2px at 72% 8%, rgba(255,220,140,0.55), transparent),
        radial-gradient(2.4px 2.4px at 85% 14%, rgba(255,240,170,0.85), transparent),
        radial-gradient(1.8px 1.8px at 18% 35%, rgba(255,225,150,0.6), transparent),
        radial-gradient(2.0px 2.0px at 40% 30%, rgba(255,230,155,0.7), transparent),
        radial-gradient(1.5px 1.5px at 58% 36%, rgba(255,225,150,0.55), transparent),
        radial-gradient(2.2px 2.2px at 75% 32%, rgba(255,240,170,0.8), transparent),
        radial-gradient(1.3px 1.3px at 92% 28%, rgba(255,220,140,0.5), transparent),
        radial-gradient(0.8px 0.8px at 5% 42%, rgba(255,255,255,0.25), transparent),
        radial-gradient(1.0px 1.0px at 32% 44%, rgba(255,225,150,0.4), transparent),
        radial-gradient(1.4px 1.4px at 68% 42%, rgba(255,230,155,0.55), transparent);
    }
```

- [ ] **Step 4: Update moon size, position, and add moon ambient light**

Replace moon CSS (lines 58-78):
```css
    /* ========== 月光环境光 ========== */
    #moon-ambient {
      position: absolute;
      top: -6%; right: 0%;
      width: 180px; height: 180px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,225,140,0.1) 0%, transparent 70%);
      z-index: 0; pointer-events: none;
    }
    /* ========== 满月 ========== */
    #moon {
      position: absolute;
      top: 4%; right: 8%;
      width: 50px; height: 50px;
      border-radius: 50%;
      background: radial-gradient(circle at 40% 36%, rgba(255,245,185,0.85) 0%, rgba(255,220,100,0.4) 40%, transparent 65%);
      box-shadow: 0 0 30px rgba(255,215,100,0.35), 0 0 80px rgba(255,190,50,0.12);
      z-index: 1; pointer-events: none;
      animation: moonGlow 8s ease-in-out infinite;
    }
    @keyframes moonGlow {
      0%, 100% { box-shadow: 0 0 30px rgba(255,215,100,0.35), 0 0 80px rgba(255,190,50,0.12); }
      50% { box-shadow: 0 0 45px rgba(255,215,100,0.5), 0 0 100px rgba(255,190,50,0.2); }
    }
```

Remove old moon CSS and geo decoration CSS (lines 58-117: `.geo-triangle-tr`, `.geo-diamond-bl`, `@keyframes geoFloat`).

- [ ] **Step 5: Verify starfield and moon render correctly**

Refresh `http://localhost:3000` and visually confirm: stars visible, moon at top-right (smaller), no old geo decorations.

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "refactor: replace design tokens, add starfield CSS, update moon"
```

---

### Task 3: Update all component styles

**Files:**
- Modify: `public/index.html` CSS sections for cards, buttons, nav, input, toast, countdown

- [ ] **Step 1: Update Memphis panel → Starry panel**

Replace `.memphis-panel` (line 80-85):
```css
    /* ========== 星空面板通用 ========== */
    .memphis-panel {
      background: linear-gradient(135deg, rgba(18,30,60,0.75) 0%, rgba(10,20,45,0.8) 100%);
      border: 1px solid var(--card-border);
      border-top: 1px solid var(--card-highlight);
      box-shadow: 0 4px 20px rgba(0,0,0,0.35), 0 1px 0 rgba(255,215,100,0.06) inset, 0 8px 32px rgba(0,0,0,0.25);
    }
```

- [ ] **Step 2: Update role card active state**

Replace `.role-card:active`:
```css
    .role-card:active {
      transform: translate(2px, 2px);
      box-shadow: 0 2px 12px rgba(0,0,0,0.35), 0 0 16px rgba(255,215,100,0.15);
    }
```

- [ ] **Step 3: Update card-img**

Replace `.role-card .card-img`:
```css
    .role-card .card-img {
      width: 44px; height: 44px;
      border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
    }
```

- [ ] **Step 4: Update message card time color**

Replace `.msg-card .msg-time`:
```css
    .msg-card .msg-time {
      font-size: 10px; font-weight: 600;
      color: rgba(255,210,130,0.35); margin-top: 6px;
    }
```

- [ ] **Step 5: Update nav bar**

Replace `.nav-bar`:
```css
    .nav-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; flex-shrink: 0; z-index: 6;
      background: linear-gradient(180deg, rgba(8,18,42,0.85) 0%, rgba(8,18,42,0.5) 100%);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255,215,100,0.12);
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
```

- [ ] **Step 6: Update nav buttons**

Replace `.nav-btn`:
```css
    .nav-btn {
      width: 36px; height: 36px; border-radius: 10px;
      border: 1px solid rgba(255,215,100,0.25);
      background: rgba(15,28,55,0.7);
      color: rgba(255,255,255,0.75); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700;
      transition: transform 0.12s, box-shadow 0.12s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      flex-shrink: 0;
      font-family: 'Nunito', 'Fredoka', 'PingFang SC', sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    .nav-btn:active {
      transform: translate(1px, 1px);
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
```

- [ ] **Step 7: Update message list**

Replace `.message-list`:
```css
    .message-list {
      flex: 1; overflow-y: auto; padding: 12px 14px;
      display: flex; flex-direction: column; gap: 8px;
      -webkit-overflow-scrolling: touch;
    }
```

- [ ] **Step 8: Update input bar**

Replace `.input-bar`:
```css
    .input-bar {
      display: flex; gap: 8px;
      padding: 10px 14px;
      padding-bottom: max(10px, env(safe-area-inset-bottom));
      flex-shrink: 0;
      background: linear-gradient(0deg, rgba(8,18,42,0.85) 0%, rgba(8,18,42,0.5) 100%);
      backdrop-filter: blur(12px);
      border-top: 1px solid rgba(255,215,100,0.12);
      box-shadow: 0 -4px 16px rgba(0,0,0,0.3);
      z-index: 6;
    }
```

- [ ] **Step 9: Update input field**

Replace `.input-bar input`:
```css
    .input-bar input {
      flex: 1; padding: 10px 14px; font-size: 16px;
      border: 1px solid rgba(255,215,100,0.2);
      border-radius: 12px; outline: none;
      font-family: 'Nunito', 'Fredoka', 'PingFang SC', sans-serif;
      font-weight: 600;
      background: rgba(0,0,0,0.2);
      color: #fff;
      box-shadow: inset 0 2px 6px rgba(0,0,0,0.3);
      transition: border-color 0.2s, box-shadow 0.2s;
      min-width: 0;
    }
    .input-bar input::placeholder {
      color: rgba(255,255,255,0.25); font-weight: 400;
    }
    .input-bar input:focus {
      border-color: var(--gold);
      box-shadow: inset 0 2px 6px rgba(0,0,0,0.3), 0 0 0 4px rgba(212,160,48,0.15);
    }
```

- [ ] **Step 10: Update send button**

Replace `.input-bar button` and `.input-bar button:active` and `.input-bar button:disabled`:
```css
    .input-bar button {
      padding: 10px 18px; font-size: 16px;
      border: none; border-top: 1px solid rgba(255,240,180,0.4);
      border-radius: 12px;
      background: linear-gradient(180deg, #E0B840 0%, #C09028 100%);
      color: #fff; cursor: pointer;
      font-family: 'Fredoka', 'Nunito', 'PingFang SC', sans-serif;
      font-weight: 700; letter-spacing: 0.04em;
      white-space: nowrap;
      transition: transform 0.12s, box-shadow 0.12s, opacity 0.12s;
      box-shadow: 0 3px 12px rgba(180,130,30,0.3);
      flex-shrink: 0;
    }
    .input-bar button:active {
      transform: translate(1px, 1px);
      box-shadow: 0 1px 6px rgba(180,130,30,0.3);
    }
    .input-bar button:disabled {
      opacity: 0.5; cursor: not-allowed;
      transform: none; box-shadow: 0 3px 12px rgba(180,130,30,0.3);
    }
```

- [ ] **Step 11: Update toast**

Replace `#toast`:
```css
    #toast {
      position: absolute; top: 20px; left: 50%;
      transform: translateX(-50%);
      padding: 12px 28px; border-radius: 14px;
      font-size: 15px;
      font-family: 'Nunito', 'Fredoka', 'PingFang SC', sans-serif;
      font-weight: 700; z-index: 30; display: none;
      border: 1.5px solid rgba(255,215,100,0.25);
      box-shadow: 0 4px 20px rgba(0,0,0,0.35);
      color: #fff;
    }
```

- [ ] **Step 12: Update countdown bar**

Replace `#countdown-bar-wrap`, `#countdown-bar`, `#countdown-text`:
```css
    #countdown-bar-wrap {
      flex-shrink: 0; height: 3px;
      background: rgba(255,255,255,0.06); display: none;
    }
    #countdown-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--gold), var(--gold-dark));
      box-shadow: 0 0 6px rgba(200,160,50,0.3);
      transition: width 1s linear; width: 100%;
    }
    #countdown-text {
      text-align: center; font-size: 10px; font-weight: 600;
      color: rgba(255,255,255,0.25); padding: 4px 0 6px;
      display: none; flex-shrink: 0;
    }
```

- [ ] **Step 13: Update title h1**

Replace `#view-roles h1`:
```css
    #view-roles h1 {
      font-family: 'ZCOOL KuaiLe', 'PingFang SC', sans-serif;
      font-size: clamp(30px, 5vw, 48px);
      text-align: center; line-height: 1.5;
      color: var(--gold-light);
      text-shadow: 0 0 30px rgba(255,215,100,0.3), 0 2px 8px rgba(0,0,0,0.5);
      margin-bottom: 24px; pointer-events: none;
    }
```

- [ ] **Step 14: Update nav center role name/alias**

Replace `.nav-center .role-name` and `.nav-center .role-alias`:
```css
    .nav-center .role-name {
      font-size: 22px; font-weight: 800; color: #fff;
      letter-spacing: 0.05em; text-shadow: 0 1px 4px rgba(0,0,0,0.4);
      font-family: 'Nunito', 'Fredoka', 'PingFang SC', sans-serif;
    }
    .nav-center .role-alias {
      font-size: 11px; font-weight: 600;
      color: rgba(255,210,130,0.4); margin-top: 2px;
    }
```

- [ ] **Step 15: Update pre-send hint colors**

Replace `.empty-hint` and `#pre-send-hint` text colors:
```css
    .empty-hint {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px 20px;
      color: rgba(255,255,255,0.25);
      font-size: 15px; font-weight: 600; text-align: center;
    }
    #pre-send-hint .hint-text {
      color: rgba(255,255,255,0.35);
      font-size: 16px; font-weight: 700; line-height: 1.6;
    }
```

- [ ] **Step 16: Update music button for dark theme**

Replace `#music-btn`:
```css
    #music-btn {
      position: absolute; top: 20px; right: 20px;
      width: 40px; height: 40px; border-radius: 12px;
      border: 1px solid rgba(255,215,100,0.25);
      background: rgba(15,28,55,0.8);
      cursor: pointer; z-index: 20;
      box-shadow: 0 2px 12px rgba(0,0,0,0.25);
      transition: transform 0.15s, box-shadow 0.15s;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.8);
    }
    #music-btn:active {
      transform: translate(1px, 1px);
      box-shadow: 0 1px 6px rgba(0,0,0,0.25);
    }
```

- [ ] **Step 17: Verify all components render**

Refresh `http://localhost:3000`, check: role cards, message view, send button, nav buttons, toast, countdown bar, music button.

- [ ] **Step 18: Commit**

```bash
git add public/index.html
git commit -m "refactor: update all component styles for Starry Lullaby theme"
```

---

### Task 4: Remove canvas animation JS

**Files:**
- Modify: `public/index.html` JS section (approximately lines 875-975, the geofield canvas code)

- [ ] **Step 1: Remove geofield canvas JS**

Remove the entire block from `// ==================== 孟菲斯几何背景（精简版） ====================` through the end of `drawGeoShapes()` and resize listener. This is approximately lines 875-975, covering:
- `const geofield`, `geoCtx`, `geoShapes`, `SHAPE_COUNT`
- `memphisColors` array
- `resizeGeofield()`, `createGeoShapes()`, `drawGeoShapes()`
- `resizeGeofield()`, `createGeoShapes()`, `drawGeoShapes()` calls
- `window.addEventListener('resize', ...)`

- [ ] **Step 2: Verify no JS errors**

Refresh `http://localhost:3000` and check browser console for errors. Confirm page loads and all interactions work.

- [ ] **Step 3: Full flow test**

1. Open `http://localhost:3000` — verify starfield, moon, 8 role cards
2. Click a role card — verify message view with lock hint
3. Send a test message — verify toast, loading state, message appears with correct time
4. Verify countdown bar and text
5. Test back button returns to role selection
6. Test next button switches roles
7. Test music button toggles
8. Test admin page at `/admin.html` (should be unchanged)

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "refactor: remove canvas geometry animation JS"
```
