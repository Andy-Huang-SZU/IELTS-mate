from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ── Requests ──

class GenerateTopicRequest(BaseModel):
    task_type: str = Field(description="part_a or part_b")


class EvaluateRequest(BaseModel):
    session_id: int | None = Field(default=None, description="null=新建, 有值=更新已有记录")
    task_type: str = Field(description="part_a or part_b")
    topic: str
    topic_data: dict | None = None
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


class TopicData(BaseModel):
    task_type: str
    prompt: str
    chart_type: str | None = None
    chart_data: ChartData | None = None


class TopicResponse(BaseModel):
    success: bool = True
    data: TopicData
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
    topic: str
    overall_score: float | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionListData(BaseModel):
    total: int
    sessions: list[SessionListItem]


class SessionListResponse(BaseModel):
    success: bool = True
    data: SessionListData
    message: str = "ok"


class SessionDetailData(BaseModel):
    session_id: int
    task_type: str
    topic: str
    topic_data: dict | None = None
    user_essay: str
    word_count: int = 0
    scores: Scores | None = None
    agent_reports: dict[str, AgentReport] = {}
    report_markdown: str = ""
    created_at: datetime


class SessionDetailResponse(BaseModel):
    success: bool = True
    data: SessionDetailData
    message: str = "ok"
