@echo off
REM This runs editor.py (legacy). For the PyQt GPOS app use run_gpos_editor.bat
setlocal EnableExtensions
cd /d "%~dp0"

REM Real Python answers -V; Windows Store stub / missing exe fails here.
set "PY="
python -V >nul 2>&1
if not errorlevel 1 set "PY=python"

if not defined PY (
  py -3 -V >nul 2>&1
  if not errorlevel 1 set "PY=py -3"
)

if not defined PY goto NO_PYTHON

echo Running Hebrew mark editor...
if "%PY%"=="python" (
  "%PY%" -m pip install -q -r requirements.txt
  if errorlevel 1 "%PY%" -m pip install -r requirements.txt
  "%PY%" editor.py
) else (
  py -3 -m pip install -q -r requirements.txt
  if errorlevel 1 py -3 -m pip install -r requirements.txt
  py -3 editor.py
)

if errorlevel 1 echo.
if errorlevel 1 echo If you see errors above, copy them when asking for help.
pause
exit /b 0

:NO_PYTHON
echo.
echo  ============================================================
echo   Python is not installed (or not available in this window).
echo  ============================================================
echo.
echo  Do this:
echo    1. Open: https://www.python.org/downloads/
echo    2. Download Python 3 and run the installer.
echo    3. On the FIRST screen, ENABLE:
echo         [x] Add python.exe to PATH
echo    4. Click "Install Now", wait until it finishes.
echo    5. CLOSE this window, then double-click run.bat again.
echo.
echo  If Python is already installed but you still see this:
echo    - Open Windows Settings - Apps - Advanced app settings
echo      - App execution aliases
echo    - Turn OFF "python.exe" and "python3.exe" (Store stubs).
echo    - Then try run.bat again.
echo.
pause
exit /b 1
