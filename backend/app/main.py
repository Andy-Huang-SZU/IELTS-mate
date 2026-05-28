from __future__ import annotations

import argparse
import json
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.api import api_router
from app.core.database import AsyncSessionLocal, Base, engine
from app.models import Setting, SpeakingMessage, SpeakingSession, Vocabulary, WritingSession  # noqa: F401
from app.models.vocabulary import VocabularyEvent  # noqa: F401
from app.services.topic_bank_service import get_topic_bank
from app.services.vocabulary_service import init_vocabulary_if_empty


def _normalise_prompt_text(value: str) -> str:
    return " ".join((value or "").split()).strip().lower()


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("SELECT 1"))

        # Auto-migrate: add first_learned_at column if missing
        result = await conn.execute(text("PRAGMA table_info(vocabulary)"))
        columns = [row[1] for row in result.fetchall()]
        if "first_learned_at" not in columns:
            await conn.execute(text("ALTER TABLE vocabulary ADD COLUMN first_learned_at DATE"))
            await conn.execute(
                text("UPDATE vocabulary SET first_learned_at = DATE(updated_at) WHERE repetition > 0")
            )
            print("migrated: added first_learned_at column")

        # Auto-migrate: add topic_id to writing sessions for stable topic tracing
        result = await conn.execute(text("PRAGMA table_info(writing_sessions)"))
        columns = [row[1] for row in result.fetchall()]
        if "topic_id" not in columns:
            await conn.execute(text("ALTER TABLE writing_sessions ADD COLUMN topic_id VARCHAR(32)"))
            print("migrated: added topic_id column")

        # Auto-migrate: create vocabulary_events table for event-driven learning stats
        existing_tables = [
            row[0]
            for row in (await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))).fetchall()
        ]
        if "vocabulary_events" not in existing_tables:
            await conn.execute(
                text(
                    """
                    CREATE TABLE vocabulary_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        word_id INTEGER NOT NULL,
                        mode VARCHAR(32) NOT NULL DEFAULT 'review',
                        quality INTEGER NOT NULL DEFAULT 3,
                        created_at DATETIME NOT NULL DEFAULT (datetime('now'))
                    )
                    """
                )
            )
            await conn.execute(text("CREATE INDEX ix_vocab_events_word_id ON vocabulary_events(word_id)"))
            await conn.execute(text("CREATE INDEX ix_vocab_events_created_at ON vocabulary_events(created_at)"))
            await conn.execute(text("CREATE INDEX ix_vocab_events_word_mode ON vocabulary_events(word_id, mode)"))
            print("migrated: created vocabulary_events table with indexes")

            # Backfill events from existing learned words so heatmap/streak have history
            await conn.execute(
                text(
                    """
                    INSERT INTO vocabulary_events (word_id, mode, quality, created_at)
                    SELECT id, 'review', 3, updated_at
                    FROM vocabulary
                    WHERE repetition > 0
                    """
                )
            )
            backfill_count = (
                await conn.execute(text("SELECT changes()"))
            ).scalar()
            if backfill_count:
                print(f"backfilled {backfill_count} vocabulary events from existing data")

    # Use the full IELTS vocabulary file extracted from ECDICT; fall back to mock
    from app.core.config import get_data_dir
    data_dir = get_data_dir()
    vocab_file = data_dir / "ielts_vocabulary.json"
    if not vocab_file.exists():
        vocab_file = data_dir / "vocabulary_mock.json"

    bank = get_topic_bank()
    prompt_to_topic_id = {
        _normalise_prompt_text(topic.get("prompt", "")): topic.get("id")
        for topic in bank.get_all_topics()
        if topic.get("id") and topic.get("prompt")
    }

    async with AsyncSessionLocal() as session:
        if vocab_file.exists():
            inserted = await init_vocabulary_if_empty(session, source_file=vocab_file)
            if inserted:
                print(f"initialized vocabulary with {inserted} items")
        else:
            print("warning: vocabulary JSON not found, skipping vocab init")

        result = await session.execute(
            select(WritingSession).where(WritingSession.topic_id.is_(None))
        )
        rows = result.scalars().all()
        backfilled = 0
        for row in rows:
            resolved_topic_id = None
            if row.topic_data:
                try:
                    topic_snapshot = json.loads(row.topic_data)
                    if isinstance(topic_snapshot, dict):
                        resolved_topic_id = topic_snapshot.get("id")
                except json.JSONDecodeError:
                    resolved_topic_id = None

            if not resolved_topic_id:
                resolved_topic_id = prompt_to_topic_id.get(_normalise_prompt_text(row.topic))

            if resolved_topic_id:
                row.topic_id = resolved_topic_id
                backfilled += 1

        if backfilled:
            await session.commit()
            print(f"backfilled topic_id for {backfilled} writing sessions")

    try:
        yield
    finally:
        print("backend shutdown complete")


app = FastAPI(title="IELTS-mate Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/system/ping")
async def ping() -> dict[str, str]:
    return {"message": "pong"}


@app.websocket("/api/speaking/ws")
async def speaking_ws(websocket: WebSocket) -> None:
    from app.services.llm.factory import create_llm_client
    from app.services.settings_service import get_settings
    from app.services.speaking_service import SpeakingSessionHandler
    from app.services.stt import create_stt_client
    from app.services.tts import create_tts_client

    # Load settings to create clients
    async with AsyncSessionLocal() as db_session:
        settings = await get_settings(db_session)

    llm = create_llm_client(settings)
    stt = create_stt_client(
        provider=settings.stt_provider,
        api_key=settings.stt_api_key,
        base_url=settings.stt_base_url,
        model=settings.stt_model,
    )
    tts = create_tts_client(
        provider=settings.tts_provider,
        api_key=settings.tts_api_key,
        base_url=settings.tts_base_url,
        model=settings.tts_model,
        voice=settings.tts_voice,
    )

    handler = SpeakingSessionHandler(
        websocket=websocket,
        llm=llm,
        stt=stt,
        tts=tts,
    )
    await handler.run()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run IELTS-mate backend service")
    parser.add_argument("--port", type=int, default=18080, help="Backend listen port")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    uvicorn.run(app, host="127.0.0.1", port=args.port, reload=False)
