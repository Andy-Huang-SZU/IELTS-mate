# 前端页面规划文档

> 最后更新：2026-03-24

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
      { path: 'vocabulary/spelling', element: <VocabularySpelling /> },
      { path: 'vocabulary/dictation', element: <VocabularyDictation /> },
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
      { path: 'speaking/report/:id', element: <SpeakingReport /> },
      
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
  - **训练模式入口**：三列网格卡片（Spelling 蓝色 / Dictation 紫色 / Statistics 黄色），点击进入对应页面。
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

- **Spelling 页 (拼写训练模式, 2026-03-24 新增)**:
  - 看到单词释义/翻译，用户需要输入正确的英文拼写。
  - 提交后逐字母反馈：正确字母绿色，错误字母红色。
  - 支持"偷看答案"（peek）按钮，允许先看正确拼写再尝试。
  - 支持收藏/笔记、键盘快捷键（Enter 提交、Space 下一个）。
  - 使用 `submitReview(wordId, quality, 'spelling')` 记录学习事件。

- **Dictation 页 (听写训练模式, 2026-03-24 新增)**:
  - 浏览器 `SpeechSynthesis` API 朗读单词发音，用户听写。
  - 两种播放速度（Normal / Slow）。
  - 播放 3 次以上后自动显示音标提示。
  - TTS 不支持时优雅降级，显示提示建议切换拼写模式。
  - 使用 `submitReview(wordId, quality, 'dictation')` 记录学习事件。
  - 键盘快捷键：`Ctrl+R` 重播。

- **Stats 页 (正式词汇统计页, 2026-03-24 新增，2026-03-24 调整)**:
  - 顶部标题区：返回入口 + 学习统计标题。
  - 核心指标区：连续学习天数、已掌握、学习中、今日待复习摘要卡片。
  - 高频错词区：展示 Top 错词（单词、释义、状态、错误次数），用于精准复习。
  - 活动趋势区：近 7/14/30 天学习事件变化，区分学习模式来源。
  - 说明：Stats 页移除热力图（首页已保留总热力图），避免重复信息与视觉拥挤。

### 2.4 写作中心 (`/writing`)

- **Hub 页（三种模式入口 + 题库浏览器，2026-03-23）**:
  - **随机模拟测验**：宽幅 GlassCard，Dices 图标（淡绿背景），点击进入 Task 1 + Task 2 完整模拟，hover scale(1.02)
  - **快速练习**：两个 GlassCard 并排，Task 1（绿色 BarChart3 图标）/ Task 2（橙色 Feather 图标）
  - **自由选择（可展开面板）**：
    - Task 切换 pill 按钮组（Task 1 / Task 2）
    - 题型 Chip 选择器：Task 1 显示 7 种 `chart_type`，Task 2 显示 5 种 `question_type`
    - 出题方式切换：题库随机（闪电图标，即时）/ AI 生成（Sparkles 图标，附 token 预估 tooltip）
    - 绿色渐变开始按钮
  - **Topic Browser（嵌入式题库浏览器）**：
    - 默认折叠，标题显示题库总量（如 `150 topics`）
    - 支持 Task / 子题型 / 难度筛选，以及按 `topic_id`、prompt、tag 的本地搜索
    - 采用前端分页展示（每页 12 条），点击任意题目可直接进入 Editor，并优先加载该题的完整快照
  - **Recent Essays 列表**：每条记录显示 `topic_id`、时间、字数和总分，右上角提供 `View All` 跳转 `Writing History`

- **Editor 页（2026-03-23 增强）**:
  - 左侧面板：
    - 题目卡片顶部显示 `topic_id`、题型、难度、`legacy_id`（如有）
    - 题目描述 + 图表区域使用 `ChartRenderer` 组件自动分发渲染
    - 操作按钮行：浅灰边框“换一题”按钮 + 浅色“AI 生成新题”按钮（附 token tooltip）
    - 当 Task 2 时无图表区域
  - 右侧面板：沉浸式写作区，背景为纸张质感
  - 底部：悬浮工具栏（字数统计、提交 AI 批改）
  - 提交批改时会带上 `topic_id` 和完整 `topic_data` 题目快照
  - 支持两种“指定题目加载”方式：
    - URL 参数：`?type=task1&topicId=T1-BAR-0001&chartType=bar`
    - Router state：由 Topic Browser / History / Report 直接传入完整 `topic` 快照

- **History 页（2026-03-24 升级为 Sessions / By Topic 双视图）**:
  - 顶部筛选栏：View 切换（Sessions / By Topic segmented control）+ Task（All / Task 1 / Task 2）+ 排序（仅 Sessions 模式显示 Latest / Score ↓ / Score ↑）
  - **Sessions 视图**：
    - 历史卡片：左侧四维分数缩略雷达图 + Overall 分数 badge，中间 `topic_id`、task 标签、题型标签、难度、题目摘要、字数和时间，右侧 `View Report` 与 `Redo Topic` 两个操作按钮
    - 重做逻辑：优先使用 `topic_data` 快照重开原题；若无快照，则退回 `topicId` 精准加载
    - 底部分页导航
  - **By Topic 视图**：
    - 使用 `ByTopicView` 组件，展示按 `topic_id` 聚合的卡片
    - 每张卡片：Best/Avg 分数、练习次数、topic_id、题型、题目摘要、最近练习日期
    - 可展开趋势区：点击「趋势」按钮展开 `TopicTrendChart` 轻量 SVG 折线图 + attempts 列表
    - 自有排序控件：最近练习 / 练习次数 ↓ / 最佳分数 ↓
    - 「再做一次」按钮：携带 topic_data 快照跳转 Editor

- **Report 页（2026-03-23 增强）**:
  - 顶部显示 `topic_id`、题型、难度
  - 展示原始题目 prompt；Task 1 支持直接回看历史图表 / 地图 / 流程图，legacy mixed 快照也能正常显示
  - 新增 **Chief Examiner Highlights** 区域：结构化解析 `report_markdown`，独立展示总评摘要、`Model Answer`、`Rewrite Suggestions`
  - 当主考官 Markdown 缺少独立的 `Rewrite Suggestions` 标题时，会自动回退到四维 `agent_reports.*.suggestions` 去重汇总展示
  - 支持折叠查看原始 Chief Markdown，便于核对解析结果
  - `Write Again` 会优先带回完整题目快照，确保继续练的是同一道题，而不只是同类题

### 2.5 口语中心 (`/speaking`)

- **Hub 页（三卡片布局，2026-03-24 升级为英文）**:
  - 三列 GlassCard 网格：Free Chat（咖啡杯图标，蓝色背景）/ Mock Test（考官图标，紫色背景）/ History（时钟图标，橙色背景）
  - 每张卡片含标题、描述、hover scale 动效
  - 英文 UI 文案，与项目 i18n 统一

- **ChatMode 页 (`/speaking/chat`，闲聊模式，2026-03-24 新增)**:
  - **顶部导航栏**：左侧返回箭头 + "Free Chat" 标题 + 连接状态指示灯，右侧 PTT/VAD 切换 Toggle
  - **中央主视觉区**：Canvas 绘制的圆形波形可视化器 (`AudioVisualizer`)，占页面中央 40% 高度
    - 空闲时：静默波纹（淡紫色脉动）
    - 录音时：波形跟随麦克风音量律动（暖珊瑚色渐变）
    - AI 说话时：波形跟随音频输出律动（青色渐变）
  - **对话记录面板** (`TranscriptPanel`)：波形下方，滚动区域，气泡式对话记录
    - 考官气泡：左对齐，`bg-white/50`，淡灰边框
    - 考生气泡：右对齐，`bg-[#A78BFA]/12`，淡紫边框
    - 每条消息下方显示时间戳
    - 自动滚动到底部
  - **底部控制区**：居中圆形麦克风按钮 (`MicButton`，直径 72px)
    - 录音态：红色渐变 + 脉动环绕动画
    - AI 说话态：青色渐变 + 涟漪动效
    - 空闲态：白色毛玻璃 + hover scale
    - 按钮上方状态文字：Listening... / AI is speaking... / Tap to speak
  - **WebSocket 通信**：自动重连（最多 3 次，指数退避），ping/pong 心跳（30s）
  - **音频播放**：AI 语音通过 `new Audio(URL.createObjectURL(blob))` 播放

- **MockTest 页 (`/speaking/mock`，模考模式，2026-03-24 新增)**:
  - **顶部状态栏**：返回箭头 + 当前 Part 标签（Part 1 / Part 2 / Part 3）+ 渐变进度条
  - **Part 1 视图**：与 ChatMode 类似布局（波形 + 对话面板 + 麦克风按钮），标签 "Part 1 · Introduction"
  - **Part 2 准备阶段**：
    - 中央 TimerDisplay（60s 倒计时环形进度条，绿→黄渐变）
    - 下方 TopicCard（GlassCard 包裹，显示话题描述 + 要点列表 + follow-up 问题）
    - 状态文字 "Preparation Time"
  - **Part 2 答题阶段**：
    - 顶部 TopicCard 缩小为紧凑模式（固定显示）
    - 中央 TimerDisplay（130s 计时器，含 4 级警报色）：
      - 90s: 黄色警告
      - 110s: 橙色警告
      - 120s: 红色闪烁
      - 130s: 后端强制中断
    - 底部 AudioVisualizer + TranscriptPanel + MicButton
  - **Part 3 视图**：与 Part 1 类似，标签 "Part 3 · Discussion"
  - **报告生成等待**：脉动圆点 loading 动画 + "Generating your report..." 文字
  - **完成后**：自动导航到 `/speaking/report/:sessionId`

- **History 页 (`/speaking/history`，口语历史列表，2026-03-24 新增)**:
  - **顶部筛选栏**：模式筛选 pill 按钮组（All / Free Chat / Mock Test），active 态绿色高亮
  - **卡片列表**：每张 GlassCard 显示：
    - 左侧：模式图标（咖啡杯 Free Chat / 毕业帽 Mock Test）+ 彩色背景
    - 中间：话题摘要文本 + 日期 + 时长
    - 右侧：总分 badge（仅 Mock Test 显示，≥7 绿色 / ≥5.5 蓝色 / <5.5 橙色）
  - 点击进入 Report 页
  - 分页导航（每页 10 条）
  - 空状态/加载中/错误状态处理

- **Report 页 (`/speaking/report/:id`，口语报告，2026-03-24 新增)**:
  - **顶部概览区**：
    - 模式标签（Free Chat / Mock Test）
    - 总分大号 SVG ScoreRing 环形进度（仅 Mock Test）
    - 日期 + 时长 + 消息数元信息
  - **四维评分区**（仅 Mock Test）：
    - 四张 GlassCard 并排（FC / LR / GRA / Pronunciation）
    - 每张含小型 ScoreRing + 分数 + 维度名称
    - 每个维度可展开 AgentReportCard（strengths / weaknesses / suggestions 列表）
  - **对话转录区**：
    - 可折叠/展开的完整对话记录
    - 考官/考生交替气泡（与 TranscriptPanel 风格一致）
  - **评估报告区**：
    - Markdown 渲染的详细报告（使用 `@tailwindcss/typography` prose 样式）
    - 发音问题、停顿分析、词汇建议等

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
