@echo off
setlocal
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-extension.ps1" %*
echo.
pause >nul
endlocal
