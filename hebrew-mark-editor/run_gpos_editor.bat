@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

REM Use ASCII only in this file. Hebrew/UTF-8 breaks Windows cmd.exe batch parsing.

REM Force Qt to use the normal Windows plugin (fixes some white-window-then-close cases)
set "QT_QPA_PLATFORM=windows"

set "SCRIPT=%~dp0gpos_editor_app\main.py"
if not exist "%SCRIPT%" (
  echo.
  echo ERROR: main.py not found:
  echo   %SCRIPT%
  echo Make sure folder gpos_editor_app is next to this .bat file.
  echo.
  pause
  exit /b 1
)

set "PY="
python -V >nul 2>&1
if not errorlevel 1 set "PY=python"
if not defined PY (
  py -3 -V >nul 2>&1
  if not errorlevel 1 set "PY=py -3"
)

if not defined PY (
  echo Python not found. Install from python.org and check "Add to PATH".
  pause
  exit /b 1
)

echo Installing packages from requirements.txt ...
if "%PY%"=="python" (
  "%PY%" -m pip install -r requirements.txt
) else (
  py -3 -m pip install -r requirements.txt
)
if errorlevel 1 (
  echo.
  echo pip install failed. Try Python 3.12 if you use 3.14 ^(PyQt5 wheels^).
  pause
  exit /b 1
)

echo.
echo Starting GPOS editor ^(window with tabs should open^)...
echo Command: "%PY%" -u "%SCRIPT%"
echo.

REM -u = unbuffered so any error prints before the window closes
if "%PY%"=="python" (
  "%PY%" -u "%SCRIPT%"
) else (
  py -3 -u "%SCRIPT%"
)

set ERR=!ERRORLEVEL!
if not "!ERR!"=="0" (
  echo.
  echo Python exited with code !ERR!. Scroll up for error text.
  echo.
)
if exist "%TEMP%\gpos_editor_crash.txt" (
  echo.
  echo --- gpos_editor_crash.txt ---
  type "%TEMP%\gpos_editor_crash.txt"
  echo --- end ---
  echo.
)
pause
exit /b !ERR!
