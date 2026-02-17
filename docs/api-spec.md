# IELTS-mate API 规格文档

> 最后更新：2026-02-17
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
  "tts_voice": "alloy"
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
  "quality": 3    // 0=Again, 2=Hard, 3=Good, 5=Easy
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

### 4.4 获取学习热力图数据

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

### 4.5 获取学习曲线数据

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

### 4.6 搜索/浏览词汇

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

### 5.1 生成写作题目

`POST /api/writing/generate-topic`

**请求体：**
```json
{
  "task_type": "part_a" | "part_b"
}
```

**响应 data (Part A - 小作文)：**
```json
{
  "task_type": "part_a",
  "prompt": "The chart below shows the percentage of households...",
  "chart_type": "bar" | "line" | "pie",
  "chart_data": {
    "title": "Household Energy Consumption by Source (2000-2020)",
    "categories": ["2000", "2005", "2010", "2015", "2020"],
    "series": [
      { "name": "Natural Gas", "data": [42, 38, 35, 30, 25] },
      { "name": "Electricity", "data": [30, 35, 40, 45, 50] },
      { "name": "Solar", "data": [2, 5, 10, 15, 20] }
    ],
    "unit": "%"
  }
}
```

**响应 data (Part B - 大作文)：**
```json
{
  "task_type": "part_b",
  "prompt": "Some people believe that university education should be free for all students. To what extent do you agree or disagree?"
}
```

### 5.2 提交作文进行评估

`POST /api/writing/evaluate`

**请求体：**
```json
{
  "session_id": null,           // null = 新建, 有值 = 更新已有记录
  "task_type": "part_b",
  "topic": "Some people believe...",
  "topic_data": null,            // Part A 时为 chart_data JSON
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

### 5.3 获取写作历史记录

`GET /api/writing/sessions`

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| task_type | string | all | 筛选: all/part_a/part_b |
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
      "topic": "Some people believe...",
      "overall_score": 6.5,
      "created_at": "2026-02-17T10:30:00Z"
    }
  ]
}
```

### 5.4 获取单次写作详情

`GET /api/writing/sessions/{session_id}`

**响应 data：** 同 5.2 的完整评估结果

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

### 6.5 获取口语报告

`GET /api/speaking/sessions/{session_id}/report`

**响应 data：**
```json
{
  "session_id": 5,
  "mode": "mock_test",
  "transcript": [
    { "role": "examiner", "text": "Good afternoon...", "timestamp": 0 },
    { "role": "candidate", "text": "Good afternoon...", "timestamp": 3.2 }
  ],
  "report_markdown": "# IELTS Speaking Assessment\n\n## Pronunciation Issues\n...",
  "scores": {
    "fluency_coherence": 6.5,
    "lexical_resource": 6.0,
    "grammar_range_accuracy": 6.5,
    "pronunciation": 6.0,
    "overall": 6.25
  }
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
