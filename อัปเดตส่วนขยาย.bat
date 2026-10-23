@echo off
setlocal
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-extension.ps1" -Force %*
echo.
pause >nul
endlocal
