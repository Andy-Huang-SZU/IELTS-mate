from __future__ import annotations

from pathlib import Path
import os


def get_db_path() -> Path:
    custom = os.getenv("BACKEND_DB_PATH")
    if custom:
        return Path(custom)
    return Path(__file__).resolve().parents[2] / "data" / "ielts_mate.db"


DB_PATH = get_db_path()
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH.as_posix()}"
