@echo off
cd /d "%~dp0"
python -m pip install -q -r requirements.txt
if errorlevel 1 (
  echo Try: py -3 -m pip install -r requirements.txt
  py -3 -m pip install -q -r requirements.txt
)
python editor.py
if errorlevel 1 py -3 editor.py
if errorlevel 1 (
  echo Python not found. Install from https://www.python.org/downloads/ and enable "Add to PATH".
  pause
)
