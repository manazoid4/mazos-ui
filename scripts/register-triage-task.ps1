# One-time registration of the MAZos Morning Triage scheduled task.
# Safe to re-run: replaces the existing task. Requires no elevation (current-user task).
$Script = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'run-morning-triage.ps1'
$Action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Script`""
$Trigger = New-ScheduledTaskTrigger -Daily -At 06:33   # off :30 to dodge cron-herd jitter
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'MAZos Morning Triage' -Action $Action -Trigger $Trigger `
  -Settings $Settings -Description 'MAZos L1 report-only loop discovery (headless Claude Code)' -Force
Write-Output "Registered 'MAZos Morning Triage' daily 06:33 (StartWhenAvailable = one catch-up run after sleep)."
