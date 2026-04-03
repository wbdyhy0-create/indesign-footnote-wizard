@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PY="
python -V >nul 2>&1
if not errorlevel 1 set "PY=python"

if not defined PY (
  py -3 -V >nul 2>&1
  if not errorlevel 1 set "PY=py -3"
)

if not defined PY goto NO_PYTHON

echo Running Taginim editor...
if "%PY%"=="python" (
  "%PY%" -m pip install -q -r requirements.txt
  if errorlevel 1 "%PY%" -m pip install -r requirements.txt
  "%PY%" taginim_app.py
) else (
  py -3 -m pip install -q -r requirements.txt
  if errorlevel 1 py -3 -m pip install -r requirements.txt
  py -3 taginim_app.py
)

if errorlevel 1 echo.
if errorlevel 1 echo If you see errors above, copy them when asking for help.
pause
exit /b 0

:NO_PYTHON
echo Python not found. Install Python 3.10+ and add to PATH.
pause
exit /b 1
