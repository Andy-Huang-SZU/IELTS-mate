# IELTS-mate 项目交接文档

> **创建日期**：2026-03-09
> **用途**：在新服务器上为 CodeBuddy AI 提供完整的项目上下文，确保无缝继续开发

---

## 一、项目概述

IELTS-mate 是一款**面向中国雅思备考生的免费开源桌面端应用**，采用 BYOK (Bring Your Own Key) 模式，聚焦三大核心模块：

1. **词汇记忆** (Vocabulary) — ✅ 已完成
2. **写作批改** (Writing) — ⚠️ 部分完成，待继续
3. **口语模考** (Speaking) — 🔲 仅骨架

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
│   │   │   ├── __init__.py           # 导出 Setting, Vocabulary, WritingSession
│   │   │   ├── settings.py
│   │   │   ├── vocabulary.py
│   │   │   └── writing.py            # WritingSession 表
│   │   ├── schemas/                  # Pydantic Schema
│   │   │   ├── settings.py
│   │   │   ├── vocabulary.py
│   │   │   └── writing.py
│   │   ├── services/                 # 业务逻辑
│   │   │   ├── settings_service.py
│   │   │   ├── vocabulary_service.py # (含首次启动词汇导入)
│   │   │   ├── writing_service.py    # 写作业务 (题目生成、AI评估、历史管理)
│   │   │   ├── sm2.py               # SM-2 间隔重复算法
│   │   │   └── llm/                  # LLM 集成
│   │   │       ├── base.py           # BaseLLMClient 抽象类 (含 chat() 方法)
│   │   │       ├── factory.py        # LLM 客户端工厂
│   │   │       └── openai_compatible.py  # OpenAI 兼容 API 实现 (httpx)
│   │   └── api/
│   │       ├── __init__.py           # 路由汇总
│   │       └── routes/
│   │           ├── settings.py       # /api/settings/*
│   │           ├── vocabulary.py     # /api/vocabulary/*
│   │           └── writing.py        # /api/writing/*
│   └── data/
│       ├── ielts_mate.db             # SQLite 数据库
│       └── ielts_vocabulary.json     # IELTS 词汇库 (3MB, 基于 ECDICT)
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
│       │   │   ├── Hub.tsx           # 词汇中心
│       │   │   ├── Learn.tsx         # 学习模式 (四选一 Quiz)
│       │   │   ├── Review.tsx        # 复习模式 (SM-2 卡片)
│       │   │   └── SessionComplete.tsx
│       │   ├── Writing/              # 写作模块 ⚠️
│       │   │   ├── Hub.tsx           # 写作中心
│       │   │   ├── Editor.tsx        # 写作编辑器
│       │   │   └── Report.tsx        # 批改报告
│       │   └── Speaking/             # 口语模块 🔲
│       │       └── Hub.tsx           # 仅入口页
│       ├── services/                 # API 服务层
│       │   ├── settings.ts
│       │   ├── vocabulary.ts
│       │   └── writing.ts
│       └── store/
│           ├── useSettingsStore.ts
│           └── useVocabularyStore.ts
│
├── docs/                             # 项目文档
│   ├── api-spec.md                   # API 规格文档
│   ├── architecture.md               # 系统架构文档
│   ├── development-guide.md          # 开发指南
│   ├── frontend-design-new.md        # 前端设计规范
│   └── frontend-pages.md             # 页面规格
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
| `/vocabulary/stats` | PlaceholderPage | 🔲 未实现 |
| `/writing` | WritingHub | ✅ 已实现 |
| `/writing/editor` | WritingEditor | ✅ 已实现 |
| `/writing/report/:id` | WritingReport | ✅ 已实现 |
| `/writing/history` | PlaceholderPage | 🔲 未实现 |
| `/speaking` | SpeakingHub | ⚠️ 仅入口 UI |
| `/speaking/chat` | PlaceholderPage | 🔲 未实现 |
| `/speaking/mock` | PlaceholderPage | 🔲 未实现 |
| `/speaking/history` | PlaceholderPage | 🔲 未实现 |
| `/settings` | SettingsPage | ✅ 已实现 |

---

## 五、各模块完成状态

### 1. 词汇模块 (Vocabulary) — ✅ 完成

**功能**：
- Hub 页：词汇中心，进入学习/复习的入口
- Learn 模式：新词学习，四选一 Quiz 交互
- Review 模式：基于 SM-2 间隔重复算法的复习卡片
- SessionComplete 页：学习/复习完成统计
- 后端完整的 CRUD + SM-2 算法服务
- 基于 ECDICT 提取的 3MB IELTS 词汇库

### 2. 写作模块 (Writing) — ⚠️ 基础框架已完成，还需继续

**已完成的部分**：
- 后端 WritingSession 数据模型 + 4 个 API 端点
- 后端 LLM `chat()` 方法（httpx，120s 超时）
- 后端写作服务（题目生成、AI 评估、历史管理）
- 前端 API 服务层 (`services/writing.ts`)
- 前端 Writing Editor 页面（题目展示 + 写作区 + 提交批改）
- 前端 Writing Report 页面（总分 + 四维评分 + 优劣势 + 标注）
- 前端 Writing Hub 页面（Task 1/2 入口 + 历史列表）

**API 端点**：
| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/writing/generate-topic` | AI 生成 Task 1(含图表 JSON)/Task 2 题目 |
| POST | `/api/writing/evaluate` | AI 批改作文 (四维评分+报告+标注) |
| GET | `/api/writing/sessions` | 写作历史列表 (分页+按类型筛选) |
| GET | `/api/writing/sessions/{id}` | 单次写作详情 |

**评估维度**：TR (Task Response)、CC (Coherence & Cohesion)、LR (Lexical Resource)、GRA (Grammatical Range)

**写作评估技术决策**：
- 当前采用**单次 LLM 调用 + 结构化 JSON Prompt** 方案（而非 PRD 要求的 5-Agent 并行架构）
- 原因：减少 API 调用次数和延迟、简化实现复杂度
- PRD 要求的完整 5-Agent 架构（4 个评分 Agent + 1 个主考官 Agent，asyncio.gather 并行）是后续迭代方向

### 3. 口语模块 (Speaking) — 🔲 仅骨架

- 前端只有 Hub.tsx（Free Chat / Mock Test 两个入口卡片）
- 后端仅有 WebSocket echo 端点 (`/api/speaking/ws`)
- 所有子页面 (chat/mock/history) 都是 Placeholder

### 4. 设置模块 (Settings) — ✅ 完成

- LLM Provider 配置（provider、API Key、Base URL、Model）
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

## 八、🔴 下一步重要待办：写作模块 — 资料准备阶段

> **这是迁移后最优先的工作**

### 8.1 背景

写作模块的基础框架（Editor、Report、Hub + 后端 API）已经在上面的 commit `284039b` 中实现完成。但这只是"能跑通"的初始版本。接下来需要进入**资料准备阶段**，为写作模块注入高质量的内容和数据，让它从"能用"变成"好用"。

### 8.2 PRD 中写作模块的完整要求 vs 当前实现的差距

| PRD 要求 | 当前状态 | 待办 |
|----------|----------|------|
| **Task 1 (小作文)**：AI 生成 JSON 数据，前端用 ECharts 渲染饼图/折线图/柱状图 | ⚠️ 当前 Editor.tsx 内有简易 SVG 图表渲染，未使用 ECharts | 需要升级为 ECharts 渲染 |
| **Task 2 (大作文)**：标准文本 Prompt 题目 | ✅ 已实现 | — |
| **5-Agent 并行评估引擎**：4 个子 Agent (TR/CC/LR/GRA) + 1 个主考官 Agent，asyncio.gather 并行，含重试机制 | ⚠️ 当前是单次 LLM 调用 + JSON Prompt | 需要重构为 5-Agent 架构 |
| **主考官生成综合报告**：含重写建议和范文 | ⚠️ 当前报告无范文 | 需要补充 |

### 8.3 资料准备工作清单

以下是需要准备的资料和数据，分为几个类别：

#### A. 写作题目库

**目标**：建立一个结构化的雅思写作题目数据库，而不是每次都依赖 LLM 实时生成。

1. **Task 2 (大作文) 题目集**：
   - 收集/整理真实雅思考试题目（按类型分类：Opinion、Discussion、Advantage/Disadvantage、Problem/Solution、Two-part Question）
   - 每个题目需要包含：题目文本、题目类型、难度级别、相关话题标签
   - 数据格式建议：JSON 文件，存放在 `backend/data/writing_topics.json`

2. **Task 1 (小作文) 题目集 + 图表数据**：
   - 需要准备结构化的图表数据 JSON（柱状图/折线图/饼图/表格）
   - 每个题目包含：题目描述文本 + `chart_type` + `chart_data`（categories、series、unit）
   - 这部分可以人工创建或让 LLM 批量生成后人工校验

#### B. 评估 Prompt 工程

**目标**：设计高质量的 System Prompt，确保 AI 评估结果专业、准确、有参考价值。

3. **四维评估 Prompt 模板**：
   - 为 TR、CC、LR、GRA 四个维度分别设计专业的评估 Prompt
   - 每个 Prompt 需要参考雅思官方评分标准（Band Descriptors）
   - 明确输出格式要求（JSON Schema）
   - 当前的评估 Prompt 在 `backend/app/services/writing_service.py` 的 `evaluate_essay()` 中，需要优化

4. **雅思官方评分标准 (Band Descriptors)**：
   - 收集 IELTS 官方的 Task 1 和 Task 2 评分标准文本
   - 将 Band 5-9 的每个维度的描述整理为结构化数据
   - 用于 Prompt 中作为评分参考基准

5. **范文库**：
   - 收集不同分数段（Band 5/6/7/8/9）的示范作文
   - 按题目类型分类
   - 用于主考官 Agent 生成"重写建议和范文"时的参考

#### C. 升级为 5-Agent 并行架构

**目标**：将当前单次 LLM 调用重构为 PRD 要求的多 Agent 并行架构。

6. **Agent 架构设计**：
   - 4 个评分 Agent（TR/CC/LR/GRA）各自独立调用 LLM
   - 使用 `asyncio.gather` 并行执行
   - 每个 Agent 有独立的 System Prompt 和输出 JSON Schema
   - 主考官 Agent 汇总 4 个子 Agent 的结果，计算均分，生成 Markdown 报告
   - 需要实现重试机制：如果子 Agent 返回损坏 JSON，最多重试 3 次

7. **前端 Report 页面增强**：
   - 当前 Report 已支持四维评分显示
   - 需要新增：范文对比区域、重写建议区域
   - 可能需要增强详细标注的交互（hover tooltip）

#### D. Task 1 图表渲染升级

8. **ECharts 图表渲染**：
   - 当前 Editor.tsx 使用简易 SVG 渲染图表
   - 需要替换为 ECharts（项目已安装 echarts 6.0.0 依赖）
   - 支持柱状图、折线图、饼图三种类型
   - 需要确保图表数据格式与后端 `chart_data` JSON 对齐

### 8.4 建议的执行顺序

```
1. 📋 收集/整理雅思写作评分标准 (Band Descriptors)
   ↓
2. ✍️ 设计四个维度的专业评估 Prompt
   ↓
3. 🏗️ 重构后端为 5-Agent 并行架构 + 重试机制
   ↓
4. 📚 准备题目库数据 (Task 1 + Task 2)
   ↓
5. 📊 升级 Task 1 图表渲染为 ECharts
   ↓
6. 📝 收集范文库，增强主考官报告（含范文+重写建议）
   ↓
7. 🖼️ 前端 Report 页面增强
```

### 8.5 关键文件参考

在开始资料准备工作时，需要重点查看这些文件：

| 文件 | 路径 | 需要做什么 |
|------|------|-----------|
| **writing_service.py** | `backend/app/services/writing_service.py` | 当前的评估逻辑和 Prompt，需要重构为 5-Agent |
| **writing.py (schemas)** | `backend/app/schemas/writing.py` | 可能需要扩展 schema 以支持新的数据结构 |
| **writing.py (routes)** | `backend/app/api/routes/writing.py` | API 端点可能需要调整 |
| **writing.ts** | `src/renderer/src/services/writing.ts` | 前端 API 类型定义 |
| **Editor.tsx** | `src/renderer/src/pages/Writing/Editor.tsx` | 图表渲染升级 |
| **Report.tsx** | `src/renderer/src/pages/Writing/Report.tsx` | 报告页增强 |
| **prd.md** | 项目根目录 | 完整的产品需求，特别是第 4 节写作模块 |

### 8.6 当前 writing_service.py 中的评估 Prompt 概要

当前 `evaluate_essay()` 使用**单次 LLM 调用**，System Prompt 要求 LLM 一次性输出包含以下结构的 JSON：
```json
{
  "scores": { "tr": 6.5, "cc": 6.0, "lr": 7.0, "gra": 6.0, "overall": 6.5 },
  "agent_reports": {
    "tr": { "criterion": "Task Response", "score": 6.5, "strengths": [...], "weaknesses": [...], "suggestions": [...], "detailed_annotations": [...] },
    "cc": { ... },
    "lr": { ... },
    "gra": { ... }
  },
  "report_markdown": "## 综合评估报告\n..."
}
```

这需要被重构为 4 个独立的 Agent 调用 + 1 个主考官汇总调用。

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
