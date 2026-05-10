# 星空摇篮（Starry Lullaby）— UI 重新设计

## 目标

当前孟菲斯+星空梦境风格 → 更安静、更有立体感、视觉层次更丰富的「星空摇篮」主题。

## 设计决策

| 决策 | 选择 |
|------|------|
| 风格方向 | 星空摇篮（Starry Lullaby） |
| 星星浓度 | 浓密（大小混合，亮暗分层） |
| 立体感 | 强（光源方向+多层投影+内阴影+星空分层） |

## 色彩系统

| 角色 | Hex | CSS 变量 |
|------|-----|----------|
| 背景深 | `#060E24` | `--bg-deep` |
| 背景中 | `#0D1A3E` | `--bg-mid` |
| 背景浅 | `#142050` | `--bg-light` |
| 暖金主色 | `#D4A030` | `--gold` |
| 暖金亮 | `#FFE8A0` | `--gold-light` |
| 暖金暗 | `#C09028` | `--gold-dark` |
| 卡片底 | `rgba(18,30,60,0.7)` | `--card-bg` |
| 卡片边框 | `rgba(255,215,100,0.18)` | `--card-border` |
| 卡片高光 | `rgba(255,235,160,0.3)` | `--card-highlight` |
| 文字主 | `rgba(255,255,255,0.9)` | `--text` |
| 文字次 | `rgba(255,210,130,0.4)` | `--text-muted` |

渐变背景：`linear-gradient(180deg, #060E24 0%, #0D1A3E 35%, #142050 65%, #0B1636 100%)`

## 字体

不变：`ZCOOL KuaiLe`（标题）、`Nunito`+`Fredoka`（正文）。标题暖金发光 `text-shadow: 0 0 30px rgba(255,215,100,0.3)`。

## 组件规范

### 角色卡片
- `background: linear-gradient(135deg, rgba(18,30,60,0.75), rgba(10,20,45,0.8))`
- `border: 1px solid rgba(255,215,100,0.2)`
- `border-top: 1px solid rgba(255,235,160,0.35)`（月光高光）
- `border-radius: 16px`
- `box-shadow: 0 4px 20px rgba(0,0,0,0.35), 0 1px 0 rgba(255,215,100,0.06) inset, 0 8px 32px rgba(0,0,0,0.25)`
- 按下：`translate(2px, 2px)` + 暖金 glow 增强

### 留言卡片
- 同角色卡片风格
- 时间戳：`font-size: 10px; color: rgba(255,210,130,0.35)`

### 发送按钮
- `background: linear-gradient(180deg, #E0B840 0%, #C09028 100%)`
- `border-top: 1px solid rgba(255,240,180,0.4)`（高光线）
- `box-shadow: 0 3px 12px rgba(180,130,30,0.3)`
- 禁用：`opacity: 0.5`

### 导航按钮（← →）
- `background: rgba(15,28,55,0.7)`
- `border: 1px solid rgba(255,215,100,0.25)`
- `border-radius: 10px`
- `box-shadow: 0 2px 8px rgba(0,0,0,0.2)`

### 输入框
- `background: rgba(0,0,0,0.2)`
- `border: 1px solid rgba(255,215,100,0.2)`
- `box-shadow: inset 0 2px 6px rgba(0,0,0,0.3)`
- 聚焦：`border-color: --gold` + 金色外发光

### 导航栏 / 输入栏
- `background: linear-gradient(rgba(8,18,42,0.85), rgba(8,18,42,0.5))`
- `backdrop-filter: blur(12px)`
- 独立投影与内容区拉开纵深

### Toast
- 深色底 + 1.5px 暖金边框
- 颜色保留：蓝 `#45B7D1`=审核中 / 红 `#E17055`=拒绝 / 橙 `#FF8E53`=错误

### 倒计时条
- 底轨：`rgba(255,255,255,0.06)`
- 进度：`linear-gradient(90deg, #D4A030, #C8922A)` + `box-shadow: 0 0 6px rgba(200,160,50,0.3)`

## 背景元素

### 星空（浓密）
- 两级分层：远景暗星（0.3-0.6px, opacity 0.15-0.3）+ 中景亮星（1.2-3.0px, opacity 0.55-0.9）
- CSS `radial-gradient` 多点阵实现，不依赖 canvas 动画
- 保持静态（reduced-motion 兼容）

### 满月
- 位置：右上角 `top: 4%; right: 8%`
- `width: 50px; height: 50px`
- 暖黄径向渐变 + 多层发光阴影
- 保留呼吸动画 `moonGlow 8s ease-in-out infinite`

### 装饰几何
- **移除**：彩色几何图形（三角形、菱形等）
- **移除**：波点纹理 `#polka-bg`
- **移除**：canvas 几何动画 `#geofield`
- **替换为**：CSS 星空点阵 + 月光环境光斑（一个大圆形 radial-gradient 模拟月光散射）

## 移除内容

- `#polka-bg` 元素
- `#geofield` canvas 及所有几何动画 JS
- 所有孟菲斯撞色 CSS 变量 (`--pink`, `--yellow`, `--teal`, `--coral`, `--mint`, `--lavender`)
- `.geo-triangle-tr`、`.geo-diamond-bl` 装饰元素
- 硬偏移阴影 `box-shadow: 6px 6px 0 var(--purple)` → 柔光多层投影
- 3px 白边框 → 1px 暖金边框

## 保留内容

- ZCOOL KuaiLe + Nunito + Fredoka 字体
- 满月元素及呼吸动画
- Toast 颜色约定（蓝/红/橙）
- 所有交互逻辑：先留言后解锁、60s倒计时、2min空闲超时、限流
- 音乐开关按钮（位置和 SVG 图标）
- 左右滑动手势切换角色
- 管理后台 `/admin.html` 样式不变
- `index.html` SPA 双 View 结构
- 星星角色的内联 SVG 五角星

## 不需要改动

- `server.js`
- `public/admin.html`
- 角色数据、API、数据库
- `package.json`
- `.env` / 部署配置

## 实现范围

仅改动 `public/index.html` 的 `<style>` 和少量 HTML 结构调整（移除旧装饰元素、添加星空元素）。
