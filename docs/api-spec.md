# IELTS-mate API 规格文档

> 最后更新：2026-03-24
>
> 基础路径：`http://127.0.0.1:{port}/api`

## 1. 通用约定

### 1.1 响应格式

所有 REST API 响应遵循统一格式：

```json
// 成功响应
{
  "success": true,
  "data": { ... },
  "message": "ok"
}

// 错误响应
{
  "success": false,
  "data": null,
  "message": "错误描述",
  "error_code": "SPECIFIC_ERROR_CODE"
}
```

### 1.2 通用错误码

| HTTP 状态码 | error_code | 说明 |
|------------|------------|------|
| 400 | `VALIDATION_ERROR` | 请求参数校验失败 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |
| 503 | `LLM_UNAVAILABLE` | LLM API 调用失败 |
| 503 | `STT_UNAVAILABLE` | STT 服务不可用 |
| 503 | `TTS_UNAVAILABLE` | TTS 服务不可用 |

---

## 2. 健康检查

### `GET /health`

Electron 主进程用于确认 Python 服务已就绪。

**响应：**
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

## 3. 设置模块 (Settings)

### 3.1 获取所有设置

`GET /api/settings`

**响应 data：**
```json
{
  "llm_provider": "openai_compatible",
  "llm_api_key": "sk-****",      // 返回时脱敏
  "llm_base_url": "https://api.openai.com/v1",
  "llm_model": "gpt-4o",
  "stt_provider": "openai_whisper",
  "stt_api_key": "sk-****",
  "stt_base_url": "https://api.openai.com/v1",
  "stt_model": "whisper-1",
  "tts_provider": "openai_tts",
  "tts_api_key": "sk-****",
  "tts_base_url": "https://api.openai.com/v1",
  "tts_model": "tts-1",
  "tts_voice": "alloy",
  "topicgen_use_same_llm": true,
  "topicgen_provider": "",
  "topicgen_api_key": "sk-****",
  "topicgen_base_url": "",
  "topicgen_model": "deepseek-chat",
  "token_price_input": 0.0,
  "token_price_output": 0.0
}
```

### 3.2 更新设置

`PUT /api/settings`

**请求体：**
```json
{
  "llm_api_key": "sk-xxxxxxxx",
  "llm_base_url": "https://api.deepseek.com/v1",
  "llm_model": "deepseek-chat",
  // ... 只传需要更新的字段
}
```

**响应 data：** 更新后的完整设置对象（同 3.1）

### 3.3 测试 API 连接

`POST /api/settings/test-connection`

**请求体：**
```json
{
  "service_type": "llm" | "stt" | "tts",
  "api_key": "sk-xxxxxxxx",
  "base_url": "https://api.openai.com/v1",
  "model": "gpt-4o"
}
```

**响应 data：**
```json
{
  "connected": true,
  "latency_ms": 342,
  "model_info": "gpt-4o"
}
```

---

## 4. 词汇模块 (Vocabulary)

### 4.1 获取今日待复习单词

`GET /api/vocabulary/review`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | int | 20 | 每次返回数量 |

**响应 data：**
```json
{
  "total_due": 42,
  "words": [
    {
      "id": 1,
      "word": "ubiquitous",
      "phonetic": "/juːˈbɪkwɪtəs/",
      "definition": "adj. 无所不在的；普遍存在的",
      "example": "Mobile phones are now ubiquitous in modern society.",
      "interval": 3,
      "repetition": 2,
      "ease_factor": 2.5,
      "status": "learning",
      "next_review": "2026-02-17"
    }
  ]
}
```

### 4.2 提交复习反馈

`POST /api/vocabulary/{word_id}/review`

**请求体：**
```json
{
  "quality": 3,    // 0=Again, 2=Hard, 3=Good, 5=Easy
  "mode": "review" // 可选，默认 "review"；可选值: "review" / "learn_quiz" / "spelling" / "dictation"
}
```

**响应 data：**
```json
{
  "word_id": 1,
  "new_interval": 6,
  "new_repetition": 3,
  "new_ease_factor": 2.6,
  "next_review": "2026-02-23",
  "status": "learning"
}
```

### 4.3 获取词汇统计

`GET /api/vocabulary/stats`

**响应 data：**
```json
{
  "total_words": 3000,
  "new_words": 1200,
  "learning_words": 800,
  "mastered_words": 1000,
  "due_today": 42,
  "streak_days": 7
}
```

### 4.5 获取干扰项（支持双向模式）

`GET /api/vocabulary/{word_id}/distractors`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| mode | string | translation | `translation`=返回中文干扰释义（英→中），`word`=返回英文干扰词（中→英） |

**响应 data：**
```json
{
  "word_id": 1,
  "distractors": ["adj. 短暂的", "adj. 模糊的", "adj. 冗余的"]
}
```

### 4.6 获取今日新词列表

`GET /api/vocabulary/new-words`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | int | 30 | 返回的新词数量（即每日新词上限） |

**响应 data：**
```json
{
  "words": [
    {
      "id": 42,
      "word": "ubiquitous",
      "phonetic": "/juːˈbɪkwɪtəs/",
      "definition": "adj. 无所不在的；普遍存在的",
      "pos": "adj",
      "difficulty": 3,
      "example": "Mobile phones are now ubiquitous."
    }
  ],
  "total": 25
}
```

### 4.7 获取今日学习摘要

`GET /api/vocabulary/today-summary`

**响应 data：**
```json
{
  "due_review_count": 15,
  "new_learned_today": 12,
  "daily_new_limit": 30
}
```

### 4.8 获取词汇学习设置

`GET /api/settings/vocabulary`

**响应 data：**
```json
{
  "daily_new_limit": 30
}
```

### 4.9 更新词汇学习设置

`PUT /api/settings/vocabulary`

**请求体：**
```json
{
  "daily_new_limit": 50
}
```

**响应 data：** 同 4.8

### 4.10 获取学习热力图数据

`GET /api/vocabulary/heatmap`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| year | int | 当前年 | 年份 |

**响应 data：**
```json
{
  "year": 2026,
  "data": [
    { "date": "2026-01-15", "count": 35 },
    { "date": "2026-01-16", "count": 28 },
    // ...
  ]
}
```

### 4.11 获取学习曲线数据

`GET /api/vocabulary/learning-curve`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| days | int | 30 | 最近 N 天 |

**响应 data：**
```json
{
  "dates": ["2026-01-18", "2026-01-19", "..."],
  "mastered": [100, 112, 130, "..."],
  "learning": [800, 790, 785, "..."]
}
```

### 4.12 搜索/浏览词汇

`GET /api/vocabulary/search`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| q | string | - | 搜索关键词 |
| status | string | all | 筛选: all/new/learning/mastered |
| page | int | 1 | 页码 |
| page_size | int | 50 | 每页数量 |

**响应 data：**
```json
{
  "total": 150,
  "page": 1,
  "page_size": 50,
  "words": [ /* 同 4.1 中的 word 对象 */ ]
}
```

---

## 5. 写作模块 (Writing)

### 5.1 AI 生成写作题目

`POST /api/writing/generate-topic`

**请求体：**
```json
{
  "task_type": "part_a" | "part_b",
  "chart_type": "bar" | "line" | "pie" | "table" | "mixed" | "map" | "process",  // Task 1 专用，7 种类型
  "question_type": "opinion" | "discussion" | "problem_solution" | "two_part" | "advantage_disadvantage",  // Task 2 专用，可选
  "theme": "education"  // 可选，指定话题主题，null 则随机
}
```

**响应 data (Part A - 小作文)：**
```json
{
  "task_type": "part_a",
  "id": "T1-BAR-0001",
  "prompt": "The chart below shows the percentage of households...",
  "chart_type": "bar",
  "chart_data": {
    "title": "Household Energy Consumption by Source (2000-2020)",
    "categories": ["2000", "2005", "2010", "2015", "2020"],
    "series": [
      { "name": "Natural Gas", "data": [42, 38, 35, 30, 25] },
      { "name": "Electricity", "data": [30, 35, 40, 45, 50] }
    ],
    "unit": "%"
  },
  "question_type": null,
  "topic_tags": ["environment", "energy"],
  "difficulty": "medium",
  "source": "generated"
}
```

**响应顶层还包含 usage 字段：**
```json
{
  "success": true,
  "data": { ... },
  "usage": {
    "prompt_tokens": 420,
    "completion_tokens": 680,
    "total_tokens": 1100
  },
  "message": "ok"
}
```

**新增图表类型的 chart_data 结构：**

Table 类型：
```json
{
  "chart_data": {
    "title": "...",
    "columns": ["Country", "2000", "2010", "2020"],
    "rows": [["USA", 100, 150, 200], ["UK", 80, 120, 160]],
    "unit": "million"
  }
}
```

Combination 类型（向后兼容旧题，新题使用 mixed）：
```json
{
  "chart_data": {
    "title": "...",
    "categories": ["2000", "2005", "2010"],
    "bar_series": [{"name": "Revenue", "data": [100, 200, 300]}],
    "line_series": [{"name": "Growth Rate", "data": [5.2, 6.1, 4.8]}],
    "bar_unit": "million",
    "line_unit": "%"
  }
}
```

Mixed 类型（双图混合题，两个独立子图）：
```json
{
  "chart_data": {
    "title": "...",
    "sub_charts": [
      {
        "chart_type": "bar",
        "chart_data": {
          "title": "Revenue by Region",
          "categories": ["2015", "2016", "2017"],
          "series": [{"name": "Asia", "data": [100, 150, 200]}],
          "unit": "million"
        }
      },
      {
        "chart_type": "pie",
        "chart_data": {
          "title": "Market Share 2017",
          "categories": ["Asia", "Europe", "Americas"],
          "series": [{"name": "Share", "data": [45, 30, 25]}],
          "unit": "%"
        }
      }
    ]
  }
}
```

Map 类型（地图题，两张地图对比 before/after）：
```json
{
  "chart_data": {
    "title": "Changes in Greenfield Town (1990 vs 2020)",
    "maps": [
      {
        "label": "1990",
        "width": 100,
        "height": 100,
        "features": [
          {"type": "building", "id": "b1", "label": "School", "x": 20, "y": 30, "width": 15, "height": 10},
          {"type": "road", "id": "r1", "label": "Main Street", "points": [[0,50],[100,50]]},
          {"type": "river", "id": "rv1", "label": "River Exe", "points": [[10,0],[15,25],[20,50],[25,75],[30,100]]},
          {"type": "park", "id": "p1", "label": "Central Park", "x": 50, "y": 40, "width": 20, "height": 20}
        ]
      },
      {
        "label": "2020",
        "width": 100,
        "height": 100,
        "features": [
          {"type": "building", "id": "b1", "label": "School", "x": 20, "y": 30, "width": 15, "height": 10},
          {"type": "building", "id": "b2", "label": "Shopping Mall", "x": 50, "y": 40, "width": 20, "height": 15},
          {"type": "road", "id": "r1", "label": "Main Street", "points": [[0,50],[100,50]]},
          {"type": "river", "id": "rv1", "label": "River Exe", "points": [[10,0],[15,25],[20,50],[25,75],[30,100]]}
        ]
      }
    ]
  }
}
```

Process 类型：
```json
{
  "chart_data": {
    "title": "Water Treatment Process",
    "mermaid_code": "graph TD\n    A[Collection] --> B[Screening]\n    B --> C[Treatment]",
    "steps": ["Collection", "Screening", "Treatment"]
  }
}
```

### 5.2 从题库随机抽取题目

`POST /api/writing/random-topic`

**请求体：**
```json
{
  "task_type": "part_a" | "part_b" | null,  // null 则任意
  "chart_type": "bar",  // 可选，仅 Task 1
  "question_type": "opinion"  // 可选，仅 Task 2
}
```

**响应：** 同 5.1 的响应格式（无 usage 字段）

**错误：** 404 — 题库中无匹配题目

### 5.3 Token 消耗预估

`GET /api/writing/topic-estimate`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| task_type | string | 必填 | part_a 或 part_b |
| chart_type | string | null | Task 1 的图表类型 |
| question_type | string | null | Task 2 的题型 |
| count | int | 1 | 预估生成数量 |

**响应 data：**
```json
{
  "prompt_tokens": 400,
  "completion_tokens": 750,
  "total_tokens": 1150,
  "estimated_cost": 0.0023,
  "cost_currency": "USD"
}
```

> 注意：`estimated_cost` 和 `cost_currency` 仅在 Settings 中配置了 `token_price_input` / `token_price_output` 后才返回非零值。

### 5.4 题库统计

`GET /api/writing/topic-bank-stats`

**响应 data：**
```json
{
  "total": 150,
  "breakdown": {
    "part_a/bar": 22,
    "part_a/line": 18,
    "part_a/pie": 12,
    "part_a/table": 12,
    "part_a/mixed": 12,
    "part_a/map": 10,
    "part_a/process": 9,
    "part_b/opinion": 11,
    "part_b/discussion": 11,
    "part_b/problem_solution": 11,
    "part_b/two_part": 11,
    "part_b/advantage_disadvantage": 11
  }
}
```

### 5.5 获取题库全量列表

`GET /api/writing/topic-bank`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| task_type | string | null | `part_a` / `part_b` |
| chart_type | string | null | Task 1 图表类型 |
| question_type | string | null | Task 2 题型 |
| difficulty | string | null | `easy` / `medium` / `hard` |

**说明：** 当前题库体量约 150 道，接口默认返回全量列表，前端可本地完成搜索、筛选和分页。

**响应 data：**
```json
{
  "total": 150,
  "topics": [
    {
      "id": "T1-BAR-0001",
      "task_type": "part_a",
      "prompt": "The chart below shows the percentage of households...",
      "chart_type": "bar",
      "chart_data": {
        "title": "Household Energy Consumption by Source (2000-2020)",
        "categories": ["2000", "2005", "2010", "2015", "2020"],
        "series": [
          { "name": "Natural Gas", "data": [42, 38, 35, 30, 25] },
          { "name": "Electricity", "data": [30, 35, 40, 45, 50] }
        ],
        "unit": "%"
      },
      "topic_tags": ["environment", "energy"],
      "difficulty": "medium",
      "source": "generated"
    }
  ]
}
```

### 5.6 提交作文进行评估

`POST /api/writing/evaluate`

**请求体：**
```json
{
  "session_id": null,
  "task_type": "part_b",
  "topic_id": "T2-OPINION-0004",
  "topic": "Some people believe...",
  "topic_data": {
    "id": "T2-OPINION-0004",
    "task_type": "part_b",
    "prompt": "Some people believe...",
    "question_type": "opinion",
    "topic_tags": ["education"],
    "difficulty": "medium",
    "source": "generated"
  },
  "user_essay": "In recent years, the debate over whether..."
}
```

**响应 data：**（注意：此接口耗时较长，推荐 SSE 或轮询）
```json
{
  "session_id": 42,
  "scores": {
    "tr": 6.5,
    "cc": 7.0,
    "lr": 6.0,
    "gra": 6.5,
    "overall": 6.5
  },
  "agent_reports": {
    "tr": {
      "criterion": "TR",
      "score": 6.5,
      "strengths": ["论点明确", "完全回应了题目要求"],
      "weaknesses": ["缺少具体例证支撑"],
      "suggestions": ["增加更多具体的实例和数据"],
      "detailed_annotations": [
        {
          "text": "many people think",
          "issue": "论述过于笼统",
          "suggestion": "使用具体的数据或例子来支撑观点"
        }
      ]
    },
    "cc": { /* 同上结构 */ },
    "lr": { /* 同上结构 */ },
    "gra": { /* 同上结构 */ }
  },
  "report_markdown": "# IELTS Writing Assessment Report\n\n## Overall Band Score: 6.5\n\n..."
}
```

### 5.7 获取写作历史记录

`GET /api/writing/sessions`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| task_type | string | all | 筛选: `all` / `part_a` / `part_b` |
| topic_id | string | null | 按题目 ID 精确筛选 |
| sort_by | string | latest | `latest` / `score_desc` / `score_asc` |
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量 |

**响应 data：**
```json
{
  "total": 15,
  "sessions": [
    {
      "id": 42,
      "task_type": "part_b",
      "topic_id": "T2-OPINION-0004",
      "topic": "Some people believe...",
      "topic_data": {
        "id": "T2-OPINION-0004",
        "task_type": "part_b",
        "prompt": "Some people believe...",
        "question_type": "opinion",
        "difficulty": "medium"
      },
      "word_count": 284,
      "overall_score": 6.5,
      "scores": {
        "tr": 6.5,
        "cc": 7.0,
        "lr": 6.0,
        "gra": 6.5,
        "overall": 6.5
      },
      "created_at": "2026-02-17T10:30:00Z"
    }
  ]
}
```

### 5.8 获取单次写作详情

`GET /api/writing/sessions/{session_id}`

**响应 data：** 返回完整评估结果，并包含 `topic_id` 与完整 `topic_data` 题目快照（Task 1 可据此重现图表 / 地图 / 流程图；前端也可用它做同题重做）。新增 `structured_report` 字段（总评摘要 + 范文 + 重写建议），保留 `report_markdown` 作为兜底。

**响应 data 中的 structured_report：**
```json
{
  "structured_report": {
    "summary_title": "Overall Assessment",
    "summary_paragraphs": ["This essay demonstrates..."],
    "model_answer_title": "Model Answer",
    "model_answer_paragraphs": ["In recent years, ..."],
    "rewrite_title": "Rewrite Suggestions",
    "rewrite_suggestions": [
      { "text": "Replace 'very important' with 'crucial'", "source": "chief", "dimension": null }
    ],
    "has_model_answer": true,
    "has_rewrite_suggestions": true
  }
}
```

> 当后端解析失败或老 session 无结构化数据时，`structured_report` 为 `null`，前端应 fallback 到本地 `parseChiefReport()` 解析。

### 5.9 按题聚合摘要

`GET /api/writing/topics/aggregate`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| task_type | string | all | `all` / `part_a` / `part_b` |
| sort_by | string | latest | `latest` / `attempts_desc` / `best_score_desc` |
| page | int | 1 | 页码 |
| page_size | int | 10 | 每页数量 |

**响应 data：**
```json
{
  "total": 8,
  "topics": [
    {
      "topic_id": "T1-BAR-0001",
      "task_type": "part_a",
      "topic": "The chart below shows the percentage of households...",
      "topic_data": { "id": "T1-BAR-0001", "chart_type": "bar", "..." : "..." },
      "attempts": 3,
      "avg_score": 6.2,
      "best_score": 7.0,
      "latest_score": 6.5,
      "latest_at": "2026-03-24T10:30:00Z"
    }
  ]
}
```

### 5.10 单题趋势明细

`GET /api/writing/topics/{topic_id}/trend`

**响应 data：**
```json
{
  "topic_id": "T1-BAR-0001",
  "attempts": [
    {
      "session_id": 42,
      "overall_score": 6.5,
      "scores": { "tr": 6.5, "cc": 7.0, "lr": 6.0, "gra": 6.5 },
      "word_count": 284,
      "created_at": "2026-03-20T10:30:00Z"
    },
    {
      "session_id": 48,
      "overall_score": 7.0,
      "scores": { "tr": 7.0, "cc": 7.0, "lr": 7.0, "gra": 7.0 },
      "word_count": 301,
      "created_at": "2026-03-24T09:00:00Z"
    }
  ]
}
```


---

## 6. 口语模块 (Speaking) - WebSocket API

### 6.1 建立连接

`WS /api/speaking/ws`

**连接查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| mode | string | `chat` 或 `mock_test` |
| topic | string | 可选，指定话题 |

### 6.2 客户端消息 (Client → Server)

#### 开始/停止录音
```json
{
  "type": "user_action",
  "action": "start" | "stop" | "end_early" | "ready"
}
```
- `start`：开始录音 (PTT 模式下按下)
- `stop`：停止录音 (PTT 模式下松开)
- `end_early`：用户提前结束 Part B
- `ready`：用户准备就绪，开始下一阶段

#### 音频数据块
```json
{
  "type": "audio_chunk",
  "data": "<base64-encoded-audio>",
  "format": "webm",
  "sample_rate": 16000
}
```

#### 切换交互模式
```json
{
  "type": "mode_switch",
  "mode": "ptt" | "vad"
}
```

### 6.3 服务端消息 (Server → Client)

#### STT 识别结果
```json
{
  "type": "transcription",
  "text": "I think education is very important...",
  "is_final": false
}
```

#### AI 文本流
```json
{
  "type": "ai_text",
  "text": "That's an interesting point. ",
  "is_final": false
}
```

#### AI 语音流
```json
{
  "type": "ai_audio",
  "data": "<base64-encoded-audio-chunk>",
  "format": "mp3"
}
```

#### 状态变更
```json
{
  "type": "state_change",
  "state": "part1_intro" | "part1_qa" | "part2_prep" | "part2_speak" | "part3_discussion" | "report_generating" | "completed",
  "metadata": {
    "topic_card": "Describe a place you visited that impressed you...",  // Part 2 话题卡
    "follow_up_points": ["Where it is", "When you went there", "..."]
  }
}
```

#### 计时器更新
```json
{
  "type": "timer",
  "phase": "part2_prep" | "part2_speak",
  "seconds_remaining": 55,
  "total_seconds": 60,
  "alert_level": "normal" | "warning" | "critical" | "expired"
}
```
- `warning`: 剩余 30s (prep) / 30s (speak)
- `critical`: 剩余 10s (speak，即 110s 处)
- `expired`: 时间到 (speak，120s 处，130s 强制中断)

#### 错误消息
```json
{
  "type": "error",
  "message": "STT service temporarily unavailable",
  "recoverable": true
}
```

### 6.4 获取口语历史

`GET /api/speaking/sessions`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| mode | string | all | 筛选: all/chat/mock_test |
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量 |

**响应 data：**
```json
{
  "total": 8,
  "sessions": [
    {
      "id": 5,
      "mode": "mock_test",
      "topic": "Describe a place...",
      "duration_seconds": 780,
      "created_at": "2026-02-17T14:00:00Z"
    }
  ]
}
```

### 6.5 获取口语详情（含报告）

`GET /api/speaking/sessions/{session_id}`

**响应 data：**
```json
{
  "session_id": 5,
  "mode": "mock_test",
  "status": "completed",
  "topic_card": {
    "topic": "Describe a place you visited recently",
    "bullet_points": ["Where it was", "When you went there", "What you did"],
    "follow_up": "Why did you enjoy this place?"
  },
  "transcript": [
    { "role": "examiner", "content": "Good afternoon...", "phase": "part1_intro", "created_at": "..." },
    { "role": "candidate", "content": "Good afternoon...", "phase": "part1_qa", "created_at": "..." }
  ],
  "report_markdown": "# IELTS Speaking Assessment\n\n## Pronunciation Issues\n...",
  "scores": {
    "fluency_coherence": 6.5,
    "lexical_resource": 6.0,
    "grammar_range_accuracy": 6.5,
    "pronunciation": 6.0,
    "overall": 6.25
  },
  "agent_reports": [
    {
      "dimension": "Fluency & Coherence",
      "score": 6.5,
      "strengths": ["..."],
      "weaknesses": ["..."],
      "suggestions": ["..."]
    }
  ],
  "duration_seconds": 780,
  "created_at": "2026-02-17T14:00:00Z"
}
```

---

## 7. 统计与仪表盘

### 7.1 获取仪表盘概览数据

`GET /api/dashboard/overview`

**响应 data：**
```json
{
  "vocabulary": {
    "total": 3000,
    "mastered": 1000,
    "due_today": 42,
    "streak_days": 7
  },
  "writing": {
    "total_sessions": 15,
    "average_score": 6.3,
    "latest_score": 6.5
  },
  "speaking": {
    "total_sessions": 8,
    "total_minutes": 120,
    "latest_score": 6.25
  },
  "today": {
    "words_reviewed": 20,
    "writing_done": false,
    "speaking_done": false
  }
}
```
