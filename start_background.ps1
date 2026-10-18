param([Parameter(Mandatory = $true)][string]$PythonPath)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
while ($true) {
    try {
        $launcherProcess = Start-Process -FilePath $PythonPath -ArgumentList 'run_local.py' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -Wait -PassThru
        if ($launcherProcess.ExitCode -eq 0) { break }
    }
    catch {
        $logFolder = Join-Path $PSScriptRoot 'runtime'
        New-Item -ItemType Directory -Path $logFolder -Force | Out-Null
        Add-Content -LiteralPath (Join-Path $logFolder 'autostart.log') -Value "$(Get-Date -Format o) Launcher failed: $($_.Exception.GetType().Name)"
    }
    Start-Sleep -Seconds 30
}
