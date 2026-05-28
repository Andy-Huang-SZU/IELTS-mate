# IELTS-mate 项目交接文档

> **创建日期**：2026-03-09
> **用途**：在新服务器上为 CodeBuddy AI 提供完整的项目上下文，确保无缝继续开发

---

## 一、项目概述

IELTS-mate 是一款**面向中国雅思备考生的免费开源桌面端应用**，采用 BYOK (Bring Your Own Key) 模式，聚焦三大核心模块：

1. **词汇记忆** (Vocabulary) — ✅ 已完成（含统计页、拼写、听写）
2. **写作批改** (Writing) — ✅ 核心完成（含结构化报告、按题复盘）
3. **口语模考** (Speaking) — ✅ 已完成（含闲聊/模考双模式、STT/TTS、考后报告）

---

## 二、技术栈

| 层级 | 技术方案 |
|------|---------|
| 桌面框架 | Electron 37 + electron-vite 4 |
| 前端框架 | React 19 + TypeScript 5.9 |
| 状态管理 | Zustand 5 |
| UI 样式 | Tailwind CSS 3.4 |
| 动画 | Framer Motion 12 |
| 数据可视化 | Apache ECharts 6 |
| 字体 | Fraunces (衬线标题) + Inter (无衬线正文) |
| 图标 | Lucide React |
| 后端框架 | Python + FastAPI |
| 数据库 | SQLite (aiosqlite 异步) |
| ORM | SQLAlchemy 2.0 async |
| LLM 调用 | httpx (OpenAI 兼容 API) |
| 包管理 | pnpm (前端) / pip (后端) |

### 设计系统

项目使用自定义 **Flux** 设计系统，核心特征：
- 暖米白背景 (#F7F6F2)
- 陶瓷质感磨砂玻璃卡片 (GlassCard)
- 流体动效背景 (FluidBackground)
- FAB 扇形导航 (Dock)
- Lucide 线条图标
- 纯 CSS 动画

核心组件位于 `src/renderer/src/components/flux/`：
- `GlassCard.tsx` — 毛玻璃卡片
- `PageContainer.tsx` — 页面容器
- `FluidBackground.tsx` — 流体背景
- `Dock.tsx` — 底部扇形导航

---

## 三、目录结构

```
IELTS-mate/
├── backend/                          # Python 后端
│   ├── requirements.txt              # Python 依赖
│   ├── app/
│   │   ├── main.py                   # FastAPI 入口 (lifespan, CORS, 路由, WebSocket)
│   │   ├── core/
│   │   │   ├── config.py             # 数据库路径配置
│   │   │   └── database.py           # SQLAlchemy 异步引擎
│   │   ├── models/                   # ORM 模型
│   │   │   ├── __init__.py           # 导出 Setting, Vocabulary, WritingSession, SpeakingSession, SpeakingMessage
│   │   │   ├── settings.py
│   │   │   ├── vocabulary.py
│   │   │   ├── writing.py            # WritingSession 表
│   │   │   └── speaking.py           # SpeakingSession + SpeakingMessage 表
│   │   ├── schemas/                  # Pydantic Schema
│   │   │   ├── settings.py
│   │   │   ├── vocabulary.py
│   │   │   ├── writing.py
│   │   │   └── speaking.py           # 口语 WS 消息类型 + REST schemas
│   │   ├── services/                 # 业务逻辑
│   │   │   ├── settings_service.py
│   │   │   ├── vocabulary_service.py # (含首次启动词汇导入 + 事件驱动统计)
│   │   │   ├── writing_service.py    # 写作业务 (题目生成、AI评估、历史管理、按题聚合)
│   │   │   ├── writing_report_parser.py # 报告结构化解析器 (总评/范文/重写建议)
│   │   │   ├── topic_gen_service.py  # ✅ 题目生成服务 (11种题型Prompt + 校验 + 重试)
│   │   │   ├── topic_bank_service.py # ✅ 题库管理服务 (JSON加载/随机抽取/写回)
│   │   │   ├── speaking_service.py   # ✅ 口语核心业务 (WebSocket处理器/对话协调/报告生成)
│   │   │   ├── speaking_state_machine.py # ✅ Mock Test 状态机引擎
│   │   │   ├── speaking_memory.py    # ✅ 认知记忆 (滑动窗口+阶段摘要)
│   │   │   ├── speaking_prompts.py   # ✅ 考官 Prompt 模板 (Part 1/2/3 + 评分Agent)
│   │   │   ├── sm2.py               # SM-2 间隔重复算法
│   │   │   ├── llm/                  # LLM 集成
│   │   │   │   ├── base.py           # BaseLLMClient 抽象类 (chat() 返回 ChatResult)
│   │   │   │   ├── factory.py        # LLM 客户端工厂 (含 topicgen 工厂)
│   │   │   │   └── openai_compatible.py  # OpenAI 兼容 API 实现 (httpx)
│   │   │   ├── stt/                  # ✅ STT 适配层
│   │   │   │   ├── base.py           # BaseSTTClient 抽象基类
│   │   │   │   ├── openai_whisper.py # OpenAI Whisper API 实现
│   │   │   │   └── __init__.py       # 工厂方法 create_stt_client()
│   │   │   └── tts/                  # ✅ TTS 适配层
│   │   │       ├── base.py           # BaseTTSClient 抽象基类
│   │   │       ├── openai_tts.py     # OpenAI TTS API 实现
│   │   │       └── __init__.py       # 工厂方法 create_tts_client()
│   │   └── api/
│   │       ├── __init__.py           # 路由汇总
│   │       └── routes/
│   │           ├── settings.py       # /api/settings/*
│   │           ├── vocabulary.py     # /api/vocabulary/*
│   │           ├── writing.py        # /api/writing/*
│   │           └── speaking.py       # /api/speaking/* (sessions/report REST)
│   └── data/
│       ├── ielts_mate.db             # SQLite 数据库
│       ├── ielts_vocabulary.json     # IELTS 词汇库 (3MB, 基于 ECDICT)
│       └── writing_topics.json       # ✅ 写作题库 JSON (由生成脚本填充)
│
├── src/                              # 前端源码
│   ├── main/                         # Electron 主进程
│   │   ├── index.ts                  # 窗口管理、IPC、启动 Python 后端
│   │   ├── port-finder.ts
│   │   └── python-manager.ts         # Python 进程管理器
│   ├── preload/                      # Electron 预加载
│   └── renderer/src/                 # React SPA
│       ├── App.tsx                   # 根布局 (FluidBackground + Dock + Outlet)
│       ├── router.tsx                # 路由配置
│       ├── main.tsx                  # React 入口
│       ├── components/flux/          # Flux 设计系统组件库
│       ├── pages/
│       │   ├── Dashboard/index.tsx   # 仪表盘首页
│       │   ├── Settings/index.tsx    # 设置页 (LLM 配置)
│       │   ├── Home/index.tsx        # 系统联调测试页
│       │   ├── Vocabulary/           # 词汇模块 ✅
│       │   │   ├── Hub.tsx           # 词汇中心（含拼写/听写/统计入口）
│       │   │   ├── Learn.tsx         # 学习模式 (四选一 Quiz)
│       │   │   ├── Review.tsx        # 复习模式 (SM-2 卡片)
│       │   │   ├── Spelling.tsx      # 拼写训练模式
│       │   │   ├── Dictation.tsx     # 听写训练模式 (浏览器 TTS)
│       │   │   ├── Stats.tsx         # 正式词汇统计页
│       │   │   └── SessionComplete.tsx
│       │   ├── Writing/              # 写作模块 ✅
│       │   │   ├── Hub.tsx           # 写作中心（三种模式入口）
│       │   │   ├── Editor.tsx        # 写作编辑器（ChartRenderer + 换题按钮）
│       │   │   ├── Report.tsx        # 批改报告（优先消费后端结构化报告）
│       │   │   ├── History.tsx       # 写作历史（Sessions / By Topic 双视图）
│       │   │   └── components/       # 图表渲染 + 趋势图组件体系
│       │   │       ├── ChartRenderer.tsx     # 分发器（React.lazy）
│       │   │       ├── EChartsRenderer.tsx   # ECharts 6 (bar/line/pie/dual-axis)
│       │   │       ├── TableRenderer.tsx     # HTML 表格
│       │   │       ├── MermaidRenderer.tsx   # [已废弃] Mermaid 流程图，被 ProcessFlowRenderer 替代
│       │   │       ├── ProcessFlowRenderer.tsx # 纯 HTML/CSS 蛇形流程图
│       │   │       ├── D3MapRenderer.tsx     # D3.js SVG 地图
│       │   │       ├── MixedChartRenderer.tsx # 双图容器
│       │   │       ├── ByTopicView.tsx       # 按题聚合视图
│       │   │       └── TopicTrendChart.tsx   # 轻量 SVG 趋势图
│       │   └── Speaking/             # 口语模块 ✅
│       │       ├── Hub.tsx           # 口语中心（三卡片入口）
│       │       ├── ChatMode.tsx      # 闲聊模式（波形+对话+麦克风）
│       │       ├── MockTest.tsx      # 模考模式（Part 1/2/3 状态切换）
│       │       ├── History.tsx       # 口语历史列表（模式筛选+分页）
│       │       ├── Report.tsx        # 口语报告（四维评分+转录+Markdown）
│       │       ├── index.ts          # 导出
│       │       └── components/       # 口语子组件
│       │           ├── AudioVisualizer.tsx  # Canvas 圆形波形可视化
│       │           ├── MicButton.tsx        # 麦克风按钮（4 状态）
│       │           ├── TranscriptPanel.tsx  # 对话气泡面板
│       │           ├── TimerDisplay.tsx     # SVG 环形计时器
│       │           └── TopicCard.tsx        # Part 2 话题卡片
│       ├── hooks/                   # 自定义 Hooks
│       │   ├── useWebSocket.ts      # WebSocket 连接管理（重连+心跳）
│       │   ├── useAudioRecorder.ts  # 音频录制（PTT/VAD 双模式）
│       │   └── useTimer.ts          # 计时器（后端校准+警报）
│       ├── services/                 # API 服务层
│       │   ├── settings.ts
│       │   ├── vocabulary.ts
│       │   ├── writing.ts
│       │   └── speaking.ts          # 口语 REST API + WS URL
│       └── store/
│           ├── useSettingsStore.ts
│           ├── useVocabularyStore.ts
│           └── useSpeakingStore.ts   # 口语 Zustand store
│
├── docs/                             # 项目文档
│   ├── api-spec.md                   # API 规格文档
│   ├── architecture.md               # 系统架构文档
│   ├── development-guide.md          # 开发指南
│   ├── frontend-design-new.md        # 前端设计规范
│   ├── frontend-pages.md             # 页面规格
│   └── references/                   # 官方参考资料
│       ├── README.md
│       ├── ielts-writing-band-descriptors.pdf
│       └── ielts-writing-key-assessment-criteria.pdf
├── prd.md                            # 产品需求文档 (PRD)
└── package.json
```

---

## 四、路由结构

| 路径 | 组件 | 状态 |
|------|------|------|
| `/` | Dashboard | ✅ 已实现 |
| `/vocabulary` | VocabularyHub | ✅ 已实现 |
| `/vocabulary/learn` | VocabularyLearn | ✅ 已实现 |
| `/vocabulary/review` | VocabularyReview | ✅ 已实现 |
| `/vocabulary/stats` | VocabularyStats | ✅ 已实现 |
| `/vocabulary/spelling` | VocabularySpelling | ✅ 已实现 |
| `/vocabulary/dictation` | VocabularyDictation | ✅ 已实现 |
| `/writing` | WritingHub | ✅ 已实现 |
| `/writing/editor` | WritingEditor | ✅ 已实现 |
| `/writing/report/:id` | WritingReport | ✅ 已实现 |
| `/writing/history` | WritingHistory | ✅ 已实现 |
| `/speaking` | SpeakingHub | ✅ 已实现（英文化 + 三卡片） |
| `/speaking/chat` | ChatMode | ✅ 已实现 |
| `/speaking/mock` | MockTest | ✅ 已实现 |
| `/speaking/history` | SpeakingHistory | ✅ 已实现 |
| `/speaking/report/:id` | SpeakingReport | ✅ 已实现 |
| `/settings` | SettingsPage | ✅ 已实现（含 STT/TTS 配置） |

---

## 五、各模块完成状态

### 1. 词汇模块 (Vocabulary) — ✅ 完成

**功能**：
- Hub 页：词汇中心，进入学习/复习/拼写/听写/统计的入口
- Learn 模式：新词学习，四选一 Quiz 交互
- Review 模式：基于 SM-2 间隔重复算法的复习卡片
- Spelling 模式：拼写训练，看释义拼英文，逐字母反馈
- Dictation 模式：听写训练，浏览器 TTS 朗读单词，用户听写，支持降级提示
- Stats 页：正式词汇统计页，展示连续学习天数、Top 错词、活动趋势与核心概览
- 2026-03-24 UI follow-up：Stats 页文案统一英文；移除 Stats 页热力图，改为高频错词列表（首页保留总热力图）
- 2026-03-24 i18n follow-up：Vocabulary 路由（Hub/Learn/Review/Spelling/Dictation/SessionComplete）清理中文 UI 文案，统一为英文；`/vocabulary` 首页卡片改为英文释义优先显示
- SessionComplete 页：学习/复习完成统计
- 后端完整的 CRUD + SM-2 算法服务 + 事件驱动统计（VocabularyEvent 表）
- 基于 ECDICT 提取的 3MB IELTS 词汇库

### 2. 写作模块 (Writing) — ✅ 题库、历史、报告与按题复盘主链路完成

**已完成的部分**：
- 后端 WritingSession 数据模型 + API 端点
- 后端 LLM `chat()` 方法（httpx，120s 超时，返回 ChatResult 含 token usage）
- 后端写作服务（题目生成、AI 评估、历史管理）
- 前端 API 服务层 (`services/writing.ts`)
- 前端 Writing Report 页面（总分 + 四维评分 + 优劣势 + 标注 + 主考官 Markdown 结构化展示）
- ✅ **后端结构化报告** (2026-03-24 完成)
  - `writing_report_parser.py` 后端报告解析器，镜像前端 `parseChiefReport()` 逻辑
  - 详情接口返回 `structured_report` 字段（总评摘要 + 范文 + 重写建议），保留 `report_markdown` 兜底
  - 前端 Report.tsx 优先消费后端结构化报告，老 session 自动 fallback 到前端解析
- ✅ **按题聚合与趋势历史** (2026-03-24 完成)
  - 新增 `GET /api/writing/topics/aggregate`（按 topic_id 聚合：练习次数、平均分、最佳分、最近分）
  - 新增 `GET /api/writing/topics/{topic_id}/trend`（同题趋势：按时间排列的 attempts 明细）
  - History 页升级为 `Sessions / By Topic` 双视图，By Topic 视图展示按题卡片 + 可展开趋势图
  - 轻量 SVG 趋势图组件 `TopicTrendChart.tsx`
- ✅ **题目系统后端基础设施** (2026-03-15 完成)
  - LLM 客户端 ChatResult 改造（chat() 返回 content + token usage）
  - 独立的题目生成 LLM 配置（topicgen_* 字段，支持复用评估 LLM 或独立配置）
  - 题库管理服务 TopicBankService（JSON 文件加载/随机抽取/写回）
  - Token 预估服务、批量生成脚本 generate_topics.py、Mermaid 校验脚本
  - 新 API 端点：random-topic、topic-estimate、topic-bank-stats
- ✅ **题目系统第二阶段升级** (2026-03-17 完成)
  - 新增 **map（地图题）** 和 **mixed（双图混合题）** 两种题型
  - 后端 12 种题型 Prompt 模板（Task 1: bar/line/pie/table/mixed/map/process；Task 2: opinion/discussion/problem_solution/two_part/advantage_disadvantage）
  - combination → mixed 迁移（保持向后兼容：题库匹配 + 路由映射 + 前端 fallback）
  - 2026-03-23 补充修复：legacy `combination` 数据即使已重编号为 `mixed`，仍可在 Editor / Report 中自动兼容渲染，不再出现 “Mixed chart data not available”
  - 前端图表渲染全面升级（6 个独立组件体系）：
    - `ChartRenderer`：分发器，根据 chart_type 使用 React.lazy 选择渲染组件
    - `EChartsRenderer`：ECharts 6 渲染 bar/line/pie/dual-axis，含 ResizeObserver
    - `TableRenderer`：Tailwind 样式 HTML 表格
    - `ProcessFlowRenderer`：纯 HTML/CSS 蛇形折行流程图（替代 MermaidRenderer）
    - `D3MapRenderer`：D3.js SVG 渲染结构化地图（双地图上下对比）
    - `MixedChartRenderer`：双图容器，上下排列两个子图
  - Writing Hub 重构为三种模式入口：随机模拟测验、快速练习（Task 1 / Task 2）、自由选择（7 种 chart_type chip + 出题方式切换）
  - 2026-03-23 新增 **Topic Browser**：Hub 内嵌题库总览，支持 Task / 子题型 / 难度筛选、关键词搜索、分页浏览，并可直接打开指定题目
  - Writing Editor 改造：删除内联 SVG 图表（~350 行），替换为 ChartRenderer 组件，新增"换一题"和"AI 生成新题"按钮
  - 2026-03-23 Editor 新增“指定题目加载”能力：支持 `topicId` 查询参数和 router state 题目快照，供 Topic Browser / History / Report 复用
  - Settings 页面新增 Token 价格配置区域（token_price_input / token_price_output）
  - 前后端类型同步：settings.ts、writing.ts 扩展 map/mixed/MapView/SubChart 等类型
  - 题库分布升级为 150 道目标：Task 1 95 道 (bar:22 line:18 pie:12 table:12 mixed:12 map:10 process:9) + Task 2 55 道

**待完成**：
- 更多维度的按题分析（如按维度追踪 TR/CC/LR/GRA 趋势变化）
- 跨题型的横向比较分析（如 Task 1 vs Task 2 整体表现对比）

**题库当前状态（2026-03-23）**：
- 已完成 **150 道** 目标题库，并完成 prompt 级重复清理与替换
- Task 1：bar 22 / line 18 / pie 12 / table 12 / mixed 12 / map 10 / process 9
- Task 2：opinion 11 / discussion 11 / problem_solution 11 / two_part 11 / advantage_disadvantage 11

**API 端点**：
| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/writing/generate-topic` | AI 生成题目（支持 7 种 chart_type + 5 种 question_type）|
| POST | `/api/writing/random-topic` | 从题库随机抽取题目（mixed 时同时匹配 combination 旧题）|
| GET | `/api/writing/topic-estimate` | Token 消耗预估（返回 token 数量 + 费用预估）|
| GET | `/api/writing/topic-bank-stats` | 题库统计信息 |
| GET | `/api/writing/topic-bank` | 题库全量列表（支持 Task / 题型 / 难度筛选，供 Topic Browser 使用） |
| POST | `/api/writing/evaluate` | AI 批改作文 (四维评分+报告+标注) |
| GET | `/api/writing/sessions` | 写作历史列表（分页 + 任务筛选 + 分数排序，返回 `scores` / `word_count` / `topic_data`） |
| GET | `/api/writing/sessions/{id}` | 单次写作详情（含结构化报告 `structured_report`） |
| GET | `/api/writing/topics/aggregate` | 按题聚合摘要（练习次数、平均分、最佳分、最近分，支持筛选和排序） |
| GET | `/api/writing/topics/{topic_id}/trend` | 单题趋势明细（按时间排列的 attempts 列表） |

**评估维度**：TR (Task Response)、CC (Coherence & Cohesion)、LR (Lexical Resource)、GRA (Grammatical Range)

**写作评估技术决策**：
- ✅ 已升级为 **5-Agent 并行评估架构**（2026-03-10 完成）
- 4 个评分 Agent (TR/CC/LR/GRA) 通过 `asyncio.gather` 并行执行
- 每个 Agent 的 System Prompt 注入对应维度的 IELTS 官方 Band Descriptors (Band 5–9)，且根据 Task 1/Task 2 自动切换不同的标准文本
- 主考官 Agent 汇总 4 份报告，生成综合 Markdown 报告（含范文 + 重写建议）
- 重试机制：JSON 解析失败时最多重试 3 次
- 相关文件：`backend/app/services/writing_service.py`、`backend/app/services/band_descriptors.py`

### 3. 口语模块 (Speaking) — ✅ 已完成 (2026-03-24)

**已完成的部分**：
- 后端 STT/TTS 适配层（策略模式：BaseSTTClient/BaseTTSClient + OpenAI Whisper/TTS 实现 + 工厂方法）
- 后端口语状态机 (SpeakingStateMachine)：Part 1→2→3 流转 + asyncio 计时器 + 警报级别
- 后端认知记忆管理 (SpeakingMemory)：8 轮滑动窗口 + Part 1 阶段摘要生成
- 后端 WebSocket 实时通信 (SpeakingSessionHandler)：STT→LLM→TTS 管线 + 对话持久化
- 后端考后报告生成：4-Agent 并行评估 (FC/LR/GRA/Pronunciation) + Chief Examiner 汇总
- 后端 REST API (GET sessions 列表 + GET session 详情)
- 前端 hooks：useWebSocket（自动重连、心跳）、useAudioRecorder（PTT/VAD 双模式）、useTimer（后端校准）
- 前端 Zustand store (useSpeakingStore)
- 前端 UI 组件：AudioVisualizer（Canvas 波形）、MicButton、TranscriptPanel、TimerDisplay、TopicCard
- 前端四个页面：ChatMode（闲聊）、MockTest（模考含 Part 1/2/3）、History（历史列表）、Report（报告详情）
- Settings 页面 STT/TTS 配置区域（Provider/Key/URL/Model/Voice + Test Connection）
- Hub 页英文化 + 三卡片布局（Free Chat / Mock Test / History）

**双交互模式**：
- Free Chat（闲聊模式）：用户与 AI 自由英语对话，支持 PTT / VAD 切换
- Mock Test（模考模式）：严格模拟雅思口语考试三个 Part 流程，后端状态机驱动

**考后报告评估维度**：FC (Fluency & Coherence)、LR (Lexical Resource)、GRA (Grammar Range & Accuracy)、Pronunciation

**API 端点**：
| 方法 | 路径 | 功能 |
|------|------|------|
| WS | `/api/speaking/ws` | WebSocket 实时通信（音频/文本/状态/计时器） |
| GET | `/api/speaking/sessions` | 口语练习历史列表（分页 + 模式筛选） |
| GET | `/api/speaking/sessions/{id}` | 单次练习详情（含评分报告 + 对话记录） |

### 4. 设置模块 (Settings) — ✅ 完成

- LLM Provider 配置（provider、API Key、Base URL、Model）
- 题目生成 LLM 独立配置（topicgen_* 字段，支持复用评估 LLM 或独立配置）
- Token 价格配置（token_price_input / token_price_output，用于 AI 生成题目费用预估）
- STT 配置（stt_provider / stt_api_key / stt_base_url / stt_model + Test Connection）
- TTS 配置（tts_provider / tts_api_key / tts_base_url / tts_model / tts_voice + Test Connection）
- 词汇学习设置（每日新词上限）
- 前后端完整实现

### 5. Dashboard (仪表盘) — ✅ 完成

---

## 六、Git 提交历史

```
284039b feat: implement Writing module (topic generation, AI evaluation, Editor/Report pages)
7fb2957 feat(词汇模块): 完成双模式学习系统 — 复习卡片 + 新词四选一Quiz
251076b new ui design
1d59140 feat: 完成 Phase 2.5
de638e0 Initial commit
```

当前工作树干净（无未提交修改）。远程仓库：`https://github.com/Andy-Huang-SZU/IELTS-mate.git`

---

## 七、与 pragent 项目的关系

在 `/data/workspace/pragent/` 目录下有一个**独立的写作工坊项目**（`apps/writer-web`），使用 Vue 3 + TypeScript + Tailwind CSS + Python FastAPI。这是一个**完全不同的项目**，与 IELTS-mate 无关。之前有一个对话（会话 ID: `778a6826878142f1806c248d3d78319e`）是针对 pragent 项目的"写作工坊 UX 改进"，涉及：
- 操作图标布局改造
- 消除 update_canvas 冗余调用
- 增强 system prompt 防误调工具
- 画布快照精准回退

该工作已全部完成。与本 IELTS-mate 项目无关，不需要关注。

---

## 八、写作模块阶段总结（2026-03-23）

> **题库填充与 Report 增强均已完成，以下保留执行脉络供后续继续迭代。**

### 8.1 已完成背景

写作模块的题目系统已经过两阶段建设，后端和前端基础设施全部就绪：
- **Phase 1** (2026-03-15): LLM 客户端、题库服务、生成服务、API 路由
- **Phase 2** (2026-03-17): 新增 map/mixed 题型、前端图表渲染升级（ECharts + D3 + Mermaid）、Hub/Editor 重构、Token 价格配置
- **2026-03-23 收尾**：题库扩充到 150 道并完成 prompt 级去重；Report 页面结构化解析主考官 Markdown，独立展示总评 / 范文 / 重写建议

### 8.2 已完成执行顺序

```
1. ✅ 收集/整理雅思写作评分标准 (Band Descriptors) — 2026-03-10 完成
   ↓
2. ✅ 设计四个维度的专业评估 Prompt — 2026-03-10 完成
   ↓
3. ✅ 重构后端为 5-Agent 并行架构 + 重试机制 — 2026-03-10 完成
   ↓
4. ✅ 题目系统后端基础设施 — 2026-03-15 完成
   ↓
5. ✅ 题目系统第二阶段升级 — 2026-03-17 完成
   - 新增 map/mixed 题型（后端 Prompt + 数据结构 + 校验）
   - 前端 6 组件图表渲染体系（ECharts + D3 + ProcessFlow）
   - Hub 三模式入口 + Editor ChartRenderer 替换
   - Token 价格配置
   ↓
6. ✅ 验证题目生成效果（Task 1 / Task 2）
   ↓
7. ✅ 批量生成完整题库（150 道）并完成 prompt 级去重
   ↓
8. ✅ 主考官综合 Markdown 报告保留范文 + Rewrite Suggestions
   ↓
9. ✅ 前端 Report 页面结构化解析 Markdown，独立展示总评 / 范文 / 重写建议，并保留原始 Markdown 折叠查看
```

### 8.5 关键文件参考

在后续继续迭代写作模块时，需要重点查看这些文件：

| 文件 | 路径 | 需要做什么 |
|------|------|-----------|
| **writing_service.py** | `backend/app/services/writing_service.py` | 当前的评估逻辑和 Prompt，需要重构为 5-Agent |
| **writing.py (schemas)** | `backend/app/schemas/writing.py` | 可能需要扩展 schema 以支持新的数据结构 |
| **writing.py (routes)** | `backend/app/api/routes/writing.py` | API 端点可能需要调整 |
| **writing.ts** | `src/renderer/src/services/writing.ts` | 前端 API 类型定义 |
| **Editor.tsx** | `src/renderer/src/pages/Writing/Editor.tsx` | 图表渲染升级 |
| **Report.tsx** | `src/renderer/src/pages/Writing/Report.tsx` | 报告页增强 |
| **prd.md** | 项目根目录 | 完整的产品需求，特别是第 4 节写作模块 |

### 8.6 当前 `writing_service.py` 中的评估 Prompt 概要

当前 `evaluate_essay()` 已使用 **4 个评分 Agent + 1 个 Chief Examiner** 的并行架构。每个评分 Agent 都会收到：
- `task_type`
- `topic_id`
- `topic`
- 完整 `topic_data` 题目快照（Task 1 含结构化图表 / 地图 / 流程 / 双图数据，Task 2 含题型 / 标签 / 难度 / 来源）
- `user_essay`

主考官 Agent 在汇总时也会再次收到同一份题目快照，因此：
- Task 1 可以基于真实图表数据判断描述是否准确
- 历史记录能够按 `topic_id` 回查并重现原题上下文
- Report 页面可以直接回放 Task 1 图表，而不是只显示题干文本

---

## 九、开发环境搭建

在新服务器上，按以下步骤恢复开发环境：

```bash
# 1. Clone 项目
git clone git@github.com:Andy-Huang-SZU/IELTS-mate.git
cd IELTS-mate

# 2. 安装前端依赖
pnpm install  # 或 npm install

# 3. 安装后端依赖
cd backend
pip install -r requirements.txt
cd ..

# 4. 启动开发
# 前端 (Electron + React)
pnpm dev  # 或 npm run dev

# 后端单独启动（调试用）
cd backend
uvicorn app.main:app --reload --port 12345
```

**注意**：正常开发时，Electron 主进程会自动启动 Python 后端子进程（见 `src/main/python-manager.ts`），不需要手动启动后端。

---

## 十、LLM 配置

项目使用 BYOK 模式，需要在设置页面 (`/settings`) 配置：
- **Provider**：API 供应商
- **API Key**：你自己的 API Key
- **Base URL**：API 端点地址（支持 OpenAI 兼容 API，如 DeepSeek、通义等）
- **Model**：模型名称

配置存储在本地 SQLite 数据库中。

---

## 十一、重要的设计模式和约定

1. **后端四层架构**：Model → Schema → Service → Route（与词汇模块一致）
2. **前端 API 调用模式**：使用 `getBaseUrl()` 获取后端地址（支持 Electron IPC 传递的动态端口）
3. **UI 组件复用**：所有页面使用 `PageContainer` + `GlassCard` 组合
4. **统一响应格式**：`{ success: boolean, data: T, message: string }`
5. **数据库 JSON 存储**：SQLite 不支持原生 JSON 类型，使用 Text 列存 JSON 字符串

---

*本文档由 AI 助手自动生成，作为项目交接的完整上下文参考。在新服务器开始新的 CodeBuddy 对话时，可以将本文档作为第一条消息发送给 AI，帮助它快速了解项目全貌。*
