from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.schemas.vocabulary import (
    VocabularyHeatmapResponse,
    VocabularyItem,
    VocabularyLearningCurveResponse,
    VocabularyReviewListData,
    VocabularyReviewListResponse,
    VocabularyReviewRequest,
    VocabularyReviewResultResponse,
    VocabularySearchResponse,
    VocabularyStatsResponse,
)
from app.services.vocabulary_service import (
    get_due_words,
    get_heatmap_data,
    get_learning_curve_data,
    get_vocabulary_stats,
    search_vocabulary,
    submit_review,
)

router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])


@router.get("/review", response_model=VocabularyReviewListResponse)
async def get_review_words(
    limit: int = Query(default=20, ge=1, le=200),
    session: AsyncSession = Depends(get_db_session),
) -> VocabularyReviewListResponse:
    total_due, words = await get_due_words(session, limit=limit)
    return VocabularyReviewListResponse(
        data=VocabularyReviewListData(
            total_due=total_due,
            words=[VocabularyItem.model_validate(item) for item in words],
        )
    )


@router.post("/{word_id}/review", response_model=VocabularyReviewResultResponse)
async def review_word(
    word_id: int, request: VocabularyReviewRequest, session: AsyncSession = Depends(get_db_session)
) -> VocabularyReviewResultResponse:
    try:
        result = await submit_review(session, word_id=word_id, quality=request.quality)
        return VocabularyReviewResultResponse(data=result)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/stats", response_model=VocabularyStatsResponse)
async def get_stats(session: AsyncSession = Depends(get_db_session)) -> VocabularyStatsResponse:
    data = await get_vocabulary_stats(session)
    return VocabularyStatsResponse(data=data)


@router.get("/heatmap", response_model=VocabularyHeatmapResponse)
async def get_heatmap(
    year: int | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> VocabularyHeatmapResponse:
    if not year or year <= 0:
        from datetime import date

        year = date.today().year
    data = await get_heatmap_data(session, year=year)
    return VocabularyHeatmapResponse(data=data)


@router.get("/learning-curve", response_model=VocabularyLearningCurveResponse)
async def get_learning_curve(
    days: int = Query(default=30, ge=1, le=365),
    session: AsyncSession = Depends(get_db_session),
) -> VocabularyLearningCurveResponse:
    data = await get_learning_curve_data(session, days=days)
    return VocabularyLearningCurveResponse(data=data)


@router.get("/search", response_model=VocabularySearchResponse)
async def search_words(
    q: str = Query(default=""),
    status: str = Query(default="all"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_db_session),
) -> VocabularySearchResponse:
    data = await search_vocabulary(session, q=q, status=status, page=page, page_size=page_size)
    return VocabularySearchResponse(data=data)
