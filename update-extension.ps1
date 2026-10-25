param(
  [switch]$Silent,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$permanentDir = Join-Path $env:LOCALAPPDATA "iHAVECPU-Copy-Product"

$lockFile = Join-Path $env:TEMP "ihavecpu-ext-updater.lock"
if (Test-Path -LiteralPath $lockFile) {
  try {
    $lockAge = (Get-Date) - (Get-Item -LiteralPath $lockFile).LastWriteTime
    if ($lockAge.TotalSeconds -lt 45 -and -not $Force) {
      exit 0
    }
  } catch {}
}
try {
  Set-Content -LiteralPath $lockFile -Value $PID -Force -ErrorAction SilentlyContinue
} catch {}

function Write-Info($msg, $color = "Cyan") {
  if (-not $Silent) {
    Write-Host $msg -ForegroundColor $color
  }
}

function Read-JsonFileNoBom($path) {
  $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF).Trim()
  return ($raw | ConvertFrom-Json)
}

function Write-Utf8NoBom($path, $text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
}

function Compare-SemVer($v1, $v2) {
  $p1 = ($v1 -replace '^v', '').Split('.') | ForEach-Object { $n = 0; [int]::TryParse($_, [ref]$n) | Out-Null; $n }
  $p2 = ($v2 -replace '^v', '').Split('.') | ForEach-Object { $n = 0; [int]::TryParse($_, [ref]$n) | Out-Null; $n }
  $len = [Math]::Max($p1.Count, $p2.Count)
  for ($i = 0; $i -lt $len; $i++) {
    $a = if ($i -lt $p1.Count) { $p1[$i] } else { 0 }
    $b = if ($i -lt $p2.Count) { $p2[$i] } else { 0 }
    if ($a -gt $b) { return 1 }
    if ($a -lt $b) { return -1 }
  }
  return 0
}

# รวบรวมโฟลเดอร์ส่วนขยายทั้งหมดในเครื่องที่ต้องอัปเดตให้ตรงกัน
$targetSet = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
[void]$targetSet.Add($permanentDir)

if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot "manifest.json"))) {
  $isDevRepo = Test-Path -LiteralPath (Join-Path $PSScriptRoot "publish-update.ps1")
  if (-not $isDevRepo -or $Force) {
    [void]$targetSet.Add($PSScriptRoot)
  }
}

# ค้นหาโฟลเดอร์ส่วนขยายที่ถูก Load Unpacked ไว้จริงใน Chrome / Edge / Brave ทุก Profile
$browserUserDataDirs = @(
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"),
  (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data"),
  (Join-Path $env:LOCALAPPDATA "BraveSoftware\Brave-Browser\User Data")
)
foreach ($userDataDir in $browserUserDataDirs) {
  if (-not (Test-Path -LiteralPath $userDataDir)) { continue }
  try {
    $prefFiles = Get-ChildItem -LiteralPath $userDataDir -Include "Preferences", "Secure Preferences" -Recurse -Depth 2 -ErrorAction SilentlyContinue
    foreach ($prefFile in $prefFiles) {
      try {
        $rawPref = [System.IO.File]::ReadAllText($prefFile.FullName, [System.Text.Encoding]::UTF8)
        $pathMatches = [regex]::Matches($rawPref, '"path"\s*:\s*"([A-Za-z]:\\(?:[^"\\]|\\.)*)"')
        foreach ($m in $pathMatches) {
          $candidatePath = $m.Groups[1].Value -replace '\\\\', '\'
          if ((Test-Path -LiteralPath (Join-Path $candidatePath "manifest.json")) -and
              (Test-Path -LiteralPath (Join-Path $candidatePath "admeta-spec-builder.js")) -and
              -not (Test-Path -LiteralPath (Join-Path $candidatePath "publish-update.ps1"))) {
            [void]$targetSet.Add($candidatePath)
          }
        }
      } catch {}
    }
  } catch {}
}

# ค้นหาโฟลเดอร์ที่แอดมินอาจแตกไฟล์ไว้ใน Downloads หรือ Desktop
$commonRoots = @(
  (Join-Path $env:USERPROFILE "Downloads"),
  (Join-Path $env:USERPROFILE "Desktop")
)
foreach ($root in $commonRoots) {
  if (-not (Test-Path -LiteralPath $root)) { continue }
  try {
    $foundManifests = Get-ChildItem -LiteralPath $root -Filter "manifest.json" -Recurse -Depth 3 -ErrorAction SilentlyContinue
    foreach ($mf in $foundManifests) {
      $candDir = $mf.Directory.FullName
      if ((Test-Path -LiteralPath (Join-Path $candDir "admeta-spec-builder.js")) -and
          -not (Test-Path -LiteralPath (Join-Path $candDir "publish-update.ps1"))) {
        [void]$targetSet.Add($candDir)
      }
    }
  } catch {}
}

$targetDirs = @($targetSet)

$config = $null
foreach ($dir in @($permanentDir, $PSScriptRoot) + $targetDirs) {
  if (-not $dir) { continue }
  $cfgCandidate = Join-Path $dir "update-config.json"
  if (Test-Path -LiteralPath $cfgCandidate) {
    try {
      $config = Read-JsonFileNoBom $cfgCandidate
      if ($config) { break }
    } catch {}
  }
}

$owner = if ($config -and $config.githubOwner -and $config.githubOwner -ne "YOUR_GITHUB_USERNAME") { $config.githubOwner } else { "orangnakao-tech" }
$repo = if ($config -and $config.githubRepo) { $config.githubRepo } else { "ihavecpu-copy-product" }
$branch = if ($config -and $config.branch) { $config.branch } else { "main" }

$minLocalVersion = $null
foreach ($dir in $targetDirs) {
  $mfPath = Join-Path $dir "manifest.json"
  $ver = "0.0.0"
  if (Test-Path -LiteralPath $mfPath) {
    try {
      $mf = Read-JsonFileNoBom $mfPath
      if ($mf.version) { $ver = [string]$mf.version }
    } catch {}
  }
  if ($null -eq $minLocalVersion -or (Compare-SemVer $ver $minLocalVersion) -lt 0) {
    $minLocalVersion = $ver
  }
}
if (-not $minLocalVersion) { $minLocalVersion = "0.0.0" }

function Ensure-AutoUpdaterRegistered {
  try {
    $vbsScript = Join-Path $permanentDir "silent-updater.vbs"
    if (-not (Test-Path -LiteralPath $vbsScript)) { return }
    $taskName = "iHAVECPU-Extension-AutoUpdater"
    $wscriptCmd = "wscript.exe //B //NoLogo `"$vbsScript`""
    $runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    if (Test-Path -LiteralPath $runKey) {
      Set-ItemProperty -LiteralPath $runKey -Name $taskName -Value $wscriptCmd -Force -ErrorAction SilentlyContinue
    }
    $protoRoot = "HKCU:\Software\Classes\ihavecpu-updater"
    $protoCmd = "HKCU:\Software\Classes\ihavecpu-updater\shell\open\command"
    New-Item -Path $protoCmd -Force -ErrorAction SilentlyContinue | Out-Null
    Set-ItemProperty -LiteralPath $protoRoot -Name "(Default)" -Value "URL:iHAVECPU Extension Updater" -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -LiteralPath $protoRoot -Name "URL Protocol" -Value "" -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -LiteralPath $protoCmd -Name "(Default)" -Value "wscript.exe //B //NoLogo `"$vbsScript`" --force" -Force -ErrorAction SilentlyContinue
    if (-not $Silent) {
      Start-Process -FilePath "wscript.exe" -ArgumentList "//B //NoLogo `"$vbsScript`"" -WindowStyle Hidden -ErrorAction SilentlyContinue
    }
  } catch {}
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$headers = @{
  "Cache-Control" = "no-cache, no-store, must-revalidate"
  "Pragma"        = "no-cache"
  "User-Agent"    = "iHAVECPU-Extension-Updater"
}

$remoteVersion = $null

Write-Info "$([char]0x0E01)$([char]0x0E33)$([char]0x0E25)$([char]0x0E31)$([char]0x0E07)$([char]0x0E40)$([char]0x0E0A)$([char]0x0E47)$([char]0x0E01)$([char]0x0E40)$([char]0x0E27)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C)$([char]0x0E0A)$([char]0x0E31)$([char]0x0E19)$([char]0x0E25)$([char]0x0E48)$([char]0x0E32)$([char]0x0E2A)$([char]0x0E38)$([char]0x0E14)$([char]0x0E08)$([char]0x0E32)$([char]0x0E01) GitHub ($owner/$repo)..."

# 1. เช็กผ่าน GitHub API ก่อน (ไม่ติด Cache 5 นาทีของ raw.githubusercontent.com)
$apiUrls = @(
  "https://api.github.com/repos/$owner/$repo/contents/manifest.json?ref=$branch&t=$ts",
  "https://api.github.com/repos/$owner/$repo/contents/ihavecpu-copy-product-v4/manifest.json?ref=$branch&t=$ts"
)
foreach ($apiUrl in $apiUrls) {
  if ($remoteVersion) { break }
  try {
    $apiResp = Invoke-RestMethod -Uri $apiUrl -Method Get -Headers $headers -UseBasicParsing -TimeoutSec 10
    if ($apiResp -and $apiResp.content) {
      $cleanBase64 = ($apiResp.content -replace '\s', '')
      $decodedText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($cleanBase64)).TrimStart([char]0xFEFF).Trim()
      $parsed = $decodedText | ConvertFrom-Json
      if ($parsed.version) {
        $remoteVersion = [string]$parsed.version
      }
    }
  } catch {}
}

# 2. Fallback เช็กจาก raw.githubusercontent.com (กรณีติด Rate Limit ของ GitHub API)
$rawUrls = @(
  "https://raw.githubusercontent.com/$owner/$repo/$branch/manifest.json?t=$ts",
  "https://raw.githubusercontent.com/$owner/$repo/$branch/ihavecpu-copy-product-v4/manifest.json?t=$ts"
)
foreach ($rawUrl in $rawUrls) {
  if ($remoteVersion) { break }
  try {
    $resp = Invoke-WebRequest -Uri $rawUrl -Method Get -Headers $headers -UseBasicParsing -TimeoutSec 12
    if ($resp.StatusCode -eq 200 -and $resp.Content) {
      $text = if ($resp.Content -is [byte[]]) {
        [System.Text.Encoding]::UTF8.GetString($resp.Content)
      } else {
        [string]$resp.Content
      }
      $text = $text.TrimStart([char]0xFEFF).Trim()
      $parsed = $text | ConvertFrom-Json
      if ($parsed.version) {
        $remoteVersion = [string]$parsed.version
      }
    }
  } catch {}
}

if ([string]::IsNullOrWhiteSpace($remoteVersion)) {
  Write-Info "$([char]0x0E22)$([char]0x0E31)$([char]0x0E07)$([char]0x0E44)$([char]0x0E21)$([char]0x0E48)$([char]0x0E1E)$([char]0x0E1A)$([char]0x0E44)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E4C) manifest.json $([char]0x0E1A)$([char]0x0E19) GitHub ($owner/$repo) $([char]0x0E2B)$([char]0x0E23)$([char]0x0E37)$([char]0x0E2D)$([char]0x0E40)$([char]0x0E0A)$([char]0x0E37)$([char]0x0E48)$([char]0x0E2D)$([char]0x0E21)$([char]0x0E15)$([char]0x0E48)$([char]0x0E2D)$([char]0x0E44)$([char]0x0E21)$([char]0x0E48)$([char]0x0E44)$([char]0x0E14)$([char]0x0E49)$([char]0x0E43)$([char]0x0E19)$([char]0x0E02)$([char]0x0E13)$([char]0x0E30)$([char]0x0E19)$([char]0x0E35)$([char]0x0E49)" "Yellow"
  Ensure-AutoUpdaterRegistered
  Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
  exit 0
}

if (-not $Force -and ((Compare-SemVer $remoteVersion $minLocalVersion) -le 0)) {
  Write-Info "$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22)$([char]0x0E40)$([char]0x0E1B)$([char]0x0E47)$([char]0x0E19)$([char]0x0E40)$([char]0x0E27)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C)$([char]0x0E0A)$([char]0x0E31)$([char]0x0E19)$([char]0x0E25)$([char]0x0E48)$([char]0x0E32)$([char]0x0E2A)$([char]0x0E38)$([char]0x0E14)$([char]0x0E41)$([char]0x0E25)$([char]0x0E49)$([char]0x0E27) (v$minLocalVersion)" "Green"
  Ensure-AutoUpdaterRegistered
  Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
  exit 0
}

Write-Info "$([char]0x0E1E)$([char]0x0E1A)$([char]0x0E40)$([char]0x0E27)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C)$([char]0x0E0A)$([char]0x0E31)$([char]0x0E19)$([char]0x0E43)$([char]0x0E2B)$([char]0x0E21)$([char]0x0E48) v$remoteVersion ($([char]0x0E43)$([char]0x0E19)$([char]0x0E40)$([char]0x0E04)$([char]0x0E23)$([char]0x0E37)$([char]0x0E48)$([char]0x0E2D)$([char]0x0E07) v$minLocalVersion) $([char]0x0E01)$([char]0x0E33)$([char]0x0E25)$([char]0x0E31)$([char]0x0E07)$([char]0x0E14)$([char]0x0E32)$([char]0x0E27)$([char]0x0E19)$([char]0x0E4C)$([char]0x0E42)$([char]0x0E2B)$([char]0x0E25)$([char]0x0E14)$([char]0x0E2D)$([char]0x0E31)$([char]0x0E1B)$([char]0x0E40)$([char]0x0E14)$([char]0x0E15)..." "Green"

$tempZip = Join-Path $env:TEMP "ihavecpu-ext-update-$([Guid]::NewGuid().ToString('N')).zip"
$tempExtract = Join-Path $env:TEMP "ihavecpu-ext-extract-$([Guid]::NewGuid().ToString('N'))"
$zipUrl = "https://github.com/$owner/$repo/archive/refs/heads/$branch.zip?t=$ts"

try {
  Invoke-WebRequest -Uri $zipUrl -Headers $headers -OutFile $tempZip -UseBasicParsing -TimeoutSec 30
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($tempZip, $tempExtract)

  $extractedRoot = Get-ChildItem -LiteralPath $tempExtract -Directory | Select-Object -First 1
  if (-not $extractedRoot) {
    throw "$([char]0x0E44)$([char]0x0E21)$([char]0x0E48)$([char]0x0E1E)$([char]0x0E1A)$([char]0x0E42)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E40)$([char]0x0E14)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C)$([char]0x0E20)$([char]0x0E32)$([char]0x0E22)$([char]0x0E43)$([char]0x0E19)$([char]0x0E44)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E4C) ZIP $([char]0x0E17)$([char]0x0E35)$([char]0x0E48)$([char]0x0E14)$([char]0x0E32)$([char]0x0E27)$([char]0x0E19)$([char]0x0E4C)$([char]0x0E42)$([char]0x0E2B)$([char]0x0E25)$([char]0x0E14)$([char]0x0E21)$([char]0x0E32)"
  }

  $sourceFolder = $extractedRoot.FullName
  if (-not (Test-Path -LiteralPath (Join-Path $sourceFolder "manifest.json"))) {
    $nestedManifest = Get-ChildItem -LiteralPath $sourceFolder -Filter "manifest.json" -Recurse | Select-Object -First 1
    if ($nestedManifest) {
      $sourceFolder = $nestedManifest.Directory.FullName
    }
  }

  $excludedPattern = '^(\.git|\.gitignore|publish-update\.ps1|.*GitHub.*\.bat|check-machines\.ps1|.*เช็กจำนวนเครื่อง.*\.bat|device-info\.json|machines-cache\.json|README-.*|TEST_CHECKLIST\.md)$'
  $filesToCopy = Get-ChildItem -LiteralPath $sourceFolder -Force | Where-Object { $_.Name -notmatch $excludedPattern }

  foreach ($destDir in $targetDirs) {
    try {
      if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
      }
      foreach ($item in $filesToCopy) {
        Copy-Item -LiteralPath $item.FullName -Destination $destDir -Recurse -Force
      }
      try {
        $devInfo = @{
          machineId    = "$($env:COMPUTERNAME)_$($env:USERNAME)"
          computerName = [string]$env:COMPUTERNAME
          windowsUser  = [string]$env:USERNAME
        } | ConvertTo-Json -Compress
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText((Join-Path $destDir "device-info.json"), $devInfo, $utf8NoBom)
      } catch {}
      $newConfigPath = Join-Path $destDir "update-config.json"
      if (Test-Path -LiteralPath $newConfigPath) {
        try {
          $newConfig = Read-JsonFileNoBom $newConfigPath
          if (-not $newConfig.githubOwner -or $newConfig.githubOwner -eq "YOUR_GITHUB_USERNAME") {
            $newConfig.githubOwner = $owner
            $newConfig.githubRepo = $repo
            $newConfig.branch = $branch
            $jsonOut = $newConfig | ConvertTo-Json -Depth 5
            Write-Utf8NoBom $newConfigPath $jsonOut
          }
        } catch {}
      }
      Write-Info "   -> $([char]0x0E2D)$([char]0x0E31)$([char]0x0E1B)$([char]0x0E40)$([char]0x0E14)$([char]0x0E15)$([char]0x0E42)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E40)$([char]0x0E14)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C): $destDir" "Cyan"
    } catch {}
  }

  Ensure-AutoUpdaterRegistered
  try {
    $hbBody = @{
      id         = "$($env:COMPUTERNAME)_$($env:USERNAME)"
      pc         = [string]$env:COMPUTERNAME
      user       = [string]$env:USERNAME
      ver        = [string]$remoteVersion
      ts         = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      lastAction = "Auto-Update to v$remoteVersion"
    } | ConvertTo-Json -Compress
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-RestMethod -Uri "https://ntfy.sh/ihc_ext_stat_9f4b2c8e1d7a6053" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($hbBody)) -ContentType "text/plain; charset=utf-8" -TimeoutSec 5 -ErrorAction SilentlyContinue | Out-Null
  } catch {}
  Write-Info "$([char]0x0E2D)$([char]0x0E31)$([char]0x0E1B)$([char]0x0E40)$([char]0x0E14)$([char]0x0E15)$([char]0x0E44)$([char]0x0E1F)$([char]0x0E25)$([char]0x0E4C)$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22)$([char]0x0E40)$([char]0x0E1B)$([char]0x0E47)$([char]0x0E19)$([char]0x0E40)$([char]0x0E27)$([char]0x0E2D)$([char]0x0E23)$([char]0x0E4C)$([char]0x0E0A)$([char]0x0E31)$([char]0x0E19) v$remoteVersion $([char]0x0E2A)$([char]0x0E33)$([char]0x0E40)$([char]0x0E23)$([char]0x0E47)$([char]0x0E08)$([char]0x0E41)$([char]0x0E25)$([char]0x0E49)$([char]0x0E27)! $([char]0x0E15)$([char]0x0E31)$([char]0x0E27)$([char]0x0E2A)$([char]0x0E48)$([char]0x0E27)$([char]0x0E19)$([char]0x0E02)$([char]0x0E22)$([char]0x0E32)$([char]0x0E22)$([char]0x0E43)$([char]0x0E19) Chrome $([char]0x0E08)$([char]0x0E30)$([char]0x0E23)$([char]0x0E35)$([char]0x0E42)$([char]0x0E2B)$([char]0x0E25)$([char]0x0E14)$([char]0x0E15)$([char]0x0E31)$([char]0x0E27)$([char]0x0E40)$([char]0x0E2D)$([char]0x0E07)$([char]0x0E2D)$([char]0x0E31)$([char]0x0E15)$([char]0x0E42)$([char]0x0E19)$([char]0x0E21)$([char]0x0E31)$([char]0x0E15)$([char]0x0E34)" "Green"
} catch {
  Write-Info "$([char]0x0E40)$([char]0x0E01)$([char]0x0E34)$([char]0x0E14)$([char]0x0E02)$([char]0x0E49)$([char]0x0E2D)$([char]0x0E1C)$([char]0x0E34)$([char]0x0E14)$([char]0x0E1E)$([char]0x0E25)$([char]0x0E32)$([char]0x0E14)$([char]0x0E23)$([char]0x0E30)$([char]0x0E2B)$([char]0x0E27)$([char]0x0E48)$([char]0x0E32)$([char]0x0E07)$([char]0x0E2D)$([char]0x0E31)$([char]0x0E1B)$([char]0x0E40)$([char]0x0E14)$([char]0x0E15): $($_.Exception.Message)" "Red"
  exit 1
} finally {
  if (Test-Path -LiteralPath $tempZip) { Remove-Item -LiteralPath $tempZip -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $tempExtract) { Remove-Item -LiteralPath $tempExtract -Recurse -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $lockFile) { Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue }
}
