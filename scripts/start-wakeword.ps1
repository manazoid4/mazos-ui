param(
  [switch]$Install,
  [string]$DataDir = ""
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$local = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { $env:TEMP }
$venv = Join-Path $local "MAZos\wakeword-venv"
$python = Join-Path $venv "Scripts\python.exe"

if (-not (Test-Path $python)) {
  if (-not $Install) {
    Write-Host "Local openWakeWord has not been installed. Re-run with -Install to opt in."
    exit 2
  }
  New-Item -ItemType Directory -Force (Split-Path $venv) | Out-Null
  $launcher = Get-Command py -ErrorAction SilentlyContinue
  if ($launcher) { & py -3 -m venv $venv }
  else { & python -m venv $venv }
  if ($LASTEXITCODE -ne 0) { throw "Python virtual environment setup failed. Install Python 3.11 or 3.12 first." }
}

& $python -c "import openwakeword, sounddevice, numpy" 2>$null
$dependenciesPresent = ($LASTEXITCODE -eq 0)
if (-not $dependenciesPresent) {
  if (-not $Install) {
    Write-Host "Wake-word packages are absent. Re-run with -Install to opt in."
    exit 2
  }
  & $python -m pip install --disable-pip-version-check "openwakeword==0.6.0" "sounddevice>=0.4,<1" "numpy>=1.24,<3"
  if ($LASTEXITCODE -ne 0) { throw "Wake-word dependencies failed to install." }
  & $python -c "import openwakeword; openwakeword.utils.download_models()"
  if ($LASTEXITCODE -ne 0) { throw "Wake-word model download failed." }
}

if (-not $DataDir) {
  $DataDir = if ($env:MAZOS_DATA_DIR) { $env:MAZOS_DATA_DIR } else { Join-Path $root "data\mazos" }
}
Write-Host "Starting LOCAL, opt-in Hey Jarvis detector. Ctrl+C stops it."
Write-Host "Data folder: $DataDir"
Write-Host "No voice audio is retained or sent by the detector."
& $python (Join-Path $root "scripts\mazos-wakeword.py") --data-dir $DataDir
exit $LASTEXITCODE
