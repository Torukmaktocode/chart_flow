# 🛑 Script de Parada Unificado - Quant Free Dashboard
# Ejecutar desde la carpeta raíz del proyecto

$ErrorActionPreference = "SilentlyContinue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Quant Free Dashboard - Parada Unificada" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Puertos a detener
$ports = @(
    @{Port=8765; Name="Dashboard Acciones"},
    @{Port=8770; Name="Dashboard Macro"},
    @{Port=8780; Name="Dashboard NAS100"}
)

Write-Host "Deteniendo servicios..." -ForegroundColor Yellow
Write-Host ""

foreach ($service in $ports) {
    try {
        $existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $service.Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess
        
        if ($existing) {
            foreach ($pidValue in $existing) {
                try { 
                    Stop-Process -Id $pidValue -Force 
                    Write-Host "  ✅ $($service.Name) (Puerto $($service.Port)) - Detenido" -ForegroundColor Green
                } catch {
                    Write-Host "  ⚠️ $($service.Name) (Puerto $($service.Port)) - Error al detener" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "  ℹ️ $($service.Name) (Puerto $($service.Port)) - No estaba ejecutándose" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  ❌ $($service.Name) (Puerto $($service.Port)) - Error" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ Todos los servicios han sido detenidos" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""