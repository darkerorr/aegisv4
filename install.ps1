param(
  [switch]$SkipSetup
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageJson = Join-Path $ProjectRoot "package.json"
$DistIndex = Join-Path $ProjectRoot "dist\index.js"
$UserBin = Join-Path $HOME ".aegis\bin"
$Launcher = Join-Path $UserBin "aegis.cmd"
$AegisHome = Join-Path $HOME ".aegis"
$GlobalEnvFile = Join-Path $AegisHome ".env"
$NpmGlobalBin = Join-Path $env:APPDATA "npm"
$NpmPowerShellShim = Join-Path $NpmGlobalBin "aegis.ps1"
$CurrentStep = "Starting installer"

function Write-Ok($Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn($Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Fail($Message) { Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-Info($Message) { Write-Host "[INFO] $Message" -ForegroundColor Cyan }

function Test-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-GlobalEnvFile {
  $script:CurrentStep = "Creating global env file"
  New-Item -ItemType Directory -Force -Path $AegisHome | Out-Null

  if (Test-Path $GlobalEnvFile) {
    Write-Ok "Global env file found: $GlobalEnvFile"
    return
  }

  $envTemplate = @"
# Aegis CLI API keys
# Remove the # before a line and paste your key after the =

# NVIDIA_API_KEY=your_nvidia_key_here
# AEGIS_OPENAI_API_KEY=your_openai_key_here
# AEGIS_GROQ_API_KEY=your_groq_key_here
# AEGIS_CUSTOM_API_KEY=your_custom_key_here

"@
  Set-Content -Path $GlobalEnvFile -Value $envTemplate -Encoding ASCII
  Write-Ok "Created global env file: $GlobalEnvFile"
}

function Test-PackageJsonDependencies {
  $script:CurrentStep = "Checking package dependencies"
  $package = Get-Content -LiteralPath $PackageJson -Raw | ConvertFrom-Json
  $sections = @("dependencies", "devDependencies", "optionalDependencies", "peerDependencies")

  foreach ($section in $sections) {
    $entries = $package.$section
    if (!$entries) {
      continue
    }

    foreach ($entry in $entries.PSObject.Properties) {
      $name = [string]$entry.Name
      $value = [string]$entry.Value
      if ($name -match "\s" -or ($name -eq "dev" -and $value -match "knip")) {
        Write-Fail "Invalid dependency entry in package.json: $section.$name = $value"
        Write-Fail "Remove malformed entries such as 'dev knip' before installing."
        exit 1
      }

      if ($name -eq "knip") {
        Write-Fail "Knip is not part of the V1 install dependencies. Remove it before installing."
        exit 1
      }
    }
  }

  Write-Ok "package.json dependencies look clean"
}

function Run-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Command
  )

  $script:CurrentStep = $Name
  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan

  Push-Location $ProjectRoot
  try {
    cmd.exe /d /s /c $Command
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }

  if ($exitCode -ne 0) {
    throw "$Name failed with exit code $exitCode"
  }

  Write-Ok "$Name completed"
}

function Invoke-ProjectCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command
  )

  Push-Location $ProjectRoot
  try {
    cmd.exe /d /s /c $Command | Out-Host
    return [int]$LASTEXITCODE
  } finally {
    Pop-Location
  }
}

function Remove-NpmInstallArtifacts {
  $nodeModulesPath = Join-Path $ProjectRoot "node_modules"
  $packageLockPath = Join-Path $ProjectRoot "package-lock.json"

  Write-Info "Cleaning npm install artifacts..."

  if (Test-Path $nodeModulesPath) {
    $resolvedNodeModules = (Resolve-Path -LiteralPath $nodeModulesPath).Path
    if ($resolvedNodeModules -ne (Join-Path $ProjectRoot "node_modules")) {
      Write-Fail "Refusing to remove unexpected path: $resolvedNodeModules"
      exit 1
    }

    Write-Info "Removing node_modules"
    Remove-Item -LiteralPath $resolvedNodeModules -Recurse -Force
  } else {
    Write-Info "node_modules not found"
  }

  if (Test-Path $packageLockPath) {
    $resolvedPackageLock = (Resolve-Path -LiteralPath $packageLockPath).Path
    if ($resolvedPackageLock -ne (Join-Path $ProjectRoot "package-lock.json")) {
      Write-Fail "Refusing to remove unexpected path: $resolvedPackageLock"
      exit 1
    }

    Write-Info "Removing package-lock.json"
    Remove-Item -LiteralPath $resolvedPackageLock -Force
  } else {
    Write-Info "package-lock.json not found"
  }
}

function Run-NpmInstall {
  $script:CurrentStep = "Installing dependencies"
  Write-Host ""
  Write-Host "==> Installing dependencies" -ForegroundColor Cyan
  $pnpmCommand = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
  if ($pnpmCommand) {
    Write-Info "pnpm detected; using the workspace lockfile instead of creating a package-lock.json"
    $pnpmExitCode = Invoke-ProjectCommand "pnpm.cmd install --frozen-lockfile"
    if ($pnpmExitCode -eq 0) {
      Write-Ok "Dependencies installed with pnpm"
      return
    }
    throw "pnpm install failed with exit code $pnpmExitCode"
  }
  $env:npm_config_progress = "false"
  Write-Info "Running: npm install"
  Write-Info "This step can take a few minutes..."

  $installExitCode = Invoke-ProjectCommand "npm install"

  if ($installExitCode -eq 0) {
    Write-Ok "Dependencies installed"
    return
  }

  Write-Warn "npm install failed with exit code $installExitCode."
  Write-Warn "npm dependency resolution failed. Retrying with --legacy-peer-deps..."
  Write-Info "Running: npm install --legacy-peer-deps --no-audit --no-fund"
  Write-Info "This step can take a few minutes..."

  $legacyExitCode = Invoke-ProjectCommand "npm install --legacy-peer-deps --no-audit --no-fund"

  if ($legacyExitCode -eq 0) {
    Write-Ok "Dependencies installed with --legacy-peer-deps"
    return
  }

  Write-Warn "npm install failed again with exit code $legacyExitCode."
  $answer = Read-Host "Do you want to clean node_modules and package-lock.json then retry? [Y/n]"
  if ($answer -eq "" -or $answer.ToLowerInvariant() -eq "y" -or $answer.ToLowerInvariant() -eq "yes") {
    Remove-NpmInstallArtifacts
    Write-Info "Running: npm install --legacy-peer-deps --no-audit --no-fund"
    Write-Info "This step can take a few minutes..."
    $cleanExitCode = Invoke-ProjectCommand "npm install --legacy-peer-deps --no-audit --no-fund"
    if ($cleanExitCode -eq 0) {
      Write-Ok "Dependencies installed after clean retry"
      return
    }

    Write-Fail "Installing dependencies failed after clean retry with exit code $cleanExitCode"
    Write-Fail "Please check package.json and package-lock.json for dependency conflicts before retrying."
    exit $cleanExitCode
  }

  Write-Fail "Installing dependencies failed with exit code $legacyExitCode"
  Write-Fail "Please check package.json and package-lock.json for dependency conflicts before retrying."
  exit $legacyExitCode
}

function Test-OllamaServer {
  try {
    Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Start-OllamaServerIfNeeded {
  $script:CurrentStep = "Checking Ollama server"
  Write-Host ""
  Write-Host "==> Checking Ollama server" -ForegroundColor Cyan

  if (-not (Test-Command "ollama")) {
    Write-Warn "Ollama command not detected. You can configure another provider during setup."
    return
  }

  if (Test-OllamaServer) {
    Write-Ok "Ollama server reachable at http://localhost:11434"
    return
  }

  Write-Warn "Ollama is installed but the server is not running."
  $answer = Read-Host "Start Ollama server now? [Y/n]"
  if ($null -eq $answer) {
    $answer = "n"
    Write-Warn "No interactive answer was available. Ollama start skipped."
  }
  if ($answer -ne "" -and $answer.ToLowerInvariant() -ne "y" -and $answer.ToLowerInvariant() -ne "yes") {
    Write-Warn "Ollama start skipped. You can start it later with: ollama serve"
    return
  }

  Write-Host "Starting Ollama server..." -ForegroundColor Cyan
  try {
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden | Out-Null
  } catch {
    Write-Warn "Could not start Ollama automatically: $($_.Exception.Message)"
    Write-Warn "You can start it later with: ollama serve"
    return
  }

  for ($i = 1; $i -le 10; $i++) {
    Start-Sleep -Seconds 2
    if (Test-OllamaServer) {
      Write-Ok "Ollama server started"
      return
    }
    Write-Host "Waiting for Ollama... ($i/10)" -ForegroundColor DarkGray
  }

  Write-Warn "Ollama did not become reachable. You can start it later with: ollama serve"
}

function Test-LMStudioServer {
  try {
    Invoke-RestMethod -Uri "http://localhost:1234/v1/models" -Method Get -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Add-UserPath($PathToAdd) {
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @()
  if ($current) {
    $parts = $current -split ";" | Where-Object { $_ -and $_.Trim() }
  }

  if ($parts -notcontains $PathToAdd) {
    $next = ((@($PathToAdd) + $parts) -join ";")
    [Environment]::SetEnvironmentVariable("Path", $next, "User")
    $env:Path = "$PathToAdd;$env:Path"
    Write-Ok "Added $PathToAdd to the front of user PATH"
  } else {
    $next = ((@($PathToAdd) + ($parts | Where-Object { $_ -ne $PathToAdd })) -join ";")
    [Environment]::SetEnvironmentVariable("Path", $next, "User")
    if (($env:Path -split ";")[0] -ne $PathToAdd) {
      $env:Path = "$PathToAdd;$env:Path"
    }
    Write-Ok "User PATH already contains $PathToAdd; moved it to the front"
  }
}

function Create-CmdLauncher {
  param(
    [string]$Reason = "Creating aegis.cmd launcher"
  )

  Write-Info $Reason
  New-Item -ItemType Directory -Force -Path $UserBin | Out-Null

  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $launcherContent = @"
@echo off
"$nodePath" "$DistIndex" %*
"@
  Set-Content -Path $Launcher -Value $launcherContent -Encoding ASCII
  Add-UserPath $UserBin
  Write-Ok "Launcher ready: $Launcher"
}

function Remove-NpmPowerShellShim {
  $script:CurrentStep = "Removing npm PowerShell shim"

  if (!(Test-Path $NpmPowerShellShim)) {
    Write-Ok "No npm PowerShell shim found for aegis"
    return
  }

  try {
    Remove-Item -LiteralPath $NpmPowerShellShim -Force
    Write-Ok "Removed blocked PowerShell shim: $NpmPowerShellShim"
  } catch {
    Write-Warn "Could not remove $NpmPowerShellShim"
    Write-Warn "PowerShell may still try to run aegis.ps1 and fail because scripts are disabled."
    Write-Warn "Manual fix: Remove-Item `"$NpmPowerShellShim`" -Force"
  }
}

function Repair-PowerShellCommandResolution {
  Create-CmdLauncher "Creating Windows cmd launcher so PowerShell does not need aegis.ps1"
  Remove-NpmPowerShellShim
}

function Test-AegisCommand {
  $script:CurrentStep = "Verifying global aegis command"
  Write-Host ""
  Write-Host "==> Verifying global aegis command" -ForegroundColor Cyan

  Push-Location $ProjectRoot
  try {
    cmd.exe /d /s /c "aegis.cmd version" | Out-Host
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "aegis.cmd version works"
      return $true
    }

    cmd.exe /d /s /c "aegis.cmd --version" | Out-Host
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "aegis.cmd --version works"
      return $true
    }
  } finally {
    Pop-Location
  }

  Write-Warn "Global aegis command is not available in this terminal yet"
  return $false
}

function Run-Aegis {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Arguments,
    [Parameter(Mandatory = $true)][bool]$UseGlobalCommand
  )

  if ($UseGlobalCommand) {
    Run-Step $Name "aegis $Arguments"
  } else {
    Run-Step $Name "node `"$DistIndex`" $Arguments"
  }
}

try {
  Write-Host "Aegis CLI Windows Installer" -ForegroundColor Cyan
  Write-Host "Project: $ProjectRoot"
  Write-Host ""

  $CurrentStep = "Checking PowerShell"
  if ($PSVersionTable.PSVersion) { Write-Ok "PowerShell detected: $($PSVersionTable.PSVersion)" }
  else { Write-Fail "PowerShell not detected"; exit 1 }

  $CurrentStep = "Checking project directory"
  if (Test-Path $ProjectRoot) { Write-Ok "Project directory found" }
  else { Write-Fail "Project directory missing: $ProjectRoot"; exit 1 }

  $CurrentStep = "Checking package.json"
  if (Test-Path $PackageJson) { Write-Ok "package.json found" }
  else { Write-Fail "package.json missing"; exit 1 }
  Test-PackageJsonDependencies
  Ensure-GlobalEnvFile

  $CurrentStep = "Checking Node.js"
  if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Ok "Node.js detected: $nodeVersion"
    $nodeMajor = [int]($nodeVersion.TrimStart("v").Split(".")[0])
    if ($nodeMajor -gt 22) {
      Write-Warn "Node.js $nodeVersion is newer than the current LTS line. Continuing installation."
    }
  } else { Write-Fail "Node.js is required. Install it from https://nodejs.org/"; exit 1 }

  $CurrentStep = "Checking npm"
  $npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
  if ($npmCmd) { Write-Ok "npm detected: $(cmd.exe /d /s /c `"npm --version`")" }
  elseif (Test-Command "npm") { Write-Warn "npm.cmd not found, but npm exists. Commands will still run through cmd.exe."; Write-Ok "npm detected: $(cmd.exe /d /s /c `"npm --version`")" }
  else { Write-Fail "npm is required and usually comes with Node.js"; exit 1 }

  $CurrentStep = "Checking Git"
  if (Test-Command "git") { Write-Ok "Git detected: $(git --version)" }
  else { Write-Warn "Git not detected. Updates with aegis update may not work." }

  $CurrentStep = "Checking Ollama"
  if (Test-Command "ollama") { Write-Ok "Ollama command detected" }
  else { Write-Warn "Ollama command not detected" }

  $CurrentStep = "Checking LM Studio"
  if (Test-LMStudioServer) {
    Write-Ok "LM Studio reachable at http://localhost:1234/v1"
  } else {
    Write-Warn "LM Studio not detected at http://localhost:1234/v1"
  }

  Run-NpmInstall
  Run-Step "Building project" "npm run build"

  if (!(Test-Path $DistIndex)) {
    throw "Build output missing: $DistIndex"
  }
  Write-Ok "Build output found: $DistIndex"

  $linked = $false
  try {
    Run-Step "Linking global aegis command" "npm link"
    $linked = $true
  } catch {
    Write-Warn "npm link failed: $($_.Exception.Message)"
    Write-Warn "A fallback launcher will be created in $UserBin and added to your user PATH."
  }

  Repair-PowerShellCommandResolution

  $globalWorks = Test-AegisCommand
  if (!$globalWorks -and $linked) {
    Write-Warn "npm link completed, but aegis was not usable immediately."
    Repair-PowerShellCommandResolution
    $globalWorks = Test-AegisCommand
  }

  if (!$globalWorks) {
    Write-Warn "Aegis will continue through node ./dist/index.js for this installer run."
    Write-Warn "If 'aegis' is still unavailable later, open a new terminal or add this folder to PATH: $UserBin"
  }

  Start-OllamaServerIfNeeded

  if (!$SkipSetup) {
    Run-Aegis "Running Aegis setup" "setup" $globalWorks
  } else {
    Write-Warn "Setup skipped because -SkipSetup was provided."
  }

  Run-Aegis "Running Aegis doctor" "doctor" $globalWorks

  Write-Host ""
  Write-Ok "Aegis CLI installed successfully."
  Write-Host ""
  Write-Host "You can now open any folder and run:"
  Write-Host ""
  Write-Host "  cd C:\Users\ROOT\Desktop\mon-projet"
  Write-Host "  aegis"
  Write-Host ""
  exit 0
} catch {
  Write-Host ""
  Write-Fail "Step failed: $CurrentStep"
  Write-Fail $_.Exception.Message
  exit 1
}
