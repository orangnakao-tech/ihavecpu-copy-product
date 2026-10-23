@echo off
setlocal
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish-update.ps1" %*
echo.
pause >nul
endlocal
