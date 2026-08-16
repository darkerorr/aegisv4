@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set "AEGIS_INSTALL_EXIT=%ERRORLEVEL%"
if not "%AEGIS_INSTALL_EXIT%"=="0" (
  echo.
  echo [ERROR] Aegis installation failed with exit code %AEGIS_INSTALL_EXIT%.
  echo Press any key to exit...
  pause >nul
  exit /b %AEGIS_INSTALL_EXIT%
)
echo.
echo [OK] Aegis installation completed.
pause
