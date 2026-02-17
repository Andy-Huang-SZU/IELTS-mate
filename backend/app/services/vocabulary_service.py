from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from pathlib import Path

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vocabulary import Vocabulary
from app.schemas.vocabulary import (
    HeatmapPoint,
    VocabularyHeatmapData,
    VocabularyLearningCurveData,
    VocabularyReviewResultData,
    VocabularySearchData,
    VocabularyStatsData,
)
from app.services.sm2 import compute_sm2


async def init_vocabulary_if_empty(session: AsyncSession, source_file: Path) -> int:
    result = await session.execute(select(func.count(Vocabulary.id)))
    count = int(result.scalar_one() or 0)
    if count > 0:
        return 0

    raw = json.loads(source_file.read_text(encoding="utf-8"))
    items: list[Vocabulary] = []
    for item in raw:
        items.append(
            Vocabulary(
                word=item.get("word", "").strip(),
                phonetic=item.get("phonetic", "").strip(),
                definition=item.get("definition", "").strip(),
                example=item.get("example", "").strip(),
                next_review=date.today(),
                status="new",
            )
        )
    session.add_all(items)
    await session.commit()
    return len(items)


async def get_due_words(session: AsyncSession, limit: int) -> tuple[int, list[Vocabulary]]:
    today = date.today()
    due_clause = or_(Vocabulary.next_review.is_(None), Vocabulary.next_review <= today)

    total_result = await session.execute(select(func.count(Vocabulary.id)).where(due_clause))
    total_due = int(total_result.scalar_one() or 0)

    words_result = await session.execute(
        select(Vocabulary).where(due_clause).order_by(Vocabulary.id.asc()).limit(limit)
    )
    words = list(words_result.scalars().all())
    return total_due, words


async def submit_review(
    session: AsyncSession, word_id: int, quality: int
) -> VocabularyReviewResultData:
    word = await session.get(Vocabulary, word_id)
    if not word:
        raise ValueError("word not found")

    sm2 = compute_sm2(
        previous_interval=word.interval,
        previous_repetition=word.repetition,
        previous_ease_factor=word.ease_factor,
        quality=quality,
    )

    word.interval = sm2.interval
    word.repetition = sm2.repetition
    word.ease_factor = sm2.ease_factor
    word.next_review = sm2.next_review
    if sm2.repetition >= 5:
        word.status = "mastered"
    elif sm2.repetition > 0:
        word.status = "learning"
    else:
        word.status = "new"

    await session.commit()
    return VocabularyReviewResultData(
        word_id=word.id,
        new_interval=word.interval,
        new_repetition=word.repetition,
        new_ease_factor=word.ease_factor,
        next_review=word.next_review,
        status=word.status,
    )


async def get_vocabulary_stats(session: AsyncSession) -> VocabularyStatsData:
    total_words = int((await session.execute(select(func.count(Vocabulary.id)))).scalar_one() or 0)
    new_words = int(
        (await session.execute(select(func.count(Vocabulary.id)).where(Vocabulary.status == "new"))).scalar_one()
        or 0
    )
    learning_words = int(
        (
            await session.execute(select(func.count(Vocabulary.id)).where(Vocabulary.status == "learning"))
        ).scalar_one()
        or 0
    )
    mastered_words = int(
        (
            await session.execute(select(func.count(Vocabulary.id)).where(Vocabulary.status == "mastered"))
        ).scalar_one()
        or 0
    )

    today = date.today()
    due_today = int(
        (
            await session.execute(
                select(func.count(Vocabulary.id)).where(
                    or_(Vocabulary.next_review.is_(None), Vocabulary.next_review <= today)
                )
            )
        ).scalar_one()
        or 0
    )

    # A lightweight streak proxy: consecutive days with any reviewed words.
    streak_days = 0
    cursor = today
    while True:
        start_dt = datetime.combine(cursor, time.min)
        end_dt = datetime.combine(cursor, time.max)
        reviewed_count = int(
            (
                await session.execute(
                    select(func.count(Vocabulary.id)).where(
                        and_(
                            Vocabulary.repetition > 0,
                            Vocabulary.updated_at >= start_dt,
                            Vocabulary.updated_at <= end_dt,
                        )
                    )
                )
            ).scalar_one()
            or 0
        )
        if reviewed_count == 0:
            break
        streak_days += 1
        cursor = cursor - timedelta(days=1)
        if streak_days >= 365:
            break

    return VocabularyStatsData(
        total_words=total_words,
        new_words=new_words,
        learning_words=learning_words,
        mastered_words=mastered_words,
        due_today=due_today,
        streak_days=streak_days,
    )


async def get_heatmap_data(session: AsyncSession, year: int) -> VocabularyHeatmapData:
    start = datetime(year, 1, 1)
    end = datetime(year + 1, 1, 1)
    rows = (
        await session.execute(
            select(Vocabulary.updated_at).where(
                and_(Vocabulary.repetition > 0, Vocabulary.updated_at >= start, Vocabulary.updated_at < end)
            )
        )
    ).scalars().all()

    counter: dict[date, int] = {}
    for dt in rows:
        d = dt.date()
        counter[d] = counter.get(d, 0) + 1

    points = [HeatmapPoint(date=d, count=counter[d]) for d in sorted(counter.keys())]
    return VocabularyHeatmapData(year=year, data=points)


async def get_learning_curve_data(session: AsyncSession, days: int) -> VocabularyLearningCurveData:
    days = max(1, min(days, 365))
    today = date.today()
    dates = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]
    mastered: list[int] = []
    learning: list[int] = []

    for d in dates:
        day_end = datetime.combine(d, time.max)
        mastered_count = int(
            (
                await session.execute(
                    select(func.count(Vocabulary.id)).where(
                        and_(Vocabulary.status == "mastered", Vocabulary.updated_at <= day_end)
                    )
                )
            ).scalar_one()
            or 0
        )
        learning_count = int(
            (
                await session.execute(
                    select(func.count(Vocabulary.id)).where(
                        and_(Vocabulary.status == "learning", Vocabulary.updated_at <= day_end)
                    )
                )
            ).scalar_one()
            or 0
        )
        mastered.append(mastered_count)
        learning.append(learning_count)

    return VocabularyLearningCurveData(dates=dates, mastered=mastered, learning=learning)


async def search_vocabulary(
    session: AsyncSession, q: str, status: str, page: int, page_size: int
) -> VocabularySearchData:
    page = max(1, page)
    page_size = max(1, min(page_size, 200))
    filters = []
    if q.strip():
        filters.append(Vocabulary.word.ilike(f"%{q.strip()}%"))
    if status in {"new", "learning", "mastered"}:
        filters.append(Vocabulary.status == status)

    base_query = select(Vocabulary)
    count_query = select(func.count(Vocabulary.id))
    if filters:
        for f in filters:
            base_query = base_query.where(f)
            count_query = count_query.where(f)

    total = int((await session.execute(count_query)).scalar_one() or 0)
    words = list(
        (
            await session.execute(
                base_query.order_by(Vocabulary.word.asc()).offset((page - 1) * page_size).limit(page_size)
            )
        ).scalars().all()
    )
    return VocabularySearchData(total=total, page=page, page_size=page_size, words=words)
