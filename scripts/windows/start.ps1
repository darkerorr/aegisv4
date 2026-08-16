Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "aegis-common.ps1")
$script:LauncherTranscriptStarted = $false

try {
  Set-Location (Get-AegisRoot)
  New-Item -ItemType Directory -Path (Get-AegisLogDir) -Force | Out-Null
  Start-Transcript -Path (Join-Path (Get-AegisLogDir) "launcher.log") -Append | Out-Null
  $script:LauncherTranscriptStarted = $true
  $webMode = if ($env:AEGIS_WEB_MODE -eq "dev") { "dev" } else { "production" }
  Write-AegisStage LAUNCHER "Aegis Local Launcher ($webMode Web)" White
  Write-Host ""
  $node = Require-AegisCommand "node" "Node.js"
  $pnpm = Require-AegisCommand "pnpm.cmd" "pnpm"
  Write-AegisMessage OK "Node.js detected: $(node --version)"
  Write-AegisMessage OK "pnpm detected: $(pnpm.cmd --version)"
  Ensure-AegisEnvFiles
  Import-AegisEnvironment
  Ensure-AegisDependencies

  # ======== Process preflight ========
  Write-AegisStage LAUNCHER "Inspecting previous Aegis processes and ports."
  $agentPort = Get-AegisLocalAgentPort
  Stop-AegisServiceOnPort "web" 3000
  Stop-AegisServiceOnPort "api" 4000
  Stop-AegisServiceOnPort "agent" $agentPort
  if (-not (Wait-AegisPortFree 3000 15)) { throw "Port 3000 did not become free." }
  if (-not (Wait-AegisPortFree 4000 15)) { throw "Port 4000 did not become free." }
  if (-not (Wait-AegisPortFree $agentPort 15)) { throw "Port $agentPort did not become free." }

  $buildIdPath = "apps\web\.next-prod\BUILD_ID"
  $currentBuildId = $null
  if ($webMode -eq "production") {
    Write-AegisStage WEB "Checking the production build fingerprint."
    if ($env:AEGIS_FORCE_REBUILD -eq "1") { & node "scripts\web\ensure-web-build.mjs" --force }
    else { & node "scripts\web\ensure-web-build.mjs" }
    if ($LASTEXITCODE -ne 0) { throw "Aegis Web production build failed or was refused." }
    if (-not (Test-Path -LiteralPath $buildIdPath)) { throw "Web build completed without .next/BUILD_ID." }
    $currentBuildId = (Get-Content -LiteralPath $buildIdPath -Raw).Trim()
    if (-not $currentBuildId) { throw "Web BUILD_ID is empty." }
    Write-AegisStage WEB "Production build ready (BUILD_ID: $currentBuildId)." Green
  } else {
    Write-AegisStage WEB "Development mode uses next dev with on-demand route compilation."
  }
  if ($webMode -eq "production") {
    Write-AegisStage API "Building the API before launch."
    & pnpm.cmd --filter "@aegis/api" build
    if ($LASTEXITCODE -ne 0) { throw "Aegis API build failed." }
  }
  $apiScript = if ($webMode -eq "dev") { "dev:api" } else { "start:api" }

  Write-Host ""
  Write-AegisStage API "Starting Aegis API." White
  if (Test-AegisApiReady) {
    Write-AegisMessage INFO "Aegis API is already running on port 4000"
    Register-AegisListeningProcess "api" 4000 | Out-Null
  } elseif (Test-AegisPort 4000) {
    throw "Port 4000 is already in use by another process and is not an Aegis API."
  } else {
    Start-AegisService "api" $apiScript | Out-Null
    if (-not (Wait-AegisReady "api" { Test-AegisApiReady })) {
      Stop-AegisPid "api" | Out-Null
      throw "Aegis API did not become ready at http://127.0.0.1:4000/health."
    }
    if (-not (Register-AegisListeningProcess "api" 4000)) { throw "Aegis API is ready but its listening process could not be recorded." }
  }
  Write-AegisStage API "Ready: http://127.0.0.1:4000/health" Green

  Write-Host ""
  Write-AegisStage AGENT "Building the Local Agent before launch."
  & pnpm.cmd --filter "@aegis/local-agent" build
  if ($LASTEXITCODE -ne 0) { throw "Aegis Local Agent build failed." }
  $agentScript = if ($webMode -eq "dev") { "dev:local-agent" } else { "start:local-agent" }

  Write-AegisStage AGENT "Starting Aegis Local Agent on port $agentPort." White
  if (Test-AegisLocalAgentReady) {
    Write-AegisMessage INFO "Aegis Local Agent is already running on port $agentPort"
    Register-AegisListeningProcess "agent" $agentPort | Out-Null
  } elseif (Test-AegisPort $agentPort) {
    throw "Port $agentPort is already in use by another process and is not an Aegis Local Agent."
  } else {
    Start-AegisService "agent" $agentScript | Out-Null
    if (-not (Wait-AegisReady "agent" { Test-AegisLocalAgentReady })) {
      Stop-AegisPid "agent" | Out-Null
      throw "Aegis Local Agent did not become ready at http://127.0.0.1:$agentPort/health."
    }
    if (-not (Register-AegisListeningProcess "agent" $agentPort)) { throw "Aegis Local Agent is ready but its listening process could not be recorded." }
  }
  Write-AegisStage AGENT "Ready: http://127.0.0.1:$agentPort/health" Green

  Write-Host ""
  Write-AegisStage WEB "Starting Aegis Web." White
  # The supervisor keeps `next dev` alive on port 3000; production asset
  # verification would fail against a dev server, so replace it first.
  if ($webMode -eq "production" -and (Test-AegisNextDevOnPort 3000)) {
    Write-AegisMessage WARN "Port 3000 is held by a `next dev` server (supervisor). Replacing it with the production build."
    Stop-AegisServiceOnPort "web" 3000
  }
  if (Test-AegisUrl "http://127.0.0.1:3000") {
    $responding = $true
    # Also verify BUILD_ID matches
    $newBuildId = if (Test-Path $buildIdPath) { (Get-Content $buildIdPath -Raw).Trim() } else { $null }
    if ($currentBuildId -and $newBuildId -and $currentBuildId -ne $newBuildId) {
      Write-AegisMessage WARN "BUILD_ID mismatch, restarting web server."
      $responding = $false
    }
    if ($responding) {
      Write-AegisMessage INFO "Aegis Web is already running on port 3000"
      Register-AegisListeningProcess "web" 3000 | Out-Null
    }
  }
  if (-not (Test-AegisUrl "http://127.0.0.1:3000")) {
    $webScript = if ($webMode -eq "dev") { "dev:web" } else { "start:web" }
    if ($webMode -eq "production") { Write-AegisMessage INFO "Starting production server (next start)." }
    Start-AegisService "web" $webScript | Out-Null
    if (-not (Wait-AegisReady "web" { Test-AegisUrl "http://127.0.0.1:3000" })) {
      Stop-AegisPid "web" | Out-Null
      throw "Aegis Web did not become ready at http://127.0.0.1:3000."
    }
    if (-not (Register-AegisListeningProcess "web" 3000)) { throw "Aegis Web is ready but its listening process could not be recorded." }
  }

  # ======== Verify static assets ========
  if ($webMode -eq "production") {
    Write-Host ""
    Write-AegisStage ASSETS "Verifying Next.js route assets." White
    & node "scripts\web\verify-next-assets.mjs"
    if ($LASTEXITCODE -ne 0) { throw "Next.js static asset verification failed." }
    Write-AegisStage ASSETS "All required routes and static assets passed." Green
  }
  if (Get-Command ollama -ErrorAction SilentlyContinue) {
    if (Test-AegisUrl "http://127.0.0.1:11434/api/tags") {
      Write-AegisMessage OK "Ollama detected and reachable"
    } else {
      Write-AegisMessage WARN "Ollama is installed but not reachable; Aegis Web can still run."
      if ($env:AEGIS_PROMPT_OLLAMA -eq "1") {
        $answer = Read-Host "Start Ollama now? [Y/N]"
        if ($answer -match "^[Yy]") { Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden; Write-AegisMessage INFO "Ollama start requested." }
      } else {
        Write-AegisMessage INFO "Set AEGIS_PROMPT_OLLAMA=1 to be asked to start Ollama."
      }
    }
  } else {
    Write-AegisMessage WARN "Ollama is not installed; local models remain offline."
  }

  Write-Host ""
  Write-AegisStage LAUNCHER "Aegis services are running." Green
  Write-Host "API: http://127.0.0.1:4000/health"
  Write-Host "Web: http://127.0.0.1:3000"
  Write-Host "Agent: http://127.0.0.1:$agentPort/health"
  Write-Host "Logs: $(Get-AegisLogDir)"
  if ($env:AEGIS_NO_BROWSER -ne "1") {
    Start-Process "http://127.0.0.1:3000"
    Write-Host "Opening Aegis Web..." -ForegroundColor White
  } else {
    Write-AegisMessage INFO "Browser opening disabled for supervised validation."
  }
  Write-Host ""
  Write-Host "Aegis supervision is active. Live logs stream below. R: restart  L: open logs  Q: quit  Ctrl+C: stop" -ForegroundColor DarkGray
  $logFiles = @{
    API = Join-Path (Get-AegisLogDir) "api.log"
    API_ERROR = Join-Path (Get-AegisLogDir) "api.error.log"
    WEB = Join-Path (Get-AegisLogDir) "web.log"
    WEB_ERROR = Join-Path (Get-AegisLogDir) "web.error.log"
    AGENT = Join-Path (Get-AegisLogDir) "agent.log"
    AGENT_ERROR = Join-Path (Get-AegisLogDir) "agent.error.log"
  }
  # Byte position per log file so the live feed only reads appended bytes.
  $logPositions = @{}
  foreach ($entry in $logFiles.GetEnumerator()) {
    if (Test-Path -LiteralPath $entry.Value) {
      $stream = [System.IO.File]::Open($entry.Value, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
      try { $logPositions[$entry.Key] = $stream.Length } finally { $stream.Dispose() }
    } else { $logPositions[$entry.Key] = 0 }
  }
      $lastHealthCheck = Get-Date
      # Degraded-state tracking: a single transient probe failure (service still
      # starting, a slow health answer during a restart) must not print a false
      # "stopped or became unhealthy". A state only turns into a hard error after
      # it has been observed consistently for the whole probe window.
      $degradedSince = @{ API = $null; WEB = $null; AGENT = $null }
      $lastErrorDump = @{ API = ""; WEB = ""; AGENT = "" }
      # Auto-recovery: once a service has stayed degraded for the whole window,
      # restart it automatically (at most a few times per supervision session)
      # instead of leaving it broken until the user presses R.
      $restartCount = @{ API = 0; WEB = 0; AGENT = 0 }
      $restartWindowSeconds = if ($env:AEGIS_AUTORESTART_SECONDS) { [int]$env:AEGIS_AUTORESTART_SECONDS } else { 20 }
      $maxAutoRestarts = if ($env:AEGIS_AUTORESTART_MAX) { [int]$env:AEGIS_AUTORESTART_MAX } else { 3 }
      $script:RestartInProgress = @{ API = $false; WEB = $false; AGENT = $false }
      $supervisionDeadline = if ($env:AEGIS_SUPERVISION_TEST_SECONDS) { (Get-Date).AddSeconds([int]$env:AEGIS_SUPERVISION_TEST_SECONDS) } else { $null }
      try {
        :supervisor while ($true) {
          if ($supervisionDeadline -and (Get-Date) -ge $supervisionDeadline) {
            Write-AegisMessage OK "Supervision validation window completed."
            break supervisor
          }
          # ---- SERVICE STATUS BOARD ----
          if (((Get-Date) - $lastHealthCheck).TotalSeconds -ge 2) {
            $apiStatus = Get-AegisServiceStatus "api" 4000
            $webStatus = Get-AegisServiceStatus "web" 3000
            $agentStatus = Get-AegisServiceStatus "agent" $agentPort
            Write-Host ""
            Write-Host "SERVICE STATUS" -ForegroundColor DarkGray
            Write-AegisServiceStatus "API" $apiStatus
            Write-AegisServiceStatus "WEB" $webStatus
            Write-AegisServiceStatus "AGENT" $agentStatus
            Write-Host ""
            foreach ($entry in @(
              @{ Name = "API"; State = $apiStatus.state; Key = "api" }
              @{ Name = "WEB"; State = $webStatus.state; Key = "web" }
              @{ Name = "AGENT"; State = $agentStatus.state; Key = "agent" }
            )) {
              $serviceKey = $entry.Key
              $isDegraded = $entry.State -in @("UNHEALTHY", "CRASHED", "STOPPED")
              if ($isDegraded) {
                if (-not $degradedSince[$serviceKey]) { $degradedSince[$serviceKey] = Get-Date }
                $errorLog = Join-Path (Get-AegisLogDir) "$serviceKey.error.log"
                $tail = if (Test-Path $errorLog) { Get-Content -LiteralPath $errorLog -Tail 6 -ErrorAction SilentlyContinue } else { @() }
                $lastLine = if ($tail) { ($tail | Select-Object -Last 1) } else { "" }
                if ($lastLine -and $lastLine -ne $lastErrorDump[$serviceKey]) {
                  Write-AegisMessage ERROR "$($entry.Name) stopped or became unhealthy."
                  if ($apiStatus.state -eq "UNHEALTHY") { Write-AegisMessage ERROR "Last error: $lastLine" }
                  $lastErrorDump[$serviceKey] = $lastLine
                }
                # Auto-recovery: restart a service that stays degraded for the
                # whole window, unless a manual restart is in progress or the
                # max auto-restart budget for this session is exhausted.
                $degradedFor = ((Get-Date) - $degradedSince[$serviceKey]).TotalSeconds
                $restartScript = switch ($serviceKey) {
                  "api" { $apiScript }
                  "agent" { $agentScript }
                  "web" { $webScript }
                }
                $restartPort = switch ($serviceKey) { "api" { 4000 } "agent" { $agentPort } "web" { 3000 } }
                if (
                  $restartScript -and
                  -not $script:RestartInProgress[$serviceKey] -and
                  $restartCount[$serviceKey] -lt $maxAutoRestarts -and
                  $degradedFor -ge $restartWindowSeconds
                ) {
                  $script:RestartInProgress[$serviceKey] = $true
                  $restartCount[$serviceKey] += 1
                  Write-AegisMessage INFO "Auto-restarting $($entry.Name) (attempt $($restartCount[$serviceKey])/$maxAutoRestarts)..."
                  Stop-AegisPid $serviceKey | Out-Null
                  Start-Sleep -Milliseconds 500
                  Start-AegisService $serviceKey $restartScript | Out-Null
                  $waited = switch ($serviceKey) {
                    "api" { Wait-AegisReady "api" { Test-AegisApiReady } 20 }
                    "agent" { Wait-AegisReady "agent" { Test-AegisLocalAgentReady } 20 }
                    "web" { Wait-AegisReady "web" { Test-AegisUrl "http://127.0.0.1:3000" } 30 }
                  }
                  if ($waited) {
                    Register-AegisListeningProcess $serviceKey $restartPort | Out-Null
                    Write-AegisMessage OK "$($entry.Name) auto-restarted."
                  } else {
                    Write-AegisMessage ERROR "$($entry.Name) auto-restart failed."
                  }
                  $script:RestartInProgress[$serviceKey] = $false
                }
              } else {
                $degradedSince[$serviceKey] = $null
              }
            }
            $lastHealthCheck = Get-Date
          }
          # ---- LIVE LOG STREAM ----
      foreach ($entry in $logFiles.GetEnumerator()) {
        $path = $entry.Value
        if (-not (Test-Path -LiteralPath $path)) { continue }
        $stream = $null
        try {
          $stream = [System.IO.File]::Open($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
          $position = [long]$logPositions[$entry.Key]
          $stream.Position = if ($stream.Length -lt $position) { 0 } else { $position }
          $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $true, 1024, $true)
          $content = $reader.ReadToEnd()
          $reader.Dispose()
          $logPositions[$entry.Key] = $stream.Position
        } catch {
          if ($stream) { $stream.Dispose() }
          continue
        } finally {
          if ($stream) { $stream.Dispose() }
        }
        if ([string]::IsNullOrEmpty($content)) { continue }
        $label = $entry.Key.Replace("_ERROR", "")
        $color = if ($entry.Key.EndsWith("ERROR")) { "Red" } elseif ($label -eq "API" -or $label -eq "AGENT") { "Cyan" } else { "DarkGray" }
        foreach ($line in ($content -split "\r?\n")) {
          if ([string]::IsNullOrWhiteSpace($line)) { continue }
          Write-Host ("[{0}][{1}] {2}" -f (Get-Date).ToString("HH:mm:ss"), $label, $line) -ForegroundColor $color
        }
      }
      if (-not $supervisionDeadline -and $Host.UI.RawUI.KeyAvailable) {
        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character.ToString().ToUpperInvariant()
        if ($key -eq "Q") { break supervisor }
        if ($key -eq "L") { Start-Process explorer.exe -ArgumentList (Get-AegisLogDir) }
        if ($key -eq "R") {
          Write-AegisMessage INFO "Restarting Aegis services with fresh build..."
          # Stop all services
          Stop-AegisPid "web" | Out-Null
          Stop-AegisPid "api" | Out-Null
          Stop-AegisPid "agent" | Out-Null
          for ($i = 0; $i -lt 20; $i++) {
            if (-not (Test-AegisPort 3000) -and -not (Test-AegisPort 4000) -and -not (Test-AegisPort $agentPort)) { break }
            Start-Sleep -Milliseconds 250
          }
          # Rebuild web if in production mode
          if ($webMode -eq "production") {
            Write-AegisMessage INFO "Rebuilding web..."
            & node "scripts\web\ensure-web-build.mjs"
            if ($LASTEXITCODE -ne 0) { Write-AegisMessage ERROR "Web rebuild failed."; continue }
          }
          # Restart API
          Start-AegisService "api" $apiScript | Out-Null
          if (-not (Wait-AegisReady "api" { Test-AegisApiReady } 20)) { Write-AegisMessage ERROR "API restart failed."; continue }
          Register-AegisListeningProcess "api" 4000 | Out-Null
          # Restart Local Agent
          Start-AegisService "agent" $agentScript | Out-Null
          if (-not (Wait-AegisReady "agent" { Test-AegisLocalAgentReady } 20)) { Write-AegisMessage ERROR "Local Agent restart failed."; continue }
          Register-AegisListeningProcess "agent" $agentPort | Out-Null
          # Restart Web
          $restartWebScript = if ($webMode -eq "dev") { "dev:web" } else { "start:web" }
          Start-AegisService "web" $restartWebScript | Out-Null
          if (-not (Wait-AegisReady "web" { Test-AegisUrl "http://127.0.0.1:3000" } 30)) { Write-AegisMessage ERROR "Web restart failed."; continue }
          Register-AegisListeningProcess "web" 3000 | Out-Null
          Write-AegisMessage OK "Aegis services restarted with fresh build."
        }
      }
      Start-Sleep -Milliseconds 250
    }
  } finally {
    Write-AegisMessage INFO "Stopping recorded Aegis services..."
    Stop-AegisPid "web" | Out-Null
    Stop-AegisPid "api" | Out-Null
    Stop-AegisPid "agent" | Out-Null
  }
  if ($script:LauncherTranscriptStarted) { Stop-Transcript | Out-Null; $script:LauncherTranscriptStarted = $false }
  exit 0
} catch {
  Write-AegisMessage ERROR $_.Exception.Message
  $log = Join-Path (Get-AegisLogDir) "launcher.log"
  if (Test-Path $log) {
    Write-Host ""
    Write-Host "Last launcher log lines:" -ForegroundColor DarkGray
    Get-Content -LiteralPath $log -Tail 10 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
  }
  if ($script:LauncherTranscriptStarted) { Stop-Transcript | Out-Null; $script:LauncherTranscriptStarted = $false }
  exit 1
}
