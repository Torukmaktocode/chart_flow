$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$NODE = "$HOME\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if (-not (Test-Path $NODE)) { $NODE = "node" }

$existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess
foreach ($pidValue in $existing) {
    try { Stop-Process -Id $pidValue -Force } catch {}
}

Start-Process -WindowStyle Hidden -WorkingDirectory $ROOT -FilePath $NODE -ArgumentList @("--use-system-ca", "server.js")
Start-Sleep -Milliseconds 600
Start-Process "http://127.0.0.1:8765/dashboard.html"
