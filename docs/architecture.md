# IELTS-mate 系统架构文档

> 最后更新：2026-02-17

## 1. 系统总览

IELTS-mate 是一款面向中国雅思备考生的 **免费开源桌面端应用**，采用 BYOK (Bring Your Own Key) 模式，聚焦词汇记忆、写作批改、口语模考三大核心模块。

### 1.1 技术选型确认

| 层级 | 技术方案 | 备注 |
|------|---------|------|
| 桌面框架 | Electron | 跨平台 (Win/Mac/Linux) |
| 前端框架 | React 19 + TypeScript | 使用 electron-vite 构建 |
| 状态管理 | Zustand | 轻量级、简洁 |
| UI 样式 | Tailwind CSS 4 | 原子化 CSS |
| 数据可视化 | Apache ECharts | 热力图、折线图、饼图等 |
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
│  │  - 窗口管理    │                │  - UI 渲染         │ │
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
│       │   │   ├── ui/                # 基础 UI 组件 (Button, Modal, Input...)
│       │   │   ├── layout/            # 布局组件 (Sidebar, Header, PageContainer)
│       │   │   └── charts/            # ECharts 封装组件
│       │   │       ├── Heatmap.tsx     # 学习热力图
│       │   │       ├── LineChart.tsx   # 折线图
│       │   │       └── WritingChart.tsx # 写作模块图表 (饼图/柱状图/折线图)
│       │   │
│       │   ├── pages/                 # 页面组件
│       │   │   ├── Dashboard/         # 首页仪表盘
│       │   │   │   └── index.tsx
│       │   │   ├── Settings/          # BYOK 设置页
│       │   │   │   ├── index.tsx
│       │   │   │   ├── ApiKeyForm.tsx
│       │   │   │   └── ProviderConfig.tsx
│       │   │   ├── Vocabulary/        # 单词记忆模块
│       │   │   │   ├── index.tsx
│       │   │   │   ├── FlashCard.tsx   # 闪卡组件
│       │   │   │   ├── ReviewPanel.tsx # 复习面板 (Easy/Good/Hard/Again)
│       │   │   │   └── StatsView.tsx   # 统计可视化
│       │   │   ├── Writing/           # 写作批改模块
│       │   │   │   ├── index.tsx
│       │   │   │   ├── TopicGenerator.tsx  # 题目生成
│       │   │   │   ├── Editor.tsx          # 写作编辑器
│       │   │   │   ├── ScoreReport.tsx     # 评分报告
│       │   │   │   └── HistoryList.tsx     # 历史记录
│       │   │   └── Speaking/          # 口语模考模块
│       │   │       ├── index.tsx
│       │   │       ├── ChatMode.tsx    # 闲聊模式
│       │   │       ├── MockTest.tsx    # 模考模式
│       │   │       ├── Timer.tsx       # 计时器组件
│       │   │       ├── AudioControl.tsx # 音频控制 (PTT/VAD)
│       │   │       └── SpeakingReport.tsx # 口语报告
│       │   │
│       │   ├── hooks/                 # 自定义 Hooks
│       │   │   ├── useWebSocket.ts    # WebSocket 连接管理
│       │   │   ├── useAudioRecorder.ts # 音频录制
│       │   │   ├── useTimer.ts        # 计时器
│       │   │   └── useApi.ts          # API 请求封装
│       │   │
│       │   ├── services/              # API 服务层
│       │   │   ├── api.ts             # Axios 实例与拦截器
│       │   │   ├── vocabulary.ts      # 词汇模块 API
│       │   │   ├── writing.ts         # 写作模块 API
│       │   │   ├── speaking.ts        # 口语模块 API (WS)
│       │   │   └── settings.ts        # 设置 API
│       │   │
│       │   ├── store/                 # Zustand 状态管理
│       │   │   ├── useSettingsStore.ts # 全局设置/API Key 状态
│       │   │   ├── useVocabStore.ts   # 词汇模块状态
│       │   │   ├── useWritingStore.ts # 写作模块状态
│       │   │   └── useSpeakingStore.ts # 口语模块状态
│       │   │
│       │   ├── types/                 # TypeScript 类型定义
│       │   │   ├── vocabulary.ts
│       │   │   ├── writing.ts
│       │   │   ├── speaking.ts
│       │   │   └── settings.ts
│       │   │
│       │   ├── utils/                 # 工具函数
│       │   │   ├── format.ts          # 格式化工具
│       │   │   └── constants.ts       # 常量定义
│       │   │
│       │   ├── App.tsx                # 根组件
│       │   ├── router.tsx             # 路由配置
│       │   ├── main.tsx               # 渲染入口
│       │   └── index.css              # 全局样式 (Tailwind)
│       │
│       └── index.html                 # HTML 模板
│
├── backend/                           # Python FastAPI 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI 入口 & 启动配置
│   │   │
│   │   ├── api/                       # API 路由层
│   │   │   ├── __init__.py
│   │   │   ├── deps.py                # 依赖注入 (DB session 等)
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       ├── settings.py        # 设置相关路由
│   │   │       ├── vocabulary.py      # 词汇 CRUD 路由
│   │   │       ├── writing.py         # 写作提交/评估路由
│   │   │       └── speaking.py        # 口语 WebSocket 路由
│   │   │
│   │   ├── core/                      # 核心配置
│   │   │   ├── __init__.py
│   │   │   ├── config.py              # 应用配置 (端口、数据库路径等)
│   │   │   └── database.py            # SQLite 异步数据库连接
│   │   │
│   │   ├── models/                    # SQLAlchemy ORM 模型
│   │   │   ├── __init__.py
│   │   │   ├── vocabulary.py          # 词汇表模型
│   │   │   ├── writing.py             # 写作记录模型
│   │   │   ├── speaking.py            # 口语会话模型
│   │   │   └── settings.py            # 设置模型
│   │   │
│   │   ├── schemas/                   # Pydantic 数据校验模型
│   │   │   ├── __init__.py
│   │   │   ├── vocabulary.py
│   │   │   ├── writing.py
│   │   │   ├── speaking.py
│   │   │   └── settings.py
│   │   │
│   │   ├── services/                  # 业务逻辑层
│   │   │   ├── __init__.py
│   │   │   ├── llm/                   # LLM 适配器 (策略模式)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py            # 抽象基类
│   │   │   │   └── openai_compatible.py # OpenAI 兼容适配器
│   │   │   ├── stt/                   # STT 适配器
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py            # 抽象基类
│   │   │   │   └── openai_whisper.py  # OpenAI Whisper 实现
│   │   │   ├── tts/                   # TTS 适配器
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py            # 抽象基类
│   │   │   │   └── openai_tts.py      # OpenAI TTS 实现
│   │   │   ├── sm2.py                 # SM-2 间隔重复算法
│   │   │   ├── vocabulary_service.py  # 词汇业务逻辑
│   │   │   ├── writing_service.py     # 写作业务逻辑
│   │   │   ├── writing_agents.py      # 5-Agent 并行评估引擎
│   │   │   ├── speaking_service.py    # 口语业务逻辑
│   │   │   └── memory.py             # 滑动窗口+阶段摘要 记忆管理
│   │   │
│   │   └── utils/                     # 工具函数
│   │       ├── __init__.py
│   │       └── prompt_templates.py    # Prompt 模板管理
│   │
│   ├── data/                          # 静态数据
│   │   └── vocabulary_mock.json       # 模拟词汇数据 (开发阶段)
│   │
│   ├── tests/                         # 测试
│   │   ├── __init__.py
│   │   ├── test_sm2.py
│   │   ├── test_writing_agents.py
│   │   └── test_speaking.py
│   │
│   ├── requirements.txt               # Python 依赖
│   └── pyproject.toml                 # Python 项目配置
│
├── resources/                         # 应用资源 (图标等)
│   └── icon.png
│
├── docs/                              # 工程文档
│   ├── architecture.md                # 架构文档 (本文件)
│   ├── api-spec.md                    # API 规格文档
│   └── development-guide.md           # 开发指南
│
├── .gitignore
├── package.json                       # 前端依赖 & Electron 配置
├── pnpm-lock.yaml
├── electron.vite.config.ts            # electron-vite 构建配置
├── electron-builder.yml               # electron-builder 打包配置
├── tsconfig.json                      # TypeScript 根配置
├── tsconfig.node.json                 # Node (主进程) TS 配置
├── tsconfig.web.json                  # Web (渲染进程) TS 配置
├── tailwind.config.js                 # Tailwind CSS 配置
├── postcss.config.js                  # PostCSS 配置
├── prd.md                             # 产品需求文档
└── README.md                          # 项目说明
```

## 3. Electron 主进程设计

### 3.1 Python 子进程生命周期管理

`python-manager.ts` 是整个架构的核心桥梁，负责：

1. **启动阶段**：
   - 扫描并分配一个随机可用的 localhost 端口
   - 根据环境判断 Python 可执行文件路径：
     - **开发环境**：直接调用 `python` 命令运行 `backend/app/main.py`
     - **生产环境**：调用 PyInstaller 打包后的 `backend.exe` / `backend`
   - 将端口号通过命令行参数传递给 Python 进程
   - 通过 health check 轮询 (`GET /health`) 确认服务已就绪
   - 将端口号通过 IPC 通知渲染进程

2. **运行阶段**：
   - 监听 Python 子进程的 `stdout`/`stderr` 输出
   - 如果 Python 进程意外崩溃，尝试自动重启（最多 3 次）

3. **关闭阶段 (Graceful Shutdown)**：
   - 监听 Electron `before-quit` 事件
   - 先发送 `SIGTERM` 信号给 Python 进程
   - 等待最多 5 秒让 FastAPI 优雅关闭
   - 超时后强制 `SIGKILL`

### 3.2 IPC 通信设计

| 通道名称 | 方向 | 用途 |
|---------|------|------|
| `python:port` | Main → Renderer | 通知 Python 服务端口号 |
| `python:status` | Main → Renderer | Python 服务状态 (starting/ready/error/stopped) |
| `python:restart` | Renderer → Main | 请求重启 Python 服务 |
| `app:get-path` | Renderer → Main | 获取应用数据目录路径 |

## 4. 核心模块设计

### 4.1 单词记忆模块 (Vocabulary)

#### SM-2 算法核心参数

```python
class SM2Result:
    interval: int       # 下次复习间隔天数
    repetition: int     # 连续正确次数
    ease_factor: float  # 简易度系数 (最低 1.3)
    next_review: date   # 下次复习日期
```

#### 用户反馈映射

| 按钮 | quality 值 | 含义 |
|------|-----------|------|
| Again (忘记) | 0 | 完全不记得，重置 |
| Hard (困难) | 2 | 勉强记得，缩短间隔 |
| Good (认识) | 3 | 正确回忆，正常间隔 |
| Easy (简单) | 5 | 毫不费力，延长间隔 |

#### 数据流

```
用户点击反馈按钮
    → 前端发送 POST /api/vocabulary/{id}/review {quality: N}
    → SM-2 算法计算新的 interval / repetition / ease_factor
    → 更新 SQLite 记录
    → 返回下一张待复习卡片
```

### 4.2 写作批改模块 (Writing - 5-Agent 架构)

#### 评估工作流

```
用户提交作文 (POST /api/writing/evaluate)
         │
         ▼
    Main Agent (Chief Examiner)
         │
         ├── asyncio.gather ──────────────────────┐
         │                                         │
    ┌────▼────┐ ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
    │Agent-TR │ │Agent-CC │ │Agent-LR │ │Agent-GRA│
    │任务回应  │ │连贯衔接  │ │词汇资源  │ │语法范围  │
    │         │ │         │ │         │ │& 准确性  │
    └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
         │           │           │            │
         │  每个 Agent 独立评分 (JSON)          │
         │  失败时最多重试 3 次                  │
         │           │           │            │
         └───────────┴───────────┴────────────┘
                          │
                          ▼
              Main Agent 汇总计算均分
              生成 Markdown 综合报告
              (含重写建议和范文)
```

#### 各 Agent 输出 JSON Schema

```json
{
  "criterion": "TR | CC | LR | GRA",
  "score": 6.5,            // 0-9 分
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."],
  "detailed_annotations": [
    {
      "text": "原文片段",
      "issue": "问题描述",
      "suggestion": "修改建议"
    }
  ]
}
```

### 4.3 口语模考模块 (Speaking)

#### 状态机设计 (Mock Test Mode)

```
[IDLE] ──开始模考──► [PART1_INTRO]
                         │
                    考官破冰提问
                         │
                         ▼
                    [PART1_QA] ◄──── PTT/VAD 交互
                         │
                    完成所有问题
                         │
                    后台静默生成 Part1 摘要
                         │
                         ▼
                    [PART2_PREP] ──── 1 分钟准备倒计时
                         │
                         ▼
                    [PART2_SPEAK] ── 2 分钟答题
                         │           ├─ 90s 提醒
                         │           ├─ 110s 提醒
                         │           ├─ 120s 提醒
                         │           └─ 130s 强制中断
                         │
                         ▼
                    [PART3_DISCUSSION] ◄── 深度追问
                         │
                    结束对话
                         │
                         ▼
                    [REPORT_GENERATING]
                         │
                         ▼
                    [COMPLETED] ── 展示 Markdown 报告
```

#### WebSocket 消息协议

```typescript
// 客户端 → 服务端
type ClientMessage =
  | { type: 'audio_chunk', data: base64string }    // 音频数据块
  | { type: 'user_action', action: 'start' | 'stop' | 'end_early' }
  | { type: 'mode_switch', mode: 'ptt' | 'vad' }

// 服务端 → 客户端
type ServerMessage =
  | { type: 'transcription', text: string, is_final: boolean }  // STT 结果
  | { type: 'ai_text', text: string, is_final: boolean }        // LLM 文本流
  | { type: 'ai_audio', data: base64string }                    // TTS 音频流
  | { type: 'state_change', state: SpeakingState }               // 状态切换
  | { type: 'timer', seconds_remaining: number, phase: string }  // 计时器
  | { type: 'error', message: string }
```

#### 认知记忆架构 (滑动窗口 + 阶段摘要)

```
对话历史管理策略：

Part 1 对话中：
  [System Prompt] + [最近 N 轮对话] (滑动窗口，N=10)

Part 1 → Part 2 转场：
  1. 触发静默 LLM 调用生成 Part 1 摘要
  2. 摘要包含：用户个人信息、表现特点、提及的话题

Part 2/3 的 System Prompt：
  [Base System Prompt]
  + [Part 1 摘要]           ← 注入历史上下文
  + [最近 N 轮对话]         ← 滑动窗口
```

## 5. 数据库 Schema 设计

### 5.1 settings 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| key | TEXT UNIQUE | 配置键名 |
| value | TEXT | 配置值 (加密存储敏感信息) |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 5.2 vocabulary 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| word | TEXT NOT NULL | 单词 |
| phonetic | TEXT | 音标 |
| definition | TEXT | 释义 |
| example | TEXT | 例句 |
| interval | INTEGER DEFAULT 0 | SM-2: 间隔天数 |
| repetition | INTEGER DEFAULT 0 | SM-2: 重复次数 |
| ease_factor | REAL DEFAULT 2.5 | SM-2: 简易度系数 |
| next_review | DATE | 下次复习日期 |
| status | TEXT DEFAULT 'new' | 状态: new/learning/mastered |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 5.3 writing_sessions 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| task_type | TEXT | 'part_a' 或 'part_b' |
| topic | TEXT | 题目内容 |
| topic_data | TEXT (JSON) | Part A 的图表数据 JSON |
| user_essay | TEXT | 用户作文 |
| score_tr | REAL | TR 分数 |
| score_cc | REAL | CC 分数 |
| score_lr | REAL | LR 分数 |
| score_gra | REAL | GRA 分数 |
| overall_score | REAL | 综合分数 |
| report | TEXT | Markdown 评估报告 |
| created_at | DATETIME | 创建时间 |

### 5.4 speaking_sessions 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| mode | TEXT | 'chat' 或 'mock_test' |
| topic | TEXT | 话题 |
| transcript | TEXT (JSON) | 完整对话记录 JSON |
| part1_summary | TEXT | Part 1 阶段摘要 |
| report | TEXT | Markdown 口语报告 |
| duration_seconds | INTEGER | 会话时长 |
| created_at | DATETIME | 创建时间 |

### 5.5 daily_stats 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| date | DATE UNIQUE | 日期 |
| words_reviewed | INTEGER DEFAULT 0 | 复习单词数 |
| words_new | INTEGER DEFAULT 0 | 新学单词数 |
| words_mastered | INTEGER DEFAULT 0 | 当日掌握数 |
| writing_count | INTEGER DEFAULT 0 | 写作练习数 |
| speaking_minutes | INTEGER DEFAULT 0 | 口语练习分钟数 |

## 6. AI 服务适配层设计

采用 **策略模式 (Strategy Pattern)**，为 LLM / STT / TTS 设计统一的抽象接口：

```
┌──────────────┐
│  BaseLLM     │  (抽象基类)
│  + chat()    │
│  + stream()  │
└──────┬───────┘
       │
       ├── OpenAICompatibleLLM   ← 支持所有 OpenAI 格式 API
       │                            (OpenAI / DeepSeek / 通义 / 代理池)
       └── (未来可扩展)

┌──────────────┐
│  BaseSTT     │  (抽象基类)
│  + transcribe()
└──────┬───────┘
       │
       ├── OpenAIWhisperSTT
       ├── AzureSTT
       └── (未来可扩展)

┌──────────────┐
│  BaseTTS     │  (抽象基类)
│  + synthesize()
└──────┬───────┘
       │
       ├── OpenAITTS
       ├── AzureTTS
       └── (未来可扩展)
```

## 7. 安全性考虑

1. **API Key 存储**：使用 SQLite 存储，敏感字段通过本地机器密钥加密
2. **Electron 安全**：
   - 启用 `contextIsolation: true`
   - 启用 `sandbox: true`
   - 禁用 `nodeIntegration`
   - 通过 `preload` 暴露最小化的 API
3. **网络安全**：Python 服务仅绑定 `127.0.0.1`，不对外暴露

## 8. 打包与分发策略

### 开发环境

```
pnpm dev  →  同时启动 electron-vite (前端热更新) + Python FastAPI (uvicorn --reload)
```

### 生产环境

1. **Python 后端**：PyInstaller 打包为单文件可执行程序
   - Windows: `backend.exe`
   - macOS: `backend` (universal binary)
   - Linux: `backend`

2. **Electron 前端**：electron-builder 打包
   - 将 PyInstaller 产物作为 extraResources 嵌入
   - Windows: `.exe` (NSIS installer)
   - macOS: `.dmg`
   - Linux: `.AppImage`
