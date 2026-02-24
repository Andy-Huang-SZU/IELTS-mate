from __future__ import annotations

import json
import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.writing import WritingSession
from app.schemas.writing import (
    AgentReport,
    EvaluateData,
    Scores,
    SessionDetailData,
    SessionListItem,
    TopicData,
)
from app.services.llm.base import BaseLLMClient


def _strip_json_fence(text: str) -> str:
    """Remove ```json ... ``` fences from LLM output."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


# ── Generate Topic ──

TOPIC_PART_A_PROMPT = """You are an IELTS examiner. Generate an IELTS Academic Writing Task 1 question.
Return ONLY valid JSON (no markdown fences) with this exact structure:
{
  "task_type": "part_a",
  "prompt": "<full task description>",
  "chart_type": "<bar|line|pie>",
  "chart_data": {
    "title": "<chart title>",
    "categories": ["cat1", "cat2", ...],
    "series": [{"name": "Series1", "data": [1,2,3,...]}, ...],
    "unit": "<%|million|...>"
  }
}
Make the data realistic and varied. The prompt should describe the chart and ask the candidate to summarise the information."""

TOPIC_PART_B_PROMPT = """You are an IELTS examiner. Generate an IELTS Academic Writing Task 2 question.
Return ONLY valid JSON (no markdown fences) with this exact structure:
{
  "task_type": "part_b",
  "prompt": "<full essay question>"
}
The question should follow standard IELTS Task 2 formats (agree/disagree, discuss both views, advantages/disadvantages, problem/solution, etc.)."""


async def generate_topic(llm: BaseLLMClient, task_type: str) -> TopicData:
    prompt = TOPIC_PART_A_PROMPT if task_type == "part_a" else TOPIC_PART_B_PROMPT
    raw = await llm.chat(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.9,
        max_tokens=2048,
    )
    data = json.loads(_strip_json_fence(raw))
    return TopicData(**data)


# ── Evaluate Essay ──

EVALUATE_PROMPT_TEMPLATE = """You are a senior IELTS writing examiner. Evaluate the following essay.

**Task type**: {task_type}
**Topic**: {topic}
**Essay**:
{essay}

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "scores": {{
    "tr": <float 0-9>,
    "cc": <float 0-9>,
    "lr": <float 0-9>,
    "gra": <float 0-9>,
    "overall": <float 0-9>
  }},
  "agent_reports": {{
    "tr": {{
      "criterion": "Task Response",
      "score": <float>,
      "strengths": ["..."],
      "weaknesses": ["..."],
      "suggestions": ["..."],
      "detailed_annotations": [
        {{"text": "<quoted phrase from essay>", "issue": "<problem>", "suggestion": "<fix>"}}
      ]
    }},
    "cc": {{ <same structure, criterion="Coherence and Cohesion"> }},
    "lr": {{ <same structure, criterion="Lexical Resource"> }},
    "gra": {{ <same structure, criterion="Grammatical Range and Accuracy"> }}
  }},
  "report_markdown": "<A comprehensive IELTS Writing Assessment Report in Markdown format with headings, bullet points, overall score, dimension analysis, key quotes, and actionable tips>"
}}

Be strict but fair. Provide specific examples from the essay. Scores should be realistic IELTS band scores (can use .5 increments). The report_markdown should be detailed (300+ words)."""


async def evaluate_essay(
    session: AsyncSession,
    llm: BaseLLMClient,
    session_id: int | None,
    task_type: str,
    topic: str,
    topic_data: dict | None,
    user_essay: str,
) -> EvaluateData:
    prompt = EVALUATE_PROMPT_TEMPLATE.format(
        task_type="Task 1" if task_type == "part_a" else "Task 2",
        topic=topic,
        essay=user_essay,
    )
    raw = await llm.chat(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=4096,
    )
    data = json.loads(_strip_json_fence(raw))

    scores = Scores(**data["scores"])
    agent_reports = {k: AgentReport(**v) for k, v in data.get("agent_reports", {}).items()}
    report_md = data.get("report_markdown", "")
    word_count = len(user_essay.split())

    if session_id:
        result = await session.execute(select(WritingSession).where(WritingSession.id == session_id))
        row = result.scalar_one_or_none()
        if row:
            row.user_essay = user_essay
            row.word_count = word_count
            row.overall_score = scores.overall
            row.scores = json.dumps(scores.model_dump())
            row.agent_reports = json.dumps({k: v.model_dump() for k, v in agent_reports.items()})
            row.report_markdown = report_md
            await session.commit()
            await session.refresh(row)
            return EvaluateData(
                session_id=row.id,
                scores=scores,
                agent_reports=agent_reports,
                report_markdown=report_md,
            )

    row = WritingSession(
        task_type=task_type,
        topic=topic,
        topic_data=json.dumps(topic_data) if topic_data else None,
        user_essay=user_essay,
        word_count=word_count,
        overall_score=scores.overall,
        scores=json.dumps(scores.model_dump()),
        agent_reports=json.dumps({k: v.model_dump() for k, v in agent_reports.items()}),
        report_markdown=report_md,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)

    return EvaluateData(
        session_id=row.id,
        scores=scores,
        agent_reports=agent_reports,
        report_markdown=report_md,
    )


# ── Session Queries ──

async def get_sessions(
    session: AsyncSession,
    task_type: str = "all",
    page: int = 1,
    page_size: int = 20,
) -> tuple[int, list[SessionListItem]]:
    base = select(WritingSession)
    count_q = select(func.count(WritingSession.id))

    if task_type != "all":
        base = base.where(WritingSession.task_type == task_type)
        count_q = count_q.where(WritingSession.task_type == task_type)

    total_result = await session.execute(count_q)
    total = total_result.scalar() or 0

    q = base.order_by(WritingSession.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(q)
    rows = result.scalars().all()

    items = [SessionListItem.model_validate(r) for r in rows]
    return total, items


async def get_session_detail(session: AsyncSession, session_id: int) -> SessionDetailData | None:
    result = await session.execute(select(WritingSession).where(WritingSession.id == session_id))
    row = result.scalar_one_or_none()
    if not row:
        return None

    scores = Scores(**json.loads(row.scores)) if row.scores else None
    agent_reports = {}
    if row.agent_reports:
        raw = json.loads(row.agent_reports)
        agent_reports = {k: AgentReport(**v) for k, v in raw.items()}

    return SessionDetailData(
        session_id=row.id,
        task_type=row.task_type,
        topic=row.topic,
        topic_data=json.loads(row.topic_data) if row.topic_data else None,
        user_essay=row.user_essay,
        word_count=row.word_count,
        scores=scores,
        agent_reports=agent_reports,
        report_markdown=row.report_markdown or "",
        created_at=row.created_at,
    )
