from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.schemas.writing import (
    EvaluateRequest,
    EvaluateResponse,
    GenerateTopicRequest,
    SessionDetailResponse,
    SessionListData,
    SessionListResponse,
    TopicResponse,
)
from app.services.llm.factory import create_llm_client
from app.services.settings_service import get_settings
from app.services.writing_service import (
    evaluate_essay,
    generate_topic,
    get_session_detail,
    get_sessions,
)

router = APIRouter(prefix="/api/writing", tags=["writing"])


async def _get_llm(session: AsyncSession):
    settings = await get_settings(session)
    if not settings.llm_api_key:
        raise HTTPException(status_code=503, detail="LLM API key not configured")
    return create_llm_client(settings)


@router.post("/generate-topic", response_model=TopicResponse)
async def api_generate_topic(
    body: GenerateTopicRequest,
    session: AsyncSession = Depends(get_db_session),
):
    llm = await _get_llm(session)
    data = await generate_topic(llm, body.task_type)
    return TopicResponse(data=data)


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
        topic=body.topic,
        topic_data=body.topic_data,
        user_essay=body.user_essay,
    )
    return EvaluateResponse(data=data)


@router.get("/sessions", response_model=SessionListResponse)
async def api_get_sessions(
    task_type: str = Query(default="all"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
):
    total, items = await get_sessions(session, task_type, page, page_size)
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
