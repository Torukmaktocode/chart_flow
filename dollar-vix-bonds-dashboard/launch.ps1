$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$NODE = "$HOME\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if (-not (Test-Path $NODE)) { $NODE = "node" }

$existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8770 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess
foreach ($pidValue in $existing) {
    try { Stop-Process -Id $pidValue -Force } catch {}
}

Start-Process -WindowStyle Hidden -WorkingDirectory $ROOT -FilePath $NODE -ArgumentList @("--use-system-ca", "server.js")
Start-Sleep -Milliseconds 700
Start-Process "http://127.0.0.1:8770/dashboard.html"
