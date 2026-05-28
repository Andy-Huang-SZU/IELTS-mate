from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.schemas.speaking import (
    SessionDetailResponse,
    SessionListData,
    SessionListResponse,
)
from app.services.speaking_service import (
    get_speaking_session_detail,
    get_speaking_sessions,
)

router = APIRouter(prefix="/api/speaking", tags=["speaking"])


@router.get("/sessions", response_model=SessionListResponse)
async def api_get_speaking_sessions(
    mode: str = Query(default="all", description="all | chat | mock_test"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> SessionListResponse:
    total, items = await get_speaking_sessions(session, mode=mode, page=page, page_size=page_size)
    return SessionListResponse(data=SessionListData(total=total, sessions=items))


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def api_get_speaking_session_detail(
    session_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> SessionDetailResponse:
    data = await get_speaking_session_detail(session, session_id)
    if not data:
        raise HTTPException(status_code=404, detail="Speaking session not found")
    return SessionDetailResponse(data=data)
