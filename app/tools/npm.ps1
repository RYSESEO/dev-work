$ErrorActionPreference = 'Stop'

$appRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$workspaceRoot = Split-Path -Parent $appRoot
$toolsRoot = Join-Path $workspaceRoot '.tools'
$nodeDir = Get-ChildItem -LiteralPath $toolsRoot -Directory -Filter 'node-v*-win-x64' |
  Sort-Object Name -Descending |
  Select-Object -First 1

if (-not $nodeDir) {
  throw "Portable Node was not found under $toolsRoot."
}

$npmPath = Join-Path $nodeDir.FullName 'npm.cmd'
if (-not (Test-Path -LiteralPath $npmPath)) {
  throw "npm.cmd was not found at $npmPath."
}

$env:Path = "$($nodeDir.FullName);$env:Path"
$env:ELECTRON_RUN_AS_NODE = $null
& $npmPath @args
exit $LASTEXITCODE
