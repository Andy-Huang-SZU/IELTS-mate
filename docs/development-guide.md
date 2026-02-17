# IELTS-mate 开发指南

> 最后更新：2026-02-17

## 1. 环境要求

### 1.1 必需软件

| 软件 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | 20 LTS | 前端 & Electron 运行时 |
| pnpm | 9.x | 前端包管理器 |
| Python | 3.11+ | 后端运行时 |
| Conda | - | Python 虚拟环境管理 (使用 `dl` 环境) |
| Git | 2.x | 版本控制 |

### 1.2 推荐 IDE

- **Cursor** (主力 IDE，支持 AI 辅助开发)
- VS Code 插件推荐：ESLint, Prettier, Tailwind CSS IntelliSense, Python

## 2. 快速开始

### 2.1 克隆仓库

```bash
git clone https://github.com/your-org/IELTS-mate.git
cd IELTS-mate
```

### 2.2 前端环境搭建

```bash
# 安装前端依赖
pnpm install
```

若网络环境导致 Electron 二进制下载缓慢，可临时使用镜像后重装 Electron：

```bash
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
pnpm rebuild electron
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

### 2.4 启动开发服务器

```bash
# 一键启动 (Electron + React 热更新 + Python FastAPI)
pnpm dev
```

该命令会同时启动：
1. **electron-vite dev server**：React 前端热更新 + Electron 主进程
2. **Python FastAPI**：由 Electron 主进程自动拉起（开发模式下使用 `uvicorn --reload`）

> **注意**：开发模式下，Electron 主进程会自动启动 `dl` 环境中的 Python。可通过环境变量 `BACKEND_PYTHON_PATH` 显式指定解释器路径（例如 `E:\\apps\\anaconda3\\envs\\dl\\python.exe`），以避免 shell hook 差异导致的 `conda activate` 问题。

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

**Phase 2 - 全局基础设施**
- [x] 搭建 SQLite 数据库连接 (async)
- [x] 实现 Settings API (BYOK)
- [x] 实现 LLM 适配器 (OpenAI-compatible)
- [x] 实现基础 UI 框架 (Layout, Sidebar, Router)

**Phase 3 - 词汇记忆模块**
- [x] 实现 SM-2 算法 (后端)
- [x] 词汇数据初始化 (JSON → SQLite)
- [x] 词汇核心复习 API (`GET /api/vocabulary/review`, `POST /api/vocabulary/{id}/review`)
- [ ] 前端闪卡 UI & 复习交互
- [ ] ECharts 热力图 & 学习曲线

**Phase 4 - 写作批改模块**
- [ ] 实现 5-Agent 并行架构 (后端)
- [ ] 题目生成 API (Part A 图表 JSON + Part B 文本)
- [ ] 前端写作编辑器 UI
- [ ] ECharts 渲染 Part A 图表
- [ ] 评分报告展示 (Markdown 渲染)

**Phase 5 - 口语模考模块**
- [ ] 实现 STT/TTS 适配器
- [ ] 实现口语状态机 (后端)
- [ ] 实现滑动窗口 + 阶段摘要记忆
- [ ] WebSocket 实时通信
- [ ] 前端录音 & 播放 UI
- [ ] 计时器 & 视觉/听觉提醒
- [ ] 口语报告生成

**Phase 6 - 完善与打包**
- [ ] Dashboard 首页仪表盘
- [ ] PyInstaller 后端打包
- [ ] electron-builder 整体打包
- [ ] 跨平台测试

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

## 5. 构建与打包

### 5.1 Python 后端打包 (PyInstaller)

```bash
conda activate dl

# 打包后端为单文件可执行程序
cd backend
pyinstaller --onefile --name backend app/main.py
```

产物位于 `backend/dist/backend.exe` (Windows)

### 5.2 Electron 前端打包

```bash
# 先将 PyInstaller 产物复制到 resources 目录
# 然后执行打包
pnpm build:win     # Windows
pnpm build:mac     # macOS
pnpm build:linux   # Linux
```

### 5.3 electron-builder 配置要点

```yaml
# electron-builder.yml
extraResources:
  - from: "backend/dist/"
    to: "backend"
    filter:
      - "**/*"
```

这确保 PyInstaller 打包的 Python 后端被嵌入到 Electron 应用中。

## 6. 调试技巧

### 6.1 前端调试

- Electron 渲染进程支持 Chrome DevTools
- `pnpm dev` 模式下支持 React 组件热更新
- 使用 React DevTools 扩展检查组件树

### 6.2 后端调试

- 开发模式下 FastAPI 使用 `uvicorn --reload`，修改 Python 代码自动重启
- 访问 `http://127.0.0.1:{port}/docs` 查看 Swagger UI 自动生成的 API 文档
- 使用 `logging` 模块输出调试信息，日志会通过 Electron 主进程捕获

快速 smoke 测试（统一使用 `dl` 环境）：

```bash
# 在项目根目录执行
E:\apps\anaconda3\envs\dl\python.exe backend/tests/smoke_step2.py
```

```bash
# 在 backend 目录执行
E:\apps\anaconda3\envs\dl\python.exe tests/smoke_step2.py
```

### 6.3 数据库调试

- 开发阶段 SQLite 数据库文件位于项目根目录 `data/ielts_mate.db`
- 可使用 DB Browser for SQLite 直接查看和编辑数据
- 生产环境数据库位于 Electron 的 `userData` 目录

## 7. 目录约定

| 路径 | 用途 |
|------|------|
| `src/main/` | Electron 主进程代码 |
| `src/preload/` | Electron preload 脚本 |
| `src/renderer/src/` | React 前端源码 |
| `backend/app/` | Python FastAPI 源码 |
| `backend/data/` | 静态数据文件 (词汇 JSON 等) |
| `backend/tests/` | Python 测试文件 |
| `docs/` | 工程文档 |
| `resources/` | 应用资源 (图标等) |

## 8. 词表数据源规划（ECDICT）

- 当前开发阶段使用 `backend/data/vocabulary_mock.json` 进行功能联调。
- 后续数据源计划采用 ECDICT 的 `ecdict.csv`，通过 `tag` 字段筛选 `ielts` 标签。
- 预期新增一个轻量 Python 清洗脚本：
  - 输入：`ecdict.csv`
  - 过滤：`tag` 包含 `ielts`
  - 输出：项目可直接读取的 `json`（保留 `word/phonetic/definition/translation/tag` 等核心字段）
