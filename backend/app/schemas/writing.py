from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ── Requests ──

class GenerateTopicRequest(BaseModel):
    task_type: str = Field(description="part_a or part_b")
    chart_type: str | None = Field(default=None, description="bar/line/pie/table/map/mixed/process (Task 1 only)")
    question_type: str | None = Field(default=None, description="opinion/discussion/problem_solution/two_part/advantage_disadvantage (Task 2 only)")
    theme: str | None = Field(default=None, description="Topic theme, e.g. education, technology. Random if null.")


class RandomTopicRequest(BaseModel):
    task_type: str | None = Field(default=None, description="part_a or part_b. Null for any.")
    chart_type: str | None = Field(default=None, description="Filter by chart type (Task 1)")
    question_type: str | None = Field(default=None, description="Filter by question type (Task 2)")


class EvaluateRequest(BaseModel):
    session_id: int | None = Field(default=None, description="null=新建, 有值=更新已有记录")
    task_type: str = Field(description="part_a or part_b")
    topic_id: str | None = Field(default=None, description="题目 ID，例如 T1-BAR-0001")
    topic: str
    topic_data: dict | None = Field(default=None, description="完整题目快照，包含结构化图表/题型/标签/来源等信息")
    user_essay: str


# ── Response data ──

class ChartSeries(BaseModel):
    name: str
    data: list[float]


class ChartData(BaseModel):
    title: str = ""
    categories: list[str] = []
    series: list[ChartSeries] = []
    unit: str = ""
    # Table-specific fields
    columns: list[str] = []
    rows: list[list] = []
    # Combination-specific fields (legacy, kept for backward compat with existing topics)
    bar_series: list[ChartSeries] = []
    line_series: list[ChartSeries] = []
    bar_unit: str = ""
    line_unit: str = ""
    # Process-specific fields
    mermaid_code: str = ""
    steps: list[str] = []
    # Map-specific fields — two maps for before/after comparison
    maps: list[dict] = []
    # Mixed-specific fields — two independent sub-charts
    sub_charts: list[dict] = []


class TopicData(BaseModel):
    id: str = ""
    legacy_id: str | None = None
    task_type: str
    prompt: str
    chart_type: str | None = None
    chart_data: ChartData | dict | None = None
    question_type: str | None = None
    topic_tags: list[str] = []
    difficulty: str = "medium"
    source: str = "generated"


class TopicResponse(BaseModel):
    success: bool = True
    data: TopicData
    message: str = "ok"
    usage: dict | None = None  # Token usage from LLM (prompt_tokens, completion_tokens, total_tokens)


class TopicListData(BaseModel):
    total: int
    topics: list[TopicData]


class TopicListResponse(BaseModel):
    success: bool = True
    data: TopicListData
    message: str = "ok"


class TokenEstimateResponse(BaseModel):
    success: bool = True
    data: dict  # {prompt_tokens, completion_tokens, total_tokens}
    message: str = "ok"


class TopicBankStatsResponse(BaseModel):
    success: bool = True
    data: dict  # {total, breakdown}
    message: str = "ok"


class DetailedAnnotation(BaseModel):
    text: str = ""
    issue: str = ""
    suggestion: str = ""


class AgentReport(BaseModel):
    criterion: str = ""
    score: float = 0
    strengths: list[str] = []
    weaknesses: list[str] = []
    suggestions: list[str] = []
    detailed_annotations: list[DetailedAnnotation] = []


class Scores(BaseModel):
    tr: float = 0
    cc: float = 0
    lr: float = 0
    gra: float = 0
    overall: float = 0


class EvaluateData(BaseModel):
    session_id: int
    scores: Scores
    agent_reports: dict[str, AgentReport] = {}
    report_markdown: str = ""


class EvaluateResponse(BaseModel):
    success: bool = True
    data: EvaluateData
    message: str = "ok"


class SessionListItem(BaseModel):
    id: int
    task_type: str
    topic_id: str | None = None
    topic: str
    topic_data: dict | None = None
    word_count: int = 0
    overall_score: float | None = None
    scores: Scores | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionListData(BaseModel):
    total: int
    sessions: list[SessionListItem]


class SessionListResponse(BaseModel):
    success: bool = True
    data: SessionListData
    message: str = "ok"


class RewriteSuggestion(BaseModel):
    text: str
    source: str = "chief"  # "chief" | "agent"
    dimension: str | None = None


class StructuredReportData(BaseModel):
    """Backend-parsed structured report — allows frontend to skip brittle regex."""
    summary_title: str = "Chief Examiner Summary"
    summary_paragraphs: list[str] = []
    model_answer_title: str = "Model Answer"
    model_answer_paragraphs: list[str] = []
    rewrite_title: str = "Rewrite Suggestions"
    rewrite_suggestions: list[RewriteSuggestion] = []
    has_model_answer: bool = False
    has_rewrite_suggestions: bool = False


class SessionDetailData(BaseModel):
    session_id: int
    task_type: str
    topic_id: str | None = None
    topic: str
    topic_data: dict | None = None
    user_essay: str
    word_count: int = 0
    scores: Scores | None = None
    agent_reports: dict[str, AgentReport] = {}
    report_markdown: str = ""
    structured_report: StructuredReportData | None = None
    created_at: datetime


class SessionDetailResponse(BaseModel):
    success: bool = True
    data: SessionDetailData
    message: str = "ok"


# ── Topic aggregation (By Topic view) ──

class TopicAggregateItem(BaseModel):
    """Aggregated stats for a single topic_id."""
    topic_id: str
    task_type: str
    topic: str  # latest topic text
    topic_data: dict | None = None
    attempts: int = 0
    avg_score: float | None = None
    best_score: float | None = None
    latest_score: float | None = None
    latest_at: datetime | None = None


class TopicAggregateData(BaseModel):
    total: int
    topics: list[TopicAggregateItem]


class TopicAggregateResponse(BaseModel):
    success: bool = True
    data: TopicAggregateData
    message: str = "ok"


class TopicTrendPoint(BaseModel):
    session_id: int
    overall_score: float | None = None
    scores: Scores | None = None
    word_count: int = 0
    created_at: datetime


class TopicTrendData(BaseModel):
    topic_id: str
    attempts: list[TopicTrendPoint]


class TopicTrendResponse(BaseModel):
    success: bool = True
    data: TopicTrendData
    message: str = "ok"
