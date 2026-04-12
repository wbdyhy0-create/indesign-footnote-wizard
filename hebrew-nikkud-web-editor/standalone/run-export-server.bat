@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Nikkud export server
echo.
python --version
if errorlevel 1 (
  echo Python not found in PATH. Install Python and try again.
  pause
  exit /b 1
)
python -c "import flask" 2>nul
if errorlevel 1 (
  echo Installing Flask...
  pip install flask
  if errorlevel 1 (
    echo pip failed. Try: py -m pip install flask
    pause
    exit /b 1
  )
)
echo.
echo Server: http://127.0.0.1:8765  (POST /export)
echo Keep this window open. Close it to stop the server.
echo.
python export_server.py
echo.
if errorlevel 1 echo Server exited with an error.
pause
