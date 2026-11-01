# Pure ASCII PowerShell Script - 100% Robust across all Windows consoles
param(
  [switch]$Once,
  [int]$IntervalSec = 5
)

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$S = @{}
  $S.TITLE = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("aUhBVkVDUFUgLSDguKHguK3guJnguLTguYDguJXguK3guKPguYzguYHguK3guJTguKHguLTguJnguYHguKXguLDguKrguJbguLLguJnguLDguK3guLHguJvguYDguJTguJXguYHguJrguJrguYDguKPguLXguKLguKXguYTguJfguKHguYwgKEFkbWluIFRlYW0gTW9uaXRvcik="))
  $S.TIME_LABEL = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4LmA4Lin4Lil4LiyOiA="))
  $S.STATUS_LABEL = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4Liq4LiW4Liy4LiZ4LiwOiA="))
  $S.NOT_SPECIFIED = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4LmE4Lih4LmI4Lij4Liw4Lia4Li4"))
  $S.JUST_NOW = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4LiB4Liz4Lil4Lix4LiH4LmD4LiK4LmJ4LiH4Liy4LiZ4LiC4LiT4Liw4LiZ4Li14LmJICjguYDguKHguLfguYjguK3guKrguLHguIHguITguKPguLnguYgp"))
  $S.SEC_AGO = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IOC4p+C4tOC4meC4suC4l+C4teC4geC5iOC4reC4mQ=="))
  $S.MIN_AGO = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IOC4meC4suC4l+C4teC4geC5iOC4reC4mQ=="))
  $S.HR_AGO = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IOC4iuC4oS7guIHguYjguK3guJk="))
  $S.DAY_AGO = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IOC4p+C4seC4meC4geC5iOC4reC4mQ=="))
  $S.INTENSE_ACTIVE = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W+C4geC4s+C4peC4seC4h+C4hOC4peC4tOC4geC5g+C4iuC5ieC4h+C4suC4mSDwn5SlXQ=="))
  $S.INTENSE_STEADY = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W+C4reC4reC4meC5hOC4peC4meC5jOC4quC4oeC5iOC4s+C5gOC4quC4oeC4rSDimqFd"))
  $S.INTENSE_TODAY = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W+C4reC4reC4meC5hOC4peC4meC5jOC4p+C4seC4meC4meC4teC5iSDwn5+iXQ=="))
  $S.INTENSE_OFFLINE = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W+C4reC4reC4n+C5hOC4peC4meC5jCDimqpd"))
  $S.MODE_LIVE = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4LmA4LiK4Li34LmI4Lit4Lih4LiV4LmI4Lit4Liq4LiUIFJlYWwtVGltZSBbT0td"))
  $S.MODE_OFFLINE = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4LmC4Lir4Lih4LiU4Lit4Lit4Lif4LmE4Lil4LiZ4LmMICjguK3guYjguLLguJnguIjguLLguIHguYHguITguIrguYDguITguKPguLfguYjguK3guIcp"))
  $S.SUMMARY_HEADER = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("8J+TiiDguKrguKPguLjguJvguKDguLLguJ7guKPguKfguKHguILguK3guIfguJfguLXguKHguYHguK3guJTguKHguLTguJk6"))
  $S.TOTAL_MEMBERS = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICAg4oCiIOC4quC4oeC4suC4iuC4tOC4geC5g+C4meC4o+C4sOC4muC4muC4l+C4seC5ieC4h+C4q+C4oeC4lCAgICAgIDog"))
  $S.UNITS_MACHINES = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IOC5gOC4hOC4o+C4t+C5iOC4reC4hw=="))
  $S.UPDATED_PREFIX = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICAg4oCiIOC4reC4seC4m+C5gOC4lOC4lSB2"))
  $S.UPDATED_SUFFIX = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IOC4peC5iOC4suC4quC4uOC4lOC5geC4peC5ieC4pyAgIDog"))
  $S.WAITING_PREFIX = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICAg4oCiIOC4reC4ouC4ueC5iOC4l+C4teC5iCB2Mi41LjIwICjguJXguYnguK3guIfguKPguLXguYLguKvguKXguJQpICA6IA=="))
  $S.WAITING_NOTE = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICjguYPguKvguYnguIHguJTguKPguLXguYLguKvguKXguJTguYPguJkgQ2hyb21lKQ=="))
  $S.OUTDATED_LABEL = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICAg4oCiIOC5g+C4iuC5ieC5gOC4p+C4reC4o+C5jOC4iuC4seC4meC5gOC4geC5iOC4siAo4LiV4LmJ4Lit4LiH4Lit4Lix4Lib4LmA4LiU4LiVKSAgIDog"))
  $S.ONLINE_NOW_LABEL = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICAg4oCiIPCfn6Ig4LiB4Liz4Lil4Lix4LiH4Lit4Lit4LiZ4LmE4Lil4LiZ4LmM4Liq4LiU4LiC4LiT4Liw4LiZ4Li14LmJICAgICA6IA=="))
  $S.ONLINE_NOW_NOTE = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICjguYPguIrguYnguIfguLLguJnguKDguLLguKLguYPguJkgMTUg4LiZ4Liy4LiX4Li1KSB8IOC4reC4reC4meC5hOC4peC4meC5jOC4p+C4seC4meC4meC4teC5iTog"))
  $S.CLICKS_TOTAL_LABEL = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICAg4oCiIOC4ouC4reC4lOC4hOC4peC4tOC4geC5g+C4iuC5ieC4h+C4suC4meC4o+C4p+C4oeC4l+C4seC5ieC4h+C4l+C4teC4oSAgIDog"))
  $S.UNITS_TIMES = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IOC4hOC4o+C4seC5ieC4hw=="))
  $S.CLICKS_TODAY_NOTE = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICjguKLguK3guJTguKfguLHguJnguJnguLXguYk6IA=="))
  $S.LIST_HEADER = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IOC4o+C4suC4ouC4iuC4t+C5iOC4reC5gOC4hOC4o+C4t+C5iOC4reC4h+C4guC4reC4h+C4l+C4teC4oeC5geC4reC4lOC4oeC4tOC4mSAo4LmA4Lij4Li14Lii4LiH4LiV4Liy4Lih4LmA4Lin4Lil4Liy4LiX4Li14LmI4LmD4LiK4LmJ4LiH4Liy4LiZ4Lil4LmI4Liy4Liq4Li44LiUKTo="))
  $S.NO_DATA = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4Lii4Lix4LiH4LmE4Lih4LmI4Lih4Li14LiC4LmJ4Lit4Lih4Li54Lil4LmA4LiE4Lij4Li34LmI4Lit4LiH4Liq4LmI4LiH4LmA4LiC4LmJ4Liy4Lih4LiyIOC5gOC4hOC4o+C4t+C5iOC4reC4h+C4iOC4sOC4m+C4o+C4suC4geC4j+C4l+C4seC4meC4l+C4teC4l+C4teC5iOC5gOC4m+C4tOC4lCBDaHJvbWUg4Lir4Lij4Li34Lit4Lij4Lix4LiZ4Lit4Lix4Lib4LmA4LiU4LiV"))
  $S.NO_NAME = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("KOC4ouC4seC4h+C5hOC4oeC5iOC4o+C4sOC4muC4uOC4iuC4t+C5iOC4rSk="))
  $S.ONLINE_BADGE = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("8J+foiBb4Lit4Lit4LiZ4LmE4Lil4LiZ4LmMXQ=="))
  $S.OFFLINE_BADGE = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4pqqIFvguK3guK3guJ/guYTguKXguJnguYxd"))
  $S.STATUS_LABEL_INNER = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICAgIOC4quC4luC4suC4meC4sOC5gOC4p+C4reC4o+C5jOC4iuC4seC4mTog"))
  $S.STATUS_LATEST = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IFvguYDguKfguK3guKPguYzguIrguLHguJnguKXguYjguLLguKrguLjguJQg4pyFXQ=="))
  $S.STATUS_WAITING = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IFvguKHguLXguYTguJ/guKXguYzguYPguKvguKHguYjguYHguKXguYnguKcgLSDguYHguJnguLDguJnguLPguYPguKvguYnguIHguJTguKPguLXguYLguKvguKXguJTguYPguJkgQ2hyb21lIPCflIRd"))
  $S.STATUS_OUTDATED = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IFvguYDguKfguK3guKPguYzguIrguLHguJnguYDguIHguYjguLIgLSDguYHguJnguLDguJnguLPguYPguKvguYnguKPguLHguJkgJ+C4reC4seC4m+C5gOC4lOC4leC4quC5iOC4p+C4meC4guC4ouC4suC4oi5iYXQnIOKaoO+4j10="))
  $S.CLICKS_LABEL = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICAgIOC4iOC4s+C4meC4p+C4meC4hOC4peC4tOC4geC5g+C4iuC5ieC4h+C4suC4mTog"))
  $S.RATIO_LABEL = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICB8ICDguKrguLHguJTguKrguYjguKfguJk6IA=="))
  $S.OF_TEAM = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICUg4LiC4Lit4LiH4LiX4Li14Lih"))
  $S.LAST_ACTION_LABEL = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICAgIOC5g+C4iuC5ieC4h+C4suC4meC4peC5iOC4suC4quC4uOC4lCAgIDog"))
  $S.ACTION_FIRST_INSTALL = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4LiV4Li04LiU4LiV4Lix4LmJ4LiH4Liq4LmI4Lin4LiZ4LiC4Lii4Liy4Lii4LiE4Lij4Lix4LmJ4LiH4LmB4Lij4LiB"))
  $S.ACTION_AUTO_UPDATE = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4Lit4Lix4Lib4LmA4LiU4LiV4LmE4Lif4Lil4LmM4LmA4Lin4Lit4Lij4LmM4LiK4Lix4LiZ4LmD4Lir4Lih4LmI"))
  $S.ACTION_OPEN_EXT = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4LmA4Lib4Li04LiU4Liq4LmI4Lin4LiZ4LiC4Lii4Liy4Lii4Lie4Lij4LmJ4Lit4Lih4LmD4LiK4LmJ4LiH4Liy4LiZ"))
  $S.CMD_PROMPT_PREFIX = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4LiE4Liz4Liq4Lix4LmI4LiHOiBbUl0g4Lij4Li14LmA4Lif4Lij4LiK4Liq4LiU4LiX4Lix4LiZ4LiX4Li1ICB8ICBbUV0g4Lit4Lit4LiB4LiI4Liy4LiB4LmC4Lib4Lij4LmB4LiB4Lij4LihICB8ICDguKPguLXguYDguJ/guKPguIrguKrguJTguK3guLHguJXguYLguJnguKHguLHguJXguLTguYPguJkg"))
  $S.CMD_PROMPT_SUFFIX = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("IOC4p+C4tOC4meC4suC4l+C4tS4uLg=="))
  $S.EXIT_MSG = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("CuC4m+C4tOC4lOC5guC4m+C4o+C5geC4geC4o+C4oeC5gOC4o+C4teC4ouC4muC4o+C5ieC4reC4ouC5geC4peC5ieC4pw=="))

try { $host.UI.RawUI.WindowTitle = 'iHAVECPU - Real-Time Team Analytics' } catch {}

$manifestFile = Join-Path $PSScriptRoot 'manifest.json'
$latestManifestVer = '2.5.21'
if (Test-Path -LiteralPath $manifestFile) {
  try {
    $mf = [System.IO.File]::ReadAllText($manifestFile, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF) | ConvertFrom-Json
    if ($mf.version) { $latestManifestVer = [string]$mf.version }
  } catch {}
}

$cacheFile = Join-Path $PSScriptRoot 'machines-cache.json'
$known = @{}
if (Test-Path -LiteralPath $cacheFile) {
  try {
    $raw = [System.IO.File]::ReadAllText($cacheFile, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    $obj = $raw | ConvertFrom-Json
    if ($obj) {
      $obj.PSObject.Properties | ForEach-Object { $known[$_.Name] = $_.Value }
    }
  } catch {}
}

function Format-TimeAgo($ms) {
  if (-not $ms) { return $S.NOT_SPECIFIED }
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $diffSec = [Math]::Floor(($now - $ms) / 1000)
  if ($diffSec -lt 45) { return $S.JUST_NOW }
  if ($diffSec -lt 60) { return ($diffSec.ToString() + $S.SEC_AGO) }
  if ($diffSec -lt 3600) {
    $mins = [Math]::Floor($diffSec / 60)
    return ($mins.ToString() + $S.MIN_AGO)
  }
  if ($diffSec -lt 86400) {
    $hrs = [Math]::Floor($diffSec / 3600)
    return ($hrs.ToString() + $S.HR_AGO)
  }
  $days = [Math]::Floor($diffSec / 86400)
  return ($days.ToString() + $S.DAY_AGO)
}

function Get-IntensityText($totalClicks, $todayClicks, $lastTs) {
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $diffMin = ($now - $lastTs) / (60 * 1000)
  if ($diffMin -le 10) { return $S.INTENSE_ACTIVE }
  if ($diffMin -le 60 -and $todayClicks -gt 0) { return $S.INTENSE_STEADY }
  if ($diffMin -le 240) { return $S.INTENSE_TODAY }
  return $S.INTENSE_OFFLINE
}

function Make-ProgressBar($pct) {
  $totalBlocks = 10
  $fill = [int][Math]::Round(($pct / 100) * $totalBlocks)
  if ($fill -gt $totalBlocks) { $fill = $totalBlocks }
  if ($fill -lt 0) { $fill = 0 }
  $empty = $totalBlocks - $fill
  $bar = (New-Object string ([char]0x2588, $fill)) + (New-Object string ([char]0x2591, $empty))
  return ('[' + $bar + ']')
}

do {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $isLive = $false
  $fetchError = ''

  try {
    $targetUrl = 'https://ntfy.sh/ihc_ext_stat_9f4b2c8e1d7a6053/json?poll=1&since=all'
    $resp = Invoke-RestMethod -Uri $targetUrl -Method Get -TimeoutSec 10
    $lines = $resp -split "`n"
    foreach ($l in $lines) {
      if (-not $l.Trim()) { continue }
      try {
        $evt = $l | ConvertFrom-Json
        if ($evt.event -eq 'message' -and $evt.message) {
          $m = $evt.message | ConvertFrom-Json
          if ($m.id) {
            $prev = $known[$m.id]
            if ($prev) {
              if (-not $m.staff -and $prev.staff) { $m | Add-Member -NotePropertyName staff -NotePropertyValue $prev.staff -Force }
              if (-not $m.branch -and $prev.branch) { $m | Add-Member -NotePropertyName branch -NotePropertyValue $prev.branch -Force }
              if (-not $m.pc -and $prev.pc) { $m | Add-Member -NotePropertyName pc -NotePropertyValue $prev.pc -Force }
              if (-not $m.user -and $prev.user) { $m | Add-Member -NotePropertyName user -NotePropertyValue $prev.user -Force }
              if ($m.totalClicks -eq $null -and $prev.totalClicks -ne $null) { $m | Add-Member -NotePropertyName totalClicks -NotePropertyValue $prev.totalClicks -Force }
              if ($m.todayClicks -eq $null -and $prev.todayClicks -ne $null) { $m | Add-Member -NotePropertyName todayClicks -NotePropertyValue $prev.todayClicks -Force }
              if (-not $m.lastAction -and $prev.lastAction) { $m | Add-Member -NotePropertyName lastAction -NotePropertyValue $prev.lastAction -Force }
              if (-not $m.lastActionTs -and $prev.lastActionTs) { $m | Add-Member -NotePropertyName lastActionTs -NotePropertyValue $prev.lastActionTs -Force }
            }
            if (-not $prev -or ($m.ts -ge $prev.ts)) {
              $known[$m.id] = $m
            }
          }
        }
      } catch {}
    }
    $isLive = $true
  } catch {
    $fetchError = $_.Exception.Message
  }

  try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($cacheFile, ($known | ConvertTo-Json -Depth 5), $utf8NoBom)
  } catch {}

  $cleanList = @($known.Values)
  $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

  $total = $cleanList.Count
  $updatedCount = @($cleanList | Where-Object { [string]$_.ver -eq $latestManifestVer }).Count
  $waitingReloadCount = @($cleanList | Where-Object { [string]$_.ver -eq '2.5.20' }).Count
  $outdatedCount = @($cleanList | Where-Object { [string]$_.ver -ne $latestManifestVer -and [string]$_.ver -ne '2.5.20' }).Count

  $onlineNow = @($cleanList | Where-Object { ($nowMs - $_.ts) -lt (15 * 60 * 1000) }).Count
  $activeToday = @($cleanList | Where-Object { ($nowMs - $_.ts) -lt (24 * 3600 * 1000) }).Count

  $totalTeamClicks = 0
  $totalTodayClicks = 0
  foreach ($m in $cleanList) {
    $totalTeamClicks += ([int]$m.totalClicks)
    $totalTodayClicks += ([int]$m.todayClicks)
  }

  $updatedPct = if ($total -gt 0) { [Math]::Round(($updatedCount / $total) * 100, 1) } else { 0 }
  $sortedList = $cleanList | Sort-Object -Property @{Expression = { [int64]$_.ts }; Descending = $true }

  try { Clear-Host } catch {}

  Write-Host '==========================================================================================' -ForegroundColor Cyan
  Write-Host ('   ' + $S.TITLE) -ForegroundColor Cyan
  $timeStr = (Get-Date).ToString('dd/MM/yyyy HH:mm:ss')
  $modeStr = if ($isLive) { $S.MODE_LIVE } else { ($S.MODE_OFFLINE + ' ' + $fetchError) }
  Write-Host ('   ' + $S.TIME_LABEL + $timeStr + '  |  ' + $S.STATUS_LABEL + $modeStr) -ForegroundColor Gray
  Write-Host '==========================================================================================' -ForegroundColor Cyan

  Write-Host $S.SUMMARY_HEADER -ForegroundColor Yellow
  Write-Host $S.TOTAL_MEMBERS -NoNewline; Write-Host ($total.ToString() + $S.UNITS_MACHINES) -ForegroundColor White
  Write-Host ($S.UPDATED_PREFIX + $latestManifestVer + $S.UPDATED_SUFFIX) -NoNewline
  Write-Host ($updatedCount.ToString() + $S.UNITS_MACHINES + ' (' + $updatedPct.ToString() + ' %)') -ForegroundColor Green
  Write-Host $S.WAITING_PREFIX -NoNewline; Write-Host ($waitingReloadCount.ToString() + $S.UNITS_MACHINES + $S.WAITING_NOTE) -ForegroundColor Yellow
  if ($outdatedCount -gt 0) {
    Write-Host $S.OUTDATED_LABEL -NoNewline; Write-Host ($outdatedCount.ToString() + $S.UNITS_MACHINES) -ForegroundColor Red
  }
  Write-Host $S.ONLINE_NOW_LABEL -NoNewline; Write-Host ($onlineNow.ToString() + $S.UNITS_MACHINES) -ForegroundColor Green -NoNewline; Write-Host ($S.ONLINE_NOW_NOTE + $activeToday.ToString() + $S.UNITS_MACHINES) -ForegroundColor Gray
  Write-Host $S.CLICKS_TOTAL_LABEL -NoNewline; Write-Host ($totalTeamClicks.ToString() + $S.UNITS_TIMES) -ForegroundColor Magenta -NoNewline; Write-Host ($S.CLICKS_TODAY_NOTE + $totalTodayClicks.ToString() + $S.UNITS_TIMES + ')') -ForegroundColor Yellow
  Write-Host '------------------------------------------------------------------------------------------' -ForegroundColor DarkGray

  if ($total -eq 0) {
    Write-Host $S.NO_DATA -ForegroundColor Gray
  } else {
    Write-Host $S.LIST_HEADER -ForegroundColor White
    Write-Host ''
    $idx = 1
    foreach ($item in $sortedList) {
      $staffName = if ($item.staff) { $item.staff } else { $S.NO_NAME }
      $branch = if ($item.branch) { (' - ' + $item.branch) } else { '' }
      $pcInfo = if ($item.pc) { ($item.pc + [char]92 + $item.user) } else { $item.id }
      $ver = if ($item.ver) { ('v' + $item.ver) } else { 'v?' }
      $clicks = [int]$item.totalClicks
      $tClicks = [int]$item.todayClicks
      $pct = if ($totalTeamClicks -gt 0) { [Math]::Round(($clicks / $totalTeamClicks) * 100, 1) } else { 0 }
      $bar = Make-ProgressBar $pct
      $diffMs = $nowMs - [int64]$item.ts
      $isOnline = $diffMs -lt (15 * 60 * 1000)
      $intensity = Get-IntensityText $clicks $tClicks ([int64]$item.ts)
      $seen = Format-TimeAgo ([int64]$item.ts)
      $actRaw = [string]$item.lastAction
      $lastAction = if ($actRaw -eq 'First-time Install') { $S.ACTION_FIRST_INSTALL }
        elseif ($actRaw -like 'Auto-Update*') { $S.ACTION_AUTO_UPDATE }
        elseif ($actRaw) { $actRaw }
        else { $S.ACTION_OPEN_EXT }

      $onlineDot = if ($isOnline) { $S.ONLINE_BADGE } else { $S.OFFLINE_BADGE }

      Write-Host ('[' + $idx + '] ') -ForegroundColor DarkGray -NoNewline
      Write-Host ($staffName + $branch) -ForegroundColor White -NoNewline
      Write-Host (' (' + $pcInfo + ') ') -ForegroundColor DarkGray -NoNewline
      Write-Host $onlineDot -ForegroundColor $(if ($isOnline) { 'Green' } else { 'DarkGray' })

      Write-Host $S.STATUS_LABEL_INNER -ForegroundColor Gray -NoNewline
      if ($item.ver -eq $latestManifestVer) {
        Write-Host ($ver + $S.STATUS_LATEST) -ForegroundColor Green -NoNewline
      } elseif ($item.ver -eq '2.5.20') {
        Write-Host ($ver + $S.STATUS_WAITING) -ForegroundColor Yellow -NoNewline
      } else {
        Write-Host ($ver + $S.STATUS_OUTDATED) -ForegroundColor Red -NoNewline
      }
      Write-Host ('  |  ' + $intensity) -ForegroundColor Yellow

      Write-Host $S.CLICKS_LABEL -ForegroundColor Gray -NoNewline
      Write-Host ($clicks.ToString() + $S.UNITS_TIMES) -ForegroundColor White -NoNewline
      Write-Host ($S.CLICKS_TODAY_NOTE + $tClicks.ToString() + $S.UNITS_TIMES + ')') -ForegroundColor Gray -NoNewline
      Write-Host ($S.RATIO_LABEL + $bar + ' ' + $pct.ToString() + $S.OF_TEAM) -ForegroundColor Cyan

      Write-Host $S.LAST_ACTION_LABEL -ForegroundColor Gray -NoNewline
      Write-Host $lastAction -ForegroundColor DarkCyan -NoNewline
      Write-Host (' (' + $seen + ')') -ForegroundColor Gray
      Write-Host ''
      $idx++
    }
  }

  Write-Host '==========================================================================================' -ForegroundColor Cyan
  if ($Once) { break }
  Write-Host ($S.CMD_PROMPT_PREFIX + $IntervalSec + $S.CMD_PROMPT_SUFFIX) -ForegroundColor DarkYellow

  $steps = $IntervalSec * 5
  for ($i = 0; $i -lt $steps; $i++) {
    try {
      if ($host.UI.RawUI.KeyAvailable) {
        $k = $host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown').Character
        if ($k -eq 'q' -or $k -eq 'Q') {
          Write-Host $S.EXIT_MSG -ForegroundColor Gray
          exit 0
        }
        if ($k -eq 'r' -or $k -eq 'R') {
          break
        }
      }
    } catch {}
    Start-Sleep -Milliseconds 200
  }
} while (-not $Once)
