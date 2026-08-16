@echo off
setlocal
set "AEGIS_WEB_MODE=dev"
call "%~dp0start.bat"
exit /b %ERRORLEVEL%
