@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\start-web-only.ps1"
set "AEGIS_EXIT=%ERRORLEVEL%"
if not "%AEGIS_EXIT%"=="0" pause
exit /b %AEGIS_EXIT%
