param(
  [switch]$Silent,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$targetDir = Join-Path $env:LOCALAPPDATA "iHAVECPU-Copy-Product"
if (-not (Test-Path -LiteralPath $targetDir)) {
  $targetDir = $PSScriptRoot
}

$lockFile = Join-Path $env:TEMP "ihavecpu-ext-updater.lock"
if (Test-Path -LiteralPath $lockFile) {
  try {
    $lockAge = (Get-Date) - (Get-Item -LiteralPath $lockFile).LastWriteTime
    if ($lockAge.TotalMinutes -lt 3 -and -not $Force) {
      exit 0
    }
  } catch {}
}
try {
  Set-Content -LiteralPath $lockFile -Value $PID -Force -ErrorAction SilentlyContinue
} catch {}

$configPath = Join-Path $targetDir "update-config.json"
$manifestPath = Join-Path $targetDir "manifest.json"

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

if (-not (Test-Path -LiteralPath $configPath)) {
  Write-Info "ไม่พบไฟล์ update-config.json ใน $targetDir" "Red"
  exit 1
}

$config = Read-JsonFileNoBom $configPath
$owner = if ($config.githubOwner -and $config.githubOwner -ne "YOUR_GITHUB_USERNAME") { $config.githubOwner } else { "orangnakao-tech" }
$repo = if ($config.githubRepo) { $config.githubRepo } else { "ihavecpu-copy-product" }
$branch = if ($config.branch) { $config.branch } else { "main" }

$localVersion = "0.0.0"
if (Test-Path -LiteralPath $manifestPath) {
  try {
    $localManifest = Read-JsonFileNoBom $manifestPath
    if ($localManifest.version) {
      $localVersion = [string]$localManifest.version
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

Write-Info "กำลังเช็กเวอร์ชันล่าสุดจาก GitHub ($owner/$repo)..."

# 1. ลองดึงผ่าน GitHub API ก่อน (ไม่ติด Cache 5 นาทีของ raw.githubusercontent.com)
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

# 2. Fallback ดึงจาก raw.githubusercontent.com (กรณีติด Rate Limit ของ GitHub API)
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
  Write-Info "ยังไม่พบไฟล์ manifest.json บน GitHub ($owner/$repo) หรือเชื่อมต่อไม่ได้ในขณะนี้" "Yellow"
  Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
  exit 0
}

if (-not $Force -and ((Compare-SemVer $remoteVersion $localVersion) -le 0)) {
  Write-Info "ส่วนขยายเป็นเวอร์ชันล่าสุดแล้ว (v$localVersion)" "Green"
  Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
  exit 0
}

Write-Info "พบเวอร์ชันใหม่ v$remoteVersion (ในเครื่อง v$localVersion) กำลังดาวน์โหลดอัปเดต..." "Green"

$tempZip = Join-Path $env:TEMP "ihavecpu-ext-update-$([Guid]::NewGuid().ToString('N')).zip"
$tempExtract = Join-Path $env:TEMP "ihavecpu-ext-extract-$([Guid]::NewGuid().ToString('N'))"
$zipUrl = "https://github.com/$owner/$repo/archive/refs/heads/$branch.zip?t=$ts"

try {
  Invoke-WebRequest -Uri $zipUrl -Headers $headers -OutFile $tempZip -UseBasicParsing -TimeoutSec 30
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($tempZip, $tempExtract)

  $extractedRoot = Get-ChildItem -LiteralPath $tempExtract -Directory | Select-Object -First 1
  if (-not $extractedRoot) {
    throw "ไม่พบโฟลเดอร์ภายในไฟล์ ZIP ที่ดาวน์โหลดมา"
  }

  $sourceFolder = $extractedRoot.FullName
  if (-not (Test-Path -LiteralPath (Join-Path $sourceFolder "manifest.json"))) {
    $nestedManifest = Get-ChildItem -LiteralPath $sourceFolder -Filter "manifest.json" -Recurse | Select-Object -First 1
    if ($nestedManifest) {
      $sourceFolder = $nestedManifest.Directory.FullName
    }
  }

  if (-not (Test-Path -LiteralPath $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  }

  $excludedPattern = '^(\.git|\.gitignore|publish-update\.ps1|.*GitHub.*\.bat|README-.*|TEST_CHECKLIST\.md)$'
  Get-ChildItem -LiteralPath $sourceFolder -Force | Where-Object { $_.Name -notmatch $excludedPattern } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $targetDir -Recurse -Force
  }

  # รักษาค่า update-config.json ของเครื่องแอดมินไว้เสมอ
  $newConfigPath = Join-Path $targetDir "update-config.json"
  if (Test-Path -LiteralPath $newConfigPath) {
    try {
      $newConfig = Read-JsonFileNoBom $newConfigPath
      if (-not $newConfig.githubOwner -or $newConfig.githubOwner -eq "YOUR_GITHUB_USERNAME") {
        $config.githubOwner = $owner
        $config.githubRepo = $repo
        $config.branch = $branch
        $jsonOut = $config | ConvertTo-Json -Depth 5
        Write-Utf8NoBom $newConfigPath $jsonOut
      }
    } catch {}
  }

  Write-Info "อัปเดตไฟล์ส่วนขยายเป็นเวอร์ชัน v$remoteVersion สำเร็จแล้ว! ตัวส่วนขยายใน Chrome จะรีโหลดตัวเองอัตโนมัติ" "Green"
} catch {
  Write-Info "เกิดข้อผิดพลาดระหว่างอัปเดต: $($_.Exception.Message)" "Red"
  exit 1
} finally {
  if (Test-Path -LiteralPath $tempZip) { Remove-Item -LiteralPath $tempZip -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $tempExtract) { Remove-Item -LiteralPath $tempExtract -Recurse -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $lockFile) { Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue }
}
