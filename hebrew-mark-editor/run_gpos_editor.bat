@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

set "PY="
python -V >nul 2>&1
if not errorlevel 1 set "PY=python"
if not defined PY (
  py -3 -V >nul 2>&1
  if not errorlevel 1 set "PY=py -3"
)

if not defined PY (
  echo לא נמצא Python. התקן מ-python.org ובחר Add to PATH.
  pause
  exit /b 1
)

echo מתקין תלויות (אם צריך)...
if "%PY%"=="python" (
  "%PY%" -m pip install -q -r requirements.txt
  if errorlevel 1 "%PY%" -m pip install -r requirements.txt
) else (
  py -3 -m pip install -q -r requirements.txt
  if errorlevel 1 py -3 -m pip install -r requirements.txt
)

echo פותח עורך GPOS (PyQt)...
cd /d "%~dp0gpos_editor_app"
if "%PY%"=="python" (
  "%PY%" main.py
) else (
  py -3 main.py
)

if errorlevel 1 echo.
if errorlevel 1 echo אם יש שגיאה למעלה — העתק אותה לבקשת עזרה.
pause
exit /b 0
