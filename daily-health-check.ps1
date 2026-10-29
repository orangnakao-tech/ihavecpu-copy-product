<#
================================================================================
  iHAVECPU Extension - Daily Health Check & Auto-Diagnostic Tool
  ระบบตรวจสอบความถูกต้องและค้นหาบั๊กอัตโนมัติประจำวัน
================================================================================
#>

[CmdletBinding()]
param(
  [switch]$Fix,
  [switch]$OpenChrome
)

# ตั้งค่า Console ให้รองรับ UTF-8 ภาษาไทย
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$ErrorActionPreference = "Continue"

$global:passCount = 0
$global:warnCount = 0
$global:failCount = 0

function Write-Header($text) {
  Write-Host ""
  Write-Host ("=" * 70) -ForegroundColor DarkCyan
  Write-Host "  $text" -ForegroundColor Cyan
  Write-Host ("=" * 70) -ForegroundColor DarkCyan
}

function Write-Section($title) {
  Write-Host ""
  Write-Host ">>> $title" -ForegroundColor Yellow
}

function Report-Pass($msg) {
  $global:passCount++
  Write-Host "  [✓ ผ่าน] " -ForegroundColor Green -NoNewline
  Write-Host $msg
}

function Report-Warn($msg, $detail = "") {
  $global:warnCount++
  Write-Host "  [! ระวัง] " -ForegroundColor Yellow -NoNewline
  Write-Host $msg -ForegroundColor Yellow
  if ($detail) {
    Write-Host "           $detail" -ForegroundColor DarkYellow
  }
}

function Report-Fail($msg, $detail = "") {
  $global:failCount++
  Write-Host "  [✗ ผิดพลาด] " -ForegroundColor Red -NoNewline
  Write-Host $msg -ForegroundColor Red
  if ($detail) {
    Write-Host "           $detail" -ForegroundColor DarkRed
  }
}

function Report-Fix($msg) {
  Write-Host "  [⚙ ซ่อมแซม] " -ForegroundColor Magenta -NoNewline
  Write-Host $msg -ForegroundColor Magenta
}

Write-Header "ระบบตรวจสอบสุขภาพ Extension และค้นหาบั๊กอัตโนมัติ (iHAVECPU)"
Write-Host "เวลาที่ตรวจสอบ: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')" -ForegroundColor Gray
Write-Host "เครื่อง: $env:COMPUTERNAME | ผู้ใช้งาน: $env:USERNAME" -ForegroundColor Gray

$workspaceDir = $PSScriptRoot
if (-not $workspaceDir) { $workspaceDir = (Get-Location).Path }
$permanentDir = Join-Path $env:LOCALAPPDATA "iHAVECPU-Copy-Product"
$lockFile = Join-Path $env:TEMP "ihavecpu-ext-updater.lock"

# ------------------------------------------------------------------------------
# 1. ตรวจสอบไฟล์ระบบพื้นฐาน (Core Files Integrity)
# ------------------------------------------------------------------------------
Write-Section "1. ตรวจสอบไฟล์ระบบและส่วนขยายพื้นฐาน (Core Files)"

$coreFiles = @(
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "popup.js",
  "admeta-spec-builder.js",
  "update-config.json"
)

$allCoreExist = $true
foreach ($file in $coreFiles) {
  $filePath = Join-Path $workspaceDir $file
  if (Test-Path -LiteralPath $filePath -PathType Leaf) {
    $size = (Get-Item -LiteralPath $filePath).Length
    if ($size -gt 0) {
      Report-Pass "พบไฟล์ $file ($([Math]::Round($size / 1KB, 2)) KB)"
    } else {
      $allCoreExist = $false
      Report-Fail "ไฟล์ $file มีขนาด 0 byte (ไฟล์ว่างเปล่าหรือเสียหาย)"
    }
  } else {
    $allCoreExist = $false
    Report-Fail "ไม่พบไฟล์สำคัญ: $file ในโฟลเดอร์ $workspaceDir"
  }
}

# ------------------------------------------------------------------------------
# 2. ตรวจสอบบั๊กและ Syntax Error ในโค้ด JavaScript
# ------------------------------------------------------------------------------
Write-Section "2. ตรวจสอบ Syntax Error ในโค้ด JavaScript (Bug Detection)"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
  $nodeVersion = (& node -v)
  Report-Pass "พบ Node.js ในเครื่อง ($nodeVersion) - กำลังตรวจสอบโค้ด..."
  
  $jsFiles = @("background.js", "content.js", "popup.js", "admeta-spec-builder.js")
  foreach ($js in $jsFiles) {
    $jsPath = Join-Path $workspaceDir $js
    if (Test-Path -LiteralPath $jsPath) {
      $syntaxCheck = & node --check "$jsPath" 2>&1
      if ($LASTEXITCODE -eq 0) {
        Report-Pass "ไฟล์ $js ผ่านการตรวจสอบ Syntax (ไม่มีบั๊กไวยากรณ์)"
      } else {
        Report-Fail "พบข้อผิดพลาดไวยากรณ์ (Syntax Error) ใน $js" "$syntaxCheck"
      }
    }
  }
} else {
  Report-Warn "ไม่พบ Node.js ในเครื่อง (ข้ามการตรวจสอบ Syntax อัตโนมัติ)" "สามารถติดตั้ง Node.js เพื่อให้ระบบตรวจจับบั๊กโค้ดได้อัตโนมัติ"
}

# ------------------------------------------------------------------------------
# 3. ตรวจสอบโครงสร้าง Manifest V3
# ------------------------------------------------------------------------------
Write-Section "3. ตรวจสอบความถูกต้องของ manifest.json"

$manifestPath = Join-Path $workspaceDir "manifest.json"
$localVersion = "0.0.0"
if (Test-Path -LiteralPath $manifestPath) {
  try {
    $rawManifest = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    $manifestObj = $rawManifest | ConvertFrom-Json
    
    if ($manifestObj.manifest_version -eq 3) {
      Report-Pass "รูปแบบ Manifest ถูกต้อง (Manifest V3)"
    } else {
      Report-Fail "Manifest Version ไม่ใช่ 3 (ปัจจุบันเป็น: $($manifestObj.manifest_version))"
    }

    if ($manifestObj.version) {
      $localVersion = [string]$manifestObj.version
      Report-Pass "เวอร์ชันส่วนขยายปัจจุบัน: v$localVersion"
    } else {
      Report-Fail "ไม่พบฟิลด์ version ใน manifest.json"
    }

    if ($manifestObj.background.service_worker) {
      Report-Pass "Service Worker: $($manifestObj.background.service_worker)"
    } else {
      Report-Fail "ไม่มีการกำหนด background.service_worker"
    }
  } catch {
    Report-Fail "ไม่สามารถแปลง manifest.json เป็น JSON ได้" "$($_.Exception.Message)"
  }
}

# ------------------------------------------------------------------------------
# 4. ตรวจสอบโฟลเดอร์ติดตั้งถาวร (%LOCALAPPDATA%\iHAVECPU-Copy-Product)
# ------------------------------------------------------------------------------
Write-Section "4. ตรวจสอบโฟลเดอร์ติดตั้งถาวร (AppData)"

$permExists = Test-Path -LiteralPath $permanentDir
if ($permExists) {
  Report-Pass "พบโฟลเดอร์ติดตั้งถาวร: $permanentDir"
  $permManifestPath = Join-Path $permanentDir "manifest.json"
  if (Test-Path -LiteralPath $permManifestPath) {
    try {
      $permManifestRaw = [System.IO.File]::ReadAllText($permManifestPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
      $permManifest = $permManifestRaw | ConvertFrom-Json
      $permVersion = [string]$permManifest.version
      if ($permVersion -eq $localVersion) {
        Report-Pass "เวอร์ชันใน AppData ตรงกับโฟลเดอร์นี้ (v$permVersion)"
      } else {
        Report-Warn "เวอร์ชันไม่ตรงกัน! ใน AppData: v$permVersion | ในโฟลเดอร์นี้: v$localVersion"
        if ($Fix) {
          Report-Fix "กำลังซิงค์ไฟล์ไปยังโฟลเดอร์ AppData..."
          Copy-Item -Path (Join-Path $workspaceDir "*") -Destination $permanentDir -Recurse -Force -ErrorAction SilentlyContinue
          Report-Pass "ซิงค์ไฟล์สำเร็จแล้ว"
        }
      }
    } catch {
      Report-Warn "ไม่สามารถอ่านเวอร์ชันใน AppData ได้: $($_.Exception.Message)"
    }
  } else {
    Report-Warn "ไม่พบ manifest.json ใน AppData"
    if ($Fix) {
      Report-Fix "กำลังคัดลอกไฟล์ทั้งหมดไปยัง AppData..."
      Copy-Item -Path (Join-Path $workspaceDir "*") -Destination $permanentDir -Recurse -Force -ErrorAction SilentlyContinue
      Report-Pass "คัดลอกไฟล์ไป AppData สำเร็จแล้ว"
    }
  }
} else {
  Report-Warn "ยังไม่มีโฟลเดอร์ติดตั้งถาวร: $permanentDir"
  if ($Fix) {
    Report-Fix "กำลังสร้างโฟลเดอร์และติดตั้ง..."
    New-Item -ItemType Directory -Path $permanentDir -Force | Out-Null
    Copy-Item -Path (Join-Path $workspaceDir "*") -Destination $permanentDir -Recurse -Force -ErrorAction SilentlyContinue
    Report-Pass "สร้างและติดตั้งโฟลเดอร์ถาวรเรียบร้อย"
  }
}

# ------------------------------------------------------------------------------
# 5. ตรวจสอบไฟล์ล็อกและตัวอัปเดตอัตโนมัติ (Lock File & Auto-Updater)
# ------------------------------------------------------------------------------
Write-Section "5. ตรวจสอบระบบล็อกและตัวอัปเดตอัตโนมัติ (Lock & Updater)"

if (Test-Path -LiteralPath $lockFile) {
  try {
    $lockAge = (Get-Date) - (Get-Item -LiteralPath $lockFile).LastWriteTime
    if ($lockAge.TotalSeconds -gt 45) {
      Report-Warn "พบไฟล์ Lock ค้างอยู่ ($([Math]::Round($lockAge.TotalMinutes, 1)) นาทีที่แล้ว)" "ไฟล์ค้างอาจทำให้การอัปเดตรันไม่ผ่านหรือปิดตัวเองทันที"
      if ($Fix) {
        Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
        Report-Fix "ปลดล็อกไฟล์เรียบร้อยแล้ว!"
      }
    } else {
      Report-Pass "ไฟล์ Lock เพิ่งถูกเรียกใช้งาน ($([Math]::Round($lockAge.TotalSeconds)) วินาทีที่แล้ว)"
    }
  } catch {
    Report-Warn "ไม่สามารถตรวจสอบอายุของไฟล์ Lock ได้"
  }
} else {
  Report-Pass "ระบบล็อกพร้อมทำงาน (ไม่มีไฟล์ Lock ค้าง)"
}

$vbsPath = Join-Path $permanentDir "silent-updater.vbs"
if (Test-Path -LiteralPath $vbsPath) {
  Report-Pass "พบสคริปต์รันเบื้องหลัง: silent-updater.vbs"
} else {
  Report-Warn "ไม่พบ silent-updater.vbs ใน AppData"
}

# ตรวจสอบ Registry Run
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$regVal = (Get-ItemProperty -LiteralPath $runKey -Name "iHAVECPU-Extension-AutoUpdater" -ErrorAction SilentlyContinue)."iHAVECPU-Extension-AutoUpdater"
if ($regVal) {
  Report-Pass "ลงทะเบียนเริ่มทำงานพร้อมเปิดเครื่องแล้ว (Startup Key OK)"
} else {
  Report-Warn "ยังไม่ได้ลงทะเบียน Startup Key ให้ทำงานอัตโนมัติเมื่อเปิดเครื่อง"
  if ($Fix -and (Test-Path -LiteralPath $vbsPath)) {
    Set-ItemProperty -LiteralPath $runKey -Name "iHAVECPU-Extension-AutoUpdater" -Value "wscript.exe //B //NoLogo `"$vbsPath`"" -Force -ErrorAction SilentlyContinue
    Report-Fix "ลงทะเบียน Startup Key เรียบร้อยแล้ว"
  }
}

# ------------------------------------------------------------------------------
# 6. ตรวจสอบการเชื่อมต่อเครือข่ายและ GitHub (Network & Cloud Check)
# ------------------------------------------------------------------------------
Write-Section "6. ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและ GitHub"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$githubReachable = $false
try {
  $ghResp = Invoke-WebRequest -Uri "https://api.github.com" -Method Head -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
  $githubReachable = $true
  Report-Pass "เชื่อมต่อ GitHub API ได้ปกติ (HTTP $($ghResp.StatusCode))"
} catch {
  Report-Warn "ไม่สามารถเชื่อมต่อ GitHub API ได้: $($_.Exception.Message)" "อาจติด Proxy/Firewall หรือเน็ตหลุด"
}

$rawReachable = $false
try {
  $rawResp = Invoke-WebRequest -Uri "https://raw.githubusercontent.com" -Method Head -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
  $rawReachable = $true
  Report-Pass "เชื่อมต่อ Raw GitHub CDN ได้ปกติ (HTTP $($rawResp.StatusCode))"
} catch {
  Report-Warn "ไม่สามารถเชื่อมต่อ Raw GitHub ได้: $($_.Exception.Message)"
}

# ตรวจสอบเวอร์ชันล่าสุดบน GitHub
if ($githubReachable -or $rawReachable) {
  try {
    $remoteVersion = $null
    $cfgPath = Join-Path $workspaceDir "update-config.json"
    $owner = "orangnakao-tech"
    $repo = "ihavecpu-copy-product"
    $branch = "main"
    if (Test-Path -LiteralPath $cfgPath) {
      $cfg = [System.IO.File]::ReadAllText($cfgPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
      if ($cfg.githubOwner -and $cfg.githubOwner -ne "YOUR_GITHUB_USERNAME") { $owner = $cfg.githubOwner }
      if ($cfg.githubRepo) { $repo = $cfg.githubRepo }
      if ($cfg.branch) { $branch = $cfg.branch }
    }
    
    $rawUrl = "https://raw.githubusercontent.com/$owner/$repo/$branch/manifest.json?t=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    $resp = Invoke-RestMethod -Uri $rawUrl -Method Get -TimeoutSec 7 -ErrorAction Stop
    if ($resp.version) {
      $remoteVersion = [string]$resp.version
      Report-Pass "เวอร์ชันล่าสุดบน GitHub Cloud ($owner/$repo): v$remoteVersion"
      if ($remoteVersion -eq $localVersion) {
        Report-Pass "ส่วนขยายในเครื่องเป็นเวอร์ชันล่าสุดแล้ว! (ตรงกับ Cloud)"
      } else {
        Report-Warn "พบเวอร์ชันใหม่บน GitHub (v$remoteVersion)! ในเครื่องเป็น v$localVersion" "แนะนำให้อัปเดตเป็นเวอร์ชันล่าสุด"
      }
    }
  } catch {
    Report-Warn "ไม่สามารถดึงข้อมูลเวอร์ชันล่าสุดจาก GitHub ได้ในขณะนี้"
  }
}

# ------------------------------------------------------------------------------
# 7. ตรวจสอบการติดตั้งในเบราว์เซอร์ (Chrome / Edge)
# ------------------------------------------------------------------------------
Write-Section "7. ตรวจสอบเบราว์เซอร์ Google Chrome & Microsoft Edge"

$chromePaths = @(
  (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$foundChrome = $chromePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if ($foundChrome) {
  Report-Pass "พบ Google Chrome: $foundChrome"
} else {
  Report-Warn "ไม่พบ Google Chrome ในพาธมาตรฐาน"
}

# ตรวจสอบว่า Chrome มีการเปิดใช้งาน Extension นี้อยู่หรือไม่
$chromeUserDir = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
$extFoundInBrowser = $false
if (Test-Path -LiteralPath $chromeUserDir) {
  $prefFiles = Get-ChildItem -LiteralPath $chromeUserDir -Include "Preferences", "Secure Preferences" -Recurse -Depth 3 -ErrorAction SilentlyContinue
  foreach ($pref in $prefFiles) {
    try {
      $raw = [System.IO.File]::ReadAllText($pref.FullName, [System.Text.Encoding]::UTF8)
      if ($raw -like "*ihavecpu*" -or $raw -like "*iHAVECPU*") {
        $json = $raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($json.extensions.settings) {
          foreach ($p in $json.extensions.settings.PSObject.Properties) {
            $ext = $p.Value
            if ($ext.path -and ($ext.path -like "*ihavecpu*" -or $ext.manifest.name -like "*ihavecpu*")) {
              $extFoundInBrowser = $true
              $status = if ($ext.state -eq 1) { "เปิดใช้งานอยู่ (Enabled)" } else { "ถูกปิดอยู่ (Disabled)" }
              $pathOk = if (Test-Path -LiteralPath $ext.path) { "พาธมีอยู่จริง" } else { "พาธไม่พบแล้ว!" }
              Report-Pass "พบ Extension ใน Chrome: $($ext.manifest.name) v$($ext.manifest.version)"
              Write-Host "           -> สถานะ: $status | ที่อยู่: $($ext.path) ($pathOk)" -ForegroundColor Gray
            }
          }
        }
      }
    } catch {}
  }
}

if (-not $extFoundInBrowser) {
  Report-Warn "ยังไม่พบการลงทะเบียนส่วนขยายแบบ Unpacked ใน Chrome Profile ปัจจุบัน" "หากเพิ่งติดตั้งใหม่ ต้องโหลด Unpacked เข้าที่ chrome://extensions"
}

# ------------------------------------------------------------------------------
# 8. สรุปผลการตรวจสอบ และคำแนะนำในการแก้ไข
# ------------------------------------------------------------------------------
Write-Header "สรุปผลการตรวจสอบความพร้อมของระบบ"

Write-Host "  รายการที่ผ่าน (Pass)      : " -NoNewline
Write-Host "$global:passCount รายการ" -ForegroundColor Green

Write-Host "  รายการที่ควรระวัง (Warning): " -NoNewline
Write-Host "$global:warnCount รายการ" -ForegroundColor Yellow

Write-Host "  รายการที่ผิดพลาด (Error)   : " -NoNewline
Write-Host "$global:failCount รายการ" -ForegroundColor $(if ($global:failCount -gt 0) { "Red" } else { "Green" })

Write-Host ""
if ($global:failCount -eq 0 -and $global:warnCount -eq 0) {
  Write-Host ">>> ระบบอยู่ในสถานะสมบูรณ์ 100%! พร้อมใช้งานทุกฟังก์ชัน <<<" -ForegroundColor Green
} elseif ($global:failCount -eq 0) {
  Write-Host ">>> ระบบพร้อมใช้งาน แต่มีข้อควรระวังบางรายการตามรายละเอียดด้านบน <<<" -ForegroundColor Yellow
} else {
  Write-Host ">>> พบปัญหาที่ต้องแก้ไขก่อนใช้งาน! กรุณาดูคำแนะนำด้านล่าง <<<" -ForegroundColor Red
}

Write-Host ""
Write-Host "================== วิธีแก้ปัญหาเมื่อใช้งานไม่ได้ทันที =================" -ForegroundColor Cyan
Write-Host "1. [รีโหลดส่วนขยายในเบราว์เซอร์]:" -ForegroundColor White
Write-Host "   เปิด Chrome ไปที่ chrome://extensions/ แล้วกดไอคอนลูกศรหมุน (รีโหลด)" -ForegroundColor Gray
Write-Host "2. [รีเฟรชหน้าเว็บที่ใช้งาน]:" -ForegroundColor White
Write-Host "   กด F5 หรือ Ctrl+F5 ที่หน้า ihavecpu.com, app.zaapi.com และ admeta.me" -ForegroundColor Gray
Write-Host "3. [สิทธิ์ Developer Mode]:" -ForegroundColor White
Write-Host "   ตรวจสอบว่าเปิดสวิตช์ 'Developer mode' (มุมขวาบนของหน้า extensions) แล้ว" -ForegroundColor Gray
Write-Host "4. [ตรวจสอบสวิตช์เปิด-ปิด Extension]:" -ForegroundColor White
Write-Host "   ตรวจดูว่าสวิตช์เปิดใช้งานส่วนขยาย iHAVECPU เป็นสีฟ้า (เปิดอยู่)" -ForegroundColor Gray
Write-Host "========================================================================" -ForegroundColor Cyan

if ($OpenChrome -and $foundChrome) {
  Write-Host "`nกำลังเปิดหน้า chrome://extensions/ ให้ทันที..." -ForegroundColor Yellow
  Start-Process -FilePath $foundChrome -ArgumentList "chrome://extensions/"
}

