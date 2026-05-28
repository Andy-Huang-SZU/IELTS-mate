from __future__ import annotations

import sys
from pathlib import Path
import os


def get_base_dir() -> Path:
    """Return the backend root directory.

    When running from a PyInstaller bundle:
    - ``onefile`` mode: ``sys._MEIPASS`` points to the temp extraction folder.
    - ``onedir`` mode: ``sys._MEIPASS`` points to the ``_internal/`` folder
      next to the executable, which contains ``data/`` alongside the code.

    In development mode we fall back to the normal source tree layout.
    """
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            return Path(meipass)
        # Fallback: use the directory containing the executable
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


BASE_DIR = get_base_dir()


def get_data_dir() -> Path:
    """Return the directory that holds *read-only* bundled data files
    (``ielts_vocabulary.json``, ``writing_topics.json``, etc.).
    """
    return BASE_DIR / "data"


def get_db_path() -> Path:
    """Return the path to the SQLite database.

    Priority:
    1. ``BACKEND_DB_PATH`` env var (set by Electron main process)
    2. Fall back to ``<backend_root>/data/ielts_mate.db``
    """
    custom = os.getenv("BACKEND_DB_PATH")
    if custom:
        return Path(custom)
    return BASE_DIR / "data" / "ielts_mate.db"


DB_PATH = get_db_path()
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH.as_posix()}"
