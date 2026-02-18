# IELTS-mate 系统架构文档

> 最后更新：2026-02-18

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
| 数据可视化 | Apache ECharts | 热力图、折线图、饼图等 |
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
│       │   │   ├── Settings/          # BYOK 设置页
│       │   │   │   └── index.tsx
│       │   │   ├── Vocabulary/        # 单词记忆模块
│       │   │   │   ├── Hub.tsx         # 词汇中心
│       │   │   │   ├── Review.tsx      # 沉浸复习页
│       │   │   │   └── FlashCard.tsx   # 玻璃质感闪卡
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
│       │   │   └── ...
│       │   │
│       │   ├── store/                 # Zustand 状态管理
│       │   │   ├── useSettingsStore.ts # 全局设置/API Key 状态
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

## 4. 核心模块设计 (保持不变)

...

## 5. 数据库 Schema 设计 (保持不变)

...

## 6. AI 服务适配层设计 (保持不变)

...

## 7. 安全性考虑 (保持不变)

...

## 8. 打包与分发策略 (保持不变)

...
