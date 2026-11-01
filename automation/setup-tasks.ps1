# Creates the Windows scheduled task that makes two videos a day. No admin needed.
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
# 2:30 PM fills that evening's slot.
$triggers = @(
  (New-ScheduledTaskTrigger -Daily -At '5:30 AM'),
  (New-ScheduledTaskTrigger -Daily -At '2:30 PM')
)

# Battery is fine (run-video.ps1 skips below 30%). Low priority keeps the PC usable.
# A missed run happens when the PC is next available, and takes the next open slot.
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun -Priority 7 -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $name -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Force | Out-Null
"Created '$name': runs daily at 5:30 AM and 2:30 PM while you're signed in, including on battery above 30%."
