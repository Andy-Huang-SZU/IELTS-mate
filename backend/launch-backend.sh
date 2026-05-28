#!/usr/bin/env bash
# --------------------------------------------------
# IELTS-mate backend launcher (bundled with Electron app)
#
# This script is invoked by the Electron main process in packaged mode
# when no PyInstaller binary is available. It:
#   1. Finds a usable python3
#   2. Ensures pip dependencies are installed (first-run only)
#   3. Starts the FastAPI backend
# --------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR"

# --- Locate python3 ---
PYTHON=""
for candidate in python3 python; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON="$candidate"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "ERROR: python3 not found. Please install Python 3.10+ from https://www.python.org/downloads/" >&2
  exit 1
fi

# Check version >= 3.10
PY_VERSION=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$("$PYTHON" -c "import sys; print(sys.version_info.major)")
PY_MINOR=$("$PYTHON" -c "import sys; print(sys.version_info.minor)")
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
  echo "ERROR: Python 3.10+ required, found $PY_VERSION" >&2
  exit 1
fi

# --- Ensure dependencies (first-run) ---
VENV_DIR="$BACKEND_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
  echo "First run: setting up Python environment..." >&2
  "$PYTHON" -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --upgrade pip -q
  "$VENV_DIR/bin/pip" install \
    fastapi uvicorn[standard] sqlalchemy aiosqlite \
    pydantic httpx openai python-dotenv orjson websockets -q
  echo "Dependencies installed." >&2
fi

# --- Start backend ---
export PYTHONPATH="$BACKEND_DIR:${PYTHONPATH:-}"
exec "$VENV_DIR/bin/python" "$BACKEND_DIR/app/main.py" "$@"
