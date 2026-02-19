# 项目需求文档 (PRD)：AI赋能的雅思备考桌面端应用

**目标受众：** 目标为中国雅思备考生。
**产品定位：** 一款完全免费、开源的桌面端软件，严格采用 BYOK (Bring Your Own Key) 模式。核心聚焦于“词汇记忆”、“写作批改”和“口语全真模拟”（雅思提分难度最大的输出项）。
**开发与目标环境：** Windows 宿主开发环境，目标为跨平台编译产物 (Windows `.exe` / macOS `.dmg` / Linux)。

## 1. 技术栈与架构设计 (Tech Stack & Architecture)
* **前端 (宿主环境)：** Electron + React (使用 TypeScript 编写)。
* **后端 (本地子进程)：** Python + FastAPI。
    * *启动逻辑约束：* Electron 启动时，必须在后台悄悄拉起打包好的 Python FastAPI 服务（分配随机可用 localhost 端口），并在 Electron 退出时优雅地终止该 Python 子进程 (Graceful Shutdown)。
* **本地存储：** SQLite。
* **通信协议：** * **REST API：** 用于状态化操作（如词汇本的 CRUD、写作记录的提交）。
    * **WebSocket：** 专用于口语模块的低延迟实时流式交互。
* **UI 与数据可视化：** Tailwind CSS + Apache ECharts。

## 2. 全局设置与 BYOK 模块 (Global Settings & BYOK)
* **核心要求：** 用户必须输入自己的 API Key 才能驱动核心 AI 功能。
* **实现方式：** 开发一个独立的“设置”页面，将 Key 安全地存储在本地 `localStorage` 或 SQLite 中。
* **兼容性：** 必须支持标准的 OpenAI API 格式调用，以兼容各大底层模型（如 DeepSeek, 阿里通义, 通用 OpenAI 代理池）。需为 STT (语音识别) 和 TTS (语音合成) 预留独立的 API Key 输入框或服务选择配置。

## 3. 核心模块：单词记忆 (Vocabulary Module)
* **数据源：** 从开源的雅思词汇 JSON 文件中读取数据（包含单词、音标、释义、例句），并在首次启动时初始化入本地 SQLite 数据库。
* **核心算法：** 实现高鲁棒性的 **SM-2 间隔重复算法 (Spaced Repetition Algorithm)**。
    * 基于用户的四个反馈选项（Easy 简单, Good 认识, Hard 困难, Again 忘记），动态计算每个单词下一次复习的 `interval` (间隔天数), `repetition` (重复次数) 和 `ease factor` (简易度系数)。
* **数据可视化 (UI/UX)：**
    * 使用 ECharts 渲染类似 GitHub 贡献图的“学习热力图 (Activity Heatmap)”。
    * 渲染折线图，直观对比“已掌握单词数”与“学习中单词数”的学习曲线。

## 4. 核心模块：写作批改 (Writing Module - 5-Agent 并行架构)
* **题目生成：** * **Part A (小作文)：** AI 严禁直接生成包含文字的图片（避免幻觉和乱码）。AI 需生成严格格式的 **JSON 数据**，前端接收后使用 ECharts 渲染成可视化的饼图、折线图或柱状图。
    * **Part B (大作文)：** 生成标准的文本 Prompt 题目。
* **评估引擎 (多智能体工作流)：**
    * 必须使用异步并行执行（Python 中的 `asyncio.gather`）同时唤起 4 个子 Agent 对用户的文章进行独立评分。
    * **Agent 1 (TR - Task Response)：** 评估是否切题、论点清晰度、字数达标情况。输出 JSON。
    * **Agent 2 (CC - Coherence & Cohesion)：** 评估逻辑连贯性、连接词使用、段落分配。输出 JSON。
    * **Agent 3 (LR - Lexical Resource)：** 评估词汇丰富度、拼写错误、地道搭配。输出 JSON。
    * **Agent 4 (GRA - Grammar)：** 评估语法错误、句型结构多样性。输出 JSON。
    * **Main Agent (Chief Examiner / 主考官)：** 接收并汇总上述 4 个 JSON。**关键约束：** 必须实现重试机制 (Retry Mechanism)。如果任一子 Agent 调用失败或返回了损坏的 JSON，针对该 Agent 最多重试 3 次。主考官计算最终均分，并生成包含“重写建议和范文”的综合 Markdown 报告。

## 5. 核心模块：口语模考 (Speaking Module)
* **实时通信底层：** 在 React 和 FastAPI 之间建立 **WebSocket** 持续连接。实现 STT 文本流向 LLM，并将 LLM 生成的文本流式传输给 TTS 引擎，确保极致的低延迟体验。
* **交互模式：**
    * **闲聊模式 (Chat Mode)：** 自由对话。UI 上提供 Toggle 按钮，允许用户在 Push-to-Talk (按住说话) 和 VAD (静音自动检测) 之间自由切换。
    * **模考模式 (Mock Test - 状态机引擎)：**
        * **Part A：** 考官进行标准化破冰提问。支持 PTT/VAD 自由交互。
        * **Part B (严格计时器)：** * 触发 1 分钟准备倒计时 (UI 视觉提示)。
            * 触发 2 分钟答题倒计时。前端 UI 需在 90s, 110s, 120s 时给出视觉/听觉提醒。
            * 在 130s 时触发强制中断 (Hard Interrupt) 停止录音。支持用户手动点击“提前结束”按钮。
        * **Part C：** 基于 Part B 的内容进行深度追问。
* **认知记忆架构 (Cognitive Memory)：**
    * 实现 **“滑动窗口 + 阶段摘要 (Sliding Window + Phase Summary)”** 算法以控制上下文长度，避免使用笨重的向量数据库。
    * **关键逻辑：** Part 1 结束后，后台静默触发一次 LLM 调用，生成对用户表现和提及的个人信息的简短摘要。将此摘要无缝注入到 Part 2 和 Part 3 的 System Prompt 中。
* **考后报告：** 对话结束后，生成一份 Markdown 格式的报告，指出发音问题、不自然的停顿以及词汇升级建议。

## 技术选型确认记录 (2026-02-17)

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 前端包管理器 | **pnpm** | 更快、节省磁盘空间 |
| Electron 脚手架 | **electron-vite** | 专为 Electron 优化的 Vite 构建工具，社区活跃 |
| 状态管理 | **Zustand** | 轻量级、API 简洁，适合中等复杂度应用 |
| 词汇数据源 | **先用模拟数据** | 开发阶段使用 mock JSON，后续替换真实开源雅思词汇数据 |
| Python 打包 | **PyInstaller** | 打包为单个可执行文件，最常用方案 |
| STT/TTS 方案 | **灵活适配层** | 设计策略模式接口，支持 OpenAI/Azure/本地模型等多提供商 |

## 对 AI IDE 的执行指令 (Execution Instructions):
1. 绝对不要一次性生成所有代码。请严格按照步骤渐进式开发。
2. **第一步：** 生成项目目录树结构，并初始化 `package.json` (前端/Electron) 和 `requirements.txt` (Python 后端)。
3. **第二步：** 搭建并跑通 Electron 宿主与 Python FastAPI 之间的 IPC (跨进程通信) 和基础网络通信，证明架构可行后，再进入具体业务模块的开发。