#!/usr/bin/env bash
# --------------------------------------------------
# IELTS-mate macOS build script
# Produces a DMG installer in dist/
#
# Prerequisites:
#   - Python 3.10+ with PyInstaller installed
#   - Node.js 20+ with pnpm
#   - macOS (for native DMG creation)
# --------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Step 1: Build Python backend with PyInstaller ==="
cd backend
pip install pyinstaller 2>/dev/null || pip3 install pyinstaller
pyinstaller backend.spec --noconfirm --clean
echo "✅ Backend binary ready at backend/dist/backend/"
cd ..

echo ""
echo "=== Step 2: Install frontend dependencies ==="
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo ""
echo "=== Step 3: Build Electron frontend ==="
pnpm build

echo ""
echo "=== Step 4: Package DMG with electron-builder ==="
npx electron-builder --mac --config electron-builder.yml

echo ""
echo "=== Done! ==="
echo "Look for the DMG in dist/ directory:"
ls -la dist/*.dmg 2>/dev/null || echo "(no DMG found – check logs above)"
