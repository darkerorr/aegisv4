Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "aegis-common.ps1")

try {
  Set-Location (Get-AegisRoot)
  Require-AegisCommand "node" "Node.js" | Out-Null
  Require-AegisCommand "pnpm.cmd" "pnpm" | Out-Null
  Ensure-AegisDependencies
  Require-AegisTauri
  if (-not (Get-Command rustc -ErrorAction SilentlyContinue) -or -not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "Rust and Cargo are required for the native Aegis App. Install Rust from https://rustup.rs/ and retry."
  }
  Initialize-AegisMsvc
  Initialize-AegisCargoTarget | Out-Null
  Write-AegisMessage INFO "Starting Aegis App in Tauri development mode."
  Invoke-AegisCommand "pnpm.cmd" @("--filter", "@aegis/desktop", "tauri:dev")
  exit 0
} catch {
  Write-AegisMessage ERROR $_.Exception.Message
  exit 1
}
