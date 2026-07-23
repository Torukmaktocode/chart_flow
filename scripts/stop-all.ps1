$ErrorActionPreference = "SilentlyContinue"

foreach ($port in 8765, 8770, 8780) {
    $existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess
    foreach ($pidValue in $existing) {
        try { Stop-Process -Id $pidValue -Force } catch {}
    }
}

Write-Host "Dashboards detenidos." -ForegroundColor Cyan
