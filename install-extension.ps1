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
$wscriptCmd = "wscript.exe `"$vbsScript`""

$taskCreated = $false
try {
  $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsScript`""
  $triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerRepeat) -Settings $settings -Force -ErrorAction Stop | Out-Null
  $taskCreated = $true
} catch {
  try {
    $schtasksLine = "/Create /SC MINUTE /MO 5 /TN `"$taskName`" /TR `"wscript.exe '$vbsScript'`" /F"
    $proc = Start-Process -FilePath "schtasks.exe" -ArgumentList $schtasksLine -NoNewWindow -Wait -PassThru -WindowStyle Hidden -ErrorAction Stop
    if ($proc.ExitCode -eq 0) {
      $taskCreated = $true
    }
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
    Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsScript`"" -WindowStyle Hidden
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

  if (-not ("Win32WindowHelperV2" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32WindowHelperV2 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
  public static extern IntPtr FindWindowEx(IntPtr parentHandle, IntPtr childAfter, string lclassName, string windowTitle);

  public static void ForceForeground(IntPtr hWnd) {
    if (hWnd == IntPtr.Zero) return;
    IntPtr fg = GetForegroundWindow();
    if (fg != IntPtr.Zero && fg != hWnd) {
      uint dummy;
      uint fgThread = GetWindowThreadProcessId(fg, out dummy);
      uint targetThread = GetWindowThreadProcessId(hWnd, out dummy);
      if (fgThread != targetThread && fgThread != 0 && targetThread != 0) {
        AttachThreadInput(fgThread, targetThread, true);
        ShowWindow(hWnd, 9);
        BringWindowToTop(hWnd);
        SetForegroundWindow(hWnd);
        AttachThreadInput(fgThread, targetThread, false);
      }
    }
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    ShowWindow(hWnd, 9);
    BringWindowToTop(hWnd);
    SetForegroundWindow(hWnd);
    SwitchToThisWindow(hWnd, true);
  }
}
"@ -ErrorAction SilentlyContinue
  }

  $wsh = New-Object -ComObject WScript.Shell
  $terminalHwnd = [Win32WindowHelperV2]::GetForegroundWindow()

  # เปิดแท็บใหม่ใน Chrome พร้อมเปิดโหมด Accessibility
  Start-Process -FilePath $chromeExe -ArgumentList @("--force-renderer-accessibility", "about:blank") | Out-Null
  Start-Sleep -Milliseconds 1200

  # ค้นหาหน้าต่างหลักของ Chrome
  $chromeWin = $null
  $deadline = (Get-Date).AddSeconds(8)
  while ((Get-Date) -lt $deadline) {
    $procs = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
    if ($procs) {
      $chromeWin = $procs | Select-Object -First 1
      break
    }
    Start-Sleep -Milliseconds 250
  }

  if (-not $chromeWin) {
    return $false
  }

  $hwnd = $chromeWin.MainWindowHandle

  # ย่อหน้าต่าง Terminal ลงเพื่อไม่ให้แย่งโฟกัสปุ่มคีย์บอร์ดจาก Chrome
  if ($terminalHwnd -ne [IntPtr]::Zero -and $terminalHwnd -ne $hwnd) {
    try { [Win32WindowHelperV2]::ShowWindow($terminalHwnd, 6) | Out-Null } catch {}
  }

  [Win32WindowHelperV2]::ForceForeground($hwnd)
  try { $wsh.AppActivate($chromeWin.Id) | Out-Null } catch {}
  Start-Sleep -Milliseconds 500

  $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)

  # บังคับเปิดหน้า chrome://extensions/ ผ่านช่อง Address Bar (Omnibox)
  for ($attempt = 0; $attempt -lt 2; $attempt++) {
    $chromeWin.Refresh()
    if ([string]$chromeWin.MainWindowTitle -match "Extensions|ส่วนขยาย") {
      break
    }

    [Win32WindowHelperV2]::ForceForeground($hwnd)
    Start-Sleep -Milliseconds 250

    # ลองโฟกัสช่อง Address Bar (OmniboxViewViews) ด้วย UI Automation ก่อน
    if ($root) {
      try {
        $omniCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, "OmniboxViewViews")
        $omnibox = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $omniCond)
        if ($omnibox) {
          $omnibox.SetFocus()
          Start-Sleep -Milliseconds 150
        }
      } catch {}
    }

    try {
      Set-Clipboard -Value "chrome://extensions/"
      [System.Windows.Forms.SendKeys]::SendWait("^l")
      Start-Sleep -Milliseconds 250
      [System.Windows.Forms.SendKeys]::SendWait("^v")
      Start-Sleep -Milliseconds 150
      [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    } catch {
      try {
        $wsh.SendKeys("^l")
        Start-Sleep -Milliseconds 250
        $wsh.SendKeys("^v{ENTER}")
      } catch {}
    }

    # รอให้หน้า chrome://extensions/ โหลดขึ้นมา
    $navWait = (Get-Date).AddSeconds(3)
    while ((Get-Date) -lt $navWait) {
      Start-Sleep -Milliseconds 300
      $chromeWin.Refresh()
      if ([string]$chromeWin.MainWindowTitle -match "Extensions|ส่วนขยาย") {
        break
      }
    }
  }

  # คืนค่าที่อยู่โฟลเดอร์ส่วนขยายกลับเข้า Clipboard ทันที
  try {
    Set-Clipboard -Value $extFolder
  } catch {}

  if (-not $root) { return $false }

  # กระตุ้น Accessibility Tree ของหน้าเว็บภายใน Chrome (Chrome_RenderWidgetHostHWND)
  try {
    $renderHwnd = [Win32WindowHelperV2]::FindWindowEx($hwnd, [IntPtr]::Zero, "Chrome_RenderWidgetHostHWND", $null)
    if ($renderHwnd -ne [IntPtr]::Zero) {
      $renderEl = [System.Windows.Automation.AutomationElement]::FromHandle($renderHwnd)
      if ($renderEl) {
        $null = $renderEl.FindFirst([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
      }
    }
  } catch {}

  Start-Sleep -Milliseconds 600

  $loadBtn = $null
  $uiDeadline = (Get-Date).AddSeconds(7)
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
  $dlgDeadline = (Get-Date).AddSeconds(6)
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

  Start-Sleep -Milliseconds 350
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
        [System.Windows.Forms.SendKeys]::SendWait("^a^v")
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

  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
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
