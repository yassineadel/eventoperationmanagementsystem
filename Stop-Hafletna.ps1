[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param()

$ErrorActionPreference = 'Stop'
$taskBackendRoot = (Join-Path $PSScriptRoot 'Backend').Replace('/', '\') + '\'
$taskFrontendRoot = (Join-Path $PSScriptRoot 'Frontend').Replace('/', '\') + '\'
$taskRoot = $PSScriptRoot.Replace('/', '\') + '\'
$taskRuntime = Join-Path $PSScriptRoot 'Frontend/node_modules/.hafletna-local'

function Test-HafletnaServer($taskProcess) {
    if ($taskProcess.Name -ne 'node.exe' -or -not $taskProcess.CommandLine) { return $false }
    $taskCommand = $taskProcess.CommandLine.Replace('/', '\')
    $taskInBackend = $taskCommand.IndexOf($taskBackendRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
    $taskInFrontend = $taskCommand.IndexOf($taskFrontendRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
    return ($taskInBackend -and $taskCommand -match '(ts-node|nodemon).*src\\server\.ts') -or
        ($taskInFrontend -and $taskCommand -match 'vite\\bin\\vite\.js')
}

function Test-HafletnaLocalService($taskProcess) {
    if ($taskProcess.Name -notin @('postgres.exe', 'redis-server.exe') -or -not $taskProcess.ExecutablePath) { return $false }
    return $taskProcess.ExecutablePath.Replace('/', '\').StartsWith($taskRuntime.Replace('/', '\') + '\', [StringComparison]::OrdinalIgnoreCase)
}

$taskProcesses = @(Get-CimInstance Win32_Process)
$taskServers = @($taskProcesses | Where-Object { Test-HafletnaServer $_ })
$taskSupervisors = @($taskProcesses | Where-Object {
    $_.Name -eq 'node.exe' -and $_.CommandLine -and
    $_.CommandLine.Replace('/', '\').IndexOf($taskRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $_.CommandLine -match '(scripts[\\/]start-hafletna|\.hafletna-local[\\/]start)\.mjs'
})
if ($taskServers.Count -eq 0 -and $taskSupervisors.Count -eq 0) {
    if (@($taskProcesses | Where-Object { Test-HafletnaLocalService $_ }).Count -gt 0) {
        Write-Warning 'A local database service is still running without its launcher. Shutdown is not confirmed; do not restart yet.'
        exit 1
    }
    Write-Host 'Hafletna is already stopped.'
    return
}

# The machine-local launcher watches this request and stops its services in order.
# This also works while it is still starting, or after an application server exits.
$taskManagedStop = $taskSupervisors.Count -gt 0 -and (Test-Path -LiteralPath (Join-Path $taskRuntime 'start.mjs'))
if ($taskManagedStop -and $PSCmdlet.ShouldProcess('Hafletna local launcher', 'Request clean shutdown')) {
    Set-Content -LiteralPath (Join-Path $taskRuntime 'stop-request') -Value 'stop' -Encoding Ascii
}

# Stop the backend first. Its launcher then saves/stops its own Redis and PostgreSQL.
# Watchers are stopped before their child server so they cannot restart it.
$taskServers = @($taskServers | Sort-Object @{ Expression = {
    if ($_.CommandLine -match 'nodemon') { 0 }
    elseif ($_.CommandLine -match 'ts-node') { 1 }
    else { 2 }
} })
$taskSupervisorIds = @($taskSupervisors | Select-Object -ExpandProperty ProcessId)

foreach ($taskServer in $taskServers) {
    if ($taskManagedStop) { continue }
    $taskCurrent = Get-CimInstance Win32_Process -Filter "ProcessId=$($taskServer.ProcessId)"
    if ($taskCurrent -and (Test-HafletnaServer $taskCurrent) -and
        $PSCmdlet.ShouldProcess("Hafletna server process $($taskCurrent.ProcessId)", 'Stop')) {
        Stop-Process -Id $taskCurrent.ProcessId -ErrorAction SilentlyContinue
    }
}
if ($WhatIfPreference) { return }

$taskWaitIds = @($taskServers.ProcessId) + $taskSupervisorIds
$taskDeadline = [DateTime]::UtcNow.AddSeconds(30)
do {
    $taskRemaining = @(Get-Process -Id $taskWaitIds -ErrorAction SilentlyContinue)
    if ($taskRemaining.Count -eq 0) {
        $taskServices = @(Get-CimInstance Win32_Process | Where-Object { Test-HafletnaLocalService $_ })
        if ($taskServices.Count -gt 0) {
            Write-Warning 'The application stopped, but a local database service is still running. Do not restart yet.'
            exit 1
        }
        Write-Host 'Hafletna stopped. Your code and saved database files are preserved.'
        return
    }
    Start-Sleep -Milliseconds 250
} while ([DateTime]::UtcNow -lt $taskDeadline)

Write-Warning "Shutdown could not be confirmed for processes: $($taskRemaining.Id -join ', '). Do not restart yet."
exit 1
