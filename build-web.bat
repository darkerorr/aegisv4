@echo off
setlocal
cd /d "%~dp0"
node scripts\web\ensure-web-build.mjs --force
if errorlevel 1 pause
exit /b %ERRORLEVEL%
