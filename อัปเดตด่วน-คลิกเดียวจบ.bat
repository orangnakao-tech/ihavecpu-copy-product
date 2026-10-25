@echo off
setlocal
chcp 65001 >nul
title iHAVECPU Extension - One-Click Auto-Repair & Update
echo ==========================================================
echo   iHAVECPU Extension - ระบบอัปเดตและซ่อมแซมอัตโนมัติ
echo ==========================================================
echo.
echo กำลังดึงตัวอัปเดตเวอร์ชันล่าสุดจาก GitHub...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $tmp = Join-Path $env:TEMP 'ihavecpu-update-repair.ps1'; (New-Object Net.WebClient).DownloadFile('https://raw.githubusercontent.com/orangnakao-tech/ihavecpu-copy-product/main/update-extension.ps1', $tmp); & $tmp -Force"
echo.
echo เสร็จสิ้นเรียบร้อย! ส่วนขยายใน Chrome จะรีโหลดตัวเองอัตโนมัติ
timeout /t 5 >nul

