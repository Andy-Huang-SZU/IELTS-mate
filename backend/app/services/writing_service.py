"""
Writing Service — 5-Agent Parallel Evaluation Architecture

Architecture:
  4 scoring Agents (TR/CC/LR/GRA) run in parallel via asyncio.gather,
  each with its own IELTS Band Descriptors–anchored system prompt.
  A Chief Examiner agent then synthesises their reports into a final
  Markdown report with model answer and rewrite suggestions.

Retry: each sub-agent retries up to 3 times on JSON parse failure.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.writing import WritingSession
from app.schemas.writing import (
    AgentReport,
    EvaluateData,
    Scores,
    SessionDetailData,
    SessionListItem,
)
from app.services.band_descriptors import (
    get_cc_descriptors,
    get_gra_descriptors,
    get_lr_descriptors,
    get_tr_descriptors,
)
from app.services.llm.base import BaseLLMClient

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


# ─────────────────────────────────────────────
# Utility
# ─────────────────────────────────────────────

def _strip_json_fence(text: str) -> str:
    """Remove ```json ... ``` fences from LLM output."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _round_to_half(score: float) -> float:
    return round(score * 2) / 2


def _safe_json_loads(value: str | None) -> Any | None:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        logger.warning("Failed to decode persisted writing JSON payload")
        return None


def _build_topic_snapshot(
    task_type: str,
    topic: str,
    topic_id: str | None,
    topic_data: dict | None,
) -> dict[str, Any]:
    """Build a complete topic snapshot used for both evaluation and persistence."""
    snapshot = dict(topic_data) if isinstance(topic_data, dict) else {}
    snapshot["task_type"] = snapshot.get("task_type") or task_type
    snapshot["prompt"] = snapshot.get("prompt") or topic
    if topic_id and not snapshot.get("id"):
        snapshot["id"] = topic_id
    snapshot["topic_tags"] = snapshot.get("topic_tags") or []
    snapshot["difficulty"] = snapshot.get("difficulty") or "medium"
    snapshot["source"] = snapshot.get("source") or "generated"
    return snapshot


def _format_topic_snapshot(snapshot: dict[str, Any]) -> str:
    """Pretty-print topic snapshot JSON for LLM prompts."""
    return json.dumps(snapshot, ensure_ascii=False, indent=2)


def _build_session_order_by(sort_by: str):
    if sort_by == "score_desc":
        return [
            WritingSession.overall_score.is_(None),
            WritingSession.overall_score.desc(),
            WritingSession.created_at.desc(),
        ]
    if sort_by == "score_asc":
        return [
            WritingSession.overall_score.is_(None),
            WritingSession.overall_score.asc(),
            WritingSession.created_at.desc(),
        ]
    return [WritingSession.created_at.desc()]


# ─────────────────────────────────────────────
# Sub-Agent Prompt Templates
# ─────────────────────────────────────────────

_AGENT_SYSTEM_TEMPLATE = """You are an IELTS writing examiner specialising in **{criterion_name}**.
Your task is to evaluate the candidate's essay on this single dimension ONLY.

## Scoring Reference

{band_descriptors}

## Output Requirements

Return ONLY valid JSON (no markdown fences, no extra text) with this EXACT structure:
{{
  "criterion": "{criterion_name}",
  "score": <float, 0.5 increments from 1.0 to 9.0>,
  "strengths": ["<specific strength with evidence from the essay>", ...],
  "weaknesses": ["<specific weakness with evidence from the essay>", ...],
  "suggestions": ["<actionable improvement suggestion>", ...],
  "detailed_annotations": [
    {{"text": "<exact quoted phrase from the essay>", "issue": "<specific problem>", "suggestion": "<concrete fix>"}}
  ]
}}

## Guidelines

- Be strict but fair. Use the Band Descriptors above as your scoring anchor.
- ALWAYS quote specific phrases from the essay to support your evaluation.
- Scores must use 0.5 increments (e.g. 5.0, 5.5, 6.0, 6.5, 7.0 ...).
- Provide at least 2 strengths, 2 weaknesses, and 2 suggestions.
- Provide at least 3 detailed_annotations for specific text-level issues.
- If the essay is very short (under 150 words for Task 1, under 250 words for Task 2), note this as a weakness and penalise appropriately."""

_AGENT_USER_TEMPLATE = """## Essay to Evaluate

**Task type**: {task_type_label}
**Topic ID**: {topic_id}
**Topic**: {topic}

## Structured Topic Snapshot
Use the following JSON as the source of truth for the task.

```json
{topic_snapshot_json}
```

**Candidate's essay**:
---
{essay}
---

## Evaluation Notes
- For Task 1, use the structured chart/table/map/process data above to judge factual accuracy, main-feature coverage, and comparison quality.
- For Task 2, use the prompt and metadata above to judge whether the response fully addresses the question.
- Do not invent task details that are not present in the snapshot.

Evaluate this essay on the **{criterion_name}** dimension only. Return valid JSON."""


def _build_agent_prompt(
    criterion_name: str,
    band_descriptors: str,
    task_type: str,
    topic: str,
    topic_snapshot: dict[str, Any],
    essay: str,
) -> list[dict[str, str]]:
    """Build the messages list for a scoring agent."""
    task_type_label = "Task 1 (Academic)" if task_type == "part_a" else "Task 2"
    system_msg = _AGENT_SYSTEM_TEMPLATE.format(
        criterion_name=criterion_name,
        band_descriptors=band_descriptors,
    )
    user_msg = _AGENT_USER_TEMPLATE.format(
        task_type_label=task_type_label,
        topic_id=topic_snapshot.get("id") or "unknown",
        topic=topic,
        topic_snapshot_json=_format_topic_snapshot(topic_snapshot),
        essay=essay,
        criterion_name=criterion_name,
    )
    return [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
    ]


# ─────────────────────────────────────────────
# Chief Examiner Prompt
# ─────────────────────────────────────────────

_CHIEF_SYSTEM = """You are the IELTS Chief Examiner. You have received individual assessment reports from four specialist examiners covering Task Response (TR), Coherence & Cohesion (CC), Lexical Resource (LR), and Grammatical Range & Accuracy (GRA).

Your tasks:
1. Review and synthesise the four reports.
2. Calculate the overall band score as the arithmetic mean of the four scores, rounded to the nearest 0.5.
3. Write a comprehensive Markdown assessment report (400+ words) that includes:
   - Overall Band Score and a brief overall comment
   - A section for each dimension summarising the specialist's findings
   - A "Model Answer" section — write a Band 8+ level model answer for the same topic
   - A "Rewrite Suggestions" section — provide 3-5 specific, actionable rewrite suggestions that would improve the candidate's essay

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "overall_score": <float>,
  "report_markdown": "<comprehensive Markdown report>"
}"""

_CHIEF_USER_TEMPLATE = """## Task Information
**Task type**: {task_type_label}
**Topic ID**: {topic_id}
**Topic**: {topic}

## Structured Topic Snapshot
```json
{topic_snapshot_json}
```

## Candidate's Original Essay
---
{essay}
---

## Specialist Reports

### TR (Task Response) — Score: {tr_score}
{tr_report}

### CC (Coherence and Cohesion) — Score: {cc_score}
{cc_report}

### LR (Lexical Resource) — Score: {lr_score}
{lr_report}

### GRA (Grammatical Range and Accuracy) — Score: {gra_score}
{gra_report}

---

Use the topic snapshot above when writing the final assessment and model answer. Return valid JSON."""


# ─────────────────────────────────────────────
# Agent Execution with Retry
# ─────────────────────────────────────────────

async def _run_agent_with_retry(
    llm: BaseLLMClient,
    messages: list[dict[str, str]],
    agent_name: str,
) -> dict[str, Any]:
    """Run a single scoring agent with up to MAX_RETRIES retries on JSON failure."""
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = await llm.chat(
                messages=messages,
                temperature=0.3,
                max_tokens=3000,
            )
            cleaned = _strip_json_fence(result.content)
            data = json.loads(cleaned)
            logger.info("Agent [%s] succeeded on attempt %d", agent_name, attempt)
            return data
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            last_error = e
            logger.warning(
                "Agent [%s] attempt %d/%d failed: %s", agent_name, attempt, MAX_RETRIES, e
            )
            if attempt < MAX_RETRIES:
                await asyncio.sleep(0.5)

    logger.error("Agent [%s] all %d retries exhausted: %s", agent_name, MAX_RETRIES, last_error)
    return {
        "criterion": agent_name,
        "score": 0,
        "strengths": [],
        "weaknesses": [f"Evaluation failed after {MAX_RETRIES} attempts: {str(last_error)}"],
        "suggestions": ["Please retry the evaluation."],
        "detailed_annotations": [],
    }


async def _run_chief_with_retry(
    llm: BaseLLMClient,
    messages: list[dict[str, str]],
) -> dict[str, Any]:
    """Run the Chief Examiner agent with retry."""
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = await llm.chat(
                messages=messages,
                temperature=0.4,
                max_tokens=6000,
            )
            cleaned = _strip_json_fence(result.content)
            data = json.loads(cleaned)
            logger.info("Chief Examiner succeeded on attempt %d", attempt)
            return data
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            last_error = e
            logger.warning(
                "Chief Examiner attempt %d/%d failed: %s", attempt, MAX_RETRIES, e
            )
            if attempt < MAX_RETRIES:
                await asyncio.sleep(0.5)

    logger.error("Chief Examiner all %d retries exhausted: %s", MAX_RETRIES, last_error)
    return {
        "overall_score": 0,
        "report_markdown": f"⚠️ Chief Examiner evaluation failed after {MAX_RETRIES} attempts. Error: {str(last_error)}",
    }


# ─────────────────────────────────────────────
# 5-Agent Parallel Evaluate
# ─────────────────────────────────────────────

def _format_agent_report_for_chief(report: dict[str, Any]) -> str:
    """Format a sub-agent report dict into readable text for the chief examiner."""
    lines = []
    if report.get("strengths"):
        lines.append("**Strengths**: " + "; ".join(report["strengths"]))
    if report.get("weaknesses"):
        lines.append("**Weaknesses**: " + "; ".join(report["weaknesses"]))
    if report.get("suggestions"):
        lines.append("**Suggestions**: " + "; ".join(report["suggestions"]))
    if report.get("detailed_annotations"):
        annots = report["detailed_annotations"]
        lines.append("**Annotations**:")
        for a in annots[:5]:
            lines.append(f'  - "{a.get("text", "")}" → {a.get("issue", "")} → Fix: {a.get("suggestion", "")}')
    return "\n".join(lines) if lines else "(No detailed report available)"


async def evaluate_essay(
    session: AsyncSession,
    llm: BaseLLMClient,
    session_id: int | None,
    task_type: str,
    topic_id: str | None,
    topic: str,
    topic_data: dict | None,
    user_essay: str,
) -> EvaluateData:
    """
    5-Agent parallel evaluation:
    1. Run 4 scoring agents (TR, CC, LR, GRA) in parallel via asyncio.gather
    2. Run Chief Examiner to synthesise the results
    3. Persist to database
    """
    topic_snapshot = _build_topic_snapshot(task_type, topic, topic_id, topic_data)
    resolved_topic_id = topic_snapshot.get("id")

    agent_configs = [
        ("tr", "Task Response" if task_type != "part_a" else "Task Achievement", get_tr_descriptors(task_type)),
        ("cc", "Coherence and Cohesion", get_cc_descriptors(task_type)),
        ("lr", "Lexical Resource", get_lr_descriptors(task_type)),
        ("gra", "Grammatical Range and Accuracy", get_gra_descriptors(task_type)),
    ]

    agent_tasks = []
    agent_keys = []
    for key, criterion_name, descriptors in agent_configs:
        messages = _build_agent_prompt(
            criterion_name=criterion_name,
            band_descriptors=descriptors,
            task_type=task_type,
            topic=topic,
            topic_snapshot=topic_snapshot,
            essay=user_essay,
        )
        agent_tasks.append(_run_agent_with_retry(llm, messages, criterion_name))
        agent_keys.append(key)

    logger.info("Starting 4 scoring agents in parallel for topic_id=%s...", resolved_topic_id or "unknown")
    results = await asyncio.gather(*agent_tasks)
    logger.info("All 4 scoring agents completed.")

    agent_reports: dict[str, AgentReport] = {}
    agent_raw: dict[str, dict[str, Any]] = {}
    scores_dict: dict[str, float] = {}

    for key, result in zip(agent_keys, results):
        agent_reports[key] = AgentReport(**result)
        agent_raw[key] = result
        scores_dict[key] = float(result.get("score", 0))

    task_type_label = "Task 1 (Academic)" if task_type == "part_a" else "Task 2"
    chief_user = _CHIEF_USER_TEMPLATE.format(
        task_type_label=task_type_label,
        topic_id=resolved_topic_id or "unknown",
        topic=topic,
        topic_snapshot_json=_format_topic_snapshot(topic_snapshot),
        essay=user_essay,
        tr_score=scores_dict.get("tr", 0),
        tr_report=_format_agent_report_for_chief(agent_raw.get("tr", {})),
        cc_score=scores_dict.get("cc", 0),
        cc_report=_format_agent_report_for_chief(agent_raw.get("cc", {})),
        lr_score=scores_dict.get("lr", 0),
        lr_report=_format_agent_report_for_chief(agent_raw.get("lr", {})),
        gra_score=scores_dict.get("gra", 0),
        gra_report=_format_agent_report_for_chief(agent_raw.get("gra", {})),
    )

    chief_messages = [
        {"role": "system", "content": _CHIEF_SYSTEM},
        {"role": "user", "content": chief_user},
    ]

    logger.info("Starting Chief Examiner agent...")
    chief_result = await _run_chief_with_retry(llm, chief_messages)
    logger.info("Chief Examiner completed.")

    chief_overall = float(chief_result.get("overall_score", 0) or 0)
    computed_mean = _round_to_half(sum(scores_dict.values()) / max(len(scores_dict), 1))
    overall = chief_overall if chief_overall > 0 else computed_mean

    scores = Scores(
        tr=scores_dict.get("tr", 0),
        cc=scores_dict.get("cc", 0),
        lr=scores_dict.get("lr", 0),
        gra=scores_dict.get("gra", 0),
        overall=overall,
    )

    report_md = chief_result.get("report_markdown", "")
    word_count = len(user_essay.split())
    scores_json = json.dumps(scores.model_dump(), ensure_ascii=False)
    reports_json = json.dumps({k: v.model_dump() for k, v in agent_reports.items()}, ensure_ascii=False)
    topic_snapshot_json = json.dumps(topic_snapshot, ensure_ascii=False)

    if session_id:
        result = await session.execute(
            select(WritingSession).where(WritingSession.id == session_id)
        )
        row = result.scalar_one_or_none()
        if row:
            row.task_type = task_type
            row.topic_id = resolved_topic_id
            row.topic = topic
            row.topic_data = topic_snapshot_json
            row.user_essay = user_essay
            row.word_count = word_count
            row.overall_score = scores.overall
            row.scores = scores_json
            row.agent_reports = reports_json
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
        topic_id=resolved_topic_id,
        topic=topic,
        topic_data=topic_snapshot_json,
        user_essay=user_essay,
        word_count=word_count,
        overall_score=scores.overall,
        scores=scores_json,
        agent_reports=reports_json,
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


# ─────────────────────────────────────────────
# Session Queries
# ─────────────────────────────────────────────

async def get_sessions(
    session: AsyncSession,
    task_type: str = "all",
    page: int = 1,
    page_size: int = 20,
    topic_id: str | None = None,
    sort_by: str = "latest",
) -> tuple[int, list[SessionListItem]]:
    base = select(WritingSession)
    count_q = select(func.count(WritingSession.id))

    if task_type != "all":
        base = base.where(WritingSession.task_type == task_type)
        count_q = count_q.where(WritingSession.task_type == task_type)

    if topic_id:
        base = base.where(WritingSession.topic_id == topic_id)
        count_q = count_q.where(WritingSession.topic_id == topic_id)

    total_result = await session.execute(count_q)
    total = total_result.scalar() or 0

    q = (
        base.order_by(*_build_session_order_by(sort_by))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await session.execute(q)
    rows = result.scalars().all()

    items: list[SessionListItem] = []
    for row in rows:
        topic_snapshot = _safe_json_loads(row.topic_data)
        scores_raw = _safe_json_loads(row.scores)
        scores = Scores(**scores_raw) if isinstance(scores_raw, dict) else None
        items.append(
            SessionListItem(
                id=row.id,
                task_type=row.task_type,
                topic_id=row.topic_id,
                topic=row.topic,
                topic_data=topic_snapshot if isinstance(topic_snapshot, dict) else None,
                word_count=row.word_count,
                overall_score=row.overall_score,
                scores=scores,
                created_at=row.created_at,
            )
        )
    return total, items


async def get_session_detail(
    session: AsyncSession, session_id: int
) -> SessionDetailData | None:
    result = await session.execute(
        select(WritingSession).where(WritingSession.id == session_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        return None

    scores_raw = _safe_json_loads(row.scores)
    scores = Scores(**scores_raw) if isinstance(scores_raw, dict) else None
    agent_reports = {}
    raw_reports = _safe_json_loads(row.agent_reports)
    if isinstance(raw_reports, dict):
        agent_reports = {k: AgentReport(**v) for k, v in raw_reports.items()}

    topic_snapshot = _safe_json_loads(row.topic_data)

    # Build structured report from markdown + agent reports
    structured_report: StructuredReportData | None = None
    try:
        from app.services.writing_report_parser import parse_report

        parsed = parse_report(row.report_markdown or "", agent_reports)
        structured_report = StructuredReportData(
            summary_title=parsed.summary_title,
            summary_paragraphs=parsed.summary_paragraphs,
            model_answer_title=parsed.model_answer_title,
            model_answer_paragraphs=parsed.model_answer_paragraphs,
            rewrite_title=parsed.rewrite_title,
            rewrite_suggestions=[
                RewriteSuggestion(**s) for s in parsed.rewrite_suggestions
            ],
            has_model_answer=parsed.has_model_answer,
            has_rewrite_suggestions=parsed.has_rewrite_suggestions,
        )
    except Exception:
        logger.warning("Failed to parse structured report for session %d", session_id, exc_info=True)

    return SessionDetailData(
        session_id=row.id,
        task_type=row.task_type,
        topic_id=row.topic_id,
        topic=row.topic,
        topic_data=topic_snapshot if isinstance(topic_snapshot, dict) else None,
        user_essay=row.user_essay,
        word_count=row.word_count,
        scores=scores,
        agent_reports=agent_reports,
        report_markdown=row.report_markdown or "",
        structured_report=structured_report,
        created_at=row.created_at,
    )


# ─────────────────────────────────────────────
# Topic Aggregation (By Topic)
# ─────────────────────────────────────────────

async def get_topic_aggregates(
    session: AsyncSession,
    task_type: str = "all",
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "latest",
) -> tuple[int, list[TopicAggregateItem]]:
    """Aggregate writing sessions by topic_id.

    Returns a paginated list of topics with attempt count, avg/best/latest score.
    Only topics with a non-null topic_id are included.
    """
    base_filter = WritingSession.topic_id.isnot(None)
    if task_type != "all":
        base_filter = base_filter & (WritingSession.task_type == task_type)

    # Count distinct topic_ids
    count_q = (
        select(func.count(func.distinct(WritingSession.topic_id)))
        .where(base_filter)
    )
    total_result = await session.execute(count_q)
    total = total_result.scalar() or 0

    # Aggregate per topic_id
    agg_q = (
        select(
            WritingSession.topic_id,
            func.count(WritingSession.id).label("attempts"),
            func.avg(WritingSession.overall_score).label("avg_score"),
            func.max(WritingSession.overall_score).label("best_score"),
            func.max(WritingSession.created_at).label("latest_at"),
        )
        .where(base_filter)
        .group_by(WritingSession.topic_id)
    )

    # Sorting
    if sort_by == "attempts_desc":
        agg_q = agg_q.order_by(func.count(WritingSession.id).desc())
    elif sort_by == "best_score_desc":
        agg_q = agg_q.order_by(func.max(WritingSession.overall_score).desc().nullslast())
    else:  # default: latest
        agg_q = agg_q.order_by(func.max(WritingSession.created_at).desc())

    agg_q = agg_q.offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(agg_q)
    rows = result.all()

    if not rows:
        return total, []

    # Fetch latest session for each topic_id to get topic text, task_type, topic_data, latest_score
    topic_ids = [r.topic_id for r in rows]
    latest_sessions_q = (
        select(WritingSession)
        .where(WritingSession.topic_id.in_(topic_ids))
        .order_by(WritingSession.created_at.desc())
    )
    latest_result = await session.execute(latest_sessions_q)
    all_sessions = latest_result.scalars().all()

    # Build lookup: topic_id → latest session
    latest_map: dict[str, WritingSession] = {}
    for s in all_sessions:
        if s.topic_id and s.topic_id not in latest_map:
            latest_map[s.topic_id] = s

    items: list[TopicAggregateItem] = []
    for r in rows:
        tid = r.topic_id
        latest_sess = latest_map.get(tid)
        topic_snapshot = _safe_json_loads(latest_sess.topic_data) if latest_sess else None

        items.append(TopicAggregateItem(
            topic_id=tid,
            task_type=latest_sess.task_type if latest_sess else "unknown",
            topic=latest_sess.topic if latest_sess else "",
            topic_data=topic_snapshot if isinstance(topic_snapshot, dict) else None,
            attempts=r.attempts,
            avg_score=round(r.avg_score, 1) if r.avg_score is not None else None,
            best_score=r.best_score,
            latest_score=latest_sess.overall_score if latest_sess else None,
            latest_at=r.latest_at,
        ))

    return total, items


async def get_topic_trend(
    session: AsyncSession,
    topic_id: str,
) -> list[TopicTrendPoint]:
    """Return all attempts for a specific topic, ordered by created_at asc."""
    q = (
        select(WritingSession)
        .where(WritingSession.topic_id == topic_id)
        .order_by(WritingSession.created_at.asc())
    )
    result = await session.execute(q)
    rows = result.scalars().all()

    points: list[TopicTrendPoint] = []
    for row in rows:
        scores_raw = _safe_json_loads(row.scores)
        scores = Scores(**scores_raw) if isinstance(scores_raw, dict) else None
        points.append(TopicTrendPoint(
            session_id=row.id,
            overall_score=row.overall_score,
            scores=scores,
            word_count=row.word_count,
            created_at=row.created_at,
        ))

    return points
