# Creates the Windows scheduled task that makes up to two videos a day. No admin needed.
# It fits around normal use: it never wakes the PC, catches up when you sign in, and does no
# work unless a video is due.
#   Set up:    powershell -ExecutionPolicy Bypass -File automation\setup-tasks.ps1
#   Remove:    powershell -ExecutionPolicy Bypass -File automation\setup-tasks.ps1 -Remove
#   Test now:  Start-ScheduledTask -TaskName "TikTok Make Video"
#   Pause:     Disable-ScheduledTask -TaskName "TikTok Make Video"
param([switch]$Remove)

$name = 'TikTok Make Video'
if ($Remove) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false
  "Removed '$name'."
  exit 0
}

$script = Join-Path $PSScriptRoot 'run-video.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""

# 5:30 AM clears the earliest morning slot (about 9 AM on weekends) with time to review.
# 2:30 PM fills that evening's slot. Signing in catches up on anything missed while the PC was off.
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$logon = New-ScheduledTaskTrigger -AtLogOn -User $user
$logon.Delay = 'PT10M'
$triggers = @(
  (New-ScheduledTaskTrigger -Daily -At '5:30 AM'),
  (New-ScheduledTaskTrigger -Daily -At '2:30 PM'),
  $logon
)

# Battery is fine (run-video.ps1 skips below 30%). Low priority keeps the PC usable.
# A missed run happens when the PC is next available. If the PC sleeps, the run picks up on waking.
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Priority 7 -ExecutionTimeLimit (New-TimeSpan -Hours 4) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $name -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Force | Out-Null
"Created '$name': checks at 5:30 AM, 2:30 PM and when you sign in, and makes a video only if one is due."
