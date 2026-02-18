# 前端页面规划文档

> 最后更新：2026-02-18

## 设计概览：Flux Academy (Light Mode)

本项目不再使用传统的深色侧栏后台风格，而是采用 **"Flux Academy"** 风格——**轻盈、流动、触感**。

- **核心视觉**：暖米白背景、陶瓷质感磨砂玻璃、流体光斑背景、3D 悬浮元素。
- **导航模式**：底部悬浮 Dock 导航（类似 macOS），配合 Bento Grid 仪表盘布局。
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
      { path: 'vocabulary/review', element: <VocabularyReview /> },
      { path: 'vocabulary/stats', element: <VocabularyStats /> },
      
      // Writing
      { path: 'writing', element: <WritingHub /> },
      { path: 'writing/editor', element: <WritingEditor /> }, // 区分 Hub 和 Editor
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
- **Fluid Background**: 3-4 个彩色光斑（淡橙/淡青/淡紫）在背景层缓慢游走。
- **Floating Dock**: 底部居中的磨砂玻璃导航栏。
- **Page Container**: 内容区域，四周留白，卡片悬浮。

### 2.2 首页 / Dashboard (`/`)

采用 **Bento Grid** (便当盒) 布局：

- **Zone A (Hero - 左侧大卡)**:
  - **内容**: 3D 动态球体 (Spline/CSS) + 问候语 "Good morning, Alex" + 当前核心任务焦点。
  - **视觉**: 陶瓷磨砂玻璃，球体缓慢蠕动。
- **Zone B (Stats - 右上长卡)**:
  - **内容**: Consistency 热力图 (圆形光点)。
  - **视觉**: 活跃点为暖橙色发光圆点，非活跃为浅灰。
- **Zone C (Goals & Mastery - 右下两小卡)**:
  - **Card 1**: 今日目标清单 (完成项划掉)。
  - **Card 2**: 词汇掌握度环形进度条。

### 2.3 词汇中心 (`/vocabulary`)

- **Hub 页**:
  - 巨大的 "Review Now" 玻璃卡片，显示今日待复习数量。
  - 底部瀑布流展示最近学习的单词卡片。
- **Review 页 (复习)**:
  - 极简模式，屏幕中央悬浮一张巨大的 **Glass Flashcard**。
  - 正面：单词 + 音标；点击翻转：释义 + 例句。
  - 底部操作栏：Again / Hard / Good / Easy 四个圆形玻璃按钮。

### 2.4 写作中心 (`/writing`)

- **Hub 页**:
  - "New Task 1" 和 "New Task 2" 两个大入口卡片，配以 3D 图标 (图表/羽毛笔)。
  - 下方 "Recent Essays" 列表，采用半透明条目样式。
- **Editor 页**:
  - 左侧：题目卡片 (题目描述/图表)。
  - 右侧：沉浸式写作区，背景为纸张质感。
  - 底部：悬浮工具栏 (字数统计、提交 AI 批改)。

### 2.5 口语中心 (`/speaking`)

- **Hub 页**:
  - "Free Chat" (咖啡杯图标) vs "Mock Test" (考官图标) 左右分栏。
- **Chat/Mock 页**:
  - 中央视觉：动态波形图 (Audio Visualizer)，随语音音量律动。
  - AI 回复时，背景光斑颜色变为活跃状态 (如青色呼吸)。
  - 底部控制：巨大的圆形麦克风按钮 (Push-to-Talk)。

### 2.6 设置页 (`/settings`)

- 极其干净的表单设计。
- 输入框采用 `border-bottom` 风格或极浅的内凹槽风格。
- "Test Connection" 按钮点击后触发光斑聚拢动画。

---

## 3. UI 组件库 (Flux UI Kit)

不再使用通用 Shadcn 风格，而是定制一套 **Flux UI**：

### 核心组件
1.  **`<PageContainer />`** (已实现): 统一页面最大宽度与内边距，所有页面共用。
2.  **`<GlassCard />`**:
    - `backdrop-blur-xl`
    - 背景白色透明度 `0.4` ~ `0.65`
    - 边框高光 `border-top-white/60`
    - 阴影 `shadow-lg` 且带暖色倾向
3.  **`<FluidBackground />`**:
    - Canvas API 或 CSS Filter 实现的交互式光斑背景。
4.  **`<Dock />`**:
    - 底部悬浮容器，包含 `Home`, `Vocab`, `Writing`, `Speaking`, `Settings` 图标。
    - 选中态：图标下方出现光晕，或图标本身上浮。
5.  **`<HeroOrb />`**:
    - 首页核心视觉，CSS 动画或 Spline 组件。

### 交互动画
- **Page Transition**: 页面切换时，元素交错淡入 (Stagger Fade In)。
- **Hover**: 卡片悬停时轻微上浮 + 光影流动。
- **Click**: 按钮点击呈果冻状回弹 (Scale down)。

---

## 4. 技术实现关键点

- **Styling**: Tailwind CSS v4
- **Animation**: Framer Motion (负责复杂的编排动画和 Dock 交互)
- **Icons**: Lucide React (线条风格，需调整 stroke width 适配轻盈感)
- **Fonts**:
  - Headings: *Fraunces* (优雅衬线)
  - Body: *Inter* 或 *Satoshi* (现代无衬线)
