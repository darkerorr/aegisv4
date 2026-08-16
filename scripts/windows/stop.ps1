Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "aegis-common.ps1")

try {
  Set-Location (Get-AegisRoot)
  Write-Host "Aegis Service Stopper" -ForegroundColor White
  Stop-AegisPid "web" | Out-Null
  Stop-AegisPid "api" | Out-Null
  Stop-AegisPid "agent" | Out-Null
  Write-AegisMessage OK "Only Aegis processes recorded by start.bat were targeted."
  exit 0
} catch {
  Write-AegisMessage ERROR $_.Exception.Message
  exit 1
}
