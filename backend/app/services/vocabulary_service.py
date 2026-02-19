from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from pathlib import Path

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vocabulary import Vocabulary
from app.schemas.vocabulary import (
    HeatmapPoint,
    TodaySummaryData,
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
        tags_val = item.get("tags", [])
        if isinstance(tags_val, list):
            tags_str = " ".join(tags_val)
        else:
            tags_str = str(tags_val)
        items.append(
            Vocabulary(
                word=item.get("word", "").strip(),
                phonetic=item.get("phonetic", "").strip(),
                definition=item.get("definition", "").strip(),
                translation=item.get("translation", "").strip(),
                full_translation=item.get("full_translation", "").strip(),
                pos=item.get("pos", "").strip(),
                example=item.get("example", "").strip(),
                difficulty=item.get("difficulty", 3),
                collins=item.get("collins", 0),
                oxford=item.get("oxford", 0),
                tags=tags_str,
                bnc=item.get("bnc", 0),
                frq=item.get("frq", 0),
                exchange=item.get("exchange", "").strip(),
                next_review=date.today(),
                status="new",
            )
        )
    session.add_all(items)
    await session.commit()
    return len(items)


async def get_due_words(session: AsyncSession, limit: int) -> tuple[int, list[Vocabulary]]:
    """Get words due for review (already learned, not brand-new words)."""
    today = date.today()
    due_clause = and_(
        Vocabulary.repetition > 0,
        or_(Vocabulary.next_review.is_(None), Vocabulary.next_review <= today),
    )

    total_result = await session.execute(select(func.count(Vocabulary.id)).where(due_clause))
    total_due = int(total_result.scalar_one() or 0)

    words_result = await session.execute(
        select(Vocabulary).where(due_clause).order_by(Vocabulary.next_review.asc(), Vocabulary.id.asc()).limit(limit)
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

    # Record first learning date
    if word.status in ("learning", "mastered") and not word.first_learned_at:
        word.first_learned_at = date.today()

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


async def reset_all_progress(session: AsyncSession) -> int:
    """Reset SM2 progress for all words back to 'new' state. Returns count of reset words."""
    from sqlalchemy import update

    result = await session.execute(
        update(Vocabulary).values(
            interval=0,
            repetition=0,
            ease_factor=2.5,
            next_review=date.today(),
            status="new",
            first_learned_at=None,
        )
    )
    await session.commit()
    return result.rowcount or 0


async def get_distractors(
    session: AsyncSession, word_id: int, count: int = 3, mode: str = "translation"
) -> list[str]:
    """
    Get distractors for quiz mode.
    mode='translation': return distractor translations (for en->zh questions)
    mode='word': return distractor word texts (for zh->en questions)
    """
    import random

    target = await session.get(Vocabulary, word_id)
    if not target:
        return []

    diff = target.difficulty
    col = Vocabulary.translation if mode == "translation" else Vocabulary.word

    # Get words from similar difficulty
    candidates_result = await session.execute(
        select(col).where(
            and_(
                Vocabulary.id != word_id,
                Vocabulary.difficulty >= max(1, diff - 1),
                Vocabulary.difficulty <= min(5, diff + 1),
                col != "",
            )
        )
    )
    candidates = [row[0] for row in candidates_result.all()]

    if len(candidates) < count:
        fallback_result = await session.execute(
            select(col).where(and_(Vocabulary.id != word_id, col != ""))
        )
        candidates = [row[0] for row in fallback_result.all()]

    return random.sample(candidates, min(count, len(candidates)))


async def get_new_words(session: AsyncSession, limit: int) -> tuple[list[Vocabulary], int, int]:
    """
    Get new words for learning. Returns (words, today_learned_count, daily_limit).
    Only returns words that have never been learned (status='new' AND repetition=0).
    """
    from app.services.settings_service import get_vocab_settings

    today = date.today()
    settings = await get_vocab_settings(session)
    daily_limit = settings.daily_new_words_limit

    # Count how many new words were first learned today
    today_learned = int(
        (
            await session.execute(
                select(func.count(Vocabulary.id)).where(Vocabulary.first_learned_at == today)
            )
        ).scalar_one()
        or 0
    )

    remaining = max(0, daily_limit - today_learned)
    actual_limit = min(limit, remaining)

    if actual_limit <= 0:
        return [], today_learned, daily_limit

    words_result = await session.execute(
        select(Vocabulary)
        .where(and_(Vocabulary.status == "new", Vocabulary.repetition == 0))
        .order_by(Vocabulary.difficulty.asc(), Vocabulary.id.asc())
        .limit(actual_limit)
    )
    words = list(words_result.scalars().all())
    return words, today_learned, daily_limit


async def get_today_summary(session: AsyncSession) -> TodaySummaryData:
    """Get today's learning summary for the Hub page."""
    from app.services.settings_service import get_vocab_settings

    today = date.today()
    settings = await get_vocab_settings(session)
    daily_limit = settings.daily_new_words_limit

    # Due for review (already learned words)
    due_review = int(
        (
            await session.execute(
                select(func.count(Vocabulary.id)).where(
                    and_(
                        Vocabulary.repetition > 0,
                        or_(Vocabulary.next_review.is_(None), Vocabulary.next_review <= today),
                    )
                )
            )
        ).scalar_one()
        or 0
    )

    # New words learned today
    new_words_learned_today = int(
        (
            await session.execute(
                select(func.count(Vocabulary.id)).where(Vocabulary.first_learned_at == today)
            )
        ).scalar_one()
        or 0
    )

    # Total brand-new words available
    total_new_words = int(
        (
            await session.execute(
                select(func.count(Vocabulary.id)).where(
                    and_(Vocabulary.status == "new", Vocabulary.repetition == 0)
                )
            )
        ).scalar_one()
        or 0
    )

    new_words_remaining = max(0, daily_limit - new_words_learned_today)

    return TodaySummaryData(
        due_review=due_review,
        new_words_learned_today=new_words_learned_today,
        daily_new_words_limit=daily_limit,
        new_words_remaining=new_words_remaining,
        total_new_words=total_new_words,
    )
