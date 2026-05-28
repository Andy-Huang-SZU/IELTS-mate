# IELTS-mate 开发指南

> 最后更新：2026-03-24

## 1. 环境要求

### 1.1 必需软件

| 软件 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | 20 LTS | 前端 & Electron 运行时 |
| pnpm / npm | 9.x / 10.x | 前端包管理器（pnpm 优先，CVM 上可用 npm 替代） |
| Python | 3.11+ | 后端运行时 |
| Conda | - | Python 虚拟环境管理 (本地使用 `dl` 环境) |
| Git | 2.x | 版本控制 |

### 1.2 推荐 IDE

- **CodeBuddy / Cursor** (主力 IDE，支持 AI 辅助开发)
- VS Code 插件推荐：ESLint, Prettier, Tailwind CSS IntelliSense, Python

### 1.3 开发环境概述

本项目支持两种开发环境，各有特点：

| 对比项 | 本地开发 (Windows/Mac) | CVM 云服务器 (Linux, 无 GUI) |
|--------|----------------------|---------------------------|
| Electron GUI | ✅ 可正常显示窗口 | ❌ 无 GUI，无法启动 Electron 窗口 |
| `pnpm dev` | ✅ 一键启动全栈 | ⚠️ Electron 主进程会因缺少 GUI 失败退出 |
| 前端 UI 预览 | 通过 Electron 窗口查看 | 需使用 **Vite 独立预览模式**（见 2.5 节） |
| 后端 Python | 由 Electron 自动拉起 | 需**手动启动** FastAPI 服务 |
| 适合做什么 | 全功能联调、最终测试 | **前端 UI/样式开发**、后端 API 开发 |

## 2. 快速开始

### 2.1 克隆仓库

```bash
git clone https://github.com/your-org/IELTS-mate.git
cd IELTS-mate
```

### 2.2 前端环境搭建

```bash
# 安装前端依赖 (包含 React, Electron, Flux UI 相关库)
pnpm install
# 或在 CVM 上无 pnpm 时使用:
# npm install

# 安装 Flux Academy 风格核心依赖 (若未包含)
pnpm add framer-motion lucide-react clsx tailwind-merge
```

若网络环境导致 Electron 二进制下载缓慢，可临时使用镜像后重装 Electron：

```bash
# Windows PowerShell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
pnpm rebuild electron

# Linux/Mac bash
ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/' pnpm rebuild electron
```

### 2.3 后端环境搭建

```bash
# 激活 conda 虚拟环境
conda activate dl

# 安装 Python 依赖
pip install -r backend/requirements.txt
```

若本机尚未执行 `conda init` 导致 `conda activate` 不可用，可临时改用：

```bash
conda run -n dl pip install -r backend/requirements.txt
```

> 为避免不同终端（PowerShell/cmd）环境变量语法差异，`backend/tests/smoke_step2.py` 已支持自动处理导入路径，无需手动设置 `PYTHONPATH`。

### 2.4 本地启动（有 GUI 环境）

```bash
# 一键启动 (Electron + React 热更新 + Python FastAPI)
pnpm dev
```

该命令会同时启动：
1. **electron-vite dev server**：React 前端热更新 + Electron 主进程
2. **Python FastAPI**：由 Electron 主进程自动拉起（开发模式下使用 `uvicorn --reload`）

> **注意**：开发模式下，Electron 主进程会自动启动 `dl` 环境中的 Python。可通过环境变量 `BACKEND_PYTHON_PATH` 显式指定解释器路径（例如 `E:\\apps\\anaconda3\\envs\\dl\\python.exe`），以避免 shell hook 差异导致的 `conda activate` 问题。

### 2.5 CVM 云服务器启动（无 GUI 环境）

在 CVM 等无桌面环境的 Linux 服务器上，**无法使用 `pnpm dev`**（Electron 需要 GUI）。需按以下方式分别启动前端和后端：

#### 2.5.1 Node.js 版本管理（nvm）

CVM 上通常没有 sudo 权限安装全局包。使用 **nvm** 在用户目录下管理 Node 版本：

```bash
# 安装 nvm（仅首次）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# 加载 nvm（每个新终端都需要）
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"

# 安装并使用 Node 20
nvm install 20
nvm use 20
```

> **提示**：将 nvm 加载命令写入 `~/.bashrc` 后，新终端会自动加载。

#### 2.5.2 前端预览（Vite 独立模式）

项目根目录下提供了 `vite.preview.config.ts`，用于**绕过 Electron 单独启动 React 前端**：

```bash
# 确保使用 Node 20+
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20

# 安装依赖（首次或 package.json 有变更时）
npm install

# 启动独立 Vite 开发服务器
npx vite --config vite.preview.config.ts
```

启动后默认监听 `http://localhost:5173`，可通过 IDE 内置浏览器预览或端口转发到本地浏览器访问。

**Vite 独立模式 vs Electron 模式的区别**：

| 方面 | Vite 独立模式 | Electron 完整模式 |
|------|-------------|-----------------|
| 运行环境 | 纯浏览器 | Electron (Chromium + Node.js) |
| `window.electron` API | ❌ 不可用 | ✅ 可用（preload 注入） |
| UI/样式/布局开发 | ✅ 完全一致 | ✅ 完全一致 |
| 后端 API 调用 | ⚠️ 需手动启动后端并配置端口 | ✅ 自动管理 |
| 适用场景 | **前端 UI 美化、组件开发** | 完整功能联调 |

> **重要**：`vite.preview.config.ts` 仅用于开发预览，不会影响最终打包。打包时仍使用 `electron-vite build`。

#### 2.5.3 后端单独启动

```bash
# 进入后端目录
cd backend

# 使用 uvicorn 启动 FastAPI（热重载模式）
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> 前端需手动将 API 请求指向 `http://localhost:8000`（Vite 独立模式下 Electron IPC 不可用，需在前端 `services/api.ts` 中做回退处理）。

### 2.6 从本地迁移到 CVM 的注意事项

将本地项目复制到 CVM 时，请确保**不要**拷贝以下文件/目录（它们在 `.gitignore` 中已被忽略）：

```
node_modules/     # 依赖需在目标机器重新安装
out/              # Electron 构建产物
dist/             # 打包产物
backend/__pycache__/
backend/**/*.pyc
*.db / *.sqlite   # 运行时数据库（需要则手动迁移）
.env / .env.*     # 环境变量（含敏感信息）
```

推荐使用 `git clone` 而非直接复制文件夹，这样自然会忽略上述内容。

## 3. 项目脚本命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发环境 (Electron + Vite HMR) |
| `pnpm build` | 构建生产版本 (不打包) |
| `pnpm build:win` | 打包 Windows 安装程序 |
| `pnpm build:mac` | 打包 macOS dmg |
| `pnpm build:linux` | 打包 Linux AppImage |
| `pnpm lint` | 运行 ESLint 检查 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 运行前端测试 |
| `pnpm test:backend` | 运行 Python 后端测试 |

## 4. 开发工作流

### 4.1 分支管理

```
main                    ← 稳定发布分支
├── develop             ← 开发主分支
│   ├── feature/vocab   ← 词汇模块功能分支
│   ├── feature/writing ← 写作模块功能分支
│   ├── feature/speaking← 口语模块功能分支
│   └── fix/xxx         ← Bug 修复分支
```

### 4.2 开发顺序 (渐进式开发)

严格按照以下顺序逐步开发，每步完成后验证可行性：

**Phase 0 - 项目初始化**
- [x] 创建工程文档
- [x] 初始化 electron-vite 项目 (React + TypeScript)
- [x] 初始化 Python FastAPI 后端
- [x] 配置 Tailwind CSS
- [x] 创建基本目录结构

**Phase 1 - IPC 与通信基础**
- [x] 实现 `python-manager.ts` (Python 子进程管理)
- [x] 实现端口分配 (`port-finder.ts`)
- [x] 验证 Electron ↔ FastAPI REST 通信
- [x] 验证 WebSocket 连接
- [x] 实现 Graceful Shutdown

**Phase 2 - 全局基础设施 (Flux UI)**
- [x] 搭建 SQLite 数据库连接 (async)
- [x] 实现 Settings API (BYOK)
- [x] 实现 LLM 适配器 (OpenAI-compatible)
- [x] **[NEW] 实现 Flux UI 基础组件**：
  - `<FluidBackground />` (交互光斑)
  - `<GlassCard />` (陶瓷磨砂)
  - `<Dock />` (底部悬浮导航)
  - `<PageContainer />` (统一留白与最大宽度)
- [x] **[NEW] 搭建新版路由结构**
- [x] **[NEW] 实现 Settings 页 Flux 风格表单与 Test Connection**
- [x] **[NEW] 实现 Vocabulary Hub / Review、Writing Hub、Speaking Hub**

**Phase 3 - 词汇记忆模块**
- [x] 实现 SM-2 算法 (后端)
- [x] 词汇数据初始化 (JSON → SQLite)
- [x] 词汇核心复习 API (`GET /api/vocabulary/review`, `POST /api/vocabulary/{id}/review`)
- [x] ECDICT 雅思词汇清洗脚本 (5,038 词, 含难度分级/词性/多语释义)
- [x] 四选一干扰项 API (`GET /api/vocabulary/{id}/distractors`，支持 `mode=translation|word` 双向)
- [x] DEV 重置 API (`POST /api/vocabulary/reset`)
- [x] 前端 Vocabulary Service + Zustand Store (全栈联调)
- [x] 前端 Hub 页面 (双模式入口：复习 + 新词学习，每日新词上限调节器)
- [x] 前端 Review 页面 — 3D 翻转卡片自评模式 (认识/模糊/忘记了，SM2 quality 映射)
- [x] 前端 Learn 页面 — 四选一 Quiz + 双轮确认 (英→中 + 中→英，错词循环，4×1 布局)
- [x] 前端 SessionComplete 页面 (学习统计 + 操作按钮)
- [x] 新词 API (`GET /api/vocabulary/new-words`) + 今日摘要 API (`GET /api/vocabulary/today-summary`)
- [x] 词汇设置 API (`GET/PUT /api/settings/vocabulary`) + 前端 Settings 页词汇设置区
- [x] `first_learned_at` 字段 + 自动迁移 + 每日新词计数
- [x] ECharts 热力图 (适配光点风格, 后端 API 已就绪)
- [x] 拼写模式 / 听写模式
- [x] 正式词汇统计页（Stats.tsx — 连续天数 + 高频错词 + 活动趋势 + 核心概览）

**Phase 4 - 写作批改模块**
- [x] 设计四维评估 Prompt（注入 IELTS 官方 Band Descriptors）
- [x] 实现 5-Agent 并行架构 (后端) + 重试机制
- [x] 题目生成后端基础设施（Prompt 模板、题库服务、Token 预估、API 路由）
- [x] 新增 map（地图题）和 mixed（双图混合题）题型 (后端 Prompt + 校验)
- [x] combination → mixed 迁移（向后兼容）
- [x] 前端图表渲染组件体系（6 组件：ECharts + Table + Mermaid + D3Map + Mixed + 分发器）
- [x] Writing Hub 重构为三种模式入口（随机模拟/快速练习/自由选择）
- [x] Writing Editor 替换为 ChartRenderer + 换一题/AI 生成按钮
- [x] Settings Token 价格配置 UI
- [x] 统一题目 ID（`T1-BAR-0001` / `T2-OPINION-0001`）并完成现有题库重编号
- [x] 评分链路注入完整题目快照（topic_id / 结构化图表数据 / 题型 / 标签 / 难度 / 来源）
- [x] `writing_sessions` 增加 `topic_id` 持久化，并支持按题回查历史
- [x] Writing Report / Recent Essays 展示 `topic_id`，Report 支持回看 Task 1 图表快照
- [x] 使用 OpenAI SDK + DeepSeek 完成首批 20 道验证后继续扩库，并最终补齐完整 150 道题库
- [x] 完成题库去重与目标分布收敛（Task 1：22/18/12/12/12/10/9；Task 2：五种题型各 11 道）
- [x] 评分报告展示增强（结构化解析主考官 Markdown、范文/重写建议独立展示，并保留原始 Markdown 折叠查看）
- [x] Writing Hub 嵌入 Topic Browser（题库总览、筛选、搜索、分页、直达指定题目）
- [x] Writing History 页面（筛选、排序、评分缩略图、分页）
- [x] 同题重做链路（History / Report → Editor，优先复用题目快照）
- [x] 后端结构化报告解析器（writing_report_parser.py — 总评/范文/重写建议后端组装）
- [x] Report.tsx 优先消费后端 structured_report，保留前端 fallback
- [x] 按题聚合 API（GET /topics/aggregate — 练习次数/平均分/最佳分/最近分）
- [x] 按题趋势 API（GET /topics/{topic_id}/trend — 同题 attempts 时间序列）
- [x] History 升级为 Sessions / By Topic 双视图（含趋势图和按题卡片）

**Phase 5 - 口语模考模块**
- [x] 实现 STT/TTS 适配器（策略模式 + OpenAI Whisper/TTS 实现 + 工厂方法）
- [x] 实现口语状态机 (后端 SpeakingStateMachine，Part 1→2→3 流转 + asyncio 计时器)
- [x] 实现滑动窗口 + 阶段摘要记忆 (SpeakingMemory，8 轮滑动窗口 + Part 1 摘要注入)
- [x] WebSocket 实时通信 (SpeakingSessionHandler，消息协调 + STT/TTS/LLM 管线)
- [x] 前端录音 & 波形可视化 UI (useAudioRecorder + AudioVisualizer Canvas 组件)
- [x] 计时器 & 视觉提醒 (useTimer + TimerDisplay SVG 环形进度 + 警报色)
- [x] 口语报告生成 (4-Agent 并行评估 FC/LR/GRA/Pronunciation + Chief Examiner)
- [x] 前端四个页面 (ChatMode / MockTest / History / Report)
- [x] REST API 路由 (sessions 列表 + 详情查询)
- [x] Settings 页 STT/TTS 配置 UI (Provider/Key/URL/Model/Voice + Test Connection)

**Phase 6 - 完善与打包**
- [x] Dashboard 首页仪表盘 (Bento Grid)
- [x] PyInstaller 后端打包 (`backend/backend.spec` + `get_base_dir()` 路径适配)
- [x] electron-builder 整体打包 (`electron-builder.yml` + `extraResources` + `BACKEND_DB_PATH` → userData)
- [ ] 跨平台测试
- [ ] 应用图标设计 (build/icon.icns / icon.ico / icon.png)

### 4.3 代码风格

**前端 (TypeScript/React)：**
- 使用 ESLint + Prettier 统一代码风格
- 组件使用函数式组件 + Hooks
- 使用 TypeScript 严格模式
- 文件命名：组件 `PascalCase.tsx`，工具 `camelCase.ts`

**后端 (Python)：**
- 遵循 PEP 8 规范
- 使用 type hints
- 使用 async/await 异步编程
- 文件命名：`snake_case.py`

## 5. 构建与打包 (保持不变)

...

## 6. 调试技巧 (保持不变)

...

## 7. 目录约定 (保持不变)

...

## 8. 词表数据源规划 (保持不变)

...
