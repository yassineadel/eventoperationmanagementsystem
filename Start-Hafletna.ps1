$ErrorActionPreference = 'Stop'
$taskRunner = Join-Path $PSScriptRoot 'scripts/start-hafletna.mjs'
Push-Location -LiteralPath $PSScriptRoot
try {
    & node $taskRunner
}
finally {
    Pop-Location
}
