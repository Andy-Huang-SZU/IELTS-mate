# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for IELTS-mate backend.
Produces a single-folder distribution named 'backend' containing
the executable + all Python dependencies.

Usage:
    cd backend
    pyinstaller backend.spec
"""

import os
from pathlib import Path

block_cipher = None

backend_root = os.path.abspath('.')

# Data files that must ship with the binary
datas = [
    (os.path.join(backend_root, 'data', 'ielts_vocabulary.json'), 'data'),
    (os.path.join(backend_root, 'data', 'writing_topics.json'), 'data'),
]

# Add vocabulary mock if it exists
mock_path = os.path.join(backend_root, 'data', 'vocabulary_mock.json')
if os.path.exists(mock_path):
    datas.append((mock_path, 'data'))

a = Analysis(
    ['app/main.py'],
    pathex=[backend_root],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'uvloop',
        'httptools',
        'aiosqlite',
        'sqlalchemy.dialects.sqlite',
        'pydantic',
        'orjson',
        'httpx',
        'openai',
        'websockets',
        'app',
        'app.api',
        'app.core',
        'app.models',
        'app.services',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
        'IPython',
        'jupyter',
        'pytest',
    ],
    noarchive=False,
    cipher=block_cipher,
)

pyz = PYZ(a.pure, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='backend',
)
