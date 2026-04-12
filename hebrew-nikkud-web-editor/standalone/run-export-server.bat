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
  python -m pip install flask
  if errorlevel 1 (
    echo Trying py launcher...
    py -m pip install flask
    if errorlevel 1 (
      echo Install failed. Run manually:  python -m pip install flask
      pause
      exit /b 1
    )
  )
)
echo.
echo Editor + export: http://127.0.0.1:8765/
echo API: POST /export  or  POST /export_hybrid
echo Keep this window open. Close it to stop the server.
echo Open the URL above in the browser ^(not file://^).
echo.
python export_server.py
echo.
if errorlevel 1 echo Server exited with an error.
pause
