Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "aegis-common.ps1")
try {
  Set-Location (Get-AegisRoot)
  if (-not (Test-Path "apps\web\.next-prod\BUILD_ID")) { throw "No production Web build exists. Run build-web.bat first." }
  if (Test-AegisUrl "http://127.0.0.1:3000") { Write-AegisMessage INFO "Aegis Web is already running on port 3000"; exit 0 }
  if (Test-AegisPort 3000) {
    Write-AegisMessage WARN "Port 3000 is occupied by a background process."
    Stop-AegisServiceOnPort "web" 3000
    if (Test-AegisPort 3000) { throw "Port 3000 is still occupied after the process was stopped." }
  }
  Write-AegisMessage INFO "Starting existing production Web build."
  Start-AegisService "web" "start:web" | Out-Null
  if (-not (Wait-AegisReady "web" { Test-AegisUrl "http://127.0.0.1:3000" } 20)) { Stop-AegisPid "web" | Out-Null; throw "Aegis Web did not become ready." }
  Register-AegisListeningProcess "web" 3000 | Out-Null
  Write-AegisMessage OK "Web ready: http://127.0.0.1:3000"
  Start-Process "http://127.0.0.1:3000"
  exit 0
} catch { Write-AegisMessage ERROR $_.Exception.Message; exit 1 }
