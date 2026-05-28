# 写作模块题目系统 — 详细实施计划

> **创建日期**：2026-03-15  
> **预计使用模型**：DeepSeek V3（题目生成）  
> **状态**：待实施

---

## 〇、目标概述

将写作模块从"每次实时 LLM 生成题目"升级为**三层题目供给混合模式**：

1. **预置题库**（JSON 文件，约 130 道题，离线可用）
2. **AI 在线生成**（实时调用 LLM，带 Token 成本预估）
3. **用户自定义**（可手动录入题目，后续迭代考虑）

同时改造**用户选题体验**（随机模拟 / 单项练习 / 自由选择），增加**独立的题目生成 LLM 配置**和**Token 成本预估系统**。

---

## 一、实施阶段总览

```
Phase A: 后端基础设施改造         ← 你可以在此阶段后试生成 1~2 道题验证
  ├── Step A1: Settings Schema 扩展（题目生成 LLM 配置 + Token 价格字段）
  ├── Step A2: LLM 客户端改造（返回 usage 数据）
  ├── Step A3: Token 成本预估服务
  └── Step A4: 题目 JSON Schema 设计 + TopicData 模型扩展

Phase B: 题目生成 Prompt 工程
  ├── Step B1: Task 1 数据图题目生成 Prompt（bar/line/pie/table/combination）
  ├── Step B2: Task 1 流程图题目生成 Prompt（process diagram + Mermaid 语法）
  ├── Step B3: Task 2 题目生成 Prompt（5 种子类型）
  └── Step B4: 生成验证脚本（JSON 格式校验 + Mermaid 语法校验）

Phase C: 题库文件 & 批量生成
  ├── Step C1: 创建题库 JSON 文件框架
  ├── Step C2: 批量生成脚本（调用 LLM + 自动校验 + 写入 JSON）
  └── Step C3: 手动试生成 1~2 道题验证效果（你亲自验收）

Phase D: 前端改造
  ├── Step D1: Writing Hub 页面改造（三种模式入口）
  ├── Step D2: Writing Editor 改造（题库 / AI 生成双通道 + Token 预估展示）
  ├── Step D3: Task 1 图表渲染升级（ECharts + Table HTML + Mermaid 流程图）
  └── Step D4: Settings 页面增加题目生成 LLM 配置 + Token 价格配置

Phase E: 后端 API 改造
  ├── Step E1: 题目 API 改造（支持题库随机抽取 + AI 在线生成 + 按类型筛选）
  ├── Step E2: Token 使用量记录 & 统计 API
  └── Step E3: 题库管理 API（列表 / 统计 / 刷新）

Phase F: 文档更新
  └── 全量同步更新 HANDOVER.md / api-spec.md / architecture.md / development-guide.md / frontend-pages.md
```

---

## 二、Phase A — 后端基础设施改造

### Step A1: Settings Schema 扩展

**目标**：在 Settings 中新增"题目生成 LLM"独立配置 + Token 价格字段

**改动文件**：
- `backend/app/schemas/settings.py` — SettingsPayload 新增字段
- `backend/app/services/settings_service.py` — 适配新字段
- `src/renderer/src/types/settings.ts` — 前端类型同步

**新增字段（SettingsPayload）**：

```python
# ── 题目生成 LLM 配置 ──
topicgen_use_same_llm: bool = Field(default=True)       # True = 复用评估 LLM 配置
topicgen_provider: str = Field(default="openai_compatible")
topicgen_api_key: str = Field(default="")
topicgen_base_url: str = Field(default="https://api.deepseek.com/v1")
topicgen_model: str = Field(default="deepseek-chat")

# ── Token 价格配置（每百万 tokens 的美元价格）──
topicgen_input_price: float = Field(default=0.27)        # DeepSeek V3 默认值
topicgen_output_price: float = Field(default=1.10)       # DeepSeek V3 默认值
eval_input_price: float = Field(default=2.50)             # GPT-4o 默认值
eval_output_price: float = Field(default=10.00)           # GPT-4o 默认值
```

**逻辑说明**：
- 当 `topicgen_use_same_llm=True` 时，题目生成复用 `llm_*` 系列字段配置的 Provider/Key/URL，但 `topicgen_model` 可以单独指定（允许用同一个 API Key 但用更便宜的模型生成题目）
- Token 价格是用户自行填写的，前端提供常用模型价格的快捷预设

**SettingsUpdateRequest 同步新增**：所有新字段都作为 Optional 加入

---

### Step A2: LLM 客户端改造（返回 usage 数据）

**目标**：`chat()` 方法返回实际 token 使用量

**改动文件**：
- `backend/app/services/llm/base.py`
- `backend/app/services/llm/openai_compatible.py`

**改造方案**：

```python
# base.py — 新增返回类型
from pydantic import BaseModel

class LLMChatResult(BaseModel):
    content: str
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0

class BaseLLMClient(ABC):
    @abstractmethod
    async def chat(self, messages, temperature, max_tokens) -> str:
        """原始方法，保持向后兼容"""
        ...

    @abstractmethod
    async def chat_with_usage(self, messages, temperature, max_tokens) -> LLMChatResult:
        """新方法，返回内容 + usage"""
        ...
```

```python
# openai_compatible.py — 实现 chat_with_usage
async def chat_with_usage(self, messages, temperature=0.7, max_tokens=4096) -> LLMChatResult:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{self.base_url}/chat/completions",
            headers={...},
            json={...},
        )
        response.raise_for_status()
        data = response.json()
        usage = data.get("usage", {})
        return LLMChatResult(
            content=data["choices"][0]["message"]["content"],
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
        )
```

**向后兼容**：原有的 `chat()` 方法保持不变，`writing_service.py` 中的评估逻辑不需要改动。新的题目生成逻辑使用 `chat_with_usage()`。

---

### Step A3: Token 成本预估服务

**目标**：提供题目生成前的 Token 预估 + 生成后的实际消耗计算

**新增文件**：`backend/app/services/token_service.py`

```python
"""
Token 成本预估与统计服务
"""

# 预估常量（基于实际 Prompt 统计）
ESTIMATES = {
    "part_b": {"input": 250, "output": 200},           # Task 2 文本题
    "part_a_bar": {"input": 350, "output": 600},        # Task 1 柱状图
    "part_a_line": {"input": 350, "output": 600},       # Task 1 折线图
    "part_a_pie": {"input": 350, "output": 500},        # Task 1 饼图
    "part_a_table": {"input": 350, "output": 500},      # Task 1 表格
    "part_a_combination": {"input": 400, "output": 700}, # Task 1 混合图
    "part_a_process": {"input": 400, "output": 500},    # Task 1 流程图
}

def estimate_generation(task_type: str, chart_type: str | None = None) -> dict:
    """预估生成一道题目的 token 消耗"""
    if task_type == "part_b":
        key = "part_b"
    else:
        key = f"part_a_{chart_type or 'bar'}"
    est = ESTIMATES.get(key, ESTIMATES["part_a_bar"])
    return {
        "estimated_input_tokens": est["input"],
        "estimated_output_tokens": est["output"],
        "estimated_total_tokens": est["input"] + est["output"],
    }

def calculate_cost(input_tokens: int, output_tokens: int,
                   input_price_per_million: float, output_price_per_million: float) -> dict:
    """计算实际费用（美元）"""
    input_cost = (input_tokens / 1_000_000) * input_price_per_million
    output_cost = (output_tokens / 1_000_000) * output_price_per_million
    return {
        "input_cost_usd": round(input_cost, 6),
        "output_cost_usd": round(output_cost, 6),
        "total_cost_usd": round(input_cost + output_cost, 6),
    }
```

---

### Step A4: 题目 JSON Schema 设计 + TopicData 模型扩展

**目标**：定义统一的题目数据结构，覆盖 6 种 Task 1 题型 + 5 种 Task 2 题型

**改动文件**：
- `backend/app/schemas/writing.py` — 扩展 TopicData、ChartData
- `src/renderer/src/services/writing.ts` — 前端类型同步

#### Task 1 统一 JSON Schema

```jsonc
{
  "id": "t1_bar_001",                    // 唯一标识：t1_{chart_type}_{序号}
  "task_type": "part_a",
  "chart_type": "bar",                   // bar | line | pie | table | combination | process
  "prompt": "The bar chart below shows...",
  "chart_data": {
    // === 数据图（bar/line/pie/combination）共用 ===
    "title": "Energy Consumption by Country",
    "categories": ["China", "USA", "India"],
    "series": [
      {"name": "Coal", "data": [65, 30, 55]},
      {"name": "Gas", "data": [10, 35, 12]}
    ],
    "unit": "%",

    // === combination 图专用 ===
    "chart_types": ["bar", "line"],      // 每个 series 对应的图表类型

    // === table 专用（直接复用 categories + series 即可）===
    // categories = 列头, series[i].name = 行头, series[i].data = 行数据

    // === process 专用 ===
    "mermaid_code": null,                 // 仅 process 有值
    "steps": null                         // 可选：流程步骤文本列表（fallback 用）
  },
  "topic_tags": ["energy", "environment"],
  "difficulty": "medium",                 // easy | medium | hard
  "source": "generated",                  // generated | curated | user
  "created_at": "2026-03-15T10:00:00Z"
}
```

#### Task 2 JSON Schema

```jsonc
{
  "id": "t2_opinion_001",                // 唯一标识：t2_{subtype}_{序号}
  "task_type": "part_b",
  "subtype": "opinion",                  // opinion | discussion | problem_solution | two_part | advantage_disadvantage
  "prompt": "Some people believe that university education should be free for all students. To what extent do you agree or disagree?",
  "topic_tags": ["education", "society"],
  "difficulty": "medium",
  "source": "generated",
  "created_at": "2026-03-15T10:00:00Z"
}
```

#### Pydantic 模型扩展

```python
# backend/app/schemas/writing.py 新增/修改

class ChartData(BaseModel):
    title: str = ""
    categories: list[str] = []
    series: list[ChartSeries] = []
    unit: str = ""
    # 新增字段
    chart_types: list[str] | None = None        # combination 图专用
    mermaid_code: str | None = None              # process 图专用
    steps: list[str] | None = None               # process fallback

class TopicData(BaseModel):
    id: str | None = None                         # 新增
    task_type: str
    prompt: str
    chart_type: str | None = None
    chart_data: ChartData | None = None
    subtype: str | None = None                    # 新增：Task 2 子类型
    topic_tags: list[str] = []                    # 新增
    difficulty: str = "medium"                    # 新增
    source: str = "generated"                     # 新增
    created_at: str | None = None                 # 新增
```

---

## 三、Phase B — 题目生成 Prompt 工程

### Step B1: Task 1 数据图题目生成 Prompt

**文件**：`backend/app/services/topic_generation.py`（新建）

针对 5 种数据图类型，分别设计专门的 Prompt：

#### Bar Chart Prompt

```
You are an IELTS Academic Writing Task 1 question designer.
Generate a Bar Chart question with realistic data.

Requirements:
1. Topic must be academic and suitable for IELTS (e.g., education, economy, demographics, environment)
2. Data must be realistic and internally consistent
3. Include 3-6 categories and 1-3 data series
4. Values should have clear trends/comparisons worth describing
5. Unit must be specified (%, million, number, etc.)

Return ONLY valid JSON (no markdown fences):
{
  "id": "t1_bar_<3-digit-number>",
  "task_type": "part_a",
  "chart_type": "bar",
  "prompt": "<full IELTS-style task description starting with 'The bar chart below shows...'>",
  "chart_data": {
    "title": "<descriptive chart title>",
    "categories": ["<cat1>", "<cat2>", ...],
    "series": [{"name": "<series name>", "data": [<num1>, <num2>, ...]}],
    "unit": "<unit>"
  },
  "topic_tags": ["<tag1>", "<tag2>"],
  "difficulty": "<easy|medium|hard>"
}
```

类似地为 **Line Graph**、**Pie Chart**、**Table**、**Combination Chart** 各写一份专门 Prompt。

#### Table 专用 Prompt 补充说明

Table 的 `chart_data` 复用 `categories + series` 结构：
- `categories` = 表头（列名）
- `series[i].name` = 行名
- `series[i].data` = 该行的数据

#### Combination Chart 专用补充

新增 `chart_types` 字段：
```json
"chart_types": ["bar", "line"]  // 第一个 series 用柱状图，第二个用折线图
```

---

### Step B2: Task 1 流程图题目生成 Prompt

```
You are an IELTS Academic Writing Task 1 question designer.
Generate a Process Diagram question with Mermaid.js flowchart syntax.

Requirements:
1. Topic: natural process, manufacturing process, or lifecycle (e.g., chocolate making, water treatment, silk production)
2. Mermaid syntax must be valid and renderable (use "flowchart TD" or "flowchart LR")
3. Include 6-12 steps
4. Use simple node shapes: [text] for rectangles, (text) for rounded, {text} for diamonds (decision)
5. Use clear --> arrows with optional labels
6. Do NOT use special characters that would break Mermaid parsing (no quotes inside nodes, no semicolons)

Return ONLY valid JSON:
{
  "id": "t1_process_<3-digit-number>",
  "task_type": "part_a",
  "chart_type": "process",
  "prompt": "<IELTS-style task description starting with 'The diagram below shows the process of...'>",
  "chart_data": {
    "title": "<process title>",
    "mermaid_code": "<valid Mermaid flowchart code>",
    "steps": ["<step1 text>", "<step2 text>", ...]
  },
  "topic_tags": ["<tag1>", "<tag2>"],
  "difficulty": "<easy|medium|hard>"
}
```

---

### Step B3: Task 2 题目生成 Prompt

为 5 种子类型各设计一份 Prompt：

| 子类型 | Prompt 关键指导 |
|--------|----------------|
| `opinion` | "To what extent do you agree or disagree?" 格式 |
| `discussion` | "Discuss both views and give your opinion." 格式 |
| `problem_solution` | "What are the problems? What solutions can you suggest?" |
| `two_part` | 两个相关但不同的问题 |
| `advantage_disadvantage` | "Do the advantages outweigh the disadvantages?" |

**Prompt 模板示例（opinion）**：

```
You are an IELTS Academic Writing Task 2 question designer.
Generate an Opinion (Agree/Disagree) essay question.

Requirements:
1. Topic should be academic and debatable (education, technology, health, environment, society, culture, government, etc.)
2. Question MUST end with "To what extent do you agree or disagree?"
3. The statement should be clear and specific enough for a 250+ word essay
4. Avoid overly controversial or politically sensitive topics
5. Vary the topic domain (do not repeat education if previous questions were about education)

Return ONLY valid JSON:
{
  "id": "t2_opinion_<3-digit-number>",
  "task_type": "part_b",
  "subtype": "opinion",
  "prompt": "<full IELTS-style essay question>",
  "topic_tags": ["<tag1>", "<tag2>"],
  "difficulty": "<easy|medium|hard>"
}
```

---

### Step B4: 生成验证脚本

**新增文件**：`backend/scripts/validate_topic.py`

```python
"""
题目生成验证脚本：
1. JSON 格式校验（Pydantic 模型校验）
2. 数据合理性检查（categories 长度 = data 长度等）
3. Mermaid 语法校验（仅 process 类型，调用 mermaid-cli 或内嵌校验）
"""

def validate_topic(topic_dict: dict) -> tuple[bool, list[str]]:
    """返回 (is_valid, error_messages)"""
    errors = []

    # 1. Pydantic 校验
    try:
        topic = TopicData(**topic_dict)
    except ValidationError as e:
        return False, [str(e)]

    # 2. 数据一致性检查
    if topic.task_type == "part_a" and topic.chart_data:
        cd = topic.chart_data
        if topic.chart_type in ("bar", "line", "pie", "table", "combination"):
            for s in cd.series:
                if len(s.data) != len(cd.categories):
                    errors.append(f"Series '{s.name}' has {len(s.data)} values but {len(cd.categories)} categories")

    # 3. Mermaid 语法校验（process 类型）
    if topic.chart_type == "process" and topic.chart_data and topic.chart_data.mermaid_code:
        is_valid_mermaid, mermaid_error = validate_mermaid(topic.chart_data.mermaid_code)
        if not is_valid_mermaid:
            errors.append(f"Invalid Mermaid syntax: {mermaid_error}")

    return len(errors) == 0, errors
```

**Mermaid 校验方案**：

方案 A（推荐）：安装 `@mermaid-js/mermaid-cli` 作为 Node 工具，通过 `subprocess` 调用：
```bash
npx -y @mermaid-js/mermaid-cli -i input.mmd -o output.svg --quiet
```
如果退出码 ≠ 0 则语法有误。

方案 B（轻量）：使用 Python 正则做基础语法检查（能覆盖 80% 常见错误）。

**选择方案 A**，因为我们是 Electron + Node 环境，本身就有 Node.js 运行时。

---

## 四、Phase C — 题库文件 & 批量生成

### Step C1: 题库 JSON 文件框架

**新增文件**：`backend/data/writing_topics.json`

```jsonc
{
  "version": "1.0.0",
  "generated_at": "2026-03-15T00:00:00Z",
  "generator_model": "deepseek-chat (DeepSeek V3)",
  "statistics": {
    "task1_total": 80,
    "task2_total": 50,
    "task1_by_type": {
      "bar": 20,
      "line": 18,
      "pie": 12,
      "table": 15,
      "combination": 7,
      "process": 8
    },
    "task2_by_type": {
      "opinion": 18,
      "discussion": 12,
      "problem_solution": 7,
      "two_part": 7,
      "advantage_disadvantage": 6
    }
  },
  "topics": {
    "part_a": [],   // TopicData[] — 80 道 Task 1 题
    "part_b": []    // TopicData[] — 50 道 Task 2 题
  }
}
```

---

### Step C2: 批量生成脚本

**新增文件**：`backend/scripts/generate_topics.py`

```
功能：
1. 读取配置（LLM API Key / Base URL / Model）
2. 按照 Step B1-B3 的 Prompt，逐个调用 LLM 生成题目
3. 每生成一道立即调用 validate_topic() 校验
4. 校验不通过则重试（最多 3 次）
5. 通过后追加到 writing_topics.json
6. 打印进度和 token 消耗统计

使用方式：
  python -m scripts.generate_topics \
    --api-key "sk-xxx" \
    --base-url "https://api.deepseek.com/v1" \
    --model "deepseek-chat" \
    --task "part_a" \
    --chart-type "bar" \
    --count 20

也可以用 --task "all" --count-config 来按配额批量生成所有类型。
```

**关键设计**：
- 逐条生成（非批量），每条之间间隔 1 秒避免触发限流
- 生成过程中实时写入 JSON 文件（断点续传）
- 支持 `--dry-run` 只输出 Prompt 不调用 API
- 支持 `--start-id` 从指定序号开始（用于增量生成）
- Mermaid 校验失败时，将失败的代码片段附加到重试 Prompt 中，告诉 LLM 具体的错误

---

### Step C3: 手动试生成验证（你亲自验收）

**操作步骤**：

```bash
# 1. 进入后端目录
cd /data/workspace/IELTS-mate/backend

# 2. 先生成 1 道 Task 1 Bar Chart 题（验证数据图生成质量）
python -m scripts.generate_topics \
  --api-key "你的 DeepSeek API Key" \
  --base-url "https://api.deepseek.com/v1" \
  --model "deepseek-chat" \
  --task part_a --chart-type bar --count 1

# 3. 再生成 1 道 Task 2 Opinion 题（验证文本题生成质量）
python -m scripts.generate_topics \
  --api-key "你的 DeepSeek API Key" \
  --base-url "https://api.deepseek.com/v1" \
  --model "deepseek-chat" \
  --task part_b --subtype opinion --count 1

# 4. 查看生成结果
cat data/writing_topics.json | python -m json.tool | head -50

# 5. 如果满意，再批量生成全部 130 道
python -m scripts.generate_topics \
  --task all \
  --api-key "..." --base-url "..." --model "deepseek-chat"
```

**验收标准**：
- [ ] JSON 格式正确，所有字段完整
- [ ] Task 1 的 categories 和 series.data 长度一致
- [ ] 数据合理（数值有意义，不是随机噪声）
- [ ] Prompt 描述是标准的 IELTS 题目格式
- [ ] Task 2 题目涵盖不同话题，格式正确
- [ ] 流程图的 Mermaid 代码能正常渲染（Phase D 验证）

---

## 五、Phase D — 前端改造

### Step D1: Writing Hub 页面改造

**改动文件**：`src/renderer/src/pages/Writing/Hub.tsx`

**现状**：仅有 "New Task 1" 和 "New Task 2" 两个简单入口

**改造为三种模式入口**：

```
┌─────────────────────────────────────────────────────────────┐
│  ✍️ Writing Practice                                        │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  🎲 Random Test  │  │  📝 Quick Practice│                │
│  │                  │  │                  │                 │
│  │  模拟真实考试      │  │  选择 Task 1/2    │                │
│  │  随机 Task1+Task2 │  │  快速开始单项练习  │                │
│  │  限时 60 分钟      │  │                  │                │
│  │                  │  │  [Task 1] [Task 2]│                │
│  │  [Start Test]    │  │                  │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  🎯 Custom Practice — 自由选择                         │  │
│  │                                                      │  │
│  │  Task:  ☐ Task 1  ☐ Task 2                           │  │
│  │                                                      │  │
│  │  Task 1 Chart Type:                                  │  │
│  │  ○ Any (随机)                                         │  │
│  │  ○ Bar Chart  ○ Line Graph  ○ Pie Chart              │  │
│  │  ○ Table  ○ Combination  ○ Process Diagram           │  │
│  │                                                      │  │
│  │  Task 2 Question Type:                               │  │
│  │  ○ Any (随机)                                         │  │
│  │  ○ Opinion  ○ Discussion  ○ Problem & Solution       │  │
│  │  ○ Two-part  ○ Advantage vs Disadvantage             │  │
│  │                                                      │  │
│  │  Source:                                              │  │
│  │  ○ From Topic Bank (⚡ 即时)                          │  │
│  │  ○ AI Generate (⏱ ~10s, 预计消耗 ~xxx tokens)        │  │
│  │                                                      │  │
│  │               [ Start Practice ]                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ── Recent Essays ──                                        │
│  (保持现有列表样式不变)                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**交互说明**：
1. **随机模拟测验**：点击后直接进入 Editor，随机抽 Task1+Task2 题目，启动 60 分钟倒计时
2. **快速练习**：点击 Task 1 或 Task 2 按钮，从题库随机抽取对应类型题目进入 Editor
3. **自由选择**：展开配置面板，用户精确选择题型 + 来源

---

### Step D2: Writing Editor 改造

**改动文件**：`src/renderer/src/pages/Writing/Editor.tsx`

**改动要点**：

1. **接收新的 URL 参数**：
   ```
   /writing/editor?type=task1&chart_type=bar&source=bank&topic_id=t1_bar_001
   /writing/editor?type=task1&source=ai&chart_type=process
   /writing/editor?mode=test  (模拟测验模式)
   ```

2. **双通道题目获取**：
   - `source=bank`：调用新 API `GET /api/writing/topics/random?task_type=part_a&chart_type=bar`
   - `source=ai`：调用现有 API `POST /api/writing/generate-topic`（改造后）

3. **Token 预估展示**（仅 AI 生成时）：
   ```
   🔮 正在生成题目... 预计消耗约 950 tokens
   💰 预估费用：~$0.0003（基于 DeepSeek V3 定价）
   ```

4. **生成完成后展示实际消耗**：
   ```
   ✅ 题目已生成 | 实际消耗：823 tokens（输入 312 + 输出 511）| 费用 $0.0002
   ```

5. **模拟测验模式**：增加 60 分钟倒计时 + Task 切换逻辑

---

### Step D3: Task 1 图表渲染升级

**改动文件**：`src/renderer/src/pages/Writing/Editor.tsx` 中的 `ChartRenderer` 组件

**现状**：使用简易 SVG 渲染 bar/line/pie 三种图表

**改造为**：

| 图表类型 | 渲染方式 | 说明 |
|---------|---------|------|
| bar | ECharts | 项目已安装 echarts 6.0.0 |
| line | ECharts | 同上 |
| pie | ECharts | 同上 |
| table | HTML `<table>` + Tailwind | 直接渲染，不需要图表库 |
| combination | ECharts | 使用 ECharts 多 Y 轴 / 混合图表 |
| process | Mermaid.js | 需要新安装 `mermaid` npm 包 |

**ECharts 封装组件**：

```typescript
// src/renderer/src/components/charts/WritingEChart.tsx
import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { ... } from 'echarts/components'

// 按需引入，控制包体积
echarts.use([BarChart, LineChart, PieChart, ...])

export function WritingEChart({ chartType, chartData }) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)
    const option = buildOption(chartType, chartData)  // 根据 chartType 构建 ECharts option
    chart.setOption(option)
    return () => chart.dispose()
  }, [chartType, chartData])

  return <div ref={chartRef} className="w-full h-[300px]" />
}
```

**Mermaid 流程图组件**：

```typescript
// src/renderer/src/components/charts/MermaidDiagram.tsx
import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false, theme: 'neutral' })

export function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const render = async () => {
      try {
        // 先校验语法
        await mermaid.parse(code)
        // 渲染
        const { svg } = await mermaid.render(`mermaid-${Date.now()}`, code)
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
        }
        setError(null)
      } catch (e) {
        setError(`Diagram rendering failed: ${e.message}`)
      }
    }
    render()
  }, [code])

  if (error) return <div className="text-red-500 text-xs p-4">{error}</div>
  return <div ref={containerRef} className="w-full flex justify-center p-4" />
}
```

**Table 渲染组件**：

```typescript
// src/renderer/src/components/charts/DataTable.tsx
export function DataTable({ chartData }: { chartData: ChartData }) {
  return (
    <div className="mt-4 overflow-x-auto">
      {chartData.title && <p className="text-xs text-gray-500 mb-2 text-center">{chartData.title}</p>}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50/50">
            <th className="border border-gray-200/60 px-3 py-2 text-left font-medium text-gray-600"></th>
            {chartData.categories.map((cat, i) => (
              <th key={i} className="border border-gray-200/60 px-3 py-2 text-center font-medium text-gray-600">
                {cat}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chartData.series.map((s, i) => (
            <tr key={i} className="hover:bg-gray-50/30">
              <td className="border border-gray-200/60 px-3 py-2 font-medium text-gray-700">{s.name}</td>
              {s.data.map((v, j) => (
                <td key={j} className="border border-gray-200/60 px-3 py-2 text-center text-gray-600">
                  {v}{chartData.unit ? ` ${chartData.unit}` : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**新的 ChartRenderer 路由**：

```typescript
function ChartRenderer({ chartType, chartData }) {
  if (!chartData) return null
  switch (chartType) {
    case 'table':     return <DataTable chartData={chartData} />
    case 'process':   return <MermaidDiagram code={chartData.mermaid_code} />
    case 'bar':
    case 'line':
    case 'pie':
    case 'combination':
    default:          return <WritingEChart chartType={chartType} chartData={chartData} />
  }
}
```

---

### Step D4: Settings 页面增加题目生成 LLM 配置

**改动文件**：`src/renderer/src/pages/Settings/index.tsx`

**新增 UI 区块**（插入在现有 LLM 配置区块之后）：

```
┌─────────────────────────────────────────────────┐
│  📝 题目生成 LLM 配置                              │
│                                                 │
│  ☑ 使用与评估相同的 API 配置                       │
│     (取消勾选可配置独立的 Provider / URL / Key)     │
│                                                 │
│  Model:  [ deepseek-chat          ]  ← 始终可编辑 │
│                                                 │
│  ── Token 价格 ──                                │
│  快捷预设：[DeepSeek V3] [GPT-4o-mini] [自定义]    │
│                                                 │
│  Input Price:  [ 0.27  ] $/百万 tokens            │
│  Output Price: [ 1.10  ] $/百万 tokens            │
│                                                 │
└─────────────────────────────────────────────────┘
```

**快捷预设按钮定义**：

| 预设 | Input Price | Output Price |
|------|------------|-------------|
| DeepSeek V3 | $0.27 | $1.10 |
| GPT-4o-mini | $0.15 | $0.60 |
| GPT-4o | $2.50 | $10.00 |
| Claude 3.5 Haiku | $0.25 | $1.25 |
| 自定义 | 用户手动输入 | 用户手动输入 |

---

## 六、Phase E — 后端 API 改造

### Step E1: 题目 API 改造

**改动文件**：`backend/app/api/routes/writing.py`

#### 新增端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/writing/topics/random` | 从题库随机抽取题目 |
| GET | `/api/writing/topics/stats` | 题库统计信息 |
| POST | `/api/writing/generate-topic` | 改造：AI 在线生成（返回 usage） |
| GET | `/api/writing/topics/estimate` | 预估生成成本 |

#### `GET /api/writing/topics/random`

```
查询参数：
  task_type: part_a | part_b             (必填)
  chart_type: bar | line | ... | any     (选填, 默认 any)
  subtype: opinion | discussion | ...    (选填, 默认 any)
  exclude_ids: t1_bar_001,t1_bar_002     (选填, 排除最近做过的)

响应：
{
  "success": true,
  "data": { /* TopicData */ },
  "message": "ok"
}
```

#### `POST /api/writing/generate-topic` 改造

```
请求体增加可选字段：
{
  "task_type": "part_a",
  "chart_type": "process",          // 新增
  "subtype": null                   // 新增（part_b 用）
}

响应增加 usage 信息：
{
  "success": true,
  "data": { /* TopicData */ },
  "usage": {
    "input_tokens": 312,
    "output_tokens": 511,
    "total_tokens": 823,
    "cost_usd": 0.0002
  },
  "message": "ok"
}
```

#### `GET /api/writing/topics/estimate`

```
查询参数：
  task_type: part_a | part_b
  chart_type: bar | process | ...

响应：
{
  "success": true,
  "data": {
    "estimated_input_tokens": 350,
    "estimated_output_tokens": 600,
    "estimated_total_tokens": 950,
    "estimated_cost_usd": 0.0003
  },
  "message": "ok"
}
```

---

### Step E2: Token 使用量记录

**可选（Phase E 可延后）**：在 SQLite 中新增 `token_usage` 表，记录每次 LLM 调用的 token 消耗。

```sql
CREATE TABLE token_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,         -- 'topic_generation' | 'essay_evaluation'
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 七、Phase F — 文档更新

Phase A~E 全部完成后，一次性更新以下文档：

| 文档 | 更新内容 |
|------|---------|
| `HANDOVER.md` | 更新写作模块完成状态；新增"三层题目供给"架构描述；更新待办列表 |
| `docs/api-spec.md` | 新增题库相关 API 端点；更新 generate-topic 端点 |
| `docs/architecture.md` | 新增"题目供给系统"架构图；更新 Service Layer 描述 |
| `docs/development-guide.md` | 更新 Phase 4 checklist |
| `docs/frontend-pages.md` | 更新 Writing Hub / Editor 的页面规格 |
| `docs/frontend-design-new.md` | 新增 ECharts / Mermaid / Table 组件说明 |

---

## 八、依赖安装清单

### 前端（npm）

```bash
# Mermaid.js — 流程图渲染
pnpm add mermaid

# ECharts 已安装 (echarts 6.0.0)，无需新增
```

### 后端（Python）

```bash
# 无新增 Python 依赖
# tiktoken 可选安装（用于更精确的 token 预估，但 DeepSeek 的 tokenizer 不是 tiktoken 兼容的）
# 暂不安装，使用固定预估值
```

### 开发工具（全局 / npx）

```bash
# Mermaid CLI — 用于生成脚本中的语法校验（通过 npx 调用，无需全局安装）
# npx -y @mermaid-js/mermaid-cli ...
```

---

## 九、Token 成本预估汇总

### 使用 DeepSeek V3 的成本

| 项目 | 数量 | 单次预估 tokens | 单价 | 小计 |
|------|------|----------------|------|------|
| Task 2（50 道） | 50 | ~450 | ~$0.0002 | ~$0.01 |
| Task 1 数据图（72 道） | 72 | ~950 | ~$0.0005 | ~$0.036 |
| Task 1 流程图（8 道） | 8 | ~900 | ~$0.0004 | ~$0.003 |
| 重试开销（~20%） | — | — | — | ~$0.01 |
| **总计** | **130** | — | — | **~$0.06（≈ ¥0.4）** |

> DeepSeek V3 生成全部 130 道初始题库，**总成本不到 ¥1**。

### 常用模型对比（生成全部 130 道题）

| 模型 | 预计总成本 |
|------|-----------|
| DeepSeek V3 | ~$0.06（¥0.4） |
| GPT-4o-mini | ~$0.04（¥0.3） |
| GPT-4o | ~$0.80（¥5.5） |
| Claude 3.5 Sonnet | ~$1.20（¥8.5） |

---

## 十、实施顺序 & 时间线建议

```
Day 1: Phase A (A1-A4) — 后端基础设施改造
  → 你可以在 A4 完成后用 Postman/curl 直接调 API 测试

Day 2: Phase B (B1-B4) — Prompt 工程 + 验证脚本
  ↓
  ★ Phase C Step C3: 你亲自试生成 1~2 道题验证效果 ★
  ↓
  （确认效果 OK 后继续）

Day 3: Phase C (C1-C2) — 批量生成 130 道题库

Day 4-5: Phase D (D1-D4) — 前端改造（Hub + Editor + 图表渲染 + Settings）

Day 6: Phase E (E1-E3) — 后端 API 改造 + 联调

Day 7: Phase F — 文档更新 + 最终验收
```

---

## 十一、风险 & 应对

| 风险 | 影响 | 应对方案 |
|------|------|---------|
| DeepSeek V3 生成的 Mermaid 语法错误率高 | 流程图题目质量差 | 在 Prompt 中加入 Mermaid 语法规范样例；重试时附带错误信息引导修正 |
| DeepSeek V3 生成的数据不合理 | 图表显示异常 | validate_topic 中增加数值范围检查；异常值自动标记人工审核 |
| ECharts combination 图表配置复杂 | 开发耗时超预期 | 优先完成 bar/line/pie 三种基础图表，combination 可降级为并列两个 ECharts 实例 |
| Mermaid.js 在 Electron 中的兼容性 | 渲染失败 | 保留 `steps` 文本列表作为 fallback：如果 Mermaid 渲染失败，显示步骤列表 |
| 题库 JSON 文件过大 | 加载慢 | 130 道题约 100-200KB，完全可接受。未来若扩展到上千题，考虑分文件或 SQLite 存储 |

---

## 十二、验收标准 Checklist

### Phase A 验收
- [ ] Settings API 返回新增的 topicgen_* 字段
- [ ] LLM chat_with_usage() 返回正确的 token 使用量
- [ ] Token 预估服务返回合理的预估值

### Phase B 验收
- [ ] 6 种 Task 1 Prompt 能生成格式正确的 JSON
- [ ] 5 种 Task 2 Prompt 能生成格式正确的 JSON
- [ ] validate_topic 能正确检测格式错误和数据不一致
- [ ] Mermaid 语法校验能检测出无效的流程图代码

### Phase C 验收 ★
- [ ] 手动生成的 1~2 道题质量满意（你亲自确认）
- [ ] 批量生成的 130 道题全部通过校验
- [ ] writing_topics.json 格式正确，统计数据匹配

### Phase D 验收
- [ ] Writing Hub 显示三种模式入口
- [ ] 自由选择面板能正确选择题型和来源
- [ ] ECharts 正确渲染 bar/line/pie/combination 图表
- [ ] HTML 表格正确渲染 table 数据
- [ ] Mermaid 正确渲染 process 流程图（含失败 fallback）
- [ ] Settings 页面显示题目生成 LLM 配置和 Token 价格

### Phase E 验收
- [ ] 从题库随机抽题 API 正常工作
- [ ] AI 在线生成返回 usage 数据
- [ ] Token 预估 API 返回合理数据
- [ ] 前端正确展示预估和实际 Token 消耗

### Phase F 验收
- [ ] 所有文档与实际代码一致
- [ ] HANDOVER.md 中写作模块状态正确更新
