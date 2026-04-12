@echo off
chcp 65001 >nul
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"
python "%~dp0apply_nikkud_project.py" %*
