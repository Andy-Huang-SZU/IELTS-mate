这是一份基于 **"Flux Academy (Light Mode)"** 视觉风格的最终版前端设计方案。

该方案将重点放在 **"轻盈"、"流动"与"触感"** 上，并提供了具体的代码实现思路，确保开发落地的还原度。

> 最后更新：2026-03-24

---


# 前端设计方案：Flux Academy (Light Mode)

> **核心理念**：将软件界面打造为一个"悬浮在云端的书房"。抛弃沉重的深色科幻感，转而使用温暖的柔光、陶瓷质感的磨砂玻璃和符合物理直觉的微交互。

## 1. 设计系统基础 (Design System)

### 1.1 色板 (Color Palette)
这套配色的核心在于**低饱和度 + 高明度**，模拟自然光下的漫反射。

*   **Canvas (背景基底)**: `#F7F6F2` (暖米白)
*   **Fluid Orbs (流动光斑色)**:
    *   *Warm Sun*: `#FFD6A5` (淡橙)
    *   *Soft Teal*: `#CAE9E0` (淡青)
    *   *Pale Lavender*: `#E6E6FA` (淡紫)
*   **Glass Surface (卡片背景)**: `rgba(255, 255, 255, 0.4)` ~ `0.65`
*   **Text (文字)**:
    *   Primary: `#2D3436` (深灰，避免纯黑的刺眼)
    *   Secondary: `#636E72`
    *   Accent: `#E17055` (用于强调数据或 CTA)

### 1.2 排印 (Typography)
*   **Headings (标题)**: *Fraunces* 或 *Playfair Display* 。
    *   *特征*：柔和的衬线体，传递学术与优雅感。
*   **Body (正文)**: *Inter* 或 *Satoshi*。
    *   *特征*：高可读性，几何感，中和标题的古典气。

---

## 2. 核心视觉实现 (Technical Implementation)

### 2.1 交互式流体背景 (Interactive Fluid Background)
**目标**：背景不是一张死图，而是几个巨大的彩色光斑，随鼠标移动而缓慢游走，如同水面的倒影。

**实现逻辑 (React + Framer Motion / Native JS)**：

1.  **DOM 结构**：在根节点放置 3-4 个 `div` (Blob)，绝对定位。
2.  **CSS 样式**：
    *   使用 `filter: blur(120px)` 将圆形模糊成光晕。
    *   使用 `mix-blend-mode: multiply` 或 `overlay` 让颜色互相渗透。
    *   使用 `will-change: transform` 开启 GPU 加速。
3.  **JS 交互 (缓动跟随)**：
    *   **核心算法 (Linear Interpolation / Lerp)**：
        `currentX += (targetX - currentX) * 0.05`
    *   **实现步骤**：
        1.  监听 `mousemove` 事件，获取鼠标坐标 `(e.clientX, e.clientY)` 作为 `target`。
        2.  创建一个 `useRef` 存储每个 Blob 的当前坐标 `(currX, currY)`。
        3.  使用 `requestAnimationFrame` 循环：每一帧计算 `curr` 向 `target` 靠近一点点。
        4.  更新 DOM 的 `transform: translate3d(...)`。
    *   *优化*：为不同的 Blob 设置不同的"滞后系数" (0.05, 0.03, 0.08)，制造出层次感。

```javascript
// 伪代码示例
const useMouseFollow = (ref, delay) => {
  useAnimationFrame(() => {
    // 每一帧让 ref.current 向 mouse.current 移动一小步
    currentX = lerp(currentX, mouseX, delay);
    currentY = lerp(currentY, mouseY, delay);
    ref.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
  });
};
```

### 2.2 陶瓷质感磨砂玻璃 (Ceramic Glassmorphism)
**目标**：不同于普通的磨砂，这种玻璃要有"厚度"和"温润感"，边缘有高光。

**CSS 实现 (Tailwind v4 / Custom CSS)**：

```css
.flux-card {
  /* 背景：半透明白色 */
  background: rgba(255, 255, 255, 0.4);
  
  /* 核心：极其强烈的模糊，制造景深感 */
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);

  /* 边框：模拟顶部受光，底部反光 */
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);

  /* 阴影：多层阴影制造悬浮感 */
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.02),
    0 20px 40px -8px rgba(0, 0, 0, 0.04);
    
  /* 倒角 */
  border-radius: 24px;
}

/* 悬停时的光效 */
.flux-card:hover {
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 
    0 10px 15px -3px rgba(0, 0, 0, 0.03),
    0 30px 60px -12px rgba(199, 169, 147, 0.15); /* 暖色投影 */
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

### 2.3 3D 核心球体 (The Hero Orb)
**目标**：首页左侧的视觉中心，一个缓慢蠕动的有机球体，具有陶瓷/粘土质感。

**实现方案 (纯 CSS 多层渐变，已实现)**：
1.  **环境光晕层**：底层 `blur(30px)` + `scale(1.15)` 的柔和扩散光，营造悬浮发光感。
2.  **主体球体**：三层径向渐变叠加
    *   顶部受光面：`radial-gradient(ellipse 65% 55% at 35% 30%, rgba(255,245,230,0.9), transparent)`
    *   底部暗面：`radial-gradient(ellipse 50% 45% at 65% 70%, rgba(210,120,60,0.45), transparent)`
    *   基础色：`#FFDAB5 → #F4A261 → #E07845 → #C85A30` 四色渐变
3.  **`inset box-shadow`**：内发光模拟陶瓷半透明质感
4.  **高光反射层**：独立 div，使用 `animate-morph-reverse`（12s 周期），与主体异步变形，模拟"光在球面上移动"
5.  **底部反光层**：柔和的底部反射光

**动画关键帧 (6帧，10s 周期)**：
```css
@keyframes morph {
  0%   { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
  20%  { border-radius: 40% 60% 50% 50% / 35% 55% 45% 65%; }
  40%  { border-radius: 50% 50% 60% 40% / 55% 40% 60% 45%; }
  60%  { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
  80%  { border-radius: 55% 45% 35% 65% / 45% 55% 50% 50%; }
  100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
}
```

---

## 3. 页面布局详解 (Page Layouts)

### 3.1 首页 / Dashboard (Bento Grid)
布局采用 CSS Grid，间距 `gap-6`。

*   **Zone A (Left - Hero):** 2x2 大卡片。
    *   内容：Spline 3D 球体 + 问候语 ("Good morning, Alex") + 当前聚焦任务。
    *   效果：球体在卡片内缓慢自转。
*   **Zone B (Top Right - Consistency):** 1x2 长卡片。
    *   内容：GitHub 风格的热力图，但是点是**圆形的、发光的** (box-shadow)。
    *   颜色：活跃天数为暖橙色，非活跃为浅灰色。
*   **Zone C (Bottom Right - Goals & Mastery):** 两个 1x1 小卡片。
    *   **Goals**: 列表项。完成的项划掉并淡化。
    *   **Mastery**: 环形进度条或条形进度条。使用 SVG `stroke-dasharray` 实现动画。

### 3.2 macOS Dock 导航栏 (已实现)
**位置**：视口底部，`position: fixed; bottom: 0;`，不随页面滚动。
**样式**：微妙渐变背景 + `backdrop-filter: blur(16px)` 磨砂效果。

**图标设计 (自定义 3D 玻璃风格 PNG)**：
1.  **首页**: `icon_home_attr1_subject.png`
2.  **词汇**: `icon_vocab_attr1_subject.png`
3.  **写作**: `icon_writing_attr1_subject.png`
4.  **口语**: `icon_speaking_attr1_subject.png`
5.  **设置**: `icon_settings_attr1_subject.png`

图标为 1024×1024 PNG，CSS 通过 `transform: scale(1.58)` + `overflow: hidden` 裁剪至中心 630×630 有效区域。

**交互**：
*   悬停时图标放大 1.32x + 上浮 8px，相邻图标联动缩放 1.12x（CSS `:has()` + `+` 选择器）。
*   点击弹跳动画 (`dockBounce` keyframes)。
*   选中态：图标下方 5px 橙色小圆点指示器。
*   悬停 tooltip：暗色半透明标签 + 小三角指示。

**分隔线**：居中渐隐渐变线 (`linear-gradient(90deg, transparent → rgba(180,170,160,0.35) → transparent)`)。

**背景区分**：从透明渐变到 `rgba(235,232,224,0.88)`，与 Canvas `#F7F6F2` 形成微妙区分。

### 3.3 写作报告页（Structured Assessment Cards）
**目标**：让写作报告既保留数据化评分的精确性，又能把主考官的长 Markdown 报告拆成更容易吸收的学习卡片。

**布局原则**：
1. **先结构化，后全文**：优先展示 Overall Summary、Model Answer、Rewrite Suggestions，再把原始 Markdown 作为折叠面板放在后面，避免用户先面对大段长文。
2. **双栏阅读节奏**：左侧使用较宽的范文卡片承载长段文本，右侧使用较窄的建议卡片承载可执行 rewrite action，形成“示范 + 行动”对照。
3. **容错优先**：如果主考官 Markdown 缺少独立标题，前端要回退到四维 `agent_reports.*.suggestions`，保证报告页始终有可读建议。
4. **保留可追溯性**：折叠区展示原始 Markdown，便于调试解析结果，也方便后续把结构化逻辑上移到后端时做对照验证。

**视觉模式**：
- Summary 卡片：使用与总体评分一致的暖色强调，承载主考官总评段落。
- Model Answer 卡片：正文优先，使用更宽的内容列与更舒适的段落间距。
- Rewrite Suggestions 卡片：使用编号块 + 浅蓝提示底色，强调“下一步怎么改”。
- Raw Markdown 卡片：默认折叠，信息层级低于结构化内容。

### 3.4 写作 Hub / History 复盘流（Topic Browser + History Cards）
**目标**：把“开始练习”“浏览题库”“回看历史”“重做同题”组织成一条连续学习动线，而不是分散在多个割裂入口里。

**布局原则**：
1. **Hub 内嵌题库，而不是跳走新页面**：Topic Browser 折叠在 `Writing Hub` 中，默认不打断主入口，但一展开就能直接浏览全部题库。
2. **筛选优先于滚动**：题库浏览器先给 Task / 子题型 / 难度 / 搜索，再给分页；避免用户在 150 条题目里盲目滚动。
3. **历史卡片强调“复盘”而不是“纯列表”**：History 卡片不仅展示题目摘要，还要同时给出总分、四维缩略图、字数、日期和重做按钮。
4. **重做必须回到原题**：从 History / Report 进入 Editor 时，优先传完整 `topic_data` 快照；只有缺快照时才退回 `topicId` 精准加载。

**视觉模式**：
- Topic Browser：使用与 Free Choice 同层级的 `GlassCard`，但通过折叠标题 + 题量数字降低默认视觉负担。
- 历史缩略图：用轻量 SVG 四维雷达图提供“这一篇整体表现形状”的直观感受，再用 Overall badge 做快速判断。
- History 卡片操作区：一个次级按钮（`View Report`）+ 一个强调按钮（`Redo Topic`），明确区分“回看分析”和“立即重做”。

---


## 4. 动画编排 (Animation Orchestration)


不要让所有元素同时出现。使用**交错动画 (Stagger)**。

```javascript
// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // 每个子元素延迟 0.1s 出现
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1, 
    transition: { type: "spring", stiffness: 100, damping: 15 } // 弹簧效果
  }
};
```

---

## 5. 开发路线图检查清单

1.  **Step 1: 环境搭建**
    *   配置 Tailwind v4。
    *   定义 `theme.colors` 中的 pastel 色系。
    *   安装 `framer-motion`, `lucide-react`, `clsx`, `tailwind-merge`。

2.  **Step 2: 基础组件 (UI Kit)**
    *   封装 `<GlassCard />`: 包含上述 CSS 样式的通用容器。
    *   封装 `<FluidBackground />`: 实现鼠标跟随逻辑。
    *   封装 `<Dock />`: 实现底部导航与路由跳转。

3.  **Step 3: 首页组装**
    *   实现 Bento Grid 布局。
    *   嵌入 3D 球体 (或 CSS 替代品)。
    *   绘制热力图组件。

4.  **Step 4: 细节打磨**
    *   添加全局字体。
    *   调整阴影和模糊半径，确保在浅色背景下文字依然清晰可见。
    *   测试窗口缩放时的流体布局适配。

---

## 6. 图表渲染组件体系 (2026-03-17 新增)

写作模块 Task 1 使用 6 个专业渲染组件，均位于 `src/renderer/src/pages/Writing/components/`：

### 6.1 ChartRenderer（分发器）
- 根据 `chart_type` 属性使用 `React.lazy()` 动态加载对应渲染器
- 统一 `Suspense` fallback（加载占位骨架）
- 支持类型：bar / line / pie / table / process / map / mixed / combination

### 6.2 EChartsRenderer
- 技术：Apache ECharts 6 + `useRef` + 动态 `import('echarts')`
- 支持 4 种 option 构建：`buildBarOption` / `buildLineOption` / `buildPieOption` / `buildDualAxisOption`
- Flux 配色：`#5EEAD4`, `#74B9FF`, `#FDCB6E`, `#E17055`, `#A78BFA`
- 圆角 bar（borderRadius:4）、平滑曲线（smooth:true）
- `ResizeObserver`（100ms debounce）响应容器尺寸变化

### 6.3 TableRenderer
- 技术：纯 HTML `<table>` + Tailwind CSS
- 交替行背景：white/40 ↔ #F7F6F2/60
- 表头淡绿背景（#5EEAD4/10），紧凑布局
- 显示 unit 信息

### 6.4 ProcessFlowRenderer（2026-03-23 替换 MermaidRenderer）
- 技术：纯 HTML/CSS/React 自绘，零额外依赖（移除 Mermaid.js）
- 蛇形折行布局：根据容器宽度自动计算每行节点数（2-5 个）
  - 奇数行从左到右（→），偶数行从右到左（←）
  - 行间用垂直下箭头连接，精确对齐到尾部卡片中心
- 数据源：仅使用 `chart_data.steps` 字符串数组（不再依赖 `mermaid_code`）
- 节点样式：圆角卡片 + 彩色序号徽章（循环使用 Flux 六色板）
- 箭头：水平方向用 SVG inline 箭头，换行用垂直箭头
- 响应式：`ResizeObserver` 监听容器宽度变化，动态调整每行个数
- 交互：hover 时卡片背景微亮（`hover:bg-white/60`）
- 兼容性：旧题目的 `mermaid_code` 字段被忽略但不报错

### 6.5 D3MapRenderer
- 技术：D3.js 7 (`d3-selection`) + SVG
- 归一化 0-100 坐标系，映射到实际 SVG 尺寸
- Feature 类型 → SVG 元素映射：
  - building → `rect`（灰色填充）
  - road → `path`（粗灰线，curveLinear）
  - river → `path`（蓝色曲线，curveBasis）
  - park → `rect`（淡绿填充）
  - lake → `rect`（淡蓝填充）
  - area → `rect`（淡黄填充）
  - label → `text`
- 两张地图上下排列（before/after），配标签
- 淡米色背景、柔和填充、小字标注

### 6.6 MixedChartRenderer
- 技术：容器组件，内部使用 `React.lazy` 加载 EChartsRenderer / TableRenderer
- 两个子图上下排列，中间 divider 分隔
- 每个 sub_chart 独立渲染，根据 chart_type 分发
- 异常处理：sub_charts 长度 <2 时显示第一个子图或错误提示

---

## 7. 新增设计模式 (2026-03-24)

### 7.1 训练模式入口卡片 (Hub Training Cards)
- **用途**：在 Vocabulary Hub 中为拼写/听写/统计提供三列网格入口
- **布局**：`grid-cols-3` 等分，每张卡片独立色彩主题
  - Spelling: 蓝色系 (`#74B9FF` 渐变)
  - Dictation: 紫色系 (`#A78BFA` 渐变)
  - Statistics: 黄色系 (`#FDCB6E` 渐变)
- **交互**：hover scale(1.02) + shadow lift，按钮常驻可点

### 7.2 Segmented Control 视图切换 (View Mode Tabs)
- **用途**：在 Writing History 页切换 Sessions / By Topic 两种视图
- **布局**：圆角容器背景 `#F0F0EC`，内部两个等分 pill 按钮
- **选中态**：白色背景 + 阴影 + 深色文字，未选中态灰色文字
- **图标**：`List` (Sessions) + `Layers` (By Topic)，保持小尺寸 13px

### 7.3 可展开趋势面板 (Expandable Trend Panel)
- **用途**：在 By Topic 卡片中展开同题分数趋势图和 attempts 列表
- **触发**：「趋势」按钮，选中态紫色高亮
- **布局**：展开区域使用 `border-top` 分隔，浅白透明背景
- **趋势图**：`TopicTrendChart` 轻量 SVG 折线图，颜色根据最新分数动态变化（绿 ≥7 / 黄 ≥5.5 / 红 <5.5）
- **动画**：`animate-fade-in` 展开过渡

### 7.4 轻量 SVG 趋势图 (TopicTrendChart)
- **用途**：展示同题分数时间序列
- **技术**：纯 SVG，无额外图表库依赖
- **视觉**：渐变填充折线区域 + 圆点节点 + 分数标签 + 日期 X 轴
- **色彩自适应**：根据最近分数自动选择主色调
- **尺寸**：高度固定 160px，宽度自适应容器

### 7.5 逐字母拼写反馈 (Letter Feedback)
- **用途**：Spelling 模式提交后展示逐字母对比
- **布局**：字母等宽排列，每个字母独立圆角背景
- **颜色**：正确字母绿色背景 (`#00B894/12`)，错误字母红色背景 (`#E17055/12`)
- **文字**：monospace 字体，保持等宽对齐