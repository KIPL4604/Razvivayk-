param(
    [string]$PythonPath = '',
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$taskName = 'TeramontGamesAutoStart'
$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder 'TeramontGamesAutoStart.lnk'
$runtimeFolder = Join-Path $PSScriptRoot 'runtime'
New-Item -ItemType Directory -Path $runtimeFolder -Force | Out-Null
$statePath = Join-Path $runtimeFolder 'autostart.json'

if ($Remove) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
    if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath }
    @{ enabled = $false } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
    Write-Output 'Autostart disabled. Current game processes are unchanged.'
    exit 0
}

if (-not $PythonPath) { $PythonPath = (Get-Command python -ErrorAction Stop).Source }
$PythonPath = (Resolve-Path -LiteralPath $PythonPath).Path
$backgroundScript = Join-Path $PSScriptRoot 'start_background.ps1'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$launchArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -PythonPath "{1}"' -f $backgroundScript, $PythonPath

try {
    $userIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action = New-ScheduledTaskAction -Execute $powershellPath -Argument $launchArguments -WorkingDirectory $PSScriptRoot
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $userIdentity
    $principal = New-ScheduledTaskPrincipal -UserId $userIdentity -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Start Teramont API, HTTPS tunnel and Telegram bot at user logon.' -Force | Out-Null
    if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath }
    $method = 'scheduled-task'
}
catch {
    Write-Output ('Task Scheduler unavailable: {0}. Using current-user Startup folder.' -f $_.Exception.GetType().Name)
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $powershellPath
    $shortcut.Arguments = $launchArguments
    $shortcut.WorkingDirectory = $PSScriptRoot
    $shortcut.WindowStyle = 7
    $shortcut.Description = 'Teramont API, HTTPS tunnel and Telegram bot'
    $shortcut.Save()
    $method = 'startup-shortcut'
}

@{ enabled = $true; method = $method; python = $PythonPath; updatedAt = (Get-Date -Format o) } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
Write-Output "Autostart enabled: $method"
