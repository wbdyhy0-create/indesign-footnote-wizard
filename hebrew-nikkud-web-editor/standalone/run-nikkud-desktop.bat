@echo off
REM ASCII-only: cmd.exe mis-parses UTF-8 Hebrew in this file before chcp runs.
setlocal EnableExtensions
cd /d "%~dp0"
set PYTHONUNBUFFERED=1
title Nikkud desktop (editor + export server)

set "PY="
python -V >nul 2>&1
if not errorlevel 1 set "PY=python"

if not defined PY (
  py -3 -V >nul 2>&1
  if not errorlevel 1 set "PY=py -3"
)

if not defined PY (
  echo Python not found. Install Python 3 and add it to PATH.
  pause
  exit /b 1
)

echo Installing desktop requirements (first run or after updates)...
if "%PY%"=="python" (
  python -m pip install -q -r requirements-desktop.txt
  if errorlevel 1 python -m pip install -r requirements-desktop.txt
  python nikkud_desktop_launcher.py
) else (
  py -3 -m pip install -q -r requirements-desktop.txt
  if errorlevel 1 py -3 -m pip install -r requirements-desktop.txt
  py -3 nikkud_desktop_launcher.py
)

if errorlevel 1 pause
exit /b 0
