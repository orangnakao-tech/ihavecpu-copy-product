param(
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
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
  Write-Host "พร้อมคัดลอกไปยังโฟลเดอร์ถาวร: $permanentDirectory และเปิด chrome://extensions/ พร้อมติดตั้งอัตโนมัติ"
  exit 0
}

Write-Host "1/3 กำลังคัดลอกส่วนขยายไปยังโฟลเดอร์ถาวรของเครื่อง..." -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $permanentDirectory)) {
  New-Item -ItemType Directory -Path $permanentDirectory -Force | Out-Null
}
if ($sourceDirectory -ne $permanentDirectory) {
  $excludedPattern = '^(\.git|\.gitignore|publish-update\.ps1|.*GitHub.*\.bat|README-.*|TEST_CHECKLIST\.md|.*\.zip)$'
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

try {
  $runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
  if (Test-Path -LiteralPath $runKey) {
    Set-ItemProperty -LiteralPath $runKey -Name $taskName -Value $wscriptCmd -Force
  }
} catch {}

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

function Invoke-ElementAction($el) {
  if (-not $el) { return $false }
  try {
    $invokePattern = $null
    if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$invokePattern)) {
      $invokePattern.Invoke()
      return $true
    }
  } catch {}
  try {
    $togglePattern = $null
    if ($el.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$togglePattern)) {
      $togglePattern.Toggle()
      return $true
    }
  } catch {}
  try {
    $legacyPattern = $null
    if ($el.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$legacyPattern)) {
      $legacyPattern.DoDefaultAction()
      return $true
    }
  } catch {}
  return $false
}

function Install-ExtensionViaChromeUI($chromeExe, $extFolder) {
  Add-Type -AssemblyName UIAutomationClient -ErrorAction SilentlyContinue
  Add-Type -AssemblyName UIAutomationTypes -ErrorAction SilentlyContinue
  Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue

  if (-not ("Win32WindowHelper" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32WindowHelper {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@ -ErrorAction SilentlyContinue
  }

  $wsh = New-Object -ComObject WScript.Shell

  # เปิด Chrome พร้อมเปิดโหมด Accessibility สำหรับ UI Automation
  Start-Process -FilePath $chromeExe -ArgumentList @("--force-renderer-accessibility", "chrome://extensions/") | Out-Null
  Start-Sleep -Milliseconds 1200

  # ค้นหาหน้าต่าง Chrome ล่าสุด
  $chromeWin = $null
  $deadline = (Get-Date).AddSeconds(8)
  while ((Get-Date) -lt $deadline) {
    $procs = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
    if ($procs) {
      $chromeWin = $procs | Sort-Object StartTime -Descending | Select-Object -First 1
      if (-not $chromeWin) { $chromeWin = $procs | Select-Object -First 1 }
      break
    }
    Start-Sleep -Milliseconds 300
  }

  if (-not $chromeWin) {
    return $false
  }

  $hwnd = $chromeWin.MainWindowHandle
  try {
    [Win32WindowHelper]::ShowWindow($hwnd, 9) | Out-Null
    [Win32WindowHelper]::SetForegroundWindow($hwnd) | Out-Null
    $wsh.AppActivate($chromeWin.Id) | Out-Null
  } catch {}
  Start-Sleep -Milliseconds 400

  # ตรวจสอบว่าเปิดหน้า chrome://extensions/ หรือยัง (เนื่องจาก Chrome มักบล็อกพารามิเตอร์ chrome:// จาก Command Line)
  $title = [string]$chromeWin.MainWindowTitle
  if ($title -notmatch "Extensions|ส่วนขยาย") {
    try {
      [Win32WindowHelper]::SetForegroundWindow($hwnd) | Out-Null
      Set-Clipboard -Value "chrome://extensions/"
      $wsh.SendKeys("^l")
      Start-Sleep -Milliseconds 200
      $wsh.SendKeys("^v{ENTER}")
      Start-Sleep -Milliseconds 1500
    } catch {}
  }

  # คืนค่าที่อยู่โฟลเดอร์ส่วนขยายกลับเข้า Clipboard ทันที
  try {
    Set-Clipboard -Value $extFolder
  } catch {}

  # พยายามกดเปิด Developer Mode + กด Load unpacked + เลือกโฟลเดอร์ให้อัตโนมัติผ่าน UI Automation
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
  if (-not $root) { return $false }

  $loadBtn = $null
  $uiDeadline = (Get-Date).AddSeconds(6)
  while ((Get-Date) -lt $uiDeadline) {
    # 1. ค้นหาปุ่ม Load unpacked ("โหลดส่วนขยายที่คลายแพ็กแล้ว" / "Load unpacked" / AutomationId: loadUnpacked)
    $idCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "loadUnpacked")
    $nameCond1 = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "โหลดส่วนขยายที่คลายแพ็กแล้ว")
    $nameCond2 = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Load unpacked")
    $orLoad = New-Object System.Windows.Automation.OrCondition($idCond, $nameCond1, $nameCond2)

    $loadBtn = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $orLoad)
    if ($loadBtn -and -not $loadBtn.Current.IsOffscreen) {
      break
    }

    # 2. หากยังไม่เห็นปุ่ม Load unpacked ให้ค้นหาสวิตช์ Developer mode เพื่อเปิดก่อน
    $devIdCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "devMode")
    $devNameCond1 = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "โหมดนักพัฒนาซอฟต์แวร์")
    $devNameCond2 = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Developer mode")
    $orDev = New-Object System.Windows.Automation.OrCondition($devIdCond, $devNameCond1, $devNameCond2)

    $devToggle = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $orDev)
    if ($devToggle) {
      $togglePattern = $null
      if ($devToggle.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$togglePattern)) {
        if ($togglePattern.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::Off) {
          $togglePattern.Toggle()
          Start-Sleep -Milliseconds 700
        }
      } else {
        Invoke-ElementAction $devToggle | Out-Null
        Start-Sleep -Milliseconds 700
      }
    }
    Start-Sleep -Milliseconds 400
  }

  if (-not $loadBtn) {
    return $false
  }

  # กดปุ่ม Load unpacked
  if (-not (Invoke-ElementAction $loadBtn)) {
    return $false
  }

  # รอหน้าต่างเลือกโฟลเดอร์ (Dialog #32770) เด้งขึ้นมา
  $dialog = $null
  $dlgDeadline = (Get-Date).AddSeconds(5)
  while ((Get-Date) -lt $dlgDeadline) {
    $dlgCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, "#32770")
    $dialog = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $dlgCond)
    if (-not $dialog) {
      $dialog = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children, $dlgCond)
    }
    if ($dialog) { break }
    Start-Sleep -Milliseconds 250
  }

  if (-not $dialog) {
    return $false
  }

  Start-Sleep -Milliseconds 300
  try {
    Set-Clipboard -Value $extFolder
  } catch {}

  # ค้นหาช่องกรอกชื่อโฟลเดอร์ (AutomationId 1152 หรือ Edit Box ใน Dialog)
  $editIdCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "1152")
  $editBox = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $editIdCond)
  if (-not $editBox) {
    $editTypeCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
    $allEdits = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editTypeCond)
    if ($allEdits -and $allEdits.Count -gt 0) {
      $editBox = $allEdits[$allEdits.Count - 1]
    }
  }

  $pathFilled = $false
  if ($editBox) {
    try {
      $valPattern = $null
      if ($editBox.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valPattern)) {
        $valPattern.SetValue($extFolder)
        $pathFilled = $true
      }
    } catch {}
    if (-not $pathFilled) {
      try {
        $editBox.SetFocus()
        Start-Sleep -Milliseconds 150
        $wsh.SendKeys("^a^v")
        $pathFilled = $true
      } catch {}
    }
  }

  if (-not $pathFilled) {
    return $false
  }

  Start-Sleep -Milliseconds 300

  # กดปุ่ม "เลือกโฟลเดอร์" / "Select Folder" (AutomationId = "1")
  $okBtnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "1")
  $okBtn = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $okBtnCond)
  if ($okBtn -and (Invoke-ElementAction $okBtn)) {
    Start-Sleep -Milliseconds 500
    return $true
  }

  $wsh.SendKeys("{ENTER}")
  Start-Sleep -Milliseconds 500
  return $true
}

Write-Host "3/3 กำลังเปิดหน้าส่วนขยายของ Chrome (chrome://extensions/) และติดตั้งอัตโนมัติ..." -ForegroundColor Cyan
$installedAutomatically = $false
try {
  $installedAutomatically = Install-ExtensionViaChromeUI -chromeExe $chromePath -extFolder $permanentDirectory
} catch {
  $installedAutomatically = $false
}

try {
  Set-Clipboard -Value $permanentDirectory
} catch {}

Write-Host ""
if ($installedAutomatically) {
  Write-Host "==========================================================" -ForegroundColor Green
  Write-Host "ติดตั้งส่วนขยายเข้าสู่ Google Chrome อัตโนมัติเรียบร้อยแล้ว!" -ForegroundColor Green
  Write-Host "โฟลเดอร์ที่ติดตั้ง: $permanentDirectory" -ForegroundColor Cyan
  Write-Host "==========================================================" -ForegroundColor Green
} else {
  Write-Host "==========================================================" -ForegroundColor Green
  Write-Host "เปิดหน้า chrome://extensions/ ให้เรียบร้อยแล้ว!" -ForegroundColor Green
  Write-Host "หากหน้าต่างเลือกโฟลเดอร์ยังไม่กดตกลงอัตโนมัติ ให้ทำต่อดังนี้:" -ForegroundColor Yellow
  Write-Host "1) เปิด โหมดนักพัฒนาซอฟต์แวร์ (Developer mode) ทางขวาบน"
  Write-Host "2) กด โหลดส่วนขยายที่คลายแพ็กแล้ว (Load unpacked)"
  Write-Host "3) กด Ctrl + V ในช่องชื่อโฟลเดอร์ (คัดลอกไว้ให้แล้ว) แล้วกดเลือกโฟลเดอร์:"
  Write-Host "   $permanentDirectory" -ForegroundColor Cyan
  Write-Host "==========================================================" -ForegroundColor Green
}
