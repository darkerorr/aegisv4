@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\stop.ps1"
set "AEGIS_EXIT=%ERRORLEVEL%"
if not "%AEGIS_EXIT%"=="0" if /i not "%AEGIS_NO_PAUSE%"=="1" pause
exit /b %AEGIS_EXIT%
