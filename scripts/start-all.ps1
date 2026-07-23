$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $ROOT
$NODE = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $NODE)) { $NODE = "node" }

Write-Host "Deteniendo servidores anteriores..." -ForegroundColor Yellow

foreach ($port in 8765, 8770, 8780, 8790, 3001) {
    $existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess
    foreach ($pidValue in $existing) {
        try { Stop-Process -Id $pidValue -Force } catch {}
    }
}

Start-Sleep -Milliseconds 500

Write-Host "`nIniciando todos los dashboards..." -ForegroundColor Cyan

# Stock Dashboard (Acciones)
$stockDir = Join-Path $PROJECT_ROOT "stock-dashboard"
Start-Process -WindowStyle Hidden -WorkingDirectory $stockDir -FilePath $NODE -ArgumentList @("server.js")
Write-Host "  [+] Stock Dashboard (8765)" -ForegroundColor Green

# Dollar/VIX/Bonds Dashboard (Macro)
$macroDir = Join-Path $PROJECT_ROOT "dollar-vix-bonds-dashboard"
Start-Process -WindowStyle Hidden -WorkingDirectory $macroDir -FilePath $NODE -ArgumentList @("server.js")
Write-Host "  [+] Dollar/VIX/Bonds Dashboard (8770)" -ForegroundColor Green

# Chartflow (NAS100 + Multi-instrumento)
$chartflowDir = Join-Path $PROJECT_ROOT "chartflow"
Start-Process -WindowStyle Hidden -WorkingDirectory $chartflowDir -FilePath $NODE -ArgumentList @("server.js")
Write-Host "  [+] Chartflow Dashboard (8780)" -ForegroundColor Green

# Chartflow Backtest
$backtestDir = Join-Path $PROJECT_ROOT "chartflow-backtest"
Start-Process -WindowStyle Hidden -WorkingDirectory $backtestDir -FilePath $NODE -ArgumentList @("server.js")
Write-Host "  [+] Chartflow Backtest (8790)" -ForegroundColor Green

# Trading War Room
$warroomDir = Join-Path $PROJECT_ROOT "chartflow-backtest\warroom"
Start-Process -WindowStyle Hidden -WorkingDirectory $warroomDir -FilePath $NODE -ArgumentList @("server.js")
Write-Host "  [+] Trading War Room (3001)" -ForegroundColor Green

Start-Sleep -Seconds 2

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TODOS LOS DASHBOARDS ACTIVOS" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Acciones:          http://127.0.0.1:8765/dashboard.html" -ForegroundColor Yellow
Write-Host "  Dolar/VIX/Bonos:   http://127.0.0.1:8770/dashboard.html" -ForegroundColor Yellow
Write-Host "  Chartflow:         http://127.0.0.1:8780/dashboard.html" -ForegroundColor Yellow
Write-Host "  Backtest:          http://127.0.0.1:8790/dashboard.html" -ForegroundColor Yellow
Write-Host "  War Room:          http://127.0.0.1:3001/" -ForegroundColor Yellow
Write-Host ""

Start-Process "http://127.0.0.1:8765/dashboard.html"
Start-Process "http://127.0.0.1:8770/dashboard.html"
Start-Process "http://127.0.0.1:8780/dashboard.html"
Start-Process "http://127.0.0.1:8790/dashboard.html"
Start-Process "http://127.0.0.1:3001/"
