# 📊 Quant Free Dashboard - Sistema de Trading

Sistema completo de dashboards y herramientas de trading en tiempo real. 100% gratuito, sin API keys.

## 🎯 Dashboards Disponibles

| Dashboard | Puerto | URL | Descripción |
|-----------|--------|-----|-------------|
| **API Server** | 8787 | http://localhost:8787 | Backend Express + Yahoo Finance |
| **Stock Dashboard** | 8765 | http://localhost:8765/dashboard.html | Acciones tech (NVDA, AAPL, MSFT, etc.) |
| **Dollar/VIX/Bonds** | 8770 | http://localhost:8770/dashboard.html | DXY, VIX, Bonos del Tesoro |
| **ChartFlow NAS100** | 8780 | http://localhost:8780/dashboard.html | Estrategia NASDAQ-100 |
| **ChartFlow Backtest** | 8790 | http://localhost:8790 | Backtesting con datos históricos |
| **War Room** | 3001 | http://localhost:3001 | Noticias live, Squawk X, análisis NAS100 |

## 📁 Estructura del Proyecto

```
chart_flow/
├── server/                    # Backend API (Express)
│   ├── index.js               # Servidor principal (puerto 8787)
│   ├── alert-manager.mjs      # Gestión de alertas de precio
│   ├── price-monitor.mjs      # Monitoreo de precios cada 30s
│   ├── telegram-alerts.mjs    # Notificaciones Telegram
│   ├── free-data-server.mjs   # Servidor de datos gratuitos
│   ├── routes/alerts.mjs      # API REST de alertas
│   └── lib/utils.mjs          # Utilidades compartidas
├── stock-dashboard/           # Dashboard de acciones
├── dollar-vix-bonds-dashboard/ # Dashboard Macro
├── chartflow/                 # Dashboard NAS100 + estrategia
├── chartflow-backtest/        # Backtesting histórico
├── war room/                  # War Room - Noticias y Squawk
├── dashboards/                # Dashboards adicionales
├── scripts/                   # Scripts de utilidad
│   ├── start-unified.ps1      # Iniciar dashboards
│   ├── stop-unified.ps1       # Detener dashboards
│   ├── send-chart.py          # Enviar gráficos a Telegram
│   └── trading/               # Scripts de gráficos
├── data/                      # Datos persistidos (alertas, configs)
├── telegram-bot.mjs           # Bot de Telegram
├── chart-generator.mjs        # Generador de gráficos de velas
└── package.json
```

## 🚀 Instalación

### Prerrequisitos
- Node.js 18+
- npm

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/Torukmaktocode/chart_flow.git
   cd chart_flow
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno** (opcional)
   ```bash
   # Copiar .env.example a .env y configurar
   cp .env.example .env
   ```

4. **Iniciar todos los dashboards**
   ```bash
   .\scripts\start-unified.ps1
   ```

5. **O iniciar manualmente**
   ```bash
   # API Server
   npm run dev

   # Bot de Telegram
   npm run bot
   ```

## 🤖 Bot de Telegram

### Comandos Disponibles
- `/start` - Mensaje de bienvenida
- `/precios` - Ver precios de todos los símbolos
- `/precio NAS100` - Precio de un símbolo específico
- `/chart NAS100 1d` - Gráfico de un símbolo
- `/grupo forex` - Ver grupo de instrumentos
- `/alerta NAS100 21500 above` - Crear alerta de precio
- `/alertas` - Ver todas las alertas activas
- `/cancelar ID` - Eliminar una alerta
- `/help` - Ayuda

### 🔔 Sistema de Alertas

```
/alerta NAS100 21500 above    # Alerta cuando NAS100 suba de 21500
/alerta BTC 100000 below     # Alerta cuando BTC baje de 100000
/alerta XAUUSD 3500          # Alerta cuando Oro suba de 3500
```

### API REST para Alertas
```bash
# Obtener todas las alertas
curl http://localhost:8787/api/alerts

# Crear nueva alerta
curl -X POST http://localhost:8787/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"symbol":"NAS100","targetPrice":21500,"direction":"above"}'

# Eliminar alerta
curl -X DELETE http://localhost:8787/api/alerts/ID
```

### Símbolos Soportados
- **Índices**: NAS100, US30, US500
- **Crypto**: BTC, ETH, SOL
- **Forex**: EURUSD, GBPUSD, USDJPY, USDCLP
- **Macro**: XAUUSD (Oro), DXY, VIX

## 📰 War Room

Dashboard de noticias en tiempo real con análisis de impacto en NAS100.

### Fuentes de Noticias (22 feeds RSS gratuitos)
- Reuters, AP News, MarketWatch, CNBC
- Yahoo Finance, Bloomberg, Barron's
- Federal Reserve (comunicados y discursos)
- Truth Social (posts de Trump)

### ⚡ Squawk X
Cuentas de trading en tiempo real:
- @DeItaone (Walter Bloomberg)
- @FirstSquawk
- @LiveSquawk

### Funcionalidades
- Análisis de impacto NAS100 (alcista/bajista/neutro)
- Categorías: Trump, Fed, Tech, Mercados
- Traducción automática al español
- Tema dark profesional

## 📈 Backtesting

El módulo de backtesting permite:
- Probar estrategias de trading
- Analizar rendimiento histórico
- Optimizar parámetros
- Replay de velas históricas

## 🛠️ Scripts de Utilidad

```bash
# Iniciar/detener dashboards
.\scripts\start-unified.ps1
.\scripts\stop-unified.ps1

# Enviar gráfico a Telegram
python scripts/send-chart.py BTC 15m
python scripts/send-chart.py NAS100 1d

# Obtener tipos de cambio
python scripts/fetch_rates.py
```

## 🔧 Configuración

### Variables de Entorno
```bash
# Telegram Bot (opcional)
TELEGRAM_BOT_TOKEN=tu-token
TELEGRAM_CHAT_ID=tu-chat-id

# APIs de Datos (opcionales)
POLYGON_API_KEY=tu-api-key
FINNHUB_TOKEN=tu-token
```

### Puertos
| Puerto | Servicio |
|--------|----------|
| 8787 | API Server (Express) |
| 8765 | Stock Dashboard |
| 8770 | Dollar/VIX/Bonds |
| 8780 | ChartFlow NAS100 |
| 8790 | ChartFlow Backtest |
| 3001 | War Room |

## 🐛 Solución de Problemas

### "Puerto ya en uso"
```bash
.\scripts\stop-unified.ps1
```

### "Token de Telegram no definido"
```bash
$env:TELEGRAM_BOT_TOKEN="tu-token"
```

### "Error de dependencias"
```bash
Remove-Item -Recurse -Force node_modules
npm install
```

## 📝 Licencia

Proyecto privado - Uso personal

---

**Última actualización**: Agosto 2026
