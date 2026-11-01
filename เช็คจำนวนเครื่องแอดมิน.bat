@echo off
setlocal
chcp 65001 >nul
title iHAVECPU - มอนิเตอร์แอดมินเรียลไทม์ (Real-Time Team Analytics)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-machines.ps1"
echo.
pause
endlocal
