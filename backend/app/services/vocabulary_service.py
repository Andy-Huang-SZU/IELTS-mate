from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from pathlib import Path

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vocabulary import Vocabulary, VocabularyEvent
from app.schemas.vocabulary import (
    ActivityTrendData,
    ActivityTrendPoint,
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
    session: AsyncSession, word_id: int, quality: int, mode: str = "review"
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

    # Track wrong answers
    if quality <= 1:
        word.wrong_count = (word.wrong_count or 0) + 1

    # Record first learning date
    if word.status in ("learning", "mastered") and not word.first_learned_at:
        word.first_learned_at = date.today()

    # Write learning event for accurate heatmap/streak/trend stats
    valid_modes = ("review", "learn_quiz", "spelling", "dictation")
    event_mode = mode if mode in valid_modes else "review"
    event = VocabularyEvent(word_id=word.id, mode=event_mode, quality=quality)
    session.add(event)

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

    # Unified due_today: already learned (repetition > 0) AND due
    today = date.today()
    due_today = int(
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

    # Event-driven streak: consecutive days with learning events
    streak_days = 0
    cursor = today
    while True:
        start_dt = datetime.combine(cursor, time.min)
        end_dt = datetime.combine(cursor, time.max)
        event_count = int(
            (
                await session.execute(
                    select(func.count(VocabularyEvent.id)).where(
                        and_(
                            VocabularyEvent.created_at >= start_dt,
                            VocabularyEvent.created_at <= end_dt,
                        )
                    )
                )
            ).scalar_one()
            or 0
        )
        if event_count == 0:
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

    # Event-driven: count learning events per day
    rows = (
        await session.execute(
            select(VocabularyEvent.created_at).where(
                and_(VocabularyEvent.created_at >= start, VocabularyEvent.created_at < end)
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
        # Count words that were first learned on or before this date and are now mastered
        mastered_count = int(
            (
                await session.execute(
                    select(func.count(Vocabulary.id)).where(
                        and_(
                            Vocabulary.status == "mastered",
                            Vocabulary.first_learned_at.isnot(None),
                            Vocabulary.first_learned_at <= d,
                        )
                    )
                )
            ).scalar_one()
            or 0
        )
        learning_count = int(
            (
                await session.execute(
                    select(func.count(Vocabulary.id)).where(
                        and_(
                            Vocabulary.status == "learning",
                            Vocabulary.first_learned_at.isnot(None),
                            Vocabulary.first_learned_at <= d,
                        )
                    )
                )
            ).scalar_one()
            or 0
        )
        mastered.append(mastered_count)
        learning.append(learning_count)

    return VocabularyLearningCurveData(dates=dates, mastered=mastered, learning=learning)


async def get_activity_trend(session: AsyncSession, days: int = 14) -> ActivityTrendData:
    """Get daily learning activity trend from event table, broken down by mode."""
    days = max(1, min(days, 90))
    today = date.today()
    start_date = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start_date, time.min)

    rows = (
        await session.execute(
            select(VocabularyEvent.created_at, VocabularyEvent.mode).where(
                VocabularyEvent.created_at >= start_dt
            )
        )
    ).all()

    # Aggregate by day and mode
    daily: dict[date, dict[str, int]] = {}
    for d in [start_date + timedelta(days=i) for i in range(days)]:
        daily[d] = {"review": 0, "learn_quiz": 0, "spelling": 0, "dictation": 0}

    for created_at, mode in rows:
        d = created_at.date()
        if d in daily:
            mode_key = mode if mode in daily[d] else "review"
            daily[d][mode_key] += 1

    points = [
        ActivityTrendPoint(
            date=d,
            total=sum(counts.values()),
            review=counts.get("review", 0),
            learn_quiz=counts.get("learn_quiz", 0),
            spelling=counts.get("spelling", 0),
            dictation=counts.get("dictation", 0),
        )
        for d, counts in sorted(daily.items())
    ]

    return ActivityTrendData(days=days, data=points)


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


def _build_order_clause(order: str):
    """Return SQLAlchemy order_by clause(s) based on the chosen strategy."""
    if order == "ielts_core":
        return [
            case(
                (Vocabulary.difficulty == 3, 0),
                (Vocabulary.difficulty == 4, 1),
                (Vocabulary.difficulty == 2, 2),
                (Vocabulary.difficulty == 5, 3),
                else_=4,
            ),
            func.random(),
        ]
    elif order == "difficulty_asc":
        return [Vocabulary.difficulty.asc(), func.random()]
    elif order == "difficulty_desc":
        return [Vocabulary.difficulty.desc(), func.random()]
    elif order == "alphabetical":
        return [Vocabulary.word.asc()]
    else:  # "random" (default)
        return [func.random()]


async def get_new_words(
    session: AsyncSession, limit: int, order: str | None = None
) -> tuple[list[Vocabulary], int, int, str]:
    """
    Get new words for learning.
    Returns (words, today_learned_count, daily_limit, effective_order).
    Only returns words that have never been learned (status='new' AND repetition=0).
    """
    from app.services.settings_service import get_vocab_settings

    today = date.today()
    settings = await get_vocab_settings(session)
    daily_limit = settings.daily_new_words_limit
    effective_order = order or settings.word_order or "random"

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
        return [], today_learned, daily_limit, effective_order

    words_result = await session.execute(
        select(Vocabulary)
        .where(and_(Vocabulary.status == "new", Vocabulary.repetition == 0))
        .order_by(*_build_order_clause(effective_order))
        .limit(actual_limit)
    )
    words = list(words_result.scalars().all())
    return words, today_learned, daily_limit, effective_order


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


# ---- Bookmark / Note / Most-wrong services ----


async def toggle_bookmark(session: AsyncSession, word_id: int, bookmarked: bool) -> Vocabulary:
    word = await session.get(Vocabulary, word_id)
    if not word:
        raise ValueError("word not found")
    word.bookmarked = bookmarked
    await session.commit()
    return word


async def update_note(session: AsyncSession, word_id: int, note: str) -> Vocabulary:
    word = await session.get(Vocabulary, word_id)
    if not word:
        raise ValueError("word not found")
    word.note = note
    await session.commit()
    return word


async def get_bookmarked_words(session: AsyncSession, page: int = 1, page_size: int = 50) -> tuple[int, list[Vocabulary]]:
    page = max(1, page)
    page_size = max(1, min(page_size, 200))
    total = int(
        (await session.execute(
            select(func.count(Vocabulary.id)).where(Vocabulary.bookmarked == True)
        )).scalar_one() or 0
    )
    words = list(
        (await session.execute(
            select(Vocabulary)
            .where(Vocabulary.bookmarked == True)
            .order_by(Vocabulary.updated_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )).scalars().all()
    )
    return total, words


async def get_most_wrong_words(session: AsyncSession, limit: int = 20) -> list[Vocabulary]:
    words = list(
        (await session.execute(
            select(Vocabulary)
            .where(Vocabulary.wrong_count > 0)
            .order_by(Vocabulary.wrong_count.desc())
            .limit(limit)
        )).scalars().all()
    )
    return words
