$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$NODE = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $NODE)) { $NODE = "node" }

foreach ($port in 8765, 8770, 8780) {
    $existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess
    foreach ($pidValue in $existing) {
        try { Stop-Process -Id $pidValue -Force } catch {}
    }
}

$stockServer = Join-Path $ROOT "stock-dashboard\server.js"
$macroServer = Join-Path $ROOT "dollar-vix-bonds-dashboard\server.js"
$nasServer = Join-Path $ROOT "nas100-dashboard\server.js"
$stockDir = Split-Path -Parent $stockServer
$macroDir = Split-Path -Parent $macroServer
$nasDir = Split-Path -Parent $nasServer

Start-Process -WindowStyle Hidden -WorkingDirectory $stockDir -FilePath $NODE -ArgumentList @("server.js")
Start-Process -WindowStyle Hidden -WorkingDirectory $macroDir -FilePath $NODE -ArgumentList @("server.js")
Start-Process -WindowStyle Hidden -WorkingDirectory $nasDir -FilePath $NODE -ArgumentList @("server.js")

Start-Sleep -Milliseconds 900

Start-Process "http://127.0.0.1:8765/dashboard.html"
Start-Process "http://127.0.0.1:8770/dashboard.html"
Start-Process "http://127.0.0.1:8780/dashboard.html"

Write-Host "Dashboards activos:" -ForegroundColor Cyan
Write-Host "  Acciones:          http://127.0.0.1:8765/dashboard.html"
Write-Host "  Dolar/VIX/Bonos:   http://127.0.0.1:8770/dashboard.html"
Write-Host "  NAS100:            http://127.0.0.1:8780/dashboard.html"
