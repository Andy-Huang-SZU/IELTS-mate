# IELTS-mate 系统架构文档

> 最后更新：2026-03-24

## 1. 系统总览

IELTS-mate 是一款面向中国雅思备考生的 **免费开源桌面端应用**，采用 BYOK (Bring Your Own Key) 模式，聚焦词汇记忆、写作批改、口语模考三大核心模块。

### 1.1 技术选型确认

| 层级 | 技术方案 | 备注 |
|------|---------|------|
| 桌面框架 | Electron | 跨平台 (Win/Mac/Linux) |
| 前端框架 | React 19 + TypeScript | 使用 electron-vite 构建 |
| 状态管理 | Zustand | 轻量级、简洁 |
| UI 样式 | Tailwind CSS 4 | 原子化 CSS |
| **动画交互** | **Framer Motion** | 负责流体背景、Dock 交互、页面转场 |
| 数据可视化 | Apache ECharts 6 | 写作模块 Task 1 图表渲染 (bar/line/pie/dual-axis) |
| 地图渲染 | D3.js 7 | 写作模块 Task 1 地图题 (SVG) |
| 流程图 | Mermaid.js 11 | 写作模块 Task 1 流程题 |
| **字体** | **Fraunces / Inter** | 衬线标题 + 无衬线正文 |
| 后端框架 | Python + FastAPI | 作为 Electron 子进程运行 |
| 本地数据库 | SQLite (aiosqlite) | 异步访问 |
| ORM | SQLAlchemy 2.0 (async) | 异步 ORM |
| 包管理器 | pnpm (前端) / pip (后端) | — |
| 打包分发 | electron-builder + PyInstaller | 前后端分别打包 |
| 前端路由 | React Router v7 | SPA 路由 |
| HTTP 客户端 | Axios (前端) | — |
| 通信协议 | REST API + WebSocket | REST 用于 CRUD，WS 用于口语实时通信 |

### 1.2 架构总图

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Shell                        │
│  ┌──────────────┐    IPC Bridge    ┌──────────────────┐ │
│  │  Main Process │◄──────────────►│  Renderer Process │ │
│  │  (Node.js)    │                │  (React + TS)     │ │
│  │              │                │                    │ │
│  │  - 窗口管理    │                │  - Flux UI 渲染    │ │
│  │  - Python 进程  │               │  - 状态管理        │ │
│  │    生命周期管理  │               │  - ECharts 可视化   │ │
│  │  - 系统托盘    │                │  - WebSocket 客户端 │ │
│  └──────┬───────┘                └────────┬───────────┘ │
│         │                                  │             │
│         │ spawn/kill                       │ HTTP/WS     │
│         │                                  │             │
│  ┌──────▼──────────────────────────────────▼───────────┐ │
│  │           Python FastAPI 子进程                       │ │
│  │           (localhost:{random_port})                   │ │
│  │                                                      │ │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │ │
│  │  │Settings │ │Vocabulary│ │ Writing  │ │Speaking │ │ │
│  │  │  API    │ │   API    │ │   API    │ │  WS API │ │ │
│  │  └────┬────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │ │
│  │       │           │            │             │      │ │
│  │  ┌────▼───────────▼────────────▼─────────────▼────┐ │ │
│  │  │              Service Layer                      │ │ │
│  │  │  SM-2 算法 │ 5-Agent 引擎 │ 口语状态机 │ LLM适配 │ │ │
│  │  └──────────────────┬─────────────────────────────┘ │ │
│  │                     │                                │ │
│  │  ┌──────────────────▼─────────────────────────────┐ │ │
│  │  │           SQLite (aiosqlite)                    │ │ │
│  │  └────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│         ┌──────────────────────────────────┐              │
│         │    External AI APIs (BYOK)       │              │
│         │  LLM: OpenAI-compatible API      │              │
│         │  STT: Whisper / Azure / 其他      │              │
│         │  TTS: OpenAI TTS / Azure / 其他   │              │
│         └──────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

## 2. 项目目录结构

```
IELTS-mate/
├── src/
│   ├── main/                          # Electron 主进程
│   │   ├── index.ts                   # 主进程入口
│   │   ├── python-manager.ts          # Python 子进程生命周期管理
│   │   └── port-finder.ts             # 随机可用端口分配
│   │
│   ├── preload/                       # Preload 脚本
│   │   ├── index.ts                   # 预加载入口
│   │   └── index.d.ts                 # 类型声明
│   │
│   └── renderer/                      # React 渲染进程 (前端)
│       ├── src/
│       │   ├── assets/                # 静态资源 (图片、字体)
│       │   │
│       │   ├── components/            # 共享组件
│       │   │   ├── ui/                # 基础 UI 组件 (Button, Input...)
│       │   │   ├── flux/              # [NEW] Flux Academy 风格核心组件
│       │   │   │   ├── GlassCard.tsx      # 陶瓷磨砂卡片
│       │   │   │   ├── FluidBackground.tsx # 交互式流体背景
│       │   │   │   ├── Dock.tsx           # 底部悬浮导航坞
│       │   │   │   └── HeroOrb.tsx        # 首页 3D 球体
│       │   │   ├── charts/            # ECharts 封装组件
│       │   │       ├── Heatmap.tsx     # 学习热力图 (圆形光点风格)
│       │   │       ├── LineChart.tsx
│       │   │       └── WritingChart.tsx
│       │   │
│       │   ├── pages/                 # 页面组件
│       │   │   ├── Dashboard/         # 首页 (Bento Grid 布局)
│       │   │   │   └── index.tsx
│       │   │   ├── Settings/          # BYOK 设置页 (含词汇学习设置)
│       │   │   │   └── index.tsx
│       │   │   ├── Vocabulary/        # 单词记忆模块
│       │   │   │   ├── Hub.tsx         # 词汇中心 (双模式入口 + 每日上限)
│       │   │   │   ├── Learn.tsx       # 新词学习 (四选一 Quiz + 双轮确认)
│       │   │   │   ├── Review.tsx      # 复习页 (3D 翻转卡片 + 自评)
│       │   │   │   └── SessionComplete.tsx # 学习完成统计页
│       │   │   ├── Writing/           # 写作批改模块
│       │   │   │   ├── Hub.tsx         # 写作中心
│       │   │   │   ├── Editor.tsx      # 沉浸编辑器
│       │   │   │   └── Report.tsx      # 评分报告
│       │   │   └── Speaking/          # 口语模考模块
│       │   │       ├── Hub.tsx
│       │   │       ├── ChatMode.tsx    # 闲聊模式
│       │   │       ├── MockTest.tsx    # 模考模式
│       │   │       └── Visualizer.tsx  # 音频波形
│       │   │
│       │   ├── hooks/                 # 自定义 Hooks
│       │   │   ├── useWebSocket.ts    # WebSocket 连接管理
│       │   │   ├── useAudioRecorder.ts # 音频录制
│       │   │   ├── useTimer.ts        # 计时器
│       │   │   └── useApi.ts          # API 请求封装
│       │   │
│       │   ├── services/              # API 服务层
│       │   │   ├── api.ts             # Axios 实例与拦截器
│       │   │   ├── vocabulary.ts      # 词汇 API 服务
│       │   │   ├── settings.ts        # 设置 API 服务
│       │   │   └── ...
│       │   │
│       │   ├── store/                 # Zustand 状态管理
│       │   │   ├── useSettingsStore.ts # 全局设置/API Key 状态
│       │   │   ├── useVocabularyStore.ts # 词汇模块状态 (含每日统计/设置)
│       │   │   └── ...
│       │   │
│       │   ├── App.tsx                # 根组件 (Layout Entry)
│       │   ├── router.tsx             # 路由配置
│       │   ├── main.tsx               # 渲染入口
│       │   └── index.css              # 全局样式 (Tailwind)
│       │
│       └── index.html                 # HTML 模板
│
├── backend/                           # Python FastAPI 后端
│   ├── ... (同前)
│
├── docs/                              # 工程文档
│   ├── architecture.md                # 架构文档 (本文件)
│   ├── api-spec.md                    # API 规格文档
│   ├── development-guide.md           # 开发指南
│   ├── frontend-design-new.md         # [NEW] Flux 视觉设计规范
│   └── frontend-pages.md              # 页面详细规划
│
├── .gitignore
├── package.json                       # 前端依赖 & Electron 配置
├── tailwind.config.js                 # Tailwind CSS 配置 (v4)
└── ...
```

## 3. Electron 主进程设计 (保持不变)

...

## 4. 核心模块设计

### 4.1 写作模块 — 5-Agent 并行评估架构

写作模块的核心评估引擎采用 **5-Agent 并行架构**，实现专业级雅思写作批改：

```
用户提交作文
      │
      ▼
┌──────────────────────────────────────────────────────┐
│                asyncio.gather (并行执行)               │
│                                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│  │ Agent 1 │ │ Agent 2 │ │ Agent 3 │ │ Agent 4  │  │
│  │   TR    │ │   CC    │ │   LR    │ │   GRA    │  │
│  │         │ │         │ │         │ │          │  │
│  │ Band    │ │ Band    │ │ Band    │ │ Band     │  │
│  │ Desc.   │ │ Desc.   │ │ Desc.   │ │ Desc.    │  │
│  │ 锚定评分 │ │ 锚定评分 │ │ 锚定评分 │ │ 锚定评分  │  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬─────┘  │
│       │           │           │            │         │
│       └─────────┬─┴───────────┴──┬─────────┘         │
│                 │                │                    │
│          ┌──────▼────────────────▼──────┐            │
│          │      Chief Examiner          │            │
│          │      (主考官 Agent)           │            │
│          │                              │            │
│          │  • 汇总 4 份评分报告           │            │
│          │  • 计算总分 (均分→四舍五入0.5)  │            │
│          │  • 生成综合 Markdown 报告       │            │
│          │  • 撰写 Band 8+ 范文          │            │
│          │  • 提供重写建议                │            │
│          └──────────────┬───────────────┘            │
│                         │                            │
└─────────────────────────┼────────────────────────────┘
                          │
                          ▼
                   最终评估结果
                   (存入 SQLite)
```

**关键设计决策**：

| 特性 | 实现方式 |
|------|---------|
| 并行执行 | `asyncio.gather(*tasks)` 同时唤起 4 个评分 Agent |
| 评分锚定 | 每个 Agent 的 System Prompt 包含对应维度的 IELTS 官方 Band Descriptors (Band 5–9) |
| 重试机制 | JSON 解析失败时最多重试 3 次，带 0.5s 退避 |
| 容错降级 | 单个 Agent 全部重试失败后返回安全 fallback（score=0 + 错误信息） |
| Task 差异 | TR Agent 根据 task_type 自动切换 Task Achievement (Task 1) / Task Response (Task 2) 的 Band Descriptors |
| 总分计算 | 主考官计算 + 后端校验均分，四舍五入到 0.5 |

**文件结构**：

```
backend/app/services/
├── band_descriptors.py      # IELTS 官方评分标准 (Band 5–9, 4 维度)
├── writing_service.py       # 5-Agent 并行评估引擎
└── llm/
    ├── base.py              # LLM 客户端抽象基类
    ├── factory.py           # LLM 客户端工厂
    └── openai_compatible.py # OpenAI 兼容 API 实现
```

### 4.2 写作模块 — 图表渲染组件体系 (2026-03-17 新增)

前端 Task 1 图表渲染采用 **分发器 + 6 个专业渲染器** 架构，支持 7 种图表类型：

```
ChartRenderer（分发器）
    │
    ├── bar/line/pie ──► EChartsRenderer (ECharts 6, useRef+init+ResizeObserver)
    │
    ├── combination ──► EChartsRenderer (dual-axis 模式, 向后兼容)
    │
    ├── table ──────► TableRenderer (Tailwind HTML 表格)
    │
    ├── process ────► MermaidRenderer (Mermaid.js 11, parse 校验+fallback)
    │
    ├── map ────────► D3MapRenderer (D3.js 7, SVG 渲染结构化地图)
    │
    └── mixed ─────► MixedChartRenderer (双图容器, 递归分发)
                        ├── SubChart 1 ──► ChartRenderer
                        └── SubChart 2 ──► ChartRenderer
```

**关键设计决策**：

| 特性 | 实现方式 |
|------|---------|
| 懒加载 | 所有渲染器使用 `React.lazy()` + `Suspense`，避免影响首屏 |
| ECharts 生命周期 | `useRef` + 动态 `import('echarts')` + `echarts.init()` + `ResizeObserver`(100ms debounce) |
| D3 地图渲染 | `d3-selection` 操作 SVG，归一化 0-100 坐标系，feature type 映射 SVG 元素 |
| Mermaid 容错 | `mermaid.parse()` 校验语法，失败时 fallback 为步骤列表 |
| Mixed 递归 | MixedChartRenderer 将 sub_charts 分发回 ChartRenderer，避免代码重复 |
| combination 兼容 | 旧 combination 题目自动 fallback 到 ECharts dual-axis 渲染 |

**文件结构**：

```
src/renderer/src/pages/Writing/components/
├── ChartRenderer.tsx       # 分发器 (React.lazy switch)
├── EChartsRenderer.tsx     # ECharts 6 (4 种 option builder)
├── TableRenderer.tsx       # HTML 表格 (Tailwind)
├── MermaidRenderer.tsx     # Mermaid.js 流程图
├── D3MapRenderer.tsx       # D3.js SVG 地图
└── MixedChartRenderer.tsx  # 双图容器
```

### 4.3 词汇模块 — 事件驱动学习统计 (2026-03-24 新增)

词汇模块的统计数据（热力图、连续天数、活动趋势）不再依赖 `Vocabulary.updated_at` 推测学习行为，而是通过独立的 `VocabularyEvent` 事件表精确记录每次真实学习动作：

```
学习/复习/拼写/听写提交结果
      │
      ▼
┌──────────────────────────────────────────────┐
│    POST /api/vocabulary/{word_id}/review      │
│    请求体: { quality: int, mode: string }     │
│                                              │
│    mode = "review" | "learn_quiz" |           │
│           "spelling" | "dictation"            │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│         vocabulary_events 表                  │
│  (word_id, mode, quality, created_at)        │
│  索引: created_at, word_id                   │
└──────────────┬───────────────────────────────┘
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
  热力图   连续天数   活动趋势
  heatmap   streak   activity-trend
```

**关键设计决策**：
- 事件表只记录 `submit_review` 触发的真实学习动作，不混入收藏/笔记等非学习操作
- `mode` 字段区分来源，支持按模式维度聚合
- 热力图和 streak 从事件表聚合，不依赖 `Vocabulary.updated_at`

### 4.4 写作模块 — 结构化报告与按题分析 (2026-03-24 新增)

**结构化报告链路**：
```
writing_sessions 表
│
├── report_markdown (原始主考官 Markdown)
├── agent_reports (四维 Agent 的 JSON 报告)
│
▼
writing_report_parser.py
│
├── 按 # / ## / ### 标题切段
├── 识别 Overall / Model Answer / Rewrite Suggestions
├── 从 agent_reports 提取 fallback suggestions
│
▼
structured_report (StructuredReportData)
│
├── summary_title + summary_paragraphs
├── model_answer_title + model_answer_paragraphs
├── rewrite_title + rewrite_suggestions
│
▼
GET /api/writing/sessions/{id} → SessionDetailData.structured_report
```

**按题聚合链路**：
```
writing_sessions 表 (topic_id 已有索引)
│
├── GROUP BY topic_id → 练习次数 / 平均分 / 最佳分
│   └── GET /api/writing/topics/aggregate
│
└── WHERE topic_id = ? ORDER BY created_at ASC
    └── GET /api/writing/topics/{topic_id}/trend
```

### 4.5 口语模块 — WebSocket 实时通信 + 状态机架构 (2026-03-24 新增)

口语模块采用**后端驱动、前端渲染**的架构，通过单一 WebSocket 连接实现实时语音对话：

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (React)                              │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐           │
│  │ useWebSocket│  │useAudioRecord│  │  useTimer   │           │
│  │  (Hook)     │  │  (Hook)      │  │  (Hook)     │           │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘           │
│         │                │                  │                   │
│  ┌──────▼──────────────────────────────────▼──────┐           │
│  │          useSpeakingStore (Zustand)             │           │
│  │   phase | isRecording | transcript | timer      │           │
│  └──────────────────┬─────────────────────────────┘           │
│                     │                                          │
│  ┌──────────────────▼─────────────────────────────┐           │
│  │  Pages: ChatMode / MockTest / History / Report  │           │
│  │  Components: AudioVisualizer / MicButton /      │           │
│  │              TranscriptPanel / TimerDisplay /    │           │
│  │              TopicCard                          │           │
│  └─────────────────────────────────────────────────┘           │
└────────────────────────┬────────────────────────────────────────┘
                         │ WebSocket
                         │ (audio_chunk / start_session / end_turn)
┌────────────────────────▼────────────────────────────────────────┐
│                     后端 (FastAPI)                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐           │
│  │         SpeakingSessionHandler                    │           │
│  │         (WebSocket 消息处理器)                      │           │
│  │                                                   │           │
│  │  audio_chunk → STT → text                         │           │
│  │  text → Memory + LLM → AI reply                   │           │
│  │  AI reply → TTS → audio bytes                     │           │
│  └──────┬───────────┬──────────────┬────────────────┘           │
│         │           │              │                             │
│  ┌──────▼────┐  ┌───▼──────┐  ┌───▼──────────┐                │
│  │ Speaking  │  │ Speaking │  │   Speaking    │                │
│  │ State    │  │ Memory   │  │   Prompts     │                │
│  │ Machine  │  │          │  │               │                │
│  │          │  │ 滑动窗口  │  │ Part 1/2/3   │                │
│  │ Part 1→  │  │ (8轮)    │  │ System       │                │
│  │ Part 2→  │  │ +        │  │ Prompts      │                │
│  │ Part 3   │  │ 阶段摘要  │  │ + 评分 Agent │                │
│  └──────────┘  └──────────┘  └──────────────┘                │
│         │           │              │                             │
│  ┌──────▼───────────▼──────────────▼────────────────┐           │
│  │              External APIs (BYOK)                 │           │
│  │  STT: OpenAI Whisper    TTS: OpenAI TTS          │           │
│  │  LLM: OpenAI-compatible                          │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐           │
│  │         Report Generator (4+1 Agent)              │           │
│  │  FC / LR / GRA / Pronunciation → Chief Examiner  │           │
│  │         (asyncio.gather 并行执行)                   │           │
│  └──────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

**关键设计决策**：

| 特性 | 实现方式 |
|------|---------|
| 通信协议 | 单一 WebSocket 连接，JSON 消息协议（type 字段区分消息类型） |
| STT 模式 | 整段音频提交（非流式），适合 Whisper API 和雅思口语场景 |
| 状态机 | 后端 `SpeakingStateMachine` 驱动 Part 1→2→3 流转 |
| 计时器 | 后端 `asyncio.create_task` 驱动，每秒推送 `timer` 消息，前端以后端为准 |
| Part 2 警报 | 4 级视觉警报：90s 黄 / 110s 橙 / 120s 红 / 130s 强制中断 |
| 认知记忆 | 滑动窗口 8 轮 + Part 1 结束后 LLM 生成阶段摘要注入后续 Part |
| 报告评估 | 4 Agent 并行 (FC/LR/GRA/Pronunciation) + Chief Examiner 汇总 |
| 录音格式 | `MediaRecorder` webm/opus 优先，降级 webm → ogg → mp4 |
| 断线重连 | 前端最多 3 次指数退避重连，ping/pong 30s 心跳 |

**文件结构**：

```
backend/app/services/
├── speaking_service.py        # WebSocket 处理器 + 对话协调 + 报告生成
├── speaking_state_machine.py  # Mock Test 状态机引擎
├── speaking_memory.py         # 滑动窗口 + 阶段摘要
├── speaking_prompts.py        # 考官 System Prompt 模板
├── stt/
│   ├── base.py                # BaseSTTClient 抽象基类
│   ├── openai_whisper.py      # OpenAI Whisper 实现
│   └── __init__.py            # 工厂方法
└── tts/
    ├── base.py                # BaseTTSClient 抽象基类
    ├── openai_tts.py          # OpenAI TTS 实现
    └── __init__.py            # 工厂方法

src/renderer/src/
├── hooks/
│   ├── useWebSocket.ts        # WebSocket 连接管理
│   ├── useAudioRecorder.ts    # PTT/VAD 录音
│   └── useTimer.ts            # 后端校准计时器
├── store/
│   └── useSpeakingStore.ts    # 口语 Zustand store
├── pages/Speaking/
│   ├── ChatMode.tsx           # 闲聊模式
│   ├── MockTest.tsx           # 模考模式
│   ├── History.tsx            # 历史列表
│   ├── Report.tsx             # 报告详情
│   └── components/            # 5 个子组件
└── services/
    └── speaking.ts            # REST API + WS URL
```

### 4.6 其他模块 (保持不变)

...

## 5. 数据库 Schema 设计 (保持不变)

...

## 6. AI 服务适配层设计 (保持不变)

...

## 7. 安全性考虑 (保持不变)

...

## 8. 打包与分发策略

### 8.1 整体流程

```
Step 1: PyInstaller 打包后端
  backend/app/main.py  →  backend/dist/backend/backend (可执行文件)
                           backend/dist/backend/_internal/ (依赖库 + data/*.json)

Step 2: electron-vite build 编译前端
  src/  →  out/main/ + out/preload/ + out/renderer/

Step 3: electron-builder 整合
  out/ + backend/dist/backend/  →  dist/IELTS-mate-*.dmg / .exe / .AppImage
```

### 8.2 关键配置文件

| 文件 | 作用 |
|------|------|
| `backend/backend.spec` | PyInstaller 打包配置（hiddenimports、data 文件） |
| `electron-builder.yml` | Electron 安装包配置（extraResources、目标平台） |
| `scripts/build-mac.sh` | macOS 一键打包脚本 |

### 8.3 运行时目录约定

| 类型 | 开发态路径 | 打包态路径 |
|------|-----------|-----------|
| 后端二进制 | `python backend/app/main.py` | `resources/backend/backend` |
| 静态数据 JSON | `backend/data/*.json` | `resources/backend/_internal/data/*.json` |
| SQLite 数据库 | `backend/data/ielts_mate.db` | `userData/ielts_mate.db` (通过 `BACKEND_DB_PATH` 环境变量) |

### 8.4 平台产物

| 平台 | 产物格式 | 构建命令 |
|------|---------|---------|
| macOS | DMG + ZIP | `pnpm build:mac` |
| Windows | NSIS 安装程序 | `pnpm build:win` |
| Linux | AppImage | `pnpm build:linux` |

> **注意**：跨平台打包有限制。macOS DMG 最好在 macOS 上构建；Windows 安装包最好在 Windows 上构建。
