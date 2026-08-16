Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:AegisRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$script:AegisLogDir = Join-Path $script:AegisRoot "logs"
$script:AegisRunDir = $script:AegisLogDir
$script:AegisLegacyRunDir = Join-Path $script:AegisRoot ".aegis\run"
$script:RustBin = Join-Path $env:USERPROFILE ".cargo\bin"
# Some Windows hosts expose both PATH and Path. PowerShell's environment
# provider treats those names as duplicate dictionary keys when Start-Process
# clones the environment. Normalize to one canonical Path before spawning
# pnpm, Next or Tauri children.
$script:ProcessPath = $env:Path
[Environment]::SetEnvironmentVariable("PATH", $null, "Process")
[Environment]::SetEnvironmentVariable("Path", $script:ProcessPath, "Process")
if ((Test-Path (Join-Path $script:RustBin "rustc.exe")) -and (($env:Path -split ";") -notcontains $script:RustBin)) {
  $env:Path = "$script:RustBin;$env:Path"
}

function Write-AegisMessage {
  param([ValidateSet("OK", "INFO", "WARN", "ERROR")][string]$Level, [string]$Message)
  $color = switch ($Level) { "OK" { "Green" } "INFO" { "Cyan" } "WARN" { "Yellow" } "ERROR" { "Red" } }
  Write-Host "[$Level] $Message" -ForegroundColor $color
}

function Require-AegisCommand {
  param([string]$Name, [string]$DisplayName = $Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) { throw "$DisplayName is required but was not found in PATH." }
  return $command
}

function Invoke-AegisCommand {
  param([string]$Command, [string[]]$Arguments)
  Write-Host "> $Command $($Arguments -join ' ')" -ForegroundColor DarkGray
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE`: $Command $($Arguments -join ' ')" }
}

function Ensure-AegisDependencies {
  if (-not (Test-Path (Join-Path $script:AegisRoot "node_modules\.pnpm"))) {
    Write-AegisMessage INFO "Dependencies are missing; running pnpm install --frozen-lockfile."
    Invoke-AegisCommand "pnpm.cmd" @("install", "--frozen-lockfile")
  } else {
    Write-AegisMessage OK "Dependencies found"
  }
}

function Require-AegisTauri {
  $candidates = @(
    (Join-Path $script:AegisRoot "node_modules\.bin\tauri.cmd"),
    (Join-Path $script:AegisRoot "apps\desktop\node_modules\.bin\tauri.cmd")
  )
  if (-not ($candidates | Where-Object { Test-Path $_ })) {
    throw "Tauri CLI is missing. Run pnpm.cmd install from the repository root."
  }
  Write-AegisMessage OK "Tauri CLI detected"
}

function Ensure-AegisEnvFiles {
  $target = Join-Path $script:AegisRoot ".env"
  $example = Join-Path $script:AegisRoot ".env.example"
  if (-not (Test-Path -LiteralPath $target)) {
    if (-not (Test-Path -LiteralPath $example)) { throw "Missing environment template: .env.example" }
    Copy-Item -LiteralPath $example -Destination $target
    Write-AegisMessage INFO "Created .env from .env.example"
  } else {
    Write-AegisMessage OK "Canonical environment configuration found: .env"
  }
}

function Import-AegisEnvironment {
  $envPath = Join-Path $script:AegisRoot ".env"
  if (-not (Test-Path -LiteralPath $envPath)) { throw "Canonical environment file is missing: $envPath" }
  $seen = @{}
  foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') { continue }
    $name = $matches[1]
    if ($seen.ContainsKey($name)) { throw "Duplicate environment key in .env: $name" }
    $seen[$name] = $true
    $value = $matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if (-not (Test-Path "Env:$name")) { Set-Item -Path "Env:$name" -Value $value }
  }
  Write-AegisMessage OK "Canonical environment loaded from .env"
}

function Write-AegisStage {
  param([ValidateSet("LAUNCHER", "API", "WEB", "AGENT", "ASSETS")][string]$Area, [string]$Message, [ConsoleColor]$Color = [ConsoleColor]::Gray)
  Write-Host "[$Area] $Message" -ForegroundColor $Color
}
function Initialize-AegisMsvc {
  if (Get-Command "link.exe" -ErrorAction SilentlyContinue) { return }
  $vswhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
  if (-not (Test-Path $vswhere)) { throw "Visual Studio Build Tools are required but vswhere.exe was not found." }
  $installationPath = (& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1).Trim()
  if (-not $installationPath) { throw "Visual Studio C++ Build Tools workload was not found." }
  $vsDevCmd = Join-Path $installationPath "Common7\Tools\VsDevCmd.bat"
  if (-not (Test-Path $vsDevCmd)) { throw "VsDevCmd.bat was not found under $installationPath." }
  $environment = & cmd.exe /d /s /c "call `"$vsDevCmd`" -arch=x64 >nul && set"
  foreach ($line in $environment) {
    $separator = $line.IndexOf("=")
    if ($separator -gt 0) {
      $name = $line.Substring(0, $separator)
      $value = $line.Substring($separator + 1)
      Set-Item -Path "Env:$name" -Value $value
    }
  }
  if (-not (Get-Command "link.exe" -ErrorAction SilentlyContinue)) { throw "MSVC environment loaded but link.exe is still unavailable." }
  Write-AegisMessage OK "MSVC linker loaded from Visual Studio Build Tools"
}

function Initialize-AegisCargoTarget {
  $target = if ($env:AEGIS_CARGO_TARGET_DIR) { $env:AEGIS_CARGO_TARGET_DIR } else { Join-Path $env:TEMP "Aegis-Cargo-Target" }
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  $env:CARGO_TARGET_DIR = $target
  Write-AegisMessage INFO "Cargo target directory: $target"
  return $target
}

function Test-AegisPort {
  param([int]$Port, [string]$HostName = "127.0.0.1")
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(500)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch { return $false }
  finally { $client.Dispose() }
}

function Test-AegisUrl {
  param([string]$Url, [int]$TimeoutSeconds = 2)
  $uri = [Uri]$Url
  if (-not (Test-AegisPort $uri.Port $uri.Host)) { return $false }
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds -ErrorAction SilentlyContinue
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch { return $false }
}

# A service starting up can take a moment to bind and answer (Prisma
# initialization, DB push, next dev warm-up). A single 2-second probe flags a
# healthy restarting service as "unhealthy", so the ready checks below retry a
# few times inside a short window and only report failure when the port is
# genuinely down or the health payload is wrong.
function Test-AegisApiReady {
  param([int]$Attempts = 3)
  for ($attempt = 0; $attempt -lt $Attempts; $attempt++) {
    if (-not (Test-AegisPort 4000)) { Start-Sleep -Milliseconds 500; continue }
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:4000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
      $payload = $response.Content | ConvertFrom-Json
      if ($response.StatusCode -eq 200 -and $payload.ok -eq $true -and $payload.service -eq "aegis-api" -and ($payload.status -eq "ready" -or $payload.status -eq "ok")) { return $true }
    } catch { # transient failure — retry
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Get-AegisLocalAgentPort { return 4150 }

function Test-AegisLocalAgentReady {
  param([int]$Attempts = 3)
  $port = Get-AegisLocalAgentPort
  for ($attempt = 0; $attempt -lt $Attempts; $attempt++) {
    if (-not (Test-AegisPort $port)) { Start-Sleep -Milliseconds 500; continue }
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
      $payload = $response.Content | ConvertFrom-Json
      if ($response.StatusCode -eq 200 -and $payload.ok -eq $true -and $payload.service -eq "aegis-local-agent") { return $true }
    } catch { # transient failure — retry
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

# Honest service state used by the launcher supervision loop. The reported
# state always reflects the real process and the real health endpoint:
#   ONLINE   port bound + health endpoint answers with the expected payload
#   UNHEALTHY port bound but health endpoint fails or returns a wrong payload
#   STOPPED  no listening process, no recorded PID running
#   CRASHED  recorded PID exists but the process is gone (it died after start)
#   STARTING the recorded PID is running but health has not answered yet
function Get-AegisServiceStatus {
  param([string]$Name, [int]$Port)
  $pidFile = Join-Path $script:AegisRunDir "$Name.pid"
  $recorded = $false
  $targetPid = 0
  if (Test-Path -LiteralPath $pidFile) {
    $parts = ((Get-Content -LiteralPath $pidFile -Raw).Trim() -split "\|")
    if ($parts.Count -ge 1) { [void][int]::TryParse($parts[0], [ref]$targetPid) }
    $recorded = $targetPid -gt 0
  }
  $processRunning = $false
  if ($targetPid -gt 0) {
    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
    $processRunning = $null -ne $proc
  }
  if (-not (Test-AegisPort $Port)) {
    if ($processRunning) { return @{ state = "UNHEALTHY"; pid = $targetPid; detail = "Process $targetPid is running but nothing is listening on port $Port." } }
    if ($recorded) { return @{ state = "CRASHED"; pid = $targetPid; detail = "Recorded PID $targetPid is no longer running." } }
    return @{ state = "STOPPED"; pid = 0; detail = "Nothing is listening on port $Port." }
  }
  if ($Name -eq "api") {
    if (Test-AegisApiReady) { return @{ state = "ONLINE"; pid = $targetPid; detail = "Health endpoint answered." } }
    return @{ state = "UNHEALTHY"; pid = $targetPid; detail = "Port $Port is bound but /health did not answer with a valid payload." }
  }
  if ($Name -eq "agent") {
    if (Test-AegisLocalAgentReady) { return @{ state = "ONLINE"; pid = $targetPid; detail = "Health endpoint answered." } }
    return @{ state = "UNHEALTHY"; pid = $targetPid; detail = "Port $Port is bound but /health did not answer with a valid payload." }
  }
  if (Test-AegisUrl "http://127.0.0.1:$Port" 1) { return @{ state = "ONLINE"; pid = $targetPid; detail = "HTTP answered." } }
  return @{ state = "UNHEALTHY"; pid = $targetPid; detail = "Port $Port is bound but HTTP did not answer." }
}

function Write-AegisServiceStatus {
  param([string]$Name, [hashtable]$Status)
  $symbol = switch ($Status.state) {
    "ONLINE"   { "● Online" }
    "UNHEALTHY" { "⚠ Unhealthy" }
    "STOPPED"  { "✕ Stopped" }
    "CRASHED"  { "✕ Crashed" }
    "STARTING" { "● Starting" }
    default    { "… $($Status.state)" }
  }
  $color = switch ($Status.state) {
    "ONLINE"   { "Green" }
    "UNHEALTHY" { "Yellow" }
    "STARTING" { "Cyan" }
    default    { "Red" }
  }
  Write-Host ("[{0}] {1}" -f $Name.ToUpperInvariant(), $symbol) -ForegroundColor $color
  if ($Status.detail) { Write-Host ("       {0}" -f $Status.detail) -ForegroundColor DarkGray }
}

function Get-AegisPortOwner {
  param([int]$Port)
  $ownerPid = 0
  foreach ($line in (& netstat.exe -ano -p TCP 2>$null)) {
    $columns = ($line.Trim() -split "\s+")
    if ($columns.Count -ge 5 -and $columns[1] -match (":$Port$") -and $columns[3] -eq "LISTENING") {
      [int]::TryParse($columns[4], [ref]$ownerPid) | Out-Null
      break
    }
  }
  return $ownerPid
}

function Test-AegisNextDevOnPort {
  param([int]$Port)
  $ownerPid = Get-AegisPortOwner $Port
  if ($ownerPid -le 0) { return $false }
  # `next dev` listens via a `start-server.js` child, so walk the parent chain
  # to find the actual `next dev` CLI invocation.
  for ($level = 0; $level -lt 6; $level++) {
    $metadata = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerPid" -ErrorAction SilentlyContinue
    if ($null -eq $metadata) { return $false }
    if ($metadata.CommandLine -match '\bnext\s+"?dev"?\b' -or $metadata.CommandLine -match '\bnext\s+dev\b') { return $true }
    $ownerPid = [int]$metadata.ParentProcessId
    if ($ownerPid -le 0) { return $false }
  }
  return $false
}

function Get-AegisProcessMetadata {
  param([int]$ProcessId)
  return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Test-AegisProcessIdentity {
  param([string]$Name, [int]$ProcessId, [switch]$RequireWorkspace)
  $metadata = Get-AegisProcessMetadata $ProcessId
  if (-not $metadata) { return $false }
  $commandLine = [string]$metadata.CommandLine
  $marker = if ($Name -eq "web") {
    $commandLine -match '(?i)(next(?:\.cmd)?\s+start|next[\\/]dist[\\/]bin[\\/]next.*\bstart\b|pnpm(?:\.cmd)?\s+(?:run\s+)?(?:start:web|dev:web))'
  } elseif ($Name -eq "agent") {
    $commandLine -match '(?i)(apps[\\/]local-agent[\\/](?:dist[\\/]server\.js|src[\\/]server\.ts)|pnpm(?:\.cmd)?\s+(?:run\s+)?(?:start:local-agent|dev:local-agent))'
  } else {
    $commandLine -match '(?i)(apps[\\/]api[\\/](?:dist[\\/]server\.js|src[\\/]server\.ts)|pnpm(?:\.cmd)?\s+(?:run\s+)?(?:start:api|dev:api))'
  }
  if (-not $marker) { return $false }
  if (-not $RequireWorkspace) { return $true }
  $rootNeedle = $script:AegisRoot.ToLowerInvariant()
  $cursor = $metadata
  for ($depth = 0; $depth -lt 5 -and $cursor; $depth++) {
    if (([string]$cursor.CommandLine).ToLowerInvariant().Contains($rootNeedle)) { return $true }
    $parentId = [int]$cursor.ParentProcessId
    if ($parentId -le 0) { break }
    $cursor = Get-AegisProcessMetadata $parentId
  }
  return $false
}

function Wait-AegisPortFree {
  param([int]$Port, [int]$TimeoutSeconds = 15)
  for ($index = 0; $index -lt ($TimeoutSeconds * 4); $index++) {
    if (-not (Test-AegisPort $Port)) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

function Stop-AegisServiceOnPort {
  param([string]$Name, [int]$Port)
  $stoppedRecorded = Stop-AegisPid $Name
  if ($stoppedRecorded -and -not (Wait-AegisPortFree $Port 15)) {
    throw "Port $Port did not become free after stopping recorded Aegis $Name."
  }
  $ownerPid = Get-AegisPortOwner $Port
  if ($ownerPid -le 0) { return }
  $metadata = Get-AegisProcessMetadata $ownerPid
  if (Test-AegisProcessIdentity $Name $ownerPid -RequireWorkspace) {
    Write-AegisStage ($Name.ToUpperInvariant()) "Previous Aegis $Name process detected."
    Write-AegisStage ($Name.ToUpperInvariant()) "Stopping PID $ownerPid"
    & taskkill.exe /PID $ownerPid /T /F | Out-Null
    if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue)) { throw "Could not stop previous Aegis $Name PID $ownerPid." }
    if (-not (Wait-AegisPortFree $Port 15)) { throw "Port $Port did not become free after stopping Aegis $Name PID $ownerPid." }
    return
  }
  $executable = if ($metadata) { $metadata.ExecutablePath } else { "unknown" }
  $processName = if ($metadata) { $metadata.Name } else { "unknown" }
  if ($env:AEGIS_KEEP_PORT_OWNERS -eq "1") {
    Write-AegisMessage ERROR "Port $Port is used by another process."
    Write-Host "PID: $ownerPid" -ForegroundColor Red
    Write-Host "Executable: $executable" -ForegroundColor Red
    throw "Port $Port is occupied by a non-Aegis process (set AEGIS_KEEP_PORT_OWNERS=0 to auto-stop it)."
  }
  Write-AegisMessage WARN "Port $Port is held by a background process that blocks Aegis."
  Write-Host "Stopping PID $ownerPid ($processName) $executable" -ForegroundColor Yellow
  & taskkill.exe /PID $ownerPid /T /F | Out-Null
  if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue)) {
    throw "Could not stop background process PID $ownerPid on port $Port."
  }
  if (-not (Wait-AegisPortFree $Port 15)) { throw "Port $Port did not become free after stopping PID $ownerPid." }
}
function Start-AegisService {
  param([string]$Name, [string]$PnpmScript)
  New-Item -ItemType Directory -Path $script:AegisRunDir -Force | Out-Null
  New-Item -ItemType Directory -Path $script:AegisLogDir -Force | Out-Null
  $stdout = Join-Path $script:AegisLogDir "$Name.log"
  $stderr = Join-Path $script:AegisLogDir "$Name.error.log"
  $pidFile = Join-Path $script:AegisRunDir "$Name.pid"
  $command = "cd /d `"$($script:AegisRoot)`" && pnpm.cmd $PnpmScript"
  $process = Start-Process -FilePath "cmd.exe" -ArgumentList @("/d", "/c", $command) -WorkingDirectory $script:AegisRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
  $startedAt = (Get-Process -Id $process.Id).StartTime.ToUniversalTime().Ticks
  Set-Content -LiteralPath $pidFile -Value ("$($process.Id)|$startedAt") -Encoding ASCII
  Write-AegisMessage INFO "$Name started with PID $($process.Id)"
  return $process.Id
}

function Register-AegisListeningProcess {
  param([string]$Name, [int]$Port)
  $ownerPid = 0
  foreach ($line in (& netstat.exe -ano -p TCP 2>$null)) {
    $columns = ($line.Trim() -split "\s+")
    if ($columns.Count -ge 5 -and $columns[1] -match (":$Port$") -and $columns[3] -eq "LISTENING") { [int]::TryParse($columns[4], [ref]$ownerPid) | Out-Null; break }
  }
  if ($ownerPid -le 0) { return $false }
  $process = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
  if (-not $process) { return $false }
  $startedAt = $process.StartTime.ToUniversalTime().Ticks
  New-Item -ItemType Directory -Path $script:AegisRunDir -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $script:AegisRunDir "$Name.pid") -Value ("$($process.Id)|$startedAt") -Encoding ASCII
  Write-AegisMessage INFO "$Name process recorded with PID $($process.Id)"
  return $true
}

function Stop-AegisPid {
  param([string]$Name)
  $primary = Join-Path $script:AegisRunDir "$Name.pid"
  $legacy = Join-Path $script:AegisLegacyRunDir "$Name.pid"
  $pidFile = if (Test-Path -LiteralPath $primary) { $primary } elseif (Test-Path -LiteralPath $legacy) { $legacy } else { return $false }
  $rawPid = (Get-Content -LiteralPath $pidFile -Raw).Trim()
  $parts = $rawPid -split "\|"
  $targetPid = 0
  $expectedStart = 0L
  $validIdentity = $parts.Count -eq 2 -and [int]::TryParse($parts[0], [ref]$targetPid) -and [long]::TryParse($parts[1], [ref]$expectedStart)
  $process = if ($validIdentity) { Get-Process -Id $targetPid -ErrorAction SilentlyContinue } else { $null }
  $sameProcess = $false
  if ($process) {
    try { $sameProcess = $process.StartTime.ToUniversalTime().Ticks -eq $expectedStart } catch { $sameProcess = $false }
  }
  $expectedCommand = $validIdentity -and $sameProcess -and (Test-AegisProcessIdentity $Name $targetPid -RequireWorkspace)
  if ($expectedCommand) {
    & taskkill.exe /PID $targetPid /T /F | Out-Null
    if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $targetPid -ErrorAction SilentlyContinue)) { throw "Could not stop $Name (PID $targetPid)." }
    Write-AegisStage ($Name.ToUpperInvariant()) "Stopped PID $targetPid" Green
  } elseif ($process) {
    Write-AegisMessage WARN "$Name PID $targetPid does not match the recorded Aegis identity; refusing to stop it."
  } else {
    Write-AegisStage ($Name.ToUpperInvariant()) "No recorded process is running."
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  return $expectedCommand
}
function Wait-AegisReady {
  param([string]$Name, [scriptblock]$Probe, [int]$TimeoutSeconds = 60)
  for ($i = 0; $i -lt ($TimeoutSeconds * 2); $i++) {
    if (& $Probe) { return $true }
    Start-Sleep -Milliseconds 500
  }
  $log = Join-Path $script:AegisLogDir "$Name.error.log"
  $details = if (Test-Path $log) { Get-Content -LiteralPath $log -Tail 20 -ErrorAction SilentlyContinue } else { @() }
  if ($details) { Write-Host ($details -join [Environment]::NewLine) -ForegroundColor DarkGray }
  return $false
}

function Get-AegisRoot { return $script:AegisRoot }
function Get-AegisRunDir { return $script:AegisRunDir }
function Get-AegisLogDir { return $script:AegisLogDir }
