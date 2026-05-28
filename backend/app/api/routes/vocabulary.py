from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.schemas.vocabulary import (
    ActivityTrendResponse,
    BookmarkRequest,
    BookmarkedWordsData,
    BookmarkedWordsResponse,
    DistractorWordsData,
    DistractorWordsResponse,
    MostWrongWordsData,
    MostWrongWordsResponse,
    MostWrongWord,
    NewWordsListData,
    NewWordsListResponse,
    NoteRequest,
    TodaySummaryResponse,
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
    get_activity_trend,
    get_bookmarked_words,
    get_distractors,
    get_due_words,
    get_heatmap_data,
    get_learning_curve_data,
    get_most_wrong_words,
    get_new_words,
    get_today_summary,
    get_vocabulary_stats,
    reset_all_progress,
    search_vocabulary,
    submit_review,
    toggle_bookmark,
    update_note,
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


@router.get("/new-words", response_model=NewWordsListResponse)
async def get_new_words_endpoint(
    limit: int = Query(default=30, ge=1, le=200),
    order: str | None = Query(default=None, regex="^(random|ielts_core|difficulty_asc|difficulty_desc|alphabetical)$"),
    session: AsyncSession = Depends(get_db_session),
) -> NewWordsListResponse:
    words, today_learned, daily_limit, effective_order = await get_new_words(
        session, limit=limit, order=order
    )
    return NewWordsListResponse(
        data=NewWordsListData(
            words=[VocabularyItem.model_validate(w) for w in words],
            today_learned=today_learned,
            daily_limit=daily_limit,
            order=effective_order,
        )
    )


@router.get("/today-summary", response_model=TodaySummaryResponse)
async def get_today_summary_endpoint(
    session: AsyncSession = Depends(get_db_session),
) -> TodaySummaryResponse:
    data = await get_today_summary(session)
    return TodaySummaryResponse(data=data)


@router.post("/{word_id}/review", response_model=VocabularyReviewResultResponse)
async def review_word(
    word_id: int, request: VocabularyReviewRequest, session: AsyncSession = Depends(get_db_session)
) -> VocabularyReviewResultResponse:
    try:
        result = await submit_review(session, word_id=word_id, quality=request.quality, mode=request.mode)
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


@router.get("/activity-trend", response_model=ActivityTrendResponse)
async def get_activity_trend_endpoint(
    days: int = Query(default=14, ge=1, le=90),
    session: AsyncSession = Depends(get_db_session),
) -> ActivityTrendResponse:
    data = await get_activity_trend(session, days=days)
    return ActivityTrendResponse(data=data)


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


@router.post("/reset")
async def reset_progress(session: AsyncSession = Depends(get_db_session)):
    """DEV ONLY: Reset all vocabulary SM2 progress back to 'new' state."""
    count = await reset_all_progress(session)
    return {"success": True, "data": {"reset_count": count}, "message": "ok"}


@router.get("/bookmarks", response_model=BookmarkedWordsResponse)
async def get_bookmarks(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_db_session),
) -> BookmarkedWordsResponse:
    total, words = await get_bookmarked_words(session, page=page, page_size=page_size)
    return BookmarkedWordsResponse(
        data=BookmarkedWordsData(
            total=total,
            words=[VocabularyItem.model_validate(w) for w in words],
        )
    )


@router.get("/most-wrong", response_model=MostWrongWordsResponse)
async def get_most_wrong(
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> MostWrongWordsResponse:
    words = await get_most_wrong_words(session, limit=limit)
    return MostWrongWordsResponse(
        data=MostWrongWordsData(
            words=[MostWrongWord.model_validate(w) for w in words],
        )
    )


@router.get("/{word_id}/distractors", response_model=DistractorWordsResponse)
async def get_word_distractors(
    word_id: int,
    count: int = Query(default=3, ge=1, le=9),
    mode: str = Query(default="translation", regex="^(translation|word)$"),
    session: AsyncSession = Depends(get_db_session),
) -> DistractorWordsResponse:
    """Get distractors for quiz mode. mode=translation for en->zh, mode=word for zh->en."""
    distractors = await get_distractors(session, word_id=word_id, count=count, mode=mode)
    return DistractorWordsResponse(data=DistractorWordsData(distractors=distractors))


@router.put("/{word_id}/bookmark")
async def bookmark_word(
    word_id: int, request: BookmarkRequest, session: AsyncSession = Depends(get_db_session)
):
    try:
        word = await toggle_bookmark(session, word_id, request.bookmarked)
        return {"success": True, "data": VocabularyItem.model_validate(word), "message": "ok"}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.put("/{word_id}/note")
async def note_word(
    word_id: int, request: NoteRequest, session: AsyncSession = Depends(get_db_session)
):
    try:
        word = await update_note(session, word_id, request.note)
        return {"success": True, "data": VocabularyItem.model_validate(word), "message": "ok"}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
