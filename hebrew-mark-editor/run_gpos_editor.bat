@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

REM ASCII only. Prefer Python 3.12 (PyQt5); "python" alone may still be 3.14.

set "QT_QPA_PLATFORM=windows"
REM Helps some Intel/AMD setups where hardware GL closes the Qt window instantly
set "QT_OPENGL=software"

set "SCRIPT=%~dp0gpos_editor_app\main.py"
if not exist "%SCRIPT%" (
  echo.
  echo ERROR: main.py not found:
  echo   %SCRIPT%
  echo.
  pause
  exit /b 1
)

echo.
echo Detecting Python ^(prefer 3.12, then 3.11, then 3.10, then py -3, then python^)...

py -3.12 -V >nul 2>&1
if not errorlevel 1 (
  echo Using: py -3.12
  py -3.12 -m pip install -r requirements.txt
  if errorlevel 1 (
    echo pip failed.
    pause
    exit /b 1
  )
  echo Starting GPOS editor...
  py -3.12 -u "%SCRIPT%"
  goto :DONE
)

py -3.11 -V >nul 2>&1
if not errorlevel 1 (
  echo Using: py -3.11
  py -3.11 -m pip install -r requirements.txt
  if errorlevel 1 (
    echo pip failed.
    pause
    exit /b 1
  )
  echo Starting GPOS editor...
  py -3.11 -u "%SCRIPT%"
  goto :DONE
)

py -3.10 -V >nul 2>&1
if not errorlevel 1 (
  echo Using: py -3.10
  py -3.10 -m pip install -r requirements.txt
  if errorlevel 1 (
    echo pip failed.
    pause
    exit /b 1
  )
  echo Starting GPOS editor...
  py -3.10 -u "%SCRIPT%"
  goto :DONE
)

py -3 -V >nul 2>&1
if not errorlevel 1 (
  echo Using: py -3 ^(default 3.x — if window closes, install 3.12 and retry^)
  py -3 -m pip install -r requirements.txt
  if errorlevel 1 (
    echo pip failed.
    pause
    exit /b 1
  )
  echo Starting GPOS editor...
  py -3 -u "%SCRIPT%"
  goto :DONE
)

python -V >nul 2>&1
if not errorlevel 1 (
  echo Using: python ^(PATH — may be 3.14^)
  python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo pip failed.
    pause
    exit /b 1
  )
  echo Starting GPOS editor...
  python -u "%SCRIPT%"
  goto :DONE
)

echo No Python found. Install 3.12 64-bit from python.org with Add to PATH.
pause
exit /b 1

:DONE
set ERR=!ERRORLEVEL!
if not "!ERR!"=="0" (
  echo.
  echo Python exited with code !ERR!. Scroll up for errors.
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
