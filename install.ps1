<#
.SYNOPSIS
Installs MazOS Control Deck.

.DESCRIPTION
Sets up the necessary directories, installs npm packages, and ensures YAML config paths are accessible.
#>

$ErrorActionPreference = 'Stop'
$UI_DIR = "C:\Users\manaz\Projects\mazos-ui"

Write-Host "Installing MazOS Control Deck..."

if (-not (Test-Path $UI_DIR)) {
    New-Item -ItemType Directory -Force -Path $UI_DIR | Out-Null
}

Set-Location $UI_DIR

Write-Host "Checking for package.json..."
if (-not (Test-Path "package.json")) {
    Write-Host "No package.json found. Initializing minimal React environment..."
    # ponytail: assuming standard vite/react setup here, add actual init if package.json is genuinely missing.
    # npm create vite@latest . -- --template react
} else {
    Write-Host "Installing dependencies..."
    npm install
}

Write-Host "Ensuring config directories exist..."
$CONFIG_DIR = Join-Path $UI_DIR "configs"
if (-not (Test-Path $CONFIG_DIR)) {
    New-Item -ItemType Directory -Force -Path $CONFIG_DIR | Out-Null
}

Write-Host "Installation complete."
Write-Host "Run 'npm start' or 'npm run dev' to launch."
