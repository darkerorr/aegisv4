Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "aegis-common.ps1")

try {
  Set-Location (Get-AegisRoot)
  Require-AegisCommand "node" "Node.js" | Out-Null
  Require-AegisCommand "pnpm.cmd" "pnpm" | Out-Null
  Ensure-AegisDependencies
  Require-AegisTauri
  if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) { throw "Rust compiler (rustc) is required. Install Rust from https://rustup.rs/." }
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw "Cargo is required. Install Rust from https://rustup.rs/." }
  Initialize-AegisMsvc
  Remove-Item Env:CARGO_TARGET_DIR -ErrorAction SilentlyContinue
  Write-AegisMessage OK "Rust detected: $(rustc --version)"
  Write-AegisMessage OK "Cargo detected: $(cargo --version)"
  Write-Host "==> Building Aegis App frontend" -ForegroundColor White
  Invoke-AegisCommand "pnpm.cmd" @("--filter", "@aegis/desktop", "build")
  Write-Host "==> Building Aegis App Windows bundle" -ForegroundColor White
  Invoke-AegisCommand "pnpm.cmd" @("--filter", "@aegis/desktop", "tauri:build")
  $release = Join-Path (Get-AegisRoot) "apps\desktop\src-tauri\target\release"
  $exePath = Join-Path $release "aegis-app.exe"
  $nsisDir = Join-Path $release "bundle\nsis"
  $msiDir = Join-Path $release "bundle\msi"
  if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) { throw "Tauri build finished without the required executable: $exePath" }
  if (-not (Test-Path -LiteralPath $nsisDir -PathType Container)) { throw "NSIS output directory is missing: $nsisDir" }
  if (-not (Test-Path -LiteralPath $msiDir -PathType Container)) { throw "MSI output directory is missing: $msiDir" }
  $nsis = Get-ChildItem -LiteralPath $nsisDir -Filter "*.exe" -File | Select-Object -First 1
  $msi = Get-ChildItem -LiteralPath $msiDir -Filter "*.msi" -File | Select-Object -First 1
  if (-not $nsis) { throw "No NSIS .exe installer found in $nsisDir" }
  if (-not $msi) { throw "No MSI installer found in $msiDir" }
  Write-AegisMessage OK "Portable executable: $exePath"
  Write-AegisMessage OK "NSIS installer: $($nsis.FullName)"
  Write-AegisMessage OK "MSI installer: $($msi.FullName)"
  Start-Process explorer.exe -ArgumentList ("`"$($release)\bundle`"")
  exit 0
} catch {
  Write-AegisMessage ERROR $_.Exception.Message
  exit 1
}
