#!/usr/bin/env bash
#
# dev-web.sh — 浏览器开发模式一键启动
#
# 同时启动:
#   1. Python 后端 (uvicorn, port 18080, hot-reload)
#   2. Vite 前端 dev server (port 5173)
#
# 用法: npm run dev:web
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
BACKEND_PORT=18080

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  IELTS-mate  Browser Dev Mode${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# --- Determine Python command ---
if [ -n "${BACKEND_PYTHON_PATH:-}" ]; then
  PYTHON_CMD="$BACKEND_PYTHON_PATH"
elif command -v python3 &>/dev/null; then
  PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
  PYTHON_CMD="python"
else
  echo -e "${YELLOW}⚠  Python not found. Backend will not start.${NC}"
  echo -e "${YELLOW}   Frontend-only mode: http://localhost:5173${NC}"
  echo ""
  cd "$PROJECT_ROOT"
  exec npx vite --config electron.vite.web.config.ts
fi

# --- Check if backend dependencies are installed ---
if ! "$PYTHON_CMD" -c "import fastapi; import uvicorn" 2>/dev/null; then
  echo -e "${YELLOW}⚠  Installing backend dependencies...${NC}"
  "$PYTHON_CMD" -m pip install -q -r "$BACKEND_DIR/requirements.txt"
fi

# --- Cleanup on exit ---
cleanup() {
  echo ""
  echo -e "${CYAN}Shutting down...${NC}"
  [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null
  wait 2>/dev/null
  echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

# --- Start backend ---
echo -e "${CYAN}▶ Starting Python backend on port ${BACKEND_PORT}...${NC}"
cd "$BACKEND_DIR"
PYTHONPATH="$BACKEND_DIR" "$PYTHON_CMD" -m uvicorn app.main:app \
  --host 0.0.0.0 --port "$BACKEND_PORT" --reload \
  --reload-dir "$BACKEND_DIR/app" &
BACKEND_PID=$!

# --- Wait for backend to be ready ---
echo -n "  Waiting for backend health check "
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    echo -e " ${GREEN}✓${NC}"
    echo -e "  Backend ready: ${GREEN}http://127.0.0.1:${BACKEND_PORT}${NC}"
    break
  fi
  echo -n "."
  sleep 0.5
done

# --- Start frontend ---
echo ""
echo -e "${CYAN}▶ Starting Vite dev server...${NC}"
cd "$PROJECT_ROOT"
npx vite --config electron.vite.web.config.ts &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Frontend : ${GREEN}http://localhost:5173${NC}"
echo -e "  Backend  : ${GREEN}http://localhost:${BACKEND_PORT}${NC}"
echo -e "  Health   : ${CYAN}http://localhost:${BACKEND_PORT}/health${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop both servers"
echo ""

# --- Keep alive ---
wait
