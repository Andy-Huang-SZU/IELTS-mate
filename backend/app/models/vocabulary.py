from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Vocabulary(Base):
    __tablename__ = "vocabulary"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    word: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    phonetic: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    definition: Mapped[str] = mapped_column(Text, default="", nullable=False)
    translation: Mapped[str] = mapped_column(Text, default="", nullable=False)
    full_translation: Mapped[str] = mapped_column(Text, default="", nullable=False)
    pos: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    example: Mapped[str] = mapped_column(Text, default="", nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    collins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    oxford: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tags: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    bnc: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    frq: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    exchange: Mapped[str] = mapped_column(Text, default="", nullable=False)

    interval: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    repetition: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)
    next_review: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="new", nullable=False)

    first_learned_at: Mapped[date | None] = mapped_column(Date, nullable=True)

    bookmarked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    wrong_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
