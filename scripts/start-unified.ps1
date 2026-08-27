# 🚀 Script de Inicio Unificado - Chart Flow
# Ejecutar desde la carpeta raíz del proyecto

$ErrorActionPreference = "Stop"

# Configuración
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $ROOT
$NODE = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $NODE)) { $NODE = "node" }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Chart Flow - Inicio Unificado" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Función para verificar si un puerto está en uso
function Test-Port($port) {
    try {
        $connection = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        return $connection -ne $null
    } catch {
        return $false
    }
}

# Función para detener procesos en un puerto
function Stop-PortProcess($port) {
    if (Test-Port $port) {
        Write-Host "Deteniendo proceso en puerto $port..." -ForegroundColor Yellow
        $existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess
        foreach ($pidValue in $existing) {
            try { 
                Stop-Process -Id $pidValue -Force 
                Write-Host "  Proceso $pidValue detenido" -ForegroundColor Green
            } catch {}
        }
    }
}

# Detener procesos existentes en los puertos
Write-Host "1. Limpiando puertos..." -ForegroundColor Magenta
foreach ($port in 8765, 8770, 8780, 8790, 3001) {
    Stop-PortProcess $port
}

Write-Host ""
Write-Host "2. Iniciando servicios..." -ForegroundColor Magenta

# Dashboard de Acciones (Puerto 8765)
Write-Host "  Iniciando Dashboard de Acciones (Puerto 8765)..." -ForegroundColor Yellow
$stockServer = Join-Path $PROJECT_ROOT "stock-dashboard\server.js"
$stockDir = Split-Path -Parent $stockServer
Start-Process -WindowStyle Hidden -WorkingDirectory $stockDir -FilePath $NODE -ArgumentList @("server.js")

# Dashboard Macro (Puerto 8770)
Write-Host "  Iniciando Dashboard Macro (Puerto 8770)..." -ForegroundColor Yellow
$macroServer = Join-Path $PROJECT_ROOT "dollar-vix-bonds-dashboard\server.js"
$macroDir = Split-Path -Parent $macroServer
Start-Process -WindowStyle Hidden -WorkingDirectory $macroDir -FilePath $NODE -ArgumentList @("server.js")

# Dashboard NAS100 (Puerto 8780)
Write-Host "  Iniciando Dashboard NAS100 (Puerto 8780)..." -ForegroundColor Yellow
$nasServer = Join-Path $PROJECT_ROOT "chartflow\server.js"
$nasDir = Split-Path -Parent $nasServer
Start-Process -WindowStyle Hidden -WorkingDirectory $nasDir -FilePath $NODE -ArgumentList @("server.js")

# ChartFlow Backtest (Puerto 8790)
Write-Host "  Iniciando ChartFlow Backtest (Puerto 8790)..." -ForegroundColor Yellow
$backtestServer = Join-Path $PROJECT_ROOT "chartflow-backtest\server.js"
$backtestDir = Split-Path -Parent $backtestServer
Start-Process -WindowStyle Hidden -WorkingDirectory $backtestDir -FilePath $NODE -ArgumentList @("server.js")

# War Room (Puerto 3001)
Write-Host "  Iniciando War Room (Puerto 3001)..." -ForegroundColor Yellow
$warroomServer = Join-Path $PROJECT_ROOT "war room\server.js"
$warroomDir = Split-Path -Parent $warroomServer
Start-Process -WindowStyle Hidden -WorkingDirectory $warroomDir -FilePath $NODE -ArgumentList @("server.js")

# Esperar a que los servicios estén listos
Write-Host ""
Write-Host "3. Esperando servicios..." -ForegroundColor Magenta
Start-Sleep -Seconds 2

# Verificar servicios
$services = @(
    @{Name="Dashboard Acciones"; Port=8765; Url="http://127.0.0.1:8765/dashboard.html"},
    @{Name="Dashboard Macro"; Port=8770; Url="http://127.0.0.1:8770/dashboard.html"},
    @{Name="Dashboard NAS100"; Port=8780; Url="http://127.0.0.1:8780/dashboard.html"},
    @{Name="ChartFlow Backtest"; Port=8790; Url="http://127.0.0.1:8790/dashboard.html"},
    @{Name="War Room"; Port=3001; Url="http://127.0.0.1:3001/"}
)

Write-Host ""
Write-Host "4. Verificando servicios..." -ForegroundColor Magenta
foreach ($service in $services) {
    if (Test-Port $service.Port) {
        Write-Host "  ✅ $($service.Name) - Puerto $($service.Port) - ACTIVO" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($service.Name) - Puerto $($service.Port) - INACTIVO" -ForegroundColor Red
    }
}

# Abrir navegadores
Write-Host ""
Write-Host "5. Abriendo navegadores..." -ForegroundColor Magenta
Start-Sleep -Milliseconds 500

foreach ($service in $services) {
    if (Test-Port $service.Port) {
        Start-Process $service.Url
        Write-Host "  🌐 Abriendo $($service.Name)..." -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ Todos los dashboards están activos" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URLs de acceso:" -ForegroundColor White
Write-Host "  • Dashboard Acciones: http://127.0.0.1:8765/dashboard.html" -ForegroundColor Yellow
Write-Host "  • Dashboard Macro:    http://127.0.0.1:8770/dashboard.html" -ForegroundColor Yellow
Write-Host "  • Dashboard NAS100:   http://127.0.0.1:8780/dashboard.html" -ForegroundColor Yellow
Write-Host "  • ChartFlow Backtest: http://127.0.0.1:8790/dashboard.html" -ForegroundColor Yellow
Write-Host "  • War Room:           http://127.0.0.1:3001/" -ForegroundColor Yellow
Write-Host ""
Write-Host "Para detener todos los servicios:" -ForegroundColor White
Write-Host "  .\scripts\stop-all.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Presiona Ctrl+C para salir..." -ForegroundColor Gray