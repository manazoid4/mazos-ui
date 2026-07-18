$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir = Join-Path $Root 'data\mazos\logs'
$DevLog = Join-Path $LogDir 'local-dev.log'
$BridgeLog = Join-Path $LogDir 'local-bridge.log'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Test-Port {
  param([int]$Port)
  $client = New-Object Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(650, $false)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Start-StackProcess {
  param(
    [string]$Name,
    [string]$Command,
    [string]$LogPath
  )

  $wrapped = @"
Set-Location '$Root'
cmd /c "$Command" *>> '$LogPath'
"@

  Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command',$wrapped -WindowStyle Hidden | Out-Null
  Add-Content -Path $LogPath -Value "[$(Get-Date -Format o)] Started $Name from $Root"
}

if (-not (Test-Port 3046)) {
  # Prefer the production server when a build exists: faster, stabler for an
  # always-on stack. Fall back to dev when there is no .next build.
  $HasBuild = Test-Path (Join-Path $Root '.next\BUILD_ID')
  $AppCommand = if ($HasBuild) { 'npm run start -- -p 3046' } else { 'npm run dev -- -p 3046' }
  Start-StackProcess -Name 'MAZos local app' -Command $AppCommand -LogPath $DevLog
} else {
  Add-Content -Path $DevLog -Value "[$(Get-Date -Format o)] Port 3046 already listening; not starting duplicate."
}

if (-not (Test-Port 3047)) {
  Start-StackProcess -Name 'MAZos local bridge' -Command 'npm run bridge' -LogPath $BridgeLog
} else {
  Add-Content -Path $BridgeLog -Value "[$(Get-Date -Format o)] Port 3047 already listening; not starting duplicate."
}
