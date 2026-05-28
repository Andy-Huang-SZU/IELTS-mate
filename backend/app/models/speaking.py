from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SpeakingSession(Base):
    __tablename__ = "speaking_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mode: Mapped[str] = mapped_column(String(32), nullable=False)  # chat | mock_test
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)  # active | completed | abandoned

    # Topic info (mainly for mock_test mode)
    topic_card: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: Part 2 topic card data
    topic_summary: Mapped[str | None] = mapped_column(Text, nullable=True)  # Brief topic description for list view

    # Scores (mock_test only)
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    scores: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: {fc, lr, gra, pronunciation, overall}
    agent_reports: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: agent evaluation details
    report_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Stage summary for cognitive memory
    part1_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Duration tracking
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class SpeakingMessage(Base):
    __tablename__ = "speaking_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # examiner | candidate | system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    phase: Mapped[str] = mapped_column(String(32), default="chat", nullable=False)  # chat | part1_qa | part2_prep | part2_speak | part3_discussion

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
