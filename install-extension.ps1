param(
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$sourceDirectory = $PSScriptRoot
$manifestPath = Join-Path $sourceDirectory "manifest.json"
$permanentDirectory = Join-Path $env:LOCALAPPDATA "iHAVECPU-Copy-Product"

function Stop-Installer($message) {
  Write-Host "ติดตั้งไม่สำเร็จ: $message" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  Stop-Installer "ไม่พบไฟล์ manifest.json ในโฟลเดอร์ส่วนขยาย: $sourceDirectory"
}

try {
  $rawManifest = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
  $manifest = $rawManifest | ConvertFrom-Json
} catch {
  Stop-Installer "ไฟล์ manifest.json ไม่ถูกต้อง: $($_.Exception.Message)"
}

if ($manifest.manifest_version -ne 3) {
  Stop-Installer "รองรับเฉพาะส่วนขยาย Chrome Manifest V3"
}

$chromePaths = @()
$chromePaths += (Get-Command chrome.exe -ErrorAction SilentlyContinue | ForEach-Object Source)
$registryPaths = @(
  "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
  "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
)

foreach ($registryPath in $registryPaths) {
  try {
    if (Test-Path -LiteralPath $registryPath -ErrorAction SilentlyContinue) {
      $registeredPath = (Get-Item -LiteralPath $registryPath -ErrorAction SilentlyContinue).GetValue("")
      if ($registeredPath) {
        $chromePaths += $registeredPath
      }
    }
  } catch {}
}

$chromePaths += @(
  (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)

$chromePath = $chromePaths |
  Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } |
  Select-Object -First 1

if (-not $chromePath) {
  Stop-Installer "ไม่พบ Google Chrome กรุณาติดตั้ง Chrome ก่อนแล้วลองอีกครั้ง"
}

if ($WhatIf) {
  Write-Host "ตรวจสอบโฟลเดอร์ส่วนขยายแล้ว: $sourceDirectory"
  Write-Host "พบ Google Chrome ที่: $chromePath"
  Write-Host "พร้อมคัดลอกไปยังโฟลเดอร์ถาวร: $permanentDirectory และเปิด chrome://extensions/ โดยตรง"
  exit 0
}

Write-Host "1/3 กำลังคัดลอกส่วนขยายไปยังโฟลเดอร์ถาวรของเครื่อง..." -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $permanentDirectory)) {
  New-Item -ItemType Directory -Path $permanentDirectory -Force | Out-Null
}
if ($sourceDirectory -ne $permanentDirectory) {
  $excludedPattern = '^(\.git|\.gitignore|publish-update\.ps1|.*GitHub.*\.bat|README-.*|TEST_CHECKLIST\.md)$'
  Get-ChildItem -LiteralPath $sourceDirectory -Force | Where-Object { $_.Name -notmatch $excludedPattern } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $permanentDirectory -Recurse -Force
  }
}
Write-Host "   เก็บไฟล์ไว้ที่: $permanentDirectory" -ForegroundColor Green

Write-Host "2/3 กำลังตั้งค่าระบบดึงอัปเดตอัตโนมัติจาก GitHub (ทำงานเบื้องหลังโดยไม่ต้องติดตั้งใหม่)..." -ForegroundColor Cyan
$vbsScript = Join-Path $permanentDirectory "silent-updater.vbs"
$updaterScript = Join-Path $permanentDirectory "update-extension.ps1"
$taskName = "iHAVECPU-Extension-AutoUpdater"
$wscriptCmd = "wscript.exe //B //NoLogo `"$vbsScript`""

$taskCreated = $false
try {
  # ใช้ schtasks.exe ระดับผู้ใช้ปัจจุบัน (ไม่ต้องใช้สิทธิ์ Administrator) รันทุกๆ 5 นาทีแบบไร้หน้าต่างกะพริบ
  $schtasksArgs = @("/Create", "/SC", "MINUTE", "/MO", "5", "/TN", $taskName, "/TR", $wscriptCmd, "/F")
  $proc = Start-Process -FilePath "schtasks.exe" -ArgumentList $schtasksArgs -NoNewWindow -Wait -PassThru -ErrorAction Stop
  if ($proc.ExitCode -eq 0) {
    $taskCreated = $true
  }
} catch {}

if (-not $taskCreated) {
  try {
    $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "//B //NoLogo `"$vbsScript`""
    $triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerRepeat) -Settings $settings -Force | Out-Null
    $taskCreated = $true
  } catch {}
}

# ตั้งค่าให้เช็กอัปเดตอัตโนมัติทุกครั้งที่เปิดเครื่อง (Current User Run Registry - ไม่ต้องใช้สิทธิ์ Admin)
try {
  $runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
  if (Test-Path -LiteralPath $runKey) {
    Set-ItemProperty -LiteralPath $runKey -Name $taskName -Value $wscriptCmd -Force
  }
} catch {}

# สั่งดึงอัปเดตล่าสุดจาก GitHub ทันทีในพื้นหลัง 1 ครั้ง
try {
  if (Test-Path -LiteralPath $vbsScript) {
    Start-Process -FilePath "wscript.exe" -ArgumentList "//B //NoLogo `"$vbsScript`"" -WindowStyle Hidden
  } elseif (Test-Path -LiteralPath $updaterScript) {
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$updaterScript`" -Silent" -WindowStyle Hidden
  }
} catch {}

if ($taskCreated) {
  Write-Host "   ตั้งค่าดึงอัปเดตอัตโนมัติทุกๆ 5 นาทีและตอนเปิดเครื่องเรียบร้อยแล้ว!" -ForegroundColor Green
} else {
  Write-Host "   ตั้งค่าดึงอัปเดตตอนเปิดเครื่องแล้ว (สามารถกดรัน 'อัปเดตส่วนขยาย.bat' ได้ทุกเมื่อ)" -ForegroundColor Yellow
}

try {
  Set-Clipboard -Value $permanentDirectory
} catch {}

try {
  Write-Host "3/3 กำลังเปิดหน้าส่วนขยายของ Chrome..." -ForegroundColor Cyan
  Start-Process -FilePath $chromePath -ArgumentList "chrome://extensions/"
} catch {
  Stop-Installer "เปิดหน้าส่วนขยายของ Chrome ไม่สำเร็จ: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "ขั้นตอนติดตั้งส่วนขยาย (ทำแค่ครั้งแรกครั้งเดียว):" -ForegroundColor Green
Write-Host "1) เปิด โหมดนักพัฒนาซอฟต์แวร์ (Developer mode) ทางขวาบน"
Write-Host "2) กด โหลดส่วนขยายที่คลายแพ็กแล้ว (Load unpacked)"
Write-Host "3) กด Ctrl + V ในช่องชื่อโฟลเดอร์ (คัดลอกไว้ให้แล้ว) หรือเลือกโฟลเดอร์:"
Write-Host "   $permanentDirectory" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
