# 前端页面规划文档

> 最后更新：2026-02-20

## 设计概览：Flux Academy (Light Mode)

本项目不再使用传统的深色侧栏后台风格，而是采用 **"Flux Academy"** 风格——**轻盈、流动、触感**。

- **核心视觉**：暖米白背景、陶瓷质感磨砂玻璃、流体光斑背景、3D 悬浮元素。
- **导航模式**：底部固定 macOS Dock 导航，配合 Bento Grid 仪表盘布局。
- **参考文档**：详细视觉规范请见 `docs/frontend-design-new.md`。
- **参考图**：`docs/assets/hero_section_template.jpeg`

---

## 1. 页面路由结构

```typescript
// src/router.tsx
export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />, // 包含 FluidBackground, Dock, PageContainer
    children: [
      { index: true, element: <DashboardPage /> },
      
      // Vocabulary
      { path: 'vocabulary', element: <VocabularyHub /> },
      { path: 'vocabulary/learn', element: <VocabularyLearn /> },
      { path: 'vocabulary/review', element: <VocabularyReview /> },
      { path: 'vocabulary/stats', element: <VocabularyStats /> },
      
      // Writing
      { path: 'writing', element: <WritingHub /> },
      { path: 'writing/editor', element: <WritingEditor /> },
      { path: 'writing/history', element: <WritingHistory /> },
      
      // Speaking
      { path: 'speaking', element: <SpeakingHub /> },
      { path: 'speaking/chat', element: <SpeakingChatMode /> },
      { path: 'speaking/mock', element: <SpeakingMockMode /> },
      { path: 'speaking/history', element: <SpeakingHistory /> },
      
      // Settings
      { path: 'settings', element: <SettingsPage /> },
    ]
  }
])
```

---

## 2. 页面详细设计

### 2.1 布局容器 (App Layout)

所有页面共享的底层结构：
- **Canvas**: `#F7F6F2` 暖米白背景。
- **Fluid Background**: 3 个彩色光斑（淡橙/淡青/淡紫）在背景层随鼠标缓慢游走。
- **macOS Dock**: 固定在视口底部的导航栏（`position: fixed`），不随页面滚动。
- **Dock 分隔线**: 内容区与 Dock 之间通过居中渐隐分隔线分隔。
- **Dock 背景**: 微妙渐变（从透明到暖米色 0.88 透明度），与 Canvas 背景有细微区分。
- **Page Container**: 内容区域，四周留白，底部 `pb-[88px]` 预留 Dock 高度。
- **响应式**: `PageContainer` 小屏 `px-4 py-6`，大屏 `px-6 py-8`。

### 2.2 首页 / Dashboard (`/`)

采用 **Bento Grid** (便当盒) 布局，响应式：大屏双列，小屏单列堆叠。

- **Zone A (Hero - 左侧大卡，大屏跨两行)**:
  - **内容**: 多层渐变 3D 有机球体 + 问候语 "Good morning, Alex" + 当前核心任务焦点。
  - **球体实现**: 多层径向渐变 + `inset box-shadow` 模拟陶瓷/粘土质感 + 高光反射层 + 环境光晕层。
  - **动画**: `animate-morph` (6 关键帧，10s 周期) + `animate-morph-reverse` (高光层，12s 周期)。
- **Zone B (Stats - 右上卡)**:
  - **内容**: Consistency 热力图 (圆形光点)。
  - **视觉**: 活跃点为暖橙色发光圆点，非活跃为浅灰。
- **Zone C (Goals & Mastery - 右下区域，双卡并排，窄屏堆叠)**:
  - **Card 1**: 今日目标清单 (完成项划掉)。
  - **Card 2**: 词汇掌握度环形进度条。

### 2.3 词汇中心 (`/vocabulary`)

- **Hub 页**:
  - **双模式入口**：「今日待复习」和「学习新词」两张玻璃卡片并排（`sm:grid-cols-2`）。
  - 复习卡片显示今日待复习数量；新词卡片显示今日已学/目标新词数。
  - **每日新词上限调节器**：默认 30，范围 5-100，步进 ±5，设置同步持久化到后端 KV。
  - 统计概览：New / Learning / Mastered 三栏卡片 + 总词数 + 连续学习天数。
  - **学习推荐流程**：先复习到期词 → 再学新词。

- **Review 页 (复习模式 - 自评卡片)**:
  - **核心交互**：3D 翻转卡片，正面显示英文单词 + 音标 + 词性，背面显示中文释义 + 例句。
  - **翻转触发**：点击卡片或按 Space 键翻转（CSS `perspective-1000` + `preserve-3d` + `rotate-y-180`）。
  - **自评按钮**（翻转后显示）：
    - 「认识」→ SM2 quality=3（绿色）
    - 「模糊」→ SM2 quality=2（橙色）
    - 「忘记了」→ SM2 quality=0（红色）
  - **键盘快捷键**：`Space` 翻转，`1` 认识，`2` 模糊，`3` 忘记了
  - **进度条**：顶部渐变进度条 + 当前/总数显示。
  - **fade 淡入淡出过渡**：卡片切换时平滑过渡。

- **Learn 页 (新词学习 - 四选一 Quiz + 双轮确认)**:
  - **双轮确认机制**：每个新词至少出现两次：
    - Round 1：英文 → 选中文（`mode=translation`）
    - Round 2：中文 → 选英文（`mode=word`，方向翻转）
  - **错词循环**：答错的词自动加入重试队列，直到全部答对。
  - **4×1 垂直布局**：4 个选项纵向排列，每个选项前有数字标识（1-4）。
  - **答题反馈**：
    - 选对 → 正确选项绿色高亮 + 弹跳动画
    - 选错 → 错误选项红色 + shake 抖动 + 正确选项绿色高亮
  - **干扰项**：后端 `/api/vocabulary/{id}/distractors?mode=translation|word` 支持双向模式。
  - **键盘快捷键**：
    | 按键 | 状态 | 操作 |
    |------|------|------|
    | `1-4` | 未作答 | 选择对应选项 |
    | `Enter` / `Space` / `→` | 已作答 | 下一题 |
  - **进度条**：顶部渐变进度条 + 阶段标签（Round 1 / Round 2 / Retry）。
  - **完成后** → 跳转 SessionComplete 页面。

- **SessionComplete 页 (学习完成统计)**:
  - 显示本次学习统计：学习新词数、正确率、用时。
  - 弹跳入场动画（bounceIn）。
  - 三个操作按钮：继续学习新词、回到词汇中心、回首页。

### 2.4 写作中心 (`/writing`)

- **Hub 页**:
  - "New Task 1" 和 "New Task 2" 两个大入口卡片 (`sm:grid-cols-2`)。
  - 下方 "Recent Essays" 列表，采用半透明条目样式。
- **Editor 页**:
  - 左侧：题目卡片 (题目描述/图表)。
  - 右侧：沉浸式写作区，背景为纸张质感。
  - 底部：悬浮工具栏 (字数统计、提交 AI 批改)。

### 2.5 口语中心 (`/speaking`)

- **Hub 页**:
  - "Free Chat" (咖啡杯图标) vs "Mock Test" (考官图标) 左右分栏 (`sm:grid-cols-2`)。
- **Chat/Mock 页**:
  - 中央视觉：动态波形图 (Audio Visualizer)，随语音音量律动。
  - AI 回复时，背景光斑颜色变为活跃状态 (如青色呼吸)。
  - 底部控制：巨大的圆形麦克风按钮 (Push-to-Talk)。

### 2.6 设置页 (`/settings`)

- 极其干净的表单设计，使用 `narrow` 模式 (`max-w-2xl`)。
- 输入框采用 `border-bottom` 风格。
- 页面可自由滚动，Dock 固定在底部不受影响。

---

## 3. UI 组件库 (Flux UI Kit)

定制的 **Flux UI** 组件集：

### 核心组件
1.  **`<PageContainer />`** (已实现): 统一页面最大宽度与内边距，响应式 padding。
2.  **`<GlassCard />`** (已实现):
    - `backdrop-blur-xl`
    - 背景白色透明度 `0.4` ~ `0.65`
    - 边框高光 `border-top-white/60`
    - 阴影 `shadow-lg` 且带暖色倾向
3.  **`<FluidBackground />`** (已实现):
    - CSS Filter + JS `requestAnimationFrame` 实现鼠标跟随光斑。
    - 3 个光斑不同颜色、不同滞后系数 (0.05, 0.03, 0.08)。
4.  **`<Dock />`** (已实现):
    - macOS Launchpad 风格，5 个 3D 玻璃图标：首页/词汇/写作/口语/设置。
    - 图标资源：`src/renderer/src/assets/icons/` 下的自定义 PNG (1024×1024, CSS 裁剪至中心 630×630)。
    - 固定在视口底部 (`position: fixed`)，不随页面滚动。
    - 悬停放大 (1.32x) + 相邻联动缩放 (CSS `:has()` 选择器)。
    - 选中态小圆点指示器。
    - 点击弹跳动画 + tooltip 标签。
    - 分隔线：居中渐隐渐变线。
    - 背景：微妙渐变磨砂层，与 Canvas 有细微区分。
5.  **Hero Orb** (已实现):
    - 多层径向渐变 + `inset box-shadow` 模拟陶瓷质感。
    - 环境光晕层 + 高光反射层 + 底部反光。
    - 双动画：`animate-morph` (10s) + `animate-morph-reverse` (12s)。

### 交互动画
- **Page Transition**: 页面切换时，元素交错淡入 (Stagger Fade In, 纯 CSS)。
- **Hover**: 卡片悬停时轻微上浮 + 光影流动。
- **Click**: 按钮点击呈果冻状回弹 (Scale down)。
- **Dock**: macOS 式悬停放大联动 + 弹跳点击反馈。

---

## 4. 技术实现关键点

- **Styling**: Tailwind CSS v4 + 自定义 CSS (Dock.css, index.css)
- **Animation**: 纯 CSS 动画 (不依赖 framer-motion)
- **Icons**: 
  - Dock: 自定义 3D 玻璃风格 PNG 图标 (`assets/icons/`)
  - 页面内: Lucide React (线条风格，strokeWidth 1.5~2)
- **Fonts**:
  - Headings: *Fraunces* (优雅衬线)
  - Body: *Inter* (现代无衬线)
- **响应式**: Tailwind 断点 (`sm:`, `md:`, `lg:`) + Dock CSS media query
