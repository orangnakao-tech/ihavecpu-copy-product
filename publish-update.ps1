$ErrorActionPreference = "Stop"
$repoDir = $PSScriptRoot
$manifestPath = Join-Path $repoDir "manifest.json"
$configPath = Join-Path $repoDir "update-config.json"

function Write-Utf8NoBom($path, $text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
}

if (-not (Test-Path -LiteralPath $manifestPath)) {
  Write-Host "ไม่พบไฟล์ manifest.json" -ForegroundColor Red
  exit 1
}

$owner = "orangnakao-tech"
$repo = "ihavecpu-copy-product"
$branch = "main"

if (Test-Path -LiteralPath $configPath) {
  try {
    $cfgText = [System.IO.File]::ReadAllText($configPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    $cfg = $cfgText | ConvertFrom-Json
    if ($cfg.githubOwner -and $cfg.githubOwner -ne "YOUR_GITHUB_USERNAME") { $owner = $cfg.githubOwner }
    if ($cfg.githubRepo) { $repo = $cfg.githubRepo }
    if ($cfg.branch) { $branch = $cfg.branch }
  } catch {}
}

$manifestText = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$manifest = $manifestText | ConvertFrom-Json
$currentVer = $manifest.version

$parts = $currentVer.Split(".")
if ($parts.Count -ge 3) {
  $nextPatch = ([int]$parts[2]) + 1
  $suggestedVer = "$($parts[0]).$($parts[1]).$nextPatch"
} else {
  $suggestedVer = "$currentVer.1"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ระบบปล่อยอัปเดตส่วนขยายขึ้น GitHub สำหรับแอดมินทุกคน" -ForegroundColor Cyan
Write-Host "  Repository: https://github.com/$owner/$repo" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "เวอร์ชันปัจจุบัน: $currentVer" -ForegroundColor Yellow
$newVer = Read-Host "กรอกเลขเวอร์ชันใหม่ (กด Enter เพื่อใช้ค่าแนะนำ $suggestedVer)"
if ([string]::IsNullOrWhiteSpace($newVer)) {
  $newVer = $suggestedVer
}

$note = Read-Host "ระบุรายละเอียดการแก้ไขสั้นๆ (กด Enter เพื่อใช้ 'Update to v$newVer')"
if ([string]::IsNullOrWhiteSpace($note)) {
  $note = "Update to v$newVer"
}

# อัปเดตเลขเวอร์ชันใน manifest.json แบบ UTF-8 (No BOM)
$updatedManifestText = [regex]::Replace($manifestText, '"version"\s*:\s*"[^"]+"', "`"version`": `"$newVer`"")
Write-Utf8NoBom $manifestPath $updatedManifestText

Write-Host ""
Write-Host "อัปเดตไฟล์ manifest.json เป็นเวอร์ชัน $newVer เรียบร้อยแล้ว" -ForegroundColor Green
Write-Host "กำลังส่งโค้ดขึ้น GitHub (git add / commit / push)..." -ForegroundColor Cyan

Push-Location $repoDir
try {
  $safeRepoDir = $repoDir -replace '\\', '/'
  try {
    git config --global --add safe.directory $safeRepoDir 2>$null
  } catch {}

  if (-not (Test-Path -LiteralPath (Join-Path $repoDir ".git"))) {
    git -c safe.directory=* init
    git -c safe.directory=* branch -M $branch
  }

  $remoteUrl = "https://github.com/$owner/$repo.git"
  $existingRemote = ""
  try {
    $existingRemote = (git -c safe.directory=* remote get-url origin 2>$null)
  } catch {}

  if ([string]::IsNullOrWhiteSpace($existingRemote)) {
    git -c safe.directory=* remote add origin $remoteUrl
  } elseif ($existingRemote.Trim() -ne $remoteUrl) {
    git -c safe.directory=* remote set-url origin $remoteUrl
  }

  git -c safe.directory=* add -A
  $status = git -c safe.directory=* status --porcelain
  if ($status) {
    git -c safe.directory=* commit -m "$note (v$newVer)"
  }
  git -c safe.directory=* branch -M $branch
  git -c safe.directory=* push -u origin $branch

  Write-Host ""
  Write-Host "สำเร็จ! ปล่อยอัปเดตเวอร์ชัน $newVer ขึ้น GitHub ($remoteUrl) เรียบร้อยแล้ว" -ForegroundColor Green
  Write-Host "เครื่องของแอดมินทุกคนจะดึงไฟล์ใหม่และรีโหลดส่วนขยายให้อัตโนมัติโดยไม่ต้องติดตั้งใหม่!" -ForegroundColor Green
} catch {
  Write-Host "เกิดข้อผิดพลาดขณะส่งโค้ดขึ้น GitHub: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "คำแนะนำ: ตรวจสอบว่าคุณได้สร้าง Repository ชื่อ '$repo' (แบบ Public) บนบัญชี '$owner' ที่ https://github.com/new แล้ว" -ForegroundColor Yellow
} finally {
  Pop-Location
}
