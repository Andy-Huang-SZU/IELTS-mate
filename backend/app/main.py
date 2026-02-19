from __future__ import annotations

import argparse
import json
from contextlib import asynccontextmanager
from pathlib import Path
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import api_router
from app.core.database import AsyncSessionLocal, Base, engine
from app.models import Setting, Vocabulary  # noqa: F401
from app.services.vocabulary_service import init_vocabulary_if_empty


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
            # Backfill: set first_learned_at for already-learned words
            await conn.execute(
                text("UPDATE vocabulary SET first_learned_at = DATE(updated_at) WHERE repetition > 0")
            )
            print("migrated: added first_learned_at column")

    # Use the full IELTS vocabulary file extracted from ECDICT; fall back to mock
    vocab_file = Path(__file__).resolve().parents[1] / "data" / "ielts_vocabulary.json"
    if not vocab_file.exists():
        vocab_file = Path(__file__).resolve().parents[1] / "data" / "vocabulary_mock.json"
    async with AsyncSessionLocal() as session:
        inserted = await init_vocabulary_if_empty(session, source_file=vocab_file)
        if inserted:
            print(f"initialized vocabulary with {inserted} items")
    try:
        yield
    finally:
        print("backend shutdown complete")


app = FastAPI(title="IELTS-mate Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:*", "http://127.0.0.1:*"],
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
    await websocket.accept()
    await websocket.send_json({"type": "connected", "message": "ws_ready"})
    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)
            msg_type = payload.get("type")
            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "message": "ws_ok"})
                continue
            await websocket.send_json({"type": "echo", "payload": payload})
    except WebSocketDisconnect:
        return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run IELTS-mate backend service")
    parser.add_argument("--port", type=int, default=18080, help="Backend listen port")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    uvicorn.run("app.main:app", host="127.0.0.1", port=args.port, reload=False)
