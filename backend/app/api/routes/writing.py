from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.schemas.writing import (
    EvaluateRequest,
    EvaluateResponse,
    GenerateTopicRequest,
    RandomTopicRequest,
    SessionDetailResponse,
    SessionListData,
    SessionListResponse,
    TokenEstimateResponse,
    TopicAggregateData,
    TopicAggregateResponse,
    TopicBankStatsResponse,
    TopicData,
    TopicListData,
    TopicListResponse,
    TopicResponse,
    TopicTrendData,
    TopicTrendResponse,
)
from app.services.llm.factory import create_llm_client, create_topicgen_llm_client
from app.services.settings_service import get_settings
from app.services.topic_bank_service import (
    get_topic_bank,
    normalise_chart_type,
    normalise_question_type,
)
from app.services.topic_gen_service import estimate_tokens
from app.services.topic_gen_service import generate_topic as gen_topic
from app.services.writing_service import (
    evaluate_essay,
    get_session_detail,
    get_sessions,
    get_topic_aggregates,
    get_topic_trend,
)

router = APIRouter(prefix="/api/writing", tags=["writing"])


async def _get_llm(session: AsyncSession):
    settings = await get_settings(session)
    if not settings.llm_api_key:
        raise HTTPException(status_code=503, detail="LLM API key not configured")
    return create_llm_client(settings)


async def _get_topicgen_llm(session: AsyncSession):
    settings = await get_settings(session)
    # When using same LLM, check the main LLM key
    if settings.topicgen_use_same_llm:
        if not settings.llm_api_key:
            raise HTTPException(status_code=503, detail="LLM API key not configured")
    else:
        if not settings.topicgen_api_key:
            raise HTTPException(status_code=503, detail="Topic generation LLM API key not configured")
    return create_topicgen_llm_client(settings)


@router.post("/generate-topic", response_model=TopicResponse)
async def api_generate_topic(
    body: GenerateTopicRequest,
    session: AsyncSession = Depends(get_db_session),
):
    llm = await _get_topicgen_llm(session)
    try:
        topic_dict, result = await gen_topic(
            llm=llm,
            task_type=body.task_type,
            chart_type=body.chart_type,
            question_type=body.question_type,
            theme=body.theme,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Auto-save to topic bank
    bank = get_topic_bank()
    bank.add_topic(topic_dict)

    # Build usage dict
    usage = None
    if result.usage:
        usage = {
            "prompt_tokens": result.usage.prompt_tokens,
            "completion_tokens": result.usage.completion_tokens,
            "total_tokens": result.usage.total_tokens,
        }

    topic_data = TopicData(**{k: v for k, v in topic_dict.items() if k in TopicData.model_fields})
    return TopicResponse(data=topic_data, usage=usage)


@router.post("/random-topic", response_model=TopicResponse)
async def api_random_topic(body: RandomTopicRequest):
    bank = get_topic_bank()
    topic = bank.random_topic(
        task_type=body.task_type,
        chart_type=body.chart_type,
        question_type=body.question_type,
    )
    if not topic:
        raise HTTPException(
            status_code=404,
            detail="No matching topic found in the bank. Try AI generation instead.",
        )
    topic_data = TopicData(**{k: v for k, v in topic.items() if k in TopicData.model_fields})
    return TopicResponse(data=topic_data)


@router.get("/topic-estimate")
async def api_topic_estimate(
    task_type: str = Query(description="part_a or part_b"),
    chart_type: str | None = Query(default=None),
    question_type: str | None = Query(default=None),
    count: int = Query(default=1, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> TokenEstimateResponse:
    # Map legacy combination to mixed
    if chart_type == "combination":
        chart_type = "mixed"
    est = estimate_tokens(task_type, chart_type, question_type, count)
    # Add cost estimation from settings
    settings = await get_settings(session)
    input_cost = est["prompt_tokens"] * settings.token_price_input / 1_000_000
    output_cost = est["completion_tokens"] * settings.token_price_output / 1_000_000
    est["estimated_cost"] = round(input_cost + output_cost, 6)
    est["cost_currency"] = "USD"
    return TokenEstimateResponse(data=est)


@router.get("/topic-bank-stats")
async def api_topic_bank_stats() -> TopicBankStatsResponse:
    bank = get_topic_bank()
    stats = bank.get_stats()
    return TopicBankStatsResponse(data=stats)


@router.get("/topic-bank", response_model=TopicListResponse)
async def api_topic_bank(
    task_type: str | None = Query(default=None, description="part_a or part_b"),
    chart_type: str | None = Query(default=None, description="Task 1 chart type"),
    question_type: str | None = Query(default=None, description="Task 2 question type"),
    difficulty: str | None = Query(default=None, description="easy / medium / hard"),
) -> TopicListResponse:
    bank = get_topic_bank()
    normalised_chart_type = normalise_chart_type(chart_type)
    normalised_question_type = normalise_question_type(question_type)
    normalised_difficulty = str(difficulty).strip().lower() if difficulty else None

    def matches(topic: dict) -> bool:
        if task_type and topic.get("task_type") != task_type:
            return False
        if normalised_chart_type and topic.get("chart_type") != normalised_chart_type:
            return False
        if normalised_question_type and topic.get("question_type") != normalised_question_type:
            return False
        if normalised_difficulty and str(topic.get("difficulty") or "medium").lower() != normalised_difficulty:
            return False
        return True

    filtered_topics = [
        TopicData(**{k: v for k, v in topic.items() if k in TopicData.model_fields})
        for topic in bank.get_all_topics()
        if matches(topic)
    ]
    filtered_topics.sort(
        key=lambda topic: (
            0 if topic.task_type == "part_a" else 1,
            topic.chart_type or topic.question_type or "",
            topic.id or "",
        )
    )
    return TopicListResponse(data=TopicListData(total=len(filtered_topics), topics=filtered_topics))


@router.post("/evaluate", response_model=EvaluateResponse)
async def api_evaluate(
    body: EvaluateRequest,
    session: AsyncSession = Depends(get_db_session),
):
    if not body.user_essay.strip():
        raise HTTPException(status_code=400, detail="Essay cannot be empty")
    llm = await _get_llm(session)
    data = await evaluate_essay(
        session=session,
        llm=llm,
        session_id=body.session_id,
        task_type=body.task_type,
        topic_id=body.topic_id,
        topic=body.topic,
        topic_data=body.topic_data,
        user_essay=body.user_essay,
    )
    return EvaluateResponse(data=data)


@router.get("/sessions", response_model=SessionListResponse)
async def api_get_sessions(
    task_type: str = Query(default="all"),
    topic_id: str | None = Query(default=None, description="按题目 ID 精确筛选，如 T1-BAR-0001"),
    sort_by: str = Query(default="latest", description="latest | score_desc | score_asc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
):
    total, items = await get_sessions(session, task_type, page, page_size, topic_id, sort_by)
    return SessionListResponse(data=SessionListData(total=total, sessions=items))


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def api_get_session_detail(
    session_id: int,
    session: AsyncSession = Depends(get_db_session),
):
    data = await get_session_detail(session, session_id)
    if not data:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionDetailResponse(data=data)


@router.get("/topics/aggregate", response_model=TopicAggregateResponse)
async def api_get_topic_aggregates(
    task_type: str = Query(default="all"),
    sort_by: str = Query(default="latest", description="latest | attempts_desc | best_score_desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
):
    total, items = await get_topic_aggregates(session, task_type, page, page_size, sort_by)
    return TopicAggregateResponse(data=TopicAggregateData(total=total, topics=items))


@router.get("/topics/{topic_id}/trend", response_model=TopicTrendResponse)
async def api_get_topic_trend(
    topic_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    points = await get_topic_trend(session, topic_id)
    return TopicTrendResponse(data=TopicTrendData(topic_id=topic_id, attempts=points))
