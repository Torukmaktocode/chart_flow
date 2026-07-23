# 📊 Quant Free Dashboard - Sistema de Trading

Sistema completo de dashboards y herramientas de trading en tiempo real.

## 🎯 Características Principales

- **Dashboard Principal**: Interfaz React con gráficos interactivos
- **Dashboard de Acciones**: Monitoreo de acciones tecnológicas (NVDA, AAPL, MSFT, etc.)
- **Dashboard NAS100**: Seguimiento del índice NASDAQ-100
- **Dashboard Macro**: Monitoreo del Dólar, VIX y Bonos
- **Bot de Telegram**: Alertas y consultas de precios en tiempo real
- **Generador de Gráficos**: Creación de gráficos de velas personalizados

## 📁 Estructura del Proyecto

```
CODIGO PARA FOREX/
├── src/                    # Código fuente React
│   ├── components/         # Componentes React
│   ├── utils/             # Utilidades y helpers
│   ├── main.jsx           # Punto de entrada principal
│   ├── backtesting.jsx    # Módulo de backtesting
│   └── styles.css         # Estilos globales
├── server/                # Servidor backend
│   ├── index.js           # Servidor principal Express
│   └── free-data-server.mjs # Servidor de datos gratuitos
├── stock-dashboard/       # Dashboard de acciones
├── nas100-dashboard/      # Dashboard NAS100
├── dollar-vix-bonds-dashboard/ # Dashboard Macro
├── scripts/               # Scripts de utilidad
│   ├── start-all.ps1      # Iniciar todos los dashboards
│   ├── stop-all.ps1       # Detener todos los dashboards
│   ├── fetch_rates.py     # Obtener tipos de cambio
│   └── trading/           # Scripts de trading
├── assets/                # Recursos estáticos
│   ├── screenshots/       # Capturas de pantalla
│   └── charts/           # Gráficos generados
├── docs/                  # Documentación
├── telegram-bot.mjs       # Bot de Telegram
├── chart-generator.mjs    # Generador de gráficos
├── package.json           # Configuración del proyecto
└── opencode.json          # Configuración de OpenCode
```

## 🚀 Instalación

### Prerrequisitos
- Node.js 18+ 
- npm o yarn
- Python 3.8+ (para scripts auxiliares)

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd "CODIGO PARA FOREX"
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   # Para el bot de Telegram (opcional)
   export TELEGRAM_BOT_TOKEN="tu-token-aqui"
   export TELEGRAM_CHAT_ID="tu-chat-id"
   
   # Para datos de Polygon (opcional)
   export POLYGON_API_KEY="tu-api-key"
   ```

4. **Iniciar el sistema completo**
   ```bash
   # Windows
   .\scripts\start-all.ps1
   
   # O manualmente
   npm run dev
   ```

## 📊 Dashboards Disponibles

### 1. Dashboard Principal (Puerto 5173)
- **URL**: http://localhost:5173
- **Tecnología**: React + Vite
- **Características**: 
  - Gráficos interactivos
  - Datos en tiempo real
  - Responsive design

### 2. Dashboard de Acciones (Puerto 8765)
- **URL**: http://localhost:8765/dashboard.html
- **Acciones monitoreadas**: NVDA, AAPL, MSFT, AMZN, GOOGL, META, TSLA
- **Datos**: Precios en tiempo real via Finnhub

### 3. Dashboard NAS100 (Puerto 8780)
- **URL**: http://localhost:8780/dashboard.html
- **Características**:
  - Datos de NASDAQ-100
  - Estrategia de trading incluida
  - Gráficos en tiempo real

### 4. Dashboard Macro (Puerto 8770)
- **URL**: http://localhost:8770/dashboard.html
- **Instrumentos**: DXY (Índice Dólar), VIX, Bonos del Tesoro

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

El sistema de alertas te notifica por Telegram cuando un precio alcanza un nivel específico.

#### Crear Alertas
```
/alerta NAS100 21500 above    # Alerta cuando NAS100 suba de 21500
/alerta BTC 100000 below     # Alerta cuando BTC baje de 100000
/alerta XAUUSD 3500          # Alerta cuando Oro suba de 3500
```

#### Gestionar Alertas
```
/alertas                      # Ver todas tus alertas
/cancelar ID                  # Eliminar una alerta específica
```

#### API REST para Alertas
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

## 🛠️ Scripts de Utilidad

### Iniciar/Detener Dashboards
```bash
# Iniciar todos los dashboards
.\scripts\start-all.ps1

# Detener todos los dashboards
.\scripts\stop-all.ps1
```

### Obtener Tipos de Cambio
```bash
python .\scripts\fetch_rates.py
```

### Generar Gráficos de Trading
```bash
# Gráfico BTC 15 minutos
python .\scripts\trading\btc_15m_chart.py

# Gráfico NAS100
python .\scripts\trading\nas100_chart.py
```

## 📦 Dependencias Principales

### Frontend
- React 19
- Vite 6
- Lucide React (iconos)

### Backend
- Express 4
- Yahoo Finance 2
- Node Telegram Bot API

### Utilidades
- Canvas (generación de gráficos)
- Concurrently (ejecución paralela)

## 🔧 Configuración

### Variables de Entorno
```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=tu-token
TELEGRAM_CHAT_ID=tu-chat-id

# APIs de Datos
POLYGON_API_KEY=tu-api-key
FINNHUB_TOKEN=tu-token (incluido en dashboard de acciones)
```

### Puertos
- **5173**: Dashboard principal (Vite)
- **8765**: Dashboard de acciones
- **8770**: Dashboard macro
- **8780**: Dashboard NAS100

## 📈 Funcionalidades Avanzadas

### Backtesting
El módulo de backtesting permite:
- Probar estrategias de trading
- Analizar rendimiento histórico
- Optimizar parámetros

### Gráficos Personalizados
- Múltiples timeframes (1m, 5m, 15m, 1h, 4h, 1d)
- Diseño profesional con tema oscuro
- Volumen integrado
- Indicadores de cambios

## 🐛 Solución de Problemas

### Errores Comunes

1. **"Puerto ya en uso"**
   ```bash
   # Detener todos los servicios
   .\scripts\stop-all.ps1
   ```

2. **"Token de Telegram no definido"**
   ```bash
   # Configurar variable de entorno
   $env:TELEGRAM_BOT_TOKEN="tu-token"
   ```

3. **"Error de dependencias"**
   ```bash
   # Reinstalar dependencias
   rm -rf node_modules
   npm install
   ```

## 📝 Licencia

Proyecto privado - Uso personal

## 👨‍💻 Autor

Desarrollado para trading y análisis de mercados financieros

---

**Última actualización**: Junio 2026