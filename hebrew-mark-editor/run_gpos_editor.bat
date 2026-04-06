@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title עורך GPOS — מפעיל

set "SCRIPT=%~dp0gpos_editor_app\main.py"
if not exist "%SCRIPT%" (
  echo.
  echo שגיאה: לא נמצא הקובץ:
  echo   %SCRIPT%
  echo ודאו שתיקיית gpos_editor_app קיימת ליד הקובץ run_gpos_editor.bat
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
  echo לא נמצא Python. התקינו מ-python.org עם סימון Add to PATH.
  pause
  exit /b 1
)

echo מתקין חבילות (אם חסרות) — אם יש שורות אדומות כאן, שלחו צילום מסך.
if "%PY%"=="python" (
  "%PY%" -m pip install -r requirements.txt
) else (
  py -3 -m pip install -r requirements.txt
)
if errorlevel 1 (
  echo.
  echo התקנת החבילות נכשלה. אולי גרסת Python 3.14 חדשה מדי ל-PyQt5 —
  echo נסו Python 3.12 מ-python.org והתקינו שוב.
  pause
  exit /b 1
)

echo.
echo מריץ את האפליקציה (אמור להופיע חלון עם לשוניות למעלה)...
echo פקודה: "%PY%" "%SCRIPT%"
echo.

if "%PY%"=="python" (
  "%PY%" "%SCRIPT%"
) else (
  py -3 "%SCRIPT%"
)

set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo Python הסתיים עם קוד %ERR%.
  echo אם לא נפתח חלון גרפי — ייתכן שחסר PyQt5 או שיש שגיאה בשורות למעלה.
  echo.
)
pause
exit /b %ERR%
