$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir = Join-Path $Root 'data\mazos\logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log = Join-Path $LogDir ("triage-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
$Runs = Join-Path $Root 'data\mazos\loop-runs.jsonl'

Add-Content $Log "[$(Get-Date -Format o)] triage wrapper start"

# Ensure the local stack is up (no-op if ports already listening)
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\start-mazos-local-stack.ps1')
Start-Sleep -Seconds 10

# Headless Claude Code runs the triage skill. Hard caps: 40 turns + 20 min wall
# clock — a hung triage costs one bounded run, never a night (token-blowout guard).
$claudeArgs = @('-p', 'Run the mazos-triage skill now. Obey its STOP section exactly. Report-only.', '--max-turns', '40')
$proc = Start-Process -FilePath 'claude' -ArgumentList $claudeArgs -WorkingDirectory $Root `
  -RedirectStandardOutput "$Log.out" -RedirectStandardError "$Log.err" -PassThru -WindowStyle Hidden

if (-not $proc.WaitForExit(1200000)) {
  Stop-Process -Id $proc.Id -Force -Confirm:$false
  $stop = '{"loopId":"mazos_triage","at":"' + (Get-Date -AsUTC -Format 'yyyy-MM-ddTHH:mm:ss.fffZ') + '","type":"stop","reason":"budget","summary":"triage killed at 20min wall clock"}'
  Add-Content $Runs $stop
  Add-Content $Log "[$(Get-Date -Format o)] KILLED at 20min"
  exit 1
}

Get-Content "$Log.out" -ErrorAction SilentlyContinue | Add-Content $Log
Get-Content "$Log.err" -ErrorAction SilentlyContinue | Add-Content $Log
Remove-Item "$Log.out", "$Log.err" -Force -Confirm:$false -ErrorAction SilentlyContinue

if ($proc.ExitCode -ne 0) {
  $stop = '{"loopId":"mazos_triage","at":"' + (Get-Date -AsUTC -Format 'yyyy-MM-ddTHH:mm:ss.fffZ') + '","type":"stop","reason":"manual","summary":"triage exited ' + $proc.ExitCode + ' — see logs"}'
  Add-Content $Runs $stop
}
Add-Content $Log "[$(Get-Date -Format o)] triage wrapper done, exit $($proc.ExitCode)"
exit $proc.ExitCode
