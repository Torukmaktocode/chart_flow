# Memoria del Proyecto - CODIGO PARA FOREX

## Arquitectura del Sistema

El sistema está compuesto por **4 dashboards** que trabajan juntos:

```
┌─────────────────────────────────────────────────────────┐
│                    SCRIPT MAESTRO                       │
│              scripts/start-all.ps1                      │
├─────────────────────────────────────────────────────────┤
│  Puerto 8765 │ Puerto 8770 │ Puerto 8780 │ Puerto 8790 │
│   STOCK      │   MACRO     │  CHARTFLOW  │  BACKTEST   │
└─────────────────────────────────────────────────────────┘
```

## Dashboards Individuales

### 1. Stock Dashboard (Acciones)
- **Puerto:** 8765
- **Carpeta:** `stock-dashboard/`
- **Inicio:** `node server.js` en `stock-dashboard/`
- **URL:** http://127.0.0.1:8765/dashboard.html

### 2. Dollar/VIX/Bonds Dashboard (Macro)
- **Puerto:** 8770
- **Carpeta:** `dollar-vix-bonds-dashboard/`
- **Inicio:** `node server.js` en `dollar-vix-bonds-dashboard/`
- **URL:** http://127.0.0.1:8770/dashboard.html

### 3. Chartflow (Multi-instrumento: NAS100, BTC, XAUUSD, etc.)
- **Puerto:** 8780
- **Carpeta:** `chartflow/`
- **Inicio:** `node server.js` en `chartflow/`
- **URL:** http://127.0.0.1:8780/dashboard.html
- **Nota:** Usa TradingView WebSocket + Yahoo Finance

### 4. Chartflow Backtest
- **Puerto:** 8790
- **Carpeta:** `chartflow-backtest/`
- **Inicio:** `node server.js` en `chartflow-backtest/`
- **URL:** http://127.0.0.1:8790/dashboard.html
- **Dependencia:** Necesita Chartflow (8780) corriendo

---

## CÓMO INICIAR TODO JUNTO

### Opción 1: Script PowerShell (RECOMENDADO)
```powershell
.\scripts\start-all.ps1
```

### Opción 2: Desde el código
```powershell
cd "C:\Users\joseh\OneDrive\Documentos\CODIGO PARA FOREX"
.\scripts\start-all.ps1
```

---

## CÓMO DETENER TODO
```powershell
.\scripts\stop-all.ps1
```

---

## Puertos Asignados
| Servicio | Puerto |
|----------|--------|
| Stock Dashboard | 8765 |
| Dollar/VIX/Bonds | 8770 |
| Chartflow | 8780 |
| Backtest | 8790 |

---

## BACKTEST - Correciones Aplicadas

### Bugs Corregidos
1. **SL contaba como TP:** Se corrigió con Set para evitar duplicados
2. **Órdenes PENDING:** Ahora se cancelan correctamente
3. **Líneas SL/TP:** Se dibujan para órdenes PENDING

### Nuevas Funcionalidades
1. **Exportación a Excel:** Botón "📊 EXCEL" descarga reporte completo
2. **Dashboard de Progreso:** Botón "📈 MI PROGRESO"
3. **Calendario de Hábitos:** Basado en FECHA ACTUAL REAL
4. **Checklist de Hábitos:** 5 hábitos diarios con streak
5. **Estadísticas:** Win Rate, P&L, Profit Factor, etc.

---

## Notas Importantes
- **NUNCA** iniciar solo un dashboard, siempre iniciar TODOS con `start-all.ps1`
- Chartflow es el dashboard principal con múltiples instrumentos
- Backtest depende de Chartflow para funcionar
- Todos los servidores corren en background (WindowStyle Hidden)
- El calendario de hábitos usa la FECHA REAL del sistema, no la del backtesting
- Los hábitos se guardan en localStorage del navegador

---

## ARCHIVOS IMPORTANTES
- `chartflow-backtest/trade-records.json` - Trades guardados
- `chartflow-backtest/trade-records/trades.xlsx` - Excel exportado
- `chartflow-backtest/dashboard.html` - UI del backtest
- `chartflow-backtest/server.js` - Servidor del backtest


## Reglas de UX del Backtesting (requisitos del usuario - NO VIOLAR)

1. Al abrir el dashboard del backtesting se muestran las velas AUTOMATICAMENTE (sin pulsar INICIAR), en pausa.
2. Cambiar simbolo/timeframe SOLO carga las velas del activo elegido, en pausa (nunca auto-inicia el replay).
3. INICIAR es el unico disparador del replay; con velas ya en pantalla, INICIAR reanudara sin recargar datos (no borra trades/balance de la misma sesion).
4. stepBack debe revertir el estado real (balance/equity/trades) y los saltos procesan TODAS las velas intermedias con fills de SL/TP.
5. Persistir configuracion de backtest (simbolo/tf/rango/balance/riesgo/velocidad) en localStorage (bt_cfg).
