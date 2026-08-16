Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "aegis-common.ps1")

function Invoke-BuildAllStep {
  param([int]$Number, [string]$Label, [string]$Command, [string[]]$Arguments)
  Write-Host "[$Number/5] $Label" -ForegroundColor White
  Invoke-AegisCommand $Command $Arguments
}

try {
  Set-Location (Get-AegisRoot)
  Require-AegisCommand "node" "Node.js" | Out-Null
  Require-AegisCommand "pnpm.cmd" "pnpm" | Out-Null
  Require-AegisTauri

  Invoke-BuildAllStep 1 "Installing dependencies" "pnpm.cmd" @("install")
  Write-Host "[2/5] Building shared packages" -ForegroundColor White
  $shared = @("@aegis/types", "@aegis/config", "@aegis/providers", "@aegis/security", "@aegis/project-engine", "@aegis/ai-runtime", "@aegis/shared-ui", "@aegis/cli-ui")
  foreach ($package in $shared) { Invoke-AegisCommand "pnpm.cmd" @("--filter", $package, "build") }
  Invoke-BuildAllStep 3 "Building API and Web" "pnpm.cmd" @("build")
  Invoke-BuildAllStep 4 "Testing ecosystem" "pnpm.cmd" @("test")

  if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) { throw "Rust compiler (rustc) is required. Install Rust from https://rustup.rs/." }
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw "Cargo is required. Install Rust from https://rustup.rs/." }
  Initialize-AegisMsvc
  Remove-Item Env:CARGO_TARGET_DIR -ErrorAction SilentlyContinue
  Invoke-BuildAllStep 5 "Building desktop application" "pnpm.cmd" @("--filter", "@aegis/desktop", "tauri:build")

  $release = Join-Path (Get-AegisRoot) "apps\desktop\src-tauri\target\release"
  $exePath = Join-Path $release "aegis-app.exe"
  $nsisDir = Join-Path $release "bundle\nsis"
  $msiDir = Join-Path $release "bundle\msi"
  if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) { throw "Desktop build output missing: $exePath" }
  if (-not (Test-Path -LiteralPath $nsisDir -PathType Container)) { throw "Desktop NSIS output missing: $nsisDir" }
  if (-not (Test-Path -LiteralPath $msiDir -PathType Container)) { throw "Desktop MSI output missing: $msiDir" }

  Write-AegisMessage OK "Full build completed"
  Write-AegisMessage OK "Portable executable: $exePath"
  Write-AegisMessage OK "NSIS directory: $nsisDir"
  Write-AegisMessage OK "MSI directory: $msiDir"
  exit 0
} catch {
  Write-AegisMessage ERROR $_.Exception.Message
  Write-AegisMessage ERROR "Build-all stopped immediately after the failed step."
  exit 1
}
