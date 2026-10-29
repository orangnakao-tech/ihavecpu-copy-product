@echo off
chcp 65001 >nul
title iHAVECPU Extension - ระบบตรวจสอบความถูกต้องและค้นหาบั๊กอัตโนมัติประจำวัน
color 0B

echo.
echo =====================================================================
echo    iHAVECPU EXTENSION - ระบบตรวจสอบสุขภาพและค้นหาบั๊กอัตโนมัติ
echo =====================================================================
echo.
echo กรุณาเลือกรายการที่ต้องการ:
echo.
echo   [1] ตรวจสอบสุขภาพระบบอย่างเดียว (ตรวจเช็คบั๊กและความพร้อม)
echo   [2] ตรวจสอบพร้อมซ่อมแซมและซิงค์ไฟล์อัตโนมัติ (Auto-Fix & Sync)
echo   [3] เปิดหน้าจัดการส่วนขยายใน Google Chrome (chrome://extensions)
echo   [4] ออกจากโปรแกรม
echo.
echo =====================================================================

set /p choice="พิมพ์ตัวเลขที่ต้องการ [1-4] แล้วกด Enter (ค่าเริ่มต้น: 1): "

if "%choice%"=="2" goto opt_fix
if "%choice%"=="3" goto opt_chrome
if "%choice%"=="4" goto opt_exit

:opt_check
cls
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0daily-health-check.ps1"
goto opt_end

:opt_fix
cls
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0daily-health-check.ps1" -Fix
goto opt_end

:opt_chrome
cls
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0daily-health-check.ps1" -OpenChrome
goto opt_end

:opt_end
echo.
echo กดปุ่มใดๆ เพื่อปิดหน้านี้...
pause >nul

:opt_exit

