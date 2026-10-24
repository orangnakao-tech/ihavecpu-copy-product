param(
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$sourceDirectory = $PSScriptRoot
$manifestPath = Join-Path $sourceDirectory "manifest.json"
$permanentDirectory = Join-Path $env:LOCALAPPDATA "iHAVECPU-Copy-Product"

function Stop-Installer($message) {
  Write-Host "$([char]0x0E15)$([char]0x0E34)$([char]0x0E14)$([char]0x0E15)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07)$([char]0x0E44)$([char]0x0E21)$([char]0x0E48)$([char]0x0E2A)$([char]0x0E33)$([char]0x0E40)$([char]0x0E23)$([char]0x0E47)$([char]0x0E08): $message" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  Stop-Installer "$([char]0x0E44)$([char]0x0E21)$([char]0x0E48)$([char]0x0E1E)$([char]0x0E1A)$([char]0x0E44)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E4C) manifest.json $([char]0x0E43)$([char]0x0E19)$([char]0x0E42)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E40)$([char]0x0E14)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C)$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22): $sourceDirectory"
}

try {
  $rawManifest = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
  $manifest = $rawManifest | ConvertFrom-Json
} catch {
  Stop-Installer "$([char]0x0E44)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E4C) manifest.json $([char]0x0E44)$([char]0x0E21)$([char]0x0E48)$([char]0x0E16)$([char]0x0E39)$([char]0x0E01)$([char]0x0E15)$([char]0x0E49)$([char]0x0E2D)$([char]0x0E07): $($_.Exception.Message)"
}

if ($manifest.manifest_version -ne 3) {
  Stop-Installer "$([char]0x0E23)$([char]0x0E2D)$([char]0x0E07)$([char]0x0E23)$([char]0x0E31)$([char]0x0E1A)$([char]0x0E40)$([char]0x0E09)$([char]0x0E1E)$([char]0x0E32)$([char]0x0E30)$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22) Chrome Manifest V3"
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
  Stop-Installer "$([char]0x0E44)$([char]0x0E21)$([char]0x0E48)$([char]0x0E1E)$([char]0x0E1A) Google Chrome $([char]0x0E01)$([char]0x0E23)$([char]0x0E38)$([char]0x0E13)$([char]0x0E32)$([char]0x0E15)$([char]0x0E34)$([char]0x0E14)$([char]0x0E15)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07) Chrome $([char]0x0E01)$([char]0x0E48)$([char]0x0E2D)$([char]0x0E19)$([char]0x0E41)$([char]0x0E25)$([char]0x0E49)$([char]0x0E27)$([char]0x0E25)$([char]0x0E2D)$([char]0x0E07)$([char]0x0E2D)$([char]0x0E35)$([char]0x0E01)$([char]0x0E04)$([char]0x0E23)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07)"
}

if ($WhatIf) {
  Write-Host "$([char]0x0E15)$([char]0x0E23)$([char]0x0E27)$([char]0x0E08)$([char]0x0E2A)$([char]0x0E2D)$([char]0x0E1A)$([char]0x0E42)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E40)$([char]0x0E14)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C)$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22)$([char]0x0E41)$([char]0x0E25)$([char]0x0E49)$([char]0x0E27): $sourceDirectory"
  Write-Host "$([char]0x0E1E)$([char]0x0E1A) Google Chrome $([char]0x0E17)$([char]0x0E35)$([char]0x0E48): $chromePath"
  Write-Host "$([char]0x0E1E)$([char]0x0E23)$([char]0x0E49)$([char]0x0E2D)$([char]0x0E21)$([char]0x0E04)$([char]0x0E31)$([char]0x0E14)$([char]0x0E25)$([char]0x0E2D)$([char]0x0E01)$([char]0x0E44)$([char]0x0E1B)$([char]0x0E22)$([char]0x0E31)$([char]0x0E07)$([char]0x0E42)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E40)$([char]0x0E14)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C)$([char]0x0E16)$([char]0x0E32)$([char]0x0E27)$([char]0x0E23): $permanentDirectory $([char]0x0E41)$([char]0x0E25)$([char]0x0E30)$([char]0x0E40)$([char]0x0E1B)$([char]0x0E34)$([char]0x0E14) chrome://extensions/ $([char]0x0E42)$([char]0x0E14)$([char]0x0E22)$([char]0x0E15)$([char]0x0E23)$([char]0x0E07)"
  exit 0
}

Write-Host "1/3 $([char]0x0E01)$([char]0x0E33)$([char]0x0E25)$([char]0x0E31)$([char]0x0E07)$([char]0x0E04)$([char]0x0E31)$([char]0x0E14)$([char]0x0E25)$([char]0x0E2D)$([char]0x0E01)$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22)$([char]0x0E44)$([char]0x0E1B)$([char]0x0E22)$([char]0x0E31)$([char]0x0E07)$([char]0x0E42)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E40)$([char]0x0E14)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C)$([char]0x0E16)$([char]0x0E32)$([char]0x0E27)$([char]0x0E23)$([char]0x0E02)$([char]0x0E2D)$([char]0x0E07)$([char]0x0E40)$([char]0x0E04)$([char]0x0E23)$([char]0x0E37)$([char]0x0E48)$([char]0x0E2D)$([char]0x0E07)..." -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $permanentDirectory)) {
  New-Item -ItemType Directory -Path $permanentDirectory -Force | Out-Null
}
if ($sourceDirectory -ne $permanentDirectory) {
  $excludedPattern = '^(\.git|\.gitignore|publish-update\.ps1|.*GitHub.*\.bat|README-.*|TEST_CHECKLIST\.md|.*\.zip)$'
  Get-ChildItem -LiteralPath $sourceDirectory -Force | Where-Object { $_.Name -notmatch $excludedPattern } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $permanentDirectory -Recurse -Force
  }
}
Write-Host "   $([char]0x0E40)$([char]0x0E01)$([char]0x0E47)$([char]0x0E1A)$([char]0x0E44)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E4C)$([char]0x0E44)$([char]0x0E27)$([char]0x0E49)$([char]0x0E17)$([char]0x0E35)$([char]0x0E48): $permanentDirectory" -ForegroundColor Green

Write-Host "2/3 $([char]0x0E01)$([char]0x0E33)$([char]0x0E25)$([char]0x0E31)$([char]0x0E07)$([char]0x0E15)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07)$([char]0x0E04)$([char]0x0E48)$([char]0x0E32)$([char]0x0E23)$([char]0x0E30)$([char]0x0E1A)$([char]0x0E1A)$([char]0x0E14)$([char]0x0E36)$([char]0x0E07)$([char]0x0E2D)$([char]0x0E31)$([char]0x0E1B)$([char]0x0E40)$([char]0x0E14)$([char]0x0E15)$([char]0x0E2D)$([char]0x0E31)$([char]0x0E15)$([char]0x0E42)$([char]0x0E19)$([char]0x0E21)$([char]0x0E31)$([char]0x0E15)$([char]0x0E34)$([char]0x0E08)$([char]0x0E32)$([char]0x0E01) GitHub ($([char]0x0E17)$([char]0x0E33)$([char]0x0E07)$([char]0x0E32)$([char]0x0E19)$([char]0x0E40)$([char]0x0E1A)$([char]0x0E37)$([char]0x0E49)$([char]0x0E2D)$([char]0x0E07)$([char]0x0E2B)$([char]0x0E25)$([char]0x0E31)$([char]0x0E07)$([char]0x0E42)$([char]0x0E14)$([char]0x0E22)$([char]0x0E44)$([char]0x0E21)$([char]0x0E48)$([char]0x0E15)$([char]0x0E49)$([char]0x0E2D)$([char]0x0E07)$([char]0x0E15)$([char]0x0E34)$([char]0x0E14)$([char]0x0E15)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07)$([char]0x0E43)$([char]0x0E2B)$([char]0x0E21)$([char]0x0E48))..." -ForegroundColor Cyan
$vbsScript = Join-Path $permanentDirectory "silent-updater.vbs"
$updaterScript = Join-Path $permanentDirectory "update-extension.ps1"
$taskName = "iHAVECPU-Extension-AutoUpdater"
$shortVbs = $vbsScript
try {
  $fso = New-Object -ComObject Scripting.FileSystemObject
  if ($fso.FileExists($vbsScript)) {
    $shortVbs = $fso.GetFile($vbsScript).ShortPath
  }
} catch {}
$wscriptCmd = "wscript.exe //B //NoLogo `"$vbsScript`""

$taskCreated = $false
try {
  $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "//B //NoLogo `"$vbsScript`" --once"
  $triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerRepeat) -Settings $settings -Force -ErrorAction Stop | Out-Null
  $taskCreated = $true
} catch {
  try {
    $schtasksLine = "/Create /SC MINUTE /MO 1 /TN `"$taskName`" /TR `"wscript.exe //B //NoLogo $shortVbs --once`" /F"
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
    $taskCreated = $true
  }
} catch {}

try {
  $protoRoot = "HKCU:\Software\Classes\ihavecpu-updater"
  $protoCmd = "HKCU:\Software\Classes\ihavecpu-updater\shell\open\command"
  New-Item -Path $protoCmd -Force | Out-Null
  Set-ItemProperty -LiteralPath $protoRoot -Name "(Default)" -Value "URL:iHAVECPU Extension Updater" -Force
  Set-ItemProperty -LiteralPath $protoRoot -Name "URL Protocol" -Value "" -Force
  Set-ItemProperty -LiteralPath $protoCmd -Name "(Default)" -Value "wscript.exe //B //NoLogo `"$vbsScript`" --force" -Force
} catch {}

try {
  if (Test-Path -LiteralPath $vbsScript) {
    Start-Process -FilePath "wscript.exe" -ArgumentList "//B //NoLogo `"$vbsScript`"" -WindowStyle Hidden
  } elseif (Test-Path -LiteralPath $updaterScript) {
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$updaterScript`" -Silent" -WindowStyle Hidden
  }
} catch {}

if ($taskCreated) {
  Write-Host "   $([char]0x0E15)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07)$([char]0x0E04)$([char]0x0E48)$([char]0x0E32)$([char]0x0E14)$([char]0x0E36)$([char]0x0E07)$([char]0x0E2D)$([char]0x0E31)$([char]0x0E1B)$([char]0x0E40)$([char]0x0E14)$([char]0x0E15)$([char]0x0E2D)$([char]0x0E31)$([char]0x0E15)$([char]0x0E42)$([char]0x0E19)$([char]0x0E21)$([char]0x0E31)$([char]0x0E15)$([char]0x0E34)$([char]0x0E17)$([char]0x0E38)$([char]0x0E01)$([char]0x0E46) 1 $([char]0x0E19)$([char]0x0E32)$([char]0x0E17)$([char]0x0E35)$([char]0x0E41)$([char]0x0E25)$([char]0x0E30)$([char]0x0E15)$([char]0x0E2D)$([char]0x0E19)$([char]0x0E40)$([char]0x0E1B)$([char]0x0E34)$([char]0x0E14)$([char]0x0E40)$([char]0x0E04)$([char]0x0E23)$([char]0x0E37)$([char]0x0E48)$([char]0x0E2D)$([char]0x0E07)$([char]0x0E40)$([char]0x0E23)$([char]0x0E35)$([char]0x0E22)$([char]0x0E1A)$([char]0x0E23)$([char]0x0E49)$([char]0x0E2D)$([char]0x0E22)$([char]0x0E41)$([char]0x0E25)$([char]0x0E49)$([char]0x0E27)!" -ForegroundColor Green
} else {
  Write-Host "   $([char]0x0E15)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07)$([char]0x0E04)$([char]0x0E48)$([char]0x0E32)$([char]0x0E14)$([char]0x0E36)$([char]0x0E07)$([char]0x0E2D)$([char]0x0E31)$([char]0x0E1B)$([char]0x0E40)$([char]0x0E14)$([char]0x0E15)$([char]0x0E15)$([char]0x0E2D)$([char]0x0E19)$([char]0x0E40)$([char]0x0E1B)$([char]0x0E34)$([char]0x0E14)$([char]0x0E40)$([char]0x0E04)$([char]0x0E23)$([char]0x0E37)$([char]0x0E48)$([char]0x0E2D)$([char]0x0E07)$([char]0x0E41)$([char]0x0E25)$([char]0x0E49)$([char]0x0E27) ($([char]0x0E2A)$([char]0x0E32)$([char]0x0E21)$([char]0x0E32)$([char]0x0E23)$([char]0x0E16)$([char]0x0E01)$([char]0x0E14)$([char]0x0E23)$([char]0x0E31)$([char]0x0E19) '$([char]0x0E2D)$([char]0x0E31)$([char]0x0E1B)$([char]0x0E40)$([char]0x0E14)$([char]0x0E15)$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22).bat' $([char]0x0E44)$([char]0x0E14)$([char]0x0E49)$([char]0x0E17)$([char]0x0E38)$([char]0x0E01)$([char]0x0E40)$([char]0x0E21)$([char]0x0E37)$([char]0x0E48)$([char]0x0E2D))" -ForegroundColor Yellow
}

function Open-ChromeExtensionsPage($chromeExe, $extFolder) {
  if (-not ("Win32ChromeKeyHelper" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;
public class Win32ChromeKeyHelper {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

  public const uint KEYEVENTF_KEYUP = 0x0002;
  public const byte VK_CONTROL = 0x11;
  public const byte VK_RETURN = 0x0D;
  public const byte VK_ESCAPE = 0x1B;
  public const byte VK_L = 0x4C;
  public const byte VK_V = 0x56;

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
    keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    ShowWindow(hWnd, 9);
    BringWindowToTop(hWnd);
    SetForegroundWindow(hWnd);
    SwitchToThisWindow(hWnd, true);
  }

  public static void SendCtrlKey(byte vk) {
    keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
    Thread.Sleep(30);
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    Thread.Sleep(30);
    keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    Thread.Sleep(30);
    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
  }

  public static void SendKey(byte vk) {
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    Thread.Sleep(30);
    keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
  }
}
"@ -ErrorAction SilentlyContinue
  }

  $wsh = New-Object -ComObject WScript.Shell

  Start-Process -FilePath $chromeExe -ArgumentList "about:blank" | Out-Null
  Start-Sleep -Milliseconds 1000

  $chromeWin = $null
  $deadline = (Get-Date).AddSeconds(6)
  while ((Get-Date) -lt $deadline) {
    $procs = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
    if ($procs) {
      $chromeWin = $procs | Select-Object -First 1
      break
    }
    Start-Sleep -Milliseconds 200
  }

  if (-not $chromeWin) {
    return $false
  }

  $hwnd = $chromeWin.MainWindowHandle

  for ($attempt = 0; $attempt -lt 2; $attempt++) {
    $chromeWin.Refresh()
    if ([string]$chromeWin.MainWindowTitle -match "Extensions|$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22)") {
      break
    }

    [Win32ChromeKeyHelper]::ForceForeground($hwnd)
    try { $wsh.AppActivate($chromeWin.Id) | Out-Null } catch {}
    Start-Sleep -Milliseconds 250

    Set-Clipboard -Value "chrome://extensions/"
    Start-Sleep -Milliseconds 100

    # Use Virtual Key Codes (0x4C = L, 0x56 = V, 0x0D = Enter) so it works regardless of Thai/English keyboard layout!
    [Win32ChromeKeyHelper]::SendCtrlKey(0x4C)
    Start-Sleep -Milliseconds 250
    [Win32ChromeKeyHelper]::SendCtrlKey(0x56)
    Start-Sleep -Milliseconds 200
    [Win32ChromeKeyHelper]::SendKey(0x0D)

    $waitLimit = (Get-Date).AddSeconds(2)
    while ((Get-Date) -lt $waitLimit) {
      Start-Sleep -Milliseconds 250
      $chromeWin.Refresh()
      if ([string]$chromeWin.MainWindowTitle -match "Extensions|$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22)") {
        break
      }
    }
  }

  try {
    Set-Clipboard -Value $extFolder
  } catch {}

  $autoInstalled = $false
  try {
    $job = Start-Job -ScriptBlock {
      param($targetHwndInt64, $folderPath)
      try {
        Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
        Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop
        $hwndPtr = [IntPtr]$targetHwndInt64
        $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwndPtr)
        if (-not $root) { return $false }

        $idCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "loadUnpacked")
        $loadBtn = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $idCond)
        if (-not $loadBtn) {
          $devCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "devMode")
          $devBtn = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $devCond)
          if ($devBtn) {
            $tp = $null
            if ($devBtn.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$tp)) {
              if ($tp.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::Off) { $tp.Toggle() }
            }
            Start-Sleep -Milliseconds 500
            $loadBtn = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $idCond)
          }
        }
        if (-not $loadBtn) { return $false }
        $ip = $null
        if ($loadBtn.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$ip)) {
          $ip.Invoke()
        } else {
          return $false
        }

        $dlg = $null
        for ($i = 0; $i -lt 12; $i++) {
          Start-Sleep -Milliseconds 250
          $dlgCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, "#32770")
          $dlg = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $dlgCond)
          if ($dlg) { break }
        }
        if (-not $dlg) { return $false }

        $editCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "1152")
        $editBox = $dlg.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $editCond)
        if ($editBox) {
          $vp = $null
          if ($editBox.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) {
            $vp.SetValue($folderPath)
            Start-Sleep -Milliseconds 200
            $okCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "1")
            $okBtn = $dlg.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $okCond)
            if ($okBtn) {
              $okIp = $null
              if ($okBtn.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$okIp)) {
                $okIp.Invoke()
                return $true
              }
            }
          }
        }
      } catch {}
      return $false
    } -ArgumentList @($hwnd.ToInt64(), $extFolder)

    if (Wait-Job -Job $job -Timeout 4) {
      $res = Receive-Job -Job $job -ErrorAction SilentlyContinue
      if ($res -eq $true) { $autoInstalled = $true }
    }
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
  } catch {}

  try {
    Set-Clipboard -Value $extFolder
  } catch {}

  return $autoInstalled
}

Write-Host "3/3 $([char]0x0E01)$([char]0x0E33)$([char]0x0E25)$([char]0x0E31)$([char]0x0E07)$([char]0x0E40)$([char]0x0E1B)$([char]0x0E34)$([char]0x0E14)$([char]0x0E2B)$([char]0x0E19)$([char]0x0E49)$([char]0x0E32)$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22)$([char]0x0E02)$([char]0x0E2D)$([char]0x0E07) Chrome (chrome://extensions/)..." -ForegroundColor Cyan
$installedAutomatically = $false
try {
  $installedAutomatically = Open-ChromeExtensionsPage -chromeExe $chromePath -extFolder $permanentDirectory
} catch {
  $installedAutomatically = $false
}

try {
  Set-Clipboard -Value $permanentDirectory
} catch {}

Write-Host ""
if ($installedAutomatically) {
  Write-Host "==========================================================" -ForegroundColor Green
  Write-Host "$([char]0x0E15)$([char]0x0E34)$([char]0x0E14)$([char]0x0E15)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07)$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22)$([char]0x0E40)$([char]0x0E02)$([char]0x0E49)$([char]0x0E32)$([char]0x0E2A)$([char]0x0E39)$([char]0x0E48) Google Chrome $([char]0x0E2D)$([char]0x0E31)$([char]0x0E15)$([char]0x0E42)$([char]0x0E19)$([char]0x0E21)$([char]0x0E31)$([char]0x0E15)$([char]0x0E34)$([char]0x0E40)$([char]0x0E23)$([char]0x0E35)$([char]0x0E22)$([char]0x0E1A)$([char]0x0E23)$([char]0x0E49)$([char]0x0E2D)$([char]0x0E22)$([char]0x0E41)$([char]0x0E25)$([char]0x0E49)$([char]0x0E27)!" -ForegroundColor Green
  Write-Host "$([char]0x0E42)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E40)$([char]0x0E14)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C)$([char]0x0E17)$([char]0x0E35)$([char]0x0E48)$([char]0x0E15)$([char]0x0E34)$([char]0x0E14)$([char]0x0E15)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07): $permanentDirectory" -ForegroundColor Cyan
  Write-Host "==========================================================" -ForegroundColor Green
} else {
  Write-Host "==========================================================" -ForegroundColor Green
  Write-Host "$([char]0x0E40)$([char]0x0E1B)$([char]0x0E34)$([char]0x0E14)$([char]0x0E2B)$([char]0x0E19)$([char]0x0E49)$([char]0x0E32) chrome://extensions/ $([char]0x0E43)$([char]0x0E2B)$([char]0x0E49)$([char]0x0E40)$([char]0x0E23)$([char]0x0E35)$([char]0x0E22)$([char]0x0E1A)$([char]0x0E23)$([char]0x0E49)$([char]0x0E2D)$([char]0x0E22)$([char]0x0E41)$([char]0x0E25)$([char]0x0E49)$([char]0x0E27)!" -ForegroundColor Green
  Write-Host "$([char]0x0E02)$([char]0x0E31)$([char]0x0E49)$([char]0x0E19)$([char]0x0E15)$([char]0x0E2D)$([char]0x0E19)$([char]0x0E15)$([char]0x0E34)$([char]0x0E14)$([char]0x0E15)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07)$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22) ($([char]0x0E17)$([char]0x0E33)$([char]0x0E41)$([char]0x0E04)$([char]0x0E48)$([char]0x0E04)$([char]0x0E23)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07)$([char]0x0E41)$([char]0x0E23)$([char]0x0E01)$([char]0x0E04)$([char]0x0E23)$([char]0x0E31)$([char]0x0E49)$([char]0x0E07)$([char]0x0E40)$([char]0x0E14)$([char]0x0E35)$([char]0x0E22)$([char]0x0E27)):" -ForegroundColor Green
  Write-Host "1) $([char]0x0E40)$([char]0x0E1B)$([char]0x0E34)$([char]0x0E14) $([char]0x0E42)$([char]0x0E2B)$([char]0x0E21)$([char]0x0E14)$([char]0x0E19)$([char]0x0E31)$([char]0x0E01)$([char]0x0E1E)$([char]0x0E31)$([char]0x0E12)$([char]0x0E19)$([char]0x0E32)$([char]0x0E0B)$([char]0x0E2D)$([char]0x0E1F)$([char]0x0E15)$([char]0x0E4C)$([char]0x0E41)$([char]0x0E27)$([char]0x0E23)$([char]0x0E4C) (Developer mode) $([char]0x0E17)$([char]0x0E32)$([char]0x0E07)$([char]0x0E02)$([char]0x0E27)$([char]0x0E32)$([char]0x0E1A)$([char]0x0E19)"
  Write-Host "2) $([char]0x0E01)$([char]0x0E14) $([char]0x0E42)$([char]0x0E2B)$([char]0x0E25)$([char]0x0E14)$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22)$([char]0x0E17)$([char]0x0E35)$([char]0x0E48)$([char]0x0E04)$([char]0x0E25)$([char]0x0E32)$([char]0x0E22)$([char]0x0E41)$([char]0x0E1E)$([char]0x0E47)$([char]0x0E01)$([char]0x0E41)$([char]0x0E25)$([char]0x0E49)$([char]0x0E27) (Load unpacked)"
  Write-Host "3) $([char]0x0E01)$([char]0x0E14) Ctrl + V $([char]0x0E43)$([char]0x0E19)$([char]0x0E0A)$([char]0x0E48)$([char]0x0E2D)$([char]0x0E07)$([char]0x0E0A)$([char]0x0E37)$([char]0x0E48)$([char]0x0E2D)$([char]0x0E42)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E40)$([char]0x0E14)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C) ($([char]0x0E04)$([char]0x0E31)$([char]0x0E14)$([char]0x0E25)$([char]0x0E2D)$([char]0x0E01)$([char]0x0E44)$([char]0x0E27)$([char]0x0E49)$([char]0x0E43)$([char]0x0E2B)$([char]0x0E49)$([char]0x0E41)$([char]0x0E25)$([char]0x0E49)$([char]0x0E27)) $([char]0x0E41)$([char]0x0E25)$([char]0x0E49)$([char]0x0E27)$([char]0x0E01)$([char]0x0E14)$([char]0x0E40)$([char]0x0E25)$([char]0x0E37)$([char]0x0E2D)$([char]0x0E01)$([char]0x0E42)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E40)$([char]0x0E14)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C):"
  Write-Host "   $permanentDirectory" -ForegroundColor Cyan
  Write-Host "==========================================================" -ForegroundColor Green
}
