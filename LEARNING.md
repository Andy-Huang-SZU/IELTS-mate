# IELTS-mate 学习文档

> 记录开发过程中的技术知识、架构决策和问题解决方案。

---

## 写作模块 — 5-Agent 评估架构

### Q: 为什么要从单次 LLM 调用重构为 5-Agent 并行架构？

**背景**：初版写作评估使用单次 LLM 调用，要求模型一次性输出 TR/CC/LR/GRA 四维评分 + 综合报告的完整 JSON。

**问题**：
1. **评分质量不稳定** — 单次调用让 LLM 同时关注 4 个维度，容易顾此失彼，评分深度不够
2. **JSON 格式风险高** — 输出 JSON 越大越容易出现格式错误，且无法部分重试
3. **缺乏范文和重写建议** — 单次调用的 token 预算难以支撑生成范文

**5-Agent 架构的优势**：
- 每个 Agent 专注单一维度，Prompt 可以注入该维度的官方 Band Descriptors，评分更专业
- `asyncio.gather` 并行执行 4 个评分 Agent，总延迟约等于最慢的那个 Agent（而非 4 倍延迟）
- 单个 Agent JSON 损坏时可独立重试（最多 3 次），不影响其他维度
- 主考官 Agent 基于 4 份报告汇总，有充足 token 预算生成范文和重写建议

**技术要点**：
- Python `asyncio.gather(*tasks, return_exceptions=True)` 可以捕获个别 Agent 的异常而不中断整体
- 每个 Agent 的 Prompt 需要包含 IELTS 官方 Band Descriptors（Band 5-9）作为评分锚点
- JSON Schema 约束 + `_strip_json_fence()` 清洗确保输出可解析

---

### Q: IELTS 写作评分标准（Band Descriptors）的四个维度分别评估什么？

**Task Response / Task Achievement (TR/TA)**：
- Task 2 叫 Task Response，Task 1 叫 Task Achievement
- 评估是否完整回应题目要求、立场是否清晰、论点是否充分展开并有支撑

**Coherence and Cohesion (CC)**：
- 评估文章逻辑连贯性、段落组织、连接词/衔接手段的使用
- 高分要求衔接手段"不引起注意"（即自然流畅），而非机械堆砌

**Lexical Resource (LR)**：
- 评估词汇丰富度、准确性、搭配的地道性
- 高分要求"自然且精练地控制词汇特征"，允许极少拼写错误

**Grammatical Range and Accuracy (GRA)**：
- 评估语法结构多样性和准确性
- 高分要求多种复杂句式 + 极少错误，标点运用得当

---

### Q: IELTS 官方 Band Descriptors 中 Task 1 和 Task 2 的评分标准有哪些关键差异？

**背景**：初版 `band_descriptors.py` 将 CC、LR、GRA 三个维度视为 Task 1/Task 2 通用。但对照官方 PDF（Updated May 2023）后发现，四个维度实际上都存在 Task 1 与 Task 2 的差异。

**具体差异**：

1. **TR/TA 维度完全不同**：
   - Task 1 叫 "Task Achievement"，评估内容侧重信息传递（选择关键特征、数据准确性、概述能力）
   - Task 2 叫 "Task Response"，评估内容侧重观点论述（立场清晰度、论点展开、证据支撑）
   - Task 1 还区分 Academic（图表描述）和 General Training（信函写作）两套子标准

2. **LR 维度的微妙差异**：
   - Task 1 Band 9: "Full flexibility and precise use are evident **within the scope of the task**"
   - Task 2 Band 9: "Full flexibility and precise use are **widely** evident"
   - Task 1 Band 8 也多了 "within the scope of the task" 限定语
   - 原因：Task 1 的词汇范围受限于图表/数据描述，评分标准因此有 scope 限定

3. **GRA 维度的微妙差异**：
   - Task 1 Band 9: "A wide range of structures **within the scope of the task** is used..."
   - Task 2 Band 9: "A wide range of structures is used..."
   - 与 LR 同理，Task 1 对语法复杂度的期待受限于任务性质

4. **CC 维度的差异**：
   - Task 2 Band 7 比 Task 1 多了更详细的 paragraphing 描述
   - Task 2 Band 5 特别提到 "Paragraphing may be inadequate or missing"
   - Task 2 Band 4 提到 "no clear main topic within paragraphs"

**决策**：将所有四个维度都拆分为 `TASK1_*` 和 `TASK2_*` 两套字典，getter 函数根据 `task_type` 参数自动选择正确的标准。

**影响**：评分 Agent 的 Prompt 现在能注入与任务类型严格匹配的官方标准，提升评分专业性和准确性。

---

### Q: 为什么写作批改必须持久化完整题目快照，而不是只存 `topic` 文本？
> 📅 2026-03-23 | 来源: AI主动记录 | 难度: 进阶

**简答**: 因为对 IELTS Writing Task 1 来说，真正可评分的信息不在题干文字里，而在图表 / 表格 / 地图 / 流程图的结构化数据里；只存 `topic` 文本会让 AI 在关键事实上“看不见题”。

**详解**:
写作系统里最容易被忽视的点，是“题目文本”和“题目事实”并不是一回事。Task 2 主要依赖 prompt 本身，问题相对小；但 Task 1 的评分必须知道图表里的趋势、极值、对比关系、分类维度、时间线甚至地图中的设施变化。

如果只把 `topic` 文本传给评分模型，会出现几个问题：
- **事实校验失真**：模型无法判断考生是否写错了数字、趋势或比较关系
- **历史回看不可用**：后续查看一条历史记录时，只看到 prompt，无法重现原始图表
- **按题统计困难**：没有稳定的 `topic_id`，就难以统计“哪道题被练过几次、平均分多少、常见错误是什么”
- **题库演进会污染旧记录**：如果之后题库内容被改动，旧会话若不保留当时的题目快照，就会失去可解释性

**关键实现**:
- 评估请求 `EvaluateRequest` 显式增加 `topic_id`
- `topic_data` 不再只是局部 `chart_data`，而是完整题目快照（`id`、`prompt`、`chart_type/question_type`、结构化数据、标签、难度、来源等）
- `writing_sessions` 新增 `topic_id` 列，并把完整 `topic_data` JSON 持久化到数据库
- 4 个评分 Agent 和 Chief Examiner 的 prompt 都注入同一份题目快照，保证评分依据一致

**实战要点**:
- 只要是“题目本身带结构化事实”的 AI 评分场景，都应优先保存快照，而不是只保存自然语言 prompt
- `topic_id` 解决“定位”和“统计”，`topic_data` 解决“解释”和“重现”，两者缺一不可
- 历史记录设计时要遵循“写时冻结（write-time snapshot）”原则，避免后续题库更新污染旧会话

---

## 写作模块 — 报告展示增强

### 实现解析: 主考官 Markdown 结构化拆分与前端容错展示
> 📅 2026-03-23 | 来源: AI主动记录

**功能概述**：
写作报告页原本只展示四维评分和逐项批注，后端返回的 `report_markdown` 虽然包含主考官总评、范文和 Rewrite Suggestions，但前端并没有消费它。本次增强把 Chief Examiner 的长 Markdown 报告拆成了更易读的三个区块：总评摘要、`Model Answer`、`Rewrite Suggestions`，同时保留原始 Markdown 折叠查看。

**技术实现拆解**：

#### 实现点 1: 轻量 Markdown 分段解析，而不是引入渲染依赖
- **实现原理**: 先按 `# / ## / ###` 标题把 `report_markdown` 切成 section，再通过标题关键词识别 `Overall`、`Model Answer`、`Rewrite Suggestions` 等语义块。
- **用到的技术/库**: 纯 TypeScript 字符串处理与正则，不额外引入 `react-markdown` 一类依赖。
- **为什么这么做**: 这个场景不是“完整渲染 Markdown 文档”，而是“从 Markdown 里提取几个关键学习区块”。直接做 section parser 体积更小，也更容易按产品需求控制布局。

#### 实现点 2: 容错优先的 fallback 设计
- **实现原理**: 如果主考官 Markdown 里没有独立的 `Rewrite Suggestions` 标题，前端自动回退到四维 `agent_reports.*.suggestions`，做去重后继续展示建议。
- **为什么这么做**: LLM 输出格式可能轻微漂移，不能把页面是否有建议完全赌在单个标题上；学习型产品里“至少给用户可执行建议”比“严格依赖完美格式”更重要。
- **注意事项**: fallback 只能替代建议列表，无法真正替代主考官写出的完整范文，因此原始 Markdown 仍要保留可查看入口。

#### 实现点 3: 结构化内容优先，原始报告作为可追溯层
- **实现原理**: 页面先显示结构化卡片（Summary / Model Answer / Rewrite Suggestions），再把原始 Chief Markdown 放进折叠面板中。
- **为什么这么做**: 用户在复盘作文时，首先需要“我哪里有问题”“高分答案长什么样”“下一步改什么”，而不是先阅读整篇长文；但调试和质检又需要回看原始文本，所以必须保留第二层信息。

**架构总结**：
这类“LLM 返回长文本，但页面只需要其中几个高价值片段”的场景，适合使用“轻量语义解析 + UI 专区展示 + 原文兜底”的模式。它比强依赖固定 JSON 更灵活，也比直接渲染整段 Markdown 更符合学习产品的信息层级。

**可复用的模式**：
- 当后端暂时还没有提供结构化字段时，可以先在前端做轻量解析验证产品形态。
- 对 AI 输出做页面展示时，优先设计 fallback，避免因为格式轻微漂移导致整个功能失效。
- “结构化摘要优先 + 原文折叠追溯”适合任何 AI 评估、复盘、诊断类页面。

---

## 写作模块 — 题库浏览与历史复盘

### 实现解析: 在 Writing Hub 中内嵌题库浏览器，并打通 History → Editor 的同题重做链路
> 📅 2026-03-23 | 来源: AI主动记录

**功能概述**：
这次改造的目标不是单独“多一个 History 页面”，而是把写作练习的完整闭环补齐：用户既能在 `Writing Hub` 里预览全部题目，也能在 `Writing History` 里快速回看过去的分数，并且一键回到“同一道题”继续练习。

**技术实现拆解**：

#### 实现点 1: 题库列表 API 返回全量轻数据，筛选和分页放在前端
- **实现原理**: 新增 `GET /api/writing/topic-bank`，一次性返回约 150 道题目的结构化数据；Hub 内的 Topic Browser 再做 Task / 子题型 / 难度筛选、关键词搜索和分页。
- **为什么这么做**: 当前题库规模不大，全量返回的复杂度和性能成本都很低，但前端交互灵活性会高很多。用户切换筛选条件时不需要反复请求后端，体验会明显更顺。
- **实战要点**: 当列表规模还处在“几百条以内”时，优先考虑“后端提供干净全量数据 + 前端本地交互”，而不是过早把所有筛选都做成服务端搜索。

#### 实现点 2: 同题重做依赖“写时冻结”的题目快照，而不是只记 topic 文本
- **实现原理**: `sessions` 列表现在会返回 `topic_id`、`topic_data`、`scores`、`word_count`；History / Report 点击重做时优先把完整 `topic_data` 通过 router state 传给 Editor，Editor 再以该快照为最高优先级加载题目。
- **为什么这么做**: 如果只记住“这是一个 bar chart”或“这是 opinion 题”，点击重做时只能回到“同类题”，而不是“原题”。对于复盘提分来说，这两者差别非常大。
- **降级策略**: 当历史记录里没有完整快照时，再退回 `topicId` 查询参数，让 Editor 通过题库列表 API 重新定位原题。

#### 实现点 3: 历史页展示要服务于复盘决策，而不是只做记录仓库
- **实现原理**: `Writing History` 的每张卡片同时展示 Overall 分数、四维缩略雷达图、字数、题目标签和时间，并提供 `View Report` / `Redo Topic` 两个动作。
- **为什么这么做**: 学习型产品里的历史页不是“日志表”，而是“下一步学什么”的决策面板。缩略图帮助用户快速判断自己是 TR 偏弱、还是 LR / GRA 偏弱；重做按钮则把判断立刻转成行动。

**架构总结**：
这类功能本质上是在构建“练习 → 评估 → 复盘 → 再练”的闭环。关键不是单个页面做得多漂亮，而是数据结构（`topic_id` + `topic_data` + `scores`）是否足够支撑跨页面的连续动作。

**可复用的模式**：
- 当历史记录需要支持“原样重做”时，优先保存并回传完整快照，而不是只保存分类标签。
- 当资源库规模还不大时，前端本地筛选往往比服务端多轮查询更顺手。
- 历史页若要真正有学习价值，至少要同时具备“结果概览”和“立即行动”两个层次。

---

## 写作模块 — 题目生成系统

### Q: Mermaid.js v11+ 为什么在 Node.js 纯环境中跑不了？

**背景**：`validate_mermaid.mjs` 脚本使用 `mermaid.parse()` 校验 LLM 生成的流程图 Mermaid 语法，但在 Node.js 中执行时报错 `DOMPurify.addHook is not a function`。

**原因**：Mermaid v11+ 内部依赖 `DOMPurify` 进行 XSS 防护，而 `DOMPurify` 需要浏览器的 `document` 对象。纯 Node.js 环境缺少 DOM API，导致初始化失败。

**解决方案**：不使用 `mermaid.parse()` 做校验，改为基于正则的轻量语法结构校验：
- 检查首行是否为合法的 `graph TD` / `flowchart LR` 等声明
- 检查是否存在 `-->` / `-.->` / `==>` 等箭头边
- 检查至少有 2 个节点 ID

**权衡**：正则校验不如 `mermaid.parse()` 精确，但在 Node.js 无 DOM 环境下是最实用的方案。如果未来需要精确校验，可以引入 `jsdom` + `DOMPurify` 的 Node.js 兼容包。

---

### Q: 为什么题目生成脚本不能并行写同一个 JSON 文件？

**背景**：首次测试时对 Task 1 和 Task 2 的生成命令并行执行，结果题库文件丢失了部分数据。

**原因**：两个进程同时读取 `writing_topics.json`（各自读到的都是 N 条），各自追加后写回。后写入的进程会覆盖先写入的结果，导致数据丢失（经典的 read-modify-write 竞争条件）。

**解决方案**：生成脚本必须**串行执行**（每次命令等上一个完成再跑下一个），不能用 `&` 放后台并行。`TopicBankService` 内部的 `threading.Lock` 只保护同一进程内的并发，跨进程无效。

---

## 写作模块 — 图表渲染组件体系

### 实现解析: 前端图表渲染组件全面升级 (SVG → ECharts + D3 + Mermaid)
> 📅 2026-03-17 | 来源: AI主动记录

**功能概述**：
将写作模块 Editor.tsx 中的内联简易 SVG 图表（~350 行 Mini*Chart 组件）替换为 6 个专业渲染组件体系，支持 7 种雅思 Task 1 图表类型的高保真渲染。

**技术实现拆解**：

#### 实现点 1: React.lazy 分发器模式
- **实现原理**：`ChartRenderer` 作为统一入口，根据 `chart_type` 使用 `React.lazy(() => import('./XxxRenderer'))` 动态加载具体渲染器。每种类型对应一个独立文件，打包时自动 code split
- **为什么这么做**：ECharts (300KB+)、D3.js (250KB+)、Mermaid.js (1MB+) 体积巨大，如果全部同步 import 会严重影响首屏加载。lazy import 确保只有用户实际查看某种图表时才加载对应库
- **关键代码**：`const EChartsRenderer = React.lazy(() => import('./EChartsRenderer'))`，外层包裹 `<Suspense fallback={<LoadingSkeleton />}>`

#### 实现点 2: ECharts 在 React 中的集成模式
- **实现原理**：使用 `useRef` 持有 DOM 容器 + `useEffect` 中动态 `import('echarts')` 获取库 → `echarts.init(container)` 创建实例 → `instance.setOption(option)` 渲染 → cleanup 时 `instance.dispose()`
- **用到的技术/库**：Apache ECharts 6，不使用 echarts-for-react 封装库，直接操作 API 获得最大控制
- **为什么这么做**：echarts-for-react 等封装库通常落后于 ECharts 主版本，且增加了不必要的抽象层。直接使用 ECharts API 更灵活，且可以精确控制 `setOption` 的 `notMerge` / `lazyUpdate` 参数
- **关键细节**：使用 `ResizeObserver` 监听容器尺寸变化并调用 `chart.resize()`，带 100ms debounce 避免频繁重绘

#### 实现点 3: D3.js SVG 地图渲染
- **实现原理**：LLM 生成结构化 JSON 地图数据（归一化 0-100 坐标系），D3.js 使用 `d3.select(svgRef)` 创建 SVG 组，将每个 feature 根据 type 映射为对应 SVG 元素（building→rect, road→path with curveLinear, river→path with curveBasis, park/lake→rect with 特定填充色）
- **用到的技术/库**：D3.js 7 (`d3-selection`, `d3-shape`)，不使用 GeoJSON/TopoJSON（因为是简化的示意图，不是真实地理数据）
- **为什么这么做**：雅思地图题是简化的示意图（不是真实地图），使用 D3.js 操作 SVG 是最轻量的方案。Canvas 虽然性能更好但缺少 SVG 的文本渲染和可访问性优势
- **归一化坐标系**：所有坐标和尺寸使用 0-100 范围，渲染时按 SVG 容器实际尺寸缩放（`x * (svgWidth / 100)`），使 LLM 生成的数据与显示尺寸解耦

#### 实现点 4: Mermaid.js 流程图渲染与容错
- **实现原理**：先用 `mermaid.parse(code)` 校验语法，通过则调用 `mermaid.render(id, code)` 获取 SVG，注入容器的 `innerHTML`；校验失败则 fallback 为从 `steps` 数组渲染的有序列表
- **为什么这么做**：LLM 生成的 Mermaid 语法不一定100%正确，`parse()` 预校验可以优雅降级而不是显示白屏。fallback 步骤列表确保用户至少能看到流程信息
- **注意事项**：Mermaid v11+ 的 `mermaid.parse()` 和 `mermaid.render()` 都是 async 的，需要在 useEffect 中处理

#### 实现点 5: combination → mixed 迁移策略
- **实现原理**：combination（bar+line 同轴双 Y 轴）和 mixed（两个独立子图）是不同的数据结构。前端遇到 `chart_type=combination` 时 fallback 到 ECharts dual-axis 渲染；后端 `topic_bank_service.py` 在 `chart_type=mixed` 查询时同时匹配 combination 旧题目；`generate_topic()` 路由层内部将 combination 映射为 mixed
- **为什么这么做**：保持向后兼容。已有的 11 道样题中有 1 道 combination 类型，不需要手动迁移数据。新题统一使用 mixed 类型和 sub_charts 数据结构

**架构总结**：
分发器模式 + React.lazy 是大型可视化组件集成的标准实践。每个渲染器只关注自己的 chart_type，ChartRenderer 负责路由分发，MixedChartRenderer 通过递归分发实现任意子图组合。

**可复用的模式**：
- **React.lazy 分发器**：适用于任何需要按条件加载不同大型库的场景（如富文本编辑器的不同渲染模式）
- **ECharts useRef+init 模式**：可直接复制到任何 React + ECharts 项目
- **D3 归一化坐标系**：让数据生成端（LLM）与渲染端解耦，适用于任何需要 LLM 生成可视化数据的场景

---

### Q: 为什么雅思 Task 1 需要地图题（map）和双图混合题（mixed）？
> 📅 2026-03-17 | 来源: AI识别 | 难度: 入门

**简答**: 根据 2025-2026 年真题研究，约 10% 的 Task 1 题目是地图题，约 10% 是双图混合题，这是雅思考试的常见题型，缺少它们会让备考工具不完整。

**详解**:
雅思学术类 Task 1 包含 7 种题型（按出现频率排序）：bar chart、line graph、pie chart、table、mixed/combination（两个图表组合）、map（地理变迁对比）、process diagram（流程图）。

其中 map 题要求考生描述一个地区在不同时间点的变化（如城镇规划变迁），或比较两个不同地点的差异。mixed 题则在同一道题中给出两个独立的图表（如一个 bar chart + 一个 pie chart），要求考生在一篇文章中描述和比较两者。

**实战要点**:
- map 题的数据结构与常规图表完全不同，需要专门的地图渲染方案（D3.js SVG）
- mixed 题的关键是两个子图各自独立渲染 + 上下排列，模拟真实考试试卷的呈现方式
- combination（bar+line 双 Y 轴同轴图）实际上是 mixed 的一个特例，在系统中归入 mixed 体系并保持向后兼容

---

### Q: Pydantic `extra="forbid"` 在前后端类型同步中的陷阱是什么？
> 📅 2026-03-17 | 来源: AI识别 | 难度: 进阶

**简答**: 当 Pydantic 模型设置 `extra="forbid"` 时，请求体中包含任何未声明的字段都会导致 422 Validation Error，因此新增字段时必须前后端同步更新。

**详解**:
IELTS-mate 的 `SettingsPayload` 和 `SettingsUpdateRequest` 使用了 `model_config = ConfigDict(extra="forbid")`，这意味着如果前端发送的 JSON 中包含后端 Schema 不认识的字段，Pydantic 会直接拒绝请求。

反过来也一样：如果后端新增了字段但前端没更新类型定义，TypeScript 不会报编译错误（因为 Partial 类型），但前端不会发送新字段的值，导致后端收到的值始终是默认值。

**实战要点**:
- 新增字段时必须同时修改：后端 Schema (`schemas/settings.py`) + 前端类型 (`types/settings.ts`) + 前端 Store (`useSettingsStore.ts` 的 saveSettings payload)
- 测试时检查 Network 面板的请求体，确认新字段确实被发送
- `extra="forbid"` 虽然严格但有好处：防止前端传了错误的字段名导致静默失败

---

## 开发环境 — Electron + 浏览器双模式

### Q: 如何在没有 Electron 的环境下（如远程服务器/容器）预览 IELTS-mate 前端？
> 📅 2026-03-17 | 来源: 用户提问 | 难度: 入门

**简答**: 使用 `npm run dev:web` 启动独立的 Vite dev server，不启动 Electron，通过浏览器直接访问 `http://localhost:5173/`。

**详解**:
`electron-vite dev` 做了三件事：① 构建 main 进程 → ② 构建 preload → ③ 启动 renderer Vite dev server → ④ 启动 Electron 窗口。在没有 GUI 的服务器/容器环境中，Electron 启动会失败（缺少 `libgbm.so.1` 等系统库），但 Vite dev server 已经成功在运行了。

解决方案是新增一个 `dev:web` 脚本，使用独立的 Vite 配置 (`electron.vite.web.config.ts`) 直接启动 renderer 进程的 Vite server：
- 配置 `root: 'src/renderer'` 指向 renderer 入口
- 保留 `@renderer` 路径别名
- 不涉及 Electron main/preload 构建

**能工作的前提条件**：
1. 所有 service 层的 `getBaseUrl()` 使用了松耦合设计：`if (window.electronAPI?.getBackendInfo) { ... } else return 'http://localhost:8000'`
2. `window.electronAPI` 在 `global.d.ts` 中声明为可选属性（`electronAPI?:`）
3. 路由使用 `createBrowserRouter`，在 Vite dev server 下天然支持 SPA history mode fallback
4. Python 后端需要同时运行 —— `dev:web` 脚本会**自动启动后端**（端口 18080）

**实战要点**:
- `npm run dev` = 完整 Electron 开发（需要 GUI 环境）
- `npm run dev:web` = 一键启动前端 + 后端（服务器/容器/远程环境友好）
- `npm run dev:web-only` = 只启动前端（后端需手动启动）
- 两种模式共享同一份 renderer 源码，只是入口方式不同
- 新增任何 Electron API 使用时，必须做 `window.electronAPI?.` 可选链检查，否则浏览器模式会报错
- **端口一致性**：前端 fallback 端口（`WEB_FALLBACK_PORT = 18080`）必须和后端默认端口 (`app/main.py --port 18080`) 一致

### Q: TopicBankService 的 JSON 热重载是怎么实现的？
> 📅 2026-03-17 | 来源: 用户反馈 | 难度: 入门

**简答**: 在每次 `_ensure_loaded()` 调用时比较文件的 `st_mtime`（修改时间），如果文件被修改过就自动重新加载，无需重启后端。

**详解**:
`TopicBankService` 是 module-level singleton，首次访问时从 `writing_topics.json` 加载所有题目到内存。原来的实现中，如果直接编辑 JSON 文件（如手动添加样题），即使 uvicorn 使用 `--reload` 模式（只监控 .py 文件变更），题库数据也不会更新——因为 singleton 已经缓存了旧数据。

解决方案：在 `load()` 时记录 `self._file_mtime = bank_path.stat().st_mtime`，在 `_ensure_loaded()` 中每次检查当前 mtime 是否大于记录值，如果是则重新 load。

**实战要点**:
- `st_mtime` 比较是 O(1) 的系统调用，对性能影响可忽略
- 这只影响读操作（`random_topic`、`get_stats`），写操作（`add_topic`）本身就会更新内存和文件
- 开发过程中可以直接编辑 JSON 文件添加样题，API 下次调用时自动生效

---

## 开发环境 — 打包与发布

### Q: 如何把 IELTS-mate 打包成可安装的软件？
> 📅 2026-04-08 | 来源: 用户提问 | 难度: 进阶

**简答**: 这个项目的正确打包链路是 **先用 PyInstaller 把 Python 后端打成可执行文件，再用 electron-builder 把 Electron 前端和后端二进制一起打进安装包**；仅执行 `pnpm build` 还不算“软件打包”，它只会产出前端/Electron 编译结果。

**详解**:
当前仓库里已经具备“为打包做准备”的关键前提，但还没有把最后一公里完全接好：

1. **Electron 主进程已经区分开发态和打包态**
   - 开发态：`python-manager.ts` 会在 `backend/app/main.py` 上直接启动 Python。
   - 打包态：`python-manager.ts` 会改为从 `process.resourcesPath/backend` 下启动 `backend` 或 `backend.exe`。
   - 这说明项目架构本身就是按“Electron 壳 + 内置 Python 后端”设计的。

2. **当前 `pnpm build` 只做编译，不做安装包**
   - `package.json` 里目前只有 `build: electron-vite build`。
   - 仓库里还没有真正可用的 `build:win` / `build:mac` / `build:linux` 脚本，也没有现成的 `electron-builder` 配置。
   - 所以现在执行构建，只会得到 `out/` 产物，不会直接生成 `.exe`、`.dmg`、`.AppImage`。

3. **后端打包时必须把数据文件一起考虑进去**
   - 后端运行依赖 `backend/data/ielts_vocabulary.json`、`backend/data/writing_topics.json` 等资源。
   - SQLite 默认也写到 `backend/data/ielts_mate.db`。
   - 如果把整个 `backend` 塞进 Electron 的只读资源目录，数据库写入可能失败；更稳妥的做法是：**静态 JSON 随安装包分发，运行时数据库写到用户目录**，例如通过环境变量 `BACKEND_DB_PATH` 指到 Electron 的 `app.getPath('userData')`。

**推荐的工程拆解**:

#### 子问题 1: 先把 Python 后端打成独立二进制
- **实现方案**: 用 PyInstaller 为 `backend/app/main.py` 生成 `backend` / `backend.exe`。
- **为什么先做这步**: Electron 打包时最适合携带“已经可直接运行”的后端程序，而不是依赖目标机器再安装 Python 环境。
- **注意事项**:
  - 需要把 `backend/data/*.json` 一并带上。
  - 如有动态导入或隐式依赖，PyInstaller 可能需要补 `hiddenimports`。

#### 子问题 2: 用 electron-builder 把前端和后端一起装箱
- **实现方案**: 在 `package.json` 增加 `electron-builder` 配置，并通过 `extraResources` 把 PyInstaller 产物复制到安装包里的 `resources/backend/`。
- **为什么这么做**: 当前 `python-manager.ts` 打包态就是按这个目录约定去找后端二进制的。
- **注意事项**:
  - Windows 对应 `backend.exe`，Linux/macOS 对应 `backend`。
  - 要把 `out/` 中的 Electron 编译结果和 `resources/backend/` 一起打包。

#### 子问题 3: 处理运行时可写目录
- **实现方案**: 不要把 SQLite 数据库长期写在安装资源目录；应在应用启动时把数据库路径指向用户目录。
- **为什么这么做**: 安装目录或应用资源目录在很多系统上不适合写入，升级时也容易被覆盖。
- **注意事项**:
  - 静态词库 JSON 可以放资源目录。
  - 用户学习进度、设置、SQLite DB 应放 `userData`。

**实战要点**:
- `pnpm build` = 生产编译，不等于安装包。
- 真正的软件分发目标应是：Windows 产出 `.exe` / NSIS，macOS 产出 `.dmg`，Linux 产出 `AppImage`。
- 这个仓库的主难点不在 React 页面，而在 **Electron 与 Python 后端二进制的协同打包**。
- 如果要一次把事情做完，优先顺序应是：**后端 PyInstaller → Electron builder 配置 → 用户目录数据库迁移 → 跨平台验包**。

---

## 词汇模块 — 事件驱动学习统计

### 实现解析: 用独立事件表替代 updated_at 推测来统计学习行为
> 📅 2026-03-24 | 来源: AI主动记录

**功能概述**：
词汇模块的热力图、连续学习天数和活动趋势统计，原先依赖 `Vocabulary.updated_at` 字段推测"用户是否学习了"。但 `updated_at` 会被收藏、笔记等非学习操作更新，导致统计数据不可靠。本次重构引入独立的 `VocabularyEvent` 事件表，只在 `submit_review` 时写入事件记录。

**技术实现拆解**：

#### 实现点 1: 事件表设计与写入时机
- **实现原理**: 新增 `vocabulary_events` 表，字段包含 `word_id`、`mode`（review / learn_quiz / spelling / dictation）、`quality`、`created_at`。仅在 `POST /api/vocabulary/{word_id}/review` 成功后写入一条事件。
- **为什么这么做**: 事件驱动的统计可以精确区分不同学习动作的来源和频率，不会被无关操作污染。这是从"状态推测"升级为"行为记录"的关键转变。
- **实战要点**: 事件表是追加写入（append-only），不做 update/delete，天然适合时间序列聚合；在 `created_at` 和 `word_id` 上建索引以支撑按日聚合和按词查询。

#### 实现点 2: 热力图和 streak 从事件表聚合
- **实现原理**: `GET /api/vocabulary/heatmap?year=2026` 从事件表按日期 GROUP BY，返回每天的学习事件计数；streak 计算从今天向前查找连续有事件的天数。
- **为什么这么做**: 直接从事件源聚合，数据可靠性最高；不需要维护额外的"每日统计汇总表"，因为事件量级（每天几十到几百条）在 SQLite 下聚合性能完全足够。

#### 实现点 3: mode 字段让统计可按维度切分
- **实现原理**: 复习提交请求从原来的 `{ quality }` 扩展为 `{ quality, mode }`，前端 Learn.tsx 传 `learn_quiz`，Review.tsx 传 `review`，Spelling.tsx 传 `spelling`，Dictation.tsx 传 `dictation`。
- **为什么这么做**: 未来活动趋势图可以按模式维度切分（如"本周拼写训练占比"），也能回答"哪种训练方式对记忆效果更好"等分析问题。

**可复用的模式**：
- 当需要可靠的用户行为统计时，优先使用独立事件表（append-only），而不是复用业务实体的 `updated_at`。
- 事件表的 `mode` / `type` 字段是低成本的维度扩展点，设计时就加上，不要等需要时再迁移。

---

## 写作模块 — 结构化报告后端化

### 实现解析: 将报告结构化解析从前端迁移到后端 writing_report_parser.py
> 📅 2026-03-24 | 来源: AI主动记录

**功能概述**：
写作报告的总评摘要、范文和重写建议原先完全依赖前端 `parseChiefReport()` 函数在浏览器端解析 `report_markdown`。本次新增 `writing_report_parser.py` 后端解析器，将结构化逻辑上移到服务层，前端优先消费 `structured_report` 字段，仅在老 session 或解析失败时 fallback 到前端解析。

**技术实现拆解**：

#### 实现点 1: 后端解析器镜像前端逻辑
- **实现原理**: `parse_report(report_markdown, agent_reports)` 使用与前端相同的 regex 和标题匹配逻辑（`_is_model_answer()`、`_is_rewrite()`、`_is_overall()`）切分 Markdown 段落，返回 `StructuredReport` dataclass。
- **为什么这么做**: 后端解析保证所有客户端（Electron、浏览器、未来可能的移动端）拿到一致的结构化结果，减少"每个客户端各自解析 + 格式漂移"的维护风险。

#### 实现点 2: 保留 report_markdown 不改数据库列
- **实现原理**: 结构化字段在 `get_session_detail()` 响应层组装，不修改 `writing_sessions` 表结构。原始 `report_markdown` 和 `agent_reports` 原样保留。
- **为什么这么做**: 避免无必要的数据库迁移；解析器可以随时升级而不影响存储；老数据也能被新解析器重新处理。

#### 实现点 3: 前端双层消费策略
- **实现原理**: `Report.tsx` 的 `chiefReport` useMemo 先检查 `data.structured_report`，如果有内容直接映射为 `ParsedChiefReport` 格式；否则 fallback 到现有的 `parseChiefReport()` 前端解析。
- **为什么这么做**: 确保在过渡期内老 session（没有 structured_report 的数据）仍然可读，同时新 session 享受更稳定的后端解析结果。

**可复用的模式**：
- "后端解析 + 前端 fallback"是 AI 输出结构化展示的渐进迁移策略：先在前端验证产品形态，确认后把解析逻辑上移到后端，保留前端作为兜底。
- 当后端返回结构化数据但可能为空时，前端应始终准备一个同等能力的 fallback 路径。

---

## 写作模块 — 按题聚合与趋势分析

### 实现解析: 利用 topic_id 实现写作历史的按题复盘
> 📅 2026-03-24 | 来源: AI主动记录

**功能概述**：
写作历史页原先只按时间线平铺所有 session。本次新增 By Topic 聚合视图，让用户能看到同一道题的练习次数、平均分、最佳分和提分趋势，形成"选题 → 练习 → 复盘 → 再练 → 对比"的完整提分闭环。

**技术实现拆解**：

#### 实现点 1: SQL 层面的 GROUP BY 聚合
- **实现原理**: `GET /api/writing/topics/aggregate` 使用 `SELECT topic_id, COUNT(*), AVG(overall_score), MAX(overall_score) FROM writing_sessions GROUP BY topic_id`，在数据库层完成聚合，避免应用层循环计算。
- **为什么这么做**: `writing_sessions.topic_id` 已有索引，GROUP BY 聚合效率高且复杂度为 O(n)。对于当前规模（几十到几百条 session），单次查询毫秒级完成。
- **排序支持**: `latest`（按最近练习时间）、`attempts_desc`（按练习次数）、`best_score_desc`（按最佳分数），都在 SQL 层实现。

#### 实现点 2: 趋势查询以 topic_id 为唯一键
- **实现原理**: `GET /api/writing/topics/{topic_id}/trend` 返回该题所有 attempts，按 `created_at asc` 排列，包含每次的 `overall_score`、`scores` JSON 和 `word_count`。
- **为什么这么做**: 趋势展示需要时间序列数据，直接查询比先聚合再展开更简单。单题 attempts 数量通常很少（几次到十几次），复杂度为 O(k)。

#### 实现点 3: History 保持双视图兼容
- **实现原理**: History.tsx 新增 `viewMode` 状态（`sessions` / `by_topic`），使用 segmented control 切换。Sessions 模式保留原有完整功能；By Topic 模式渲染独立的 `ByTopicView` 组件。Task 筛选器共享。
- **为什么这么做**: 保留现有 sessions 列表降低已有使用路径的破坏；用户可以在"按时间回顾"和"按题复盘"之间自由切换，适应不同的复习需求。

**可复用的模式**：
- 当需要"按实体聚合 + 按实体趋势"时，优先用 SQL GROUP BY 做聚合摘要，再用简单 WHERE 做单实体趋势，避免引入复杂的 OLAP 框架。
- 双视图设计（列表 + 聚合）适合任何"既需要时间线浏览，又需要实体维度分析"的历史页场景。

---

## 口语模块 — WebSocket 实时通信架构

### 实现解析: 基于 WebSocket 的实时口语对话系统（STT→LLM→TTS 管线）
> 📅 2026-03-24 | 来源: AI主动记录

**功能概述**：
口语模块通过单一 WebSocket 连接实现前后端实时通信，串联 STT（语音转文本）→ LLM（对话生成）→ TTS（文本转语音）的完整语音交互管线。前端负责录音采集和音频播放，后端负责状态机流转、对话管理和外部 API 调度。

**技术实现拆解**：

#### 实现点 1: 单一 WebSocket + JSON 消息协议
- **实现原理**: 前后端通过一条 WebSocket 连接传输所有消息，使用 `type` 字段区分消息类型。客户端发送 `start_session`、`audio_chunk`（base64）、`end_turn`、`stop_session`、`ping`；服务端推送 `connected`、`pong`、`transcription`、`ai_text`、`ai_audio`（base64）、`state_change`、`timer`、`topic_card`、`error`、`session_ended`。
- **为什么这么做**: 口语场景的消息类型虽多但数据量不大（除了音频 base64），单连接足以承载。比使用多个 REST + WS 连接更简单，避免了连接管理和消息顺序同步的复杂性。
- **实战要点**: 
  - 音频 base64 编码会增加 ~33% 的数据体积，但对于几秒到几十秒的语音片段，这个开销完全可以接受
  - `ping/pong` 心跳（30s 间隔）检测连接健康状态，避免静默断开
  - 前端 `useWebSocket` Hook 使用 `useRef` 持有最新的回调函数引用，避免闭包陷阱导致的 stale state 问题

#### 实现点 2: 整段音频提交（而非流式 STT）的设计权衡
- **实现原理**: 用户发言完成后，前端将完整音频 Blob 转为 base64 一次性发送给后端，后端调用 Whisper API 获取转录文本。
- **为什么这么做**: OpenAI Whisper API 不支持流式输入，需要完整音频文件；对于雅思口语场景，用户每次发言是完整的句子/段落（通常 3-30 秒），整段提交延迟约 1-3 秒，用户体验可接受。
- **权衡**: 流式 STT（如 Azure Speech SDK、Deepgram）可以实现边说边显示文字，但引入了额外的依赖和复杂度（VAD 分割、partial transcript 处理）。当前方案实现复杂度低 10 倍，且 Whisper 的转录质量通常优于流式 STT。

#### 实现点 3: 前端自动重连 + 指数退避
- **实现原理**: `useWebSocket` 维护 `reconnectAttempts` 计数器和 `intentionalClose` 标记。WebSocket `onclose` 时如果不是主动关闭且尝试次数未超过 `maxReconnectAttempts`（默认 3），则按 `baseDelay * 2^attempts`（1s → 2s → 4s）的间隔自动重连。
- **为什么这么做**: 网络波动（如 WiFi 切换、服务器短暂重启）不应中断用户的口语练习。指数退避避免在服务不可用时对服务端形成连接风暴。
- **关键细节**: 重连成功后 `reconnectAttempts` 归零；组件卸载时设置 `intentionalClose = true` 防止触发不必要的重连尝试。

---

### 需求: Web Audio API 录音方案（PTT/VAD 双模式）
> 📅 2026-03-24 | 来源: AI主动记录

**需求描述**: 口语模块需要支持两种录音触发方式——Push-to-Talk（按住录音）和 VAD（Voice Activity Detection，声音自动触发录音）。

**工程拆解**:

1. **MediaRecorder 录音核心**:
   - 使用 `navigator.mediaDevices.getUserMedia({ audio: true })` 获取麦克风权限
   - `MediaRecorder` 录制 `audio/webm;codecs=opus` 格式（文件小、质量好）
   - MIME 类型降级链：`audio/webm;codecs=opus` → `audio/webm` → `audio/ogg;codecs=opus` → `audio/mp4`（不同浏览器支持不同格式）
   - `ondataavailable` 事件收集 chunks，`onstop` 时合并为完整 Blob

2. **PTT 模式**: 
   - `startRecording()` / `stopRecording()` 手动控制
   - MicButton 组件提供 `onPress`（mousedown/touchstart）和 `onRelease`（mouseup/touchend）事件

3. **VAD 模式**:
   - 使用 `AudioContext` + `AnalyserNode` 实时监测麦克风音量
   - `getByteFrequencyData()` 获取频域数据，计算平均振幅
   - 音量超过阈值（默认 30/255）→ 开始录音
   - 静音超过超时时间（默认 1500ms）→ 自动停止录音并发送
   - 使用 `requestAnimationFrame` 循环监测音量，高效且不阻塞 UI 线程

4. **AnalyserNode 复用**:
   - 同一个 `AnalyserNode` 既用于 VAD 音量检测，也暴露给 `AudioVisualizer` 组件获取频域数据绘制波形
   - 避免创建多个 `AnalyserNode`，节省资源

**技术要点**:
- `MediaRecorder` 是 Web 标准 API，不需要额外库，但 MIME type 支持因浏览器而异
- `AudioContext` 在用户交互后才能创建（浏览器自动播放策略），首次 `startRecording()` 时初始化
- VAD 的阈值和超时时间需要根据环境噪音调整，30/255 是安静室内的合理默认值

---

### Q: Canvas 圆形波形可视化是如何实现的？
> 📅 2026-03-24 | 来源: AI主动记录 | 难度: 进阶

**简答**: 使用 `requestAnimationFrame` 循环，从 `AnalyserNode.getByteFrequencyData()` 获取实时频域数据，以极坐标方式在 Canvas 上绘制环形条状波形。

**详解**:

`AudioVisualizer` 组件的渲染管线：
1. **数据获取**: 每帧从 `AnalyserNode` 的 `frequencyBinCount` 个频率 bin 中提取振幅数据（0-255）
2. **采样**: 从频域数据中均匀采样 `barCount`（默认 64）个频率点
3. **极坐标映射**: 每个采样点映射到圆周上的一个角度（`2π * i / barCount`），振幅映射为径向长度
4. **双层绘制**: 先画一层半透明底层条（较短），再画一层高亮顶层条（完整长度），产生深度感
5. **中心圆**: 画一个渐变填充的中心圆，与波形条构成视觉焦点
6. **外发光**: 使用径向渐变绘制外围光晕，增强氛围感

**三种颜色模式**:
- **idle** (空闲): 淡紫色系 `#C4B5FD` → `#A78BFA`，微弱脉动
- **recording** (录音): 暖珊瑚色 `#FCA5A5` → `#F87171`，跟随声音律动
- **ai-speaking** (AI 说话): 青色系 `#5EEAD4` → `#2DD4BF`，跟随音频输出

**DPR 适配**: `canvas.width = containerWidth * devicePixelRatio`，`ctx.scale(dpr, dpr)`，确保 Retina 屏幕上波形清晰不模糊。

**性能考量**: `requestAnimationFrame` 自动与显示器刷新率同步（通常 60fps），不会过度消耗 CPU。组件卸载时通过 `cancelAnimationFrame` 清理。

---

## 口语模块 — 后端状态机设计

### Q: 为什么口语模考需要后端状态机而不是前端状态管理？
> 📅 2026-03-24 | 来源: AI主动记录 | 难度: 进阶

**简答**: 后端状态机是"权威状态源"，防止前端篡改考试流程（如跳过 Part 2 计时）、保证多客户端一致性、且计时器精度不受浏览器标签切换影响。

**详解**:

口语模考有严格的阶段流转规则：
```
part1_intro → part1_qa → part2_prep(60s) → part2_speak(130s) → part3_discussion → report_generating → completed
```

如果把状态放在前端：
1. **计时器不可靠**: 浏览器标签失焦时 `setInterval` 会被降频到 1 次/秒甚至更慢，Part 2 的 130s 计时可能严重漂移
2. **流程可绕过**: 用户可以通过 DevTools 修改状态跳过 Part 2 准备时间，破坏模考的训练价值
3. **状态分裂**: 如果网络断开又重连，前端状态可能与后端对话历史不一致

**后端状态机的关键实现**:
- `SpeakingStateMachine` 类维护 `current_phase` 和合法的 `transitions` 字典
- Part 2 计时器使用 `asyncio.create_task` 启动后台协程，每秒向前端推送 `timer` 消息
- 130s 到达时后端主动发送 `state_change` 强制进入下一阶段，不等前端触发
- LLM 回复中检测 `[TRANSITION:next_phase]` 标记自动触发阶段流转

**前端的角色是"渲染 + 反馈"**:
- 收到 `state_change` → 切换 UI 视图
- 收到 `timer` → 更新计时器显示和警报色
- 本地也维护一个 `useTimer` 作为视觉补间（后端推送间隔 1s 之间的平滑动画），但以后端数据为准做校准

---

### Q: STT/TTS 为什么使用与 LLM 相同的策略模式（Strategy Pattern）？
> 📅 2026-03-24 | 来源: AI主动记录 | 难度: 入门

**简答**: 保持项目架构一致性，且 BYOK 模式下用户可能使用不同提供商（如 Azure Speech 替代 OpenAI Whisper），策略模式让切换提供商只需新增一个实现类而不修改业务逻辑。

**详解**:

项目已有的 LLM 适配层使用 `BaseLLMClient` 抽象基类 + `OpenAICompatibleClient` 实现 + `create_llm_client()` 工厂方法的模式。STT/TTS 完全复用这个架构：

```python
# 抽象基类定义接口
class BaseSTTClient:
    async def transcribe(self, audio_data: bytes, format: str) -> STTResult: ...

class BaseTTSClient:
    async def synthesize(self, text: str, voice: str) -> TTSResult: ...

# 具体实现
class OpenAIWhisperSTTClient(BaseSTTClient): ...
class OpenAITTSClient(BaseTTSClient): ...

# 工厂方法根据 settings 创建正确的客户端
def create_stt_client(settings: SettingsPayload) -> BaseSTTClient: ...
def create_tts_client(settings: SettingsPayload) -> BaseTTSClient: ...
```

**好处**:
- `SpeakingSessionHandler` 只依赖抽象基类，不知道具体使用哪个提供商
- 新增 Azure Speech 或 Deepgram 支持只需添加一个新类 + 在工厂方法中注册
- Settings 页面的 Provider 字段决定工厂方法创建哪个实现
- 单元测试可以注入 Mock 实现，不需要真实 API Key

---

## 口语模块 — 4-Agent 并行评估（口语版）

### Q: 口语评估的 4-Agent 架构与写作评估有何不同？
> 📅 2026-03-24 | 来源: AI主动记录 | 难度: 进阶

**简答**: 口语评估替换了 TR 和 CC 两个维度为 FC（Fluency & Coherence）和 Pronunciation，因为雅思口语和写作使用不同的评分维度。

**详解**:

**写作评估维度**: TR / CC / LR / GRA
**口语评估维度**: FC / LR / GRA / Pronunciation

差异在于：
1. **Fluency & Coherence (FC)** 替代了 TR + CC：口语不像写作那样有"任务完成度"的概念，而是评估说话的流利程度、自我纠正能力、话语组织和连贯性
2. **Pronunciation** 是口语独有的维度：评估语音、语调、重音、连读等（写作没有这个维度）
3. **LR 和 GRA** 在写作和口语中概念一致，但评分标准（Band Descriptors）的具体描述有差异

**实现上的复用**:
- 4-Agent 并行 + Chief Examiner 汇总的架构完全复用写作模块的 `asyncio.gather` 模式
- 每个 Agent 的 Prompt 包含对应维度的口语 Band Descriptors（Band 5-9）
- Chief Examiner 同样负责汇总四份报告、计算总分、生成 Markdown 综合评估
- 评估基于完整对话转录文本（而非录音音频），因此 Pronunciation 评估是基于文本推断而非声学分析

**局限性**: 当前的 Pronunciation 评估依赖 LLM 从转录文本中推断发音问题（如不自然的词汇选择可能暗示发音困难），精度不如声学分析。未来可考虑接入专业的发音评估 API（如 SpeechAce）来增强这一维度。
