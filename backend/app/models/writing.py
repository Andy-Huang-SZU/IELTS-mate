from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WritingSession(Base):
    __tablename__ = "writing_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_type: Mapped[str] = mapped_column(String(16), nullable=False)  # part_a | part_b
    topic_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    topic_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON topic snapshot
    user_essay: Mapped[str] = mapped_column(Text, default="", nullable=False)
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    scores: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: {tr, cc, lr, gra, overall}
    agent_reports: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: {tr:{...}, cc:{...}, ...}
    report_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
