$ErrorActionPreference = "Stop"
$UserBin = Join-Path $env:LOCALAPPDATA "AegisCLI\bin"
$Launcher = Join-Path $UserBin "aegis.cmd"
$AegisHome = if ($env:AEGIS_HOME) { $env:AEGIS_HOME } else { Join-Path $HOME ".aegis" }
$HistoryDir = Join-Path $AegisHome "history"

function Write-Ok($Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn($Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }

function Remove-UserPath($PathToRemove) {
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  if (!$current) { return }
  $parts = $current -split ";" | Where-Object { $_ -and $_.Trim() -and $_ -ne $PathToRemove }
  [Environment]::SetEnvironmentVariable("Path", ($parts -join ";"), "User")
}

Write-Host "Aegis CLI Uninstaller" -ForegroundColor Cyan

$removeCommand = Read-Host "Do you want to remove Aegis global command? [Y/n]"
if ($removeCommand -eq "" -or $removeCommand.ToLowerInvariant() -eq "y" -or $removeCommand.ToLowerInvariant() -eq "yes") {
  try {
    npm unlink -g aegis-cli | Out-Host
    Write-Ok "npm global link removed"
  } catch {
    Write-Warn "npm unlink failed or was not needed"
  }

  if (Test-Path $Launcher) {
    Remove-Item -LiteralPath $Launcher -Force
    Write-Ok "Fallback launcher removed: $Launcher"
  }

  Remove-UserPath $UserBin
}

$deleteConfig = Read-Host "Do you want to delete global config? [y/N]"
if ($deleteConfig.ToLowerInvariant() -eq "y" -or $deleteConfig.ToLowerInvariant() -eq "yes") {
  $deleteHistory = Read-Host "Do you want to delete conversation history? [y/N]"
  if (Test-Path $AegisHome) {
    if ($deleteHistory.ToLowerInvariant() -eq "y" -or $deleteHistory.ToLowerInvariant() -eq "yes") {
      Remove-Item -LiteralPath $AegisHome -Recurse -Force
      Write-Ok "Aegis config and history deleted: $AegisHome"
    } else {
      Get-ChildItem -LiteralPath $AegisHome -Force | Where-Object { $_.FullName -ne $HistoryDir } | Remove-Item -Recurse -Force
      Write-Ok "Aegis config deleted, history kept"
    }
  }
}

Write-Ok "Uninstall complete"
