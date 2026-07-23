# 🎯 Sistema de Alertas NAS100 - Guía Rápida

## ✅ Estado del Sistema

| Componente | Estado | URL/Puerto |
|------------|--------|------------|
| Dashboard NAS100 | ✅ ACTIVO | http://127.0.0.1:8780/dashboard.html |
| Bot Telegram | ✅ ACTIVO | @TuBotUsername |
| Monitor de Alertas | ✅ ACTIVO | Ejecutándose en segundo plano |

---

## 📱 Cómo Crear Alertas

### Opción 1: Desde Telegram
Envía estos comandos a tu bot:

```
/alerta NAS100 21500 above    ← Alerta cuando suba de 21,500
/alerta BTC 100000 below     ← Alerta cuando baje de 100,000
/alerta XAUUSD 3500 above    ← Alerta cuando el oro suba de 3,500
```

### Opción 2: Desde el Dashboard
1. Abre http://127.0.0.1:8780/dashboard.html
2. Selecciona el activo
3. Haz clic en "Crear Alerta"
4. Configura precio y dirección

---

## 📋 Comandos de Telegram

| Comando | Descripción |
|---------|-------------|
| `/start` | Mensaje de bienvenida |
| `/precios` | Ver todos los precios |
| `/precio NAS100` | Precio de un activo específico |
| `/alerta SIMBOLO PRECIO [above\|below]` | Crear alerta |
| `/alertas` | Ver tus alertas activas |
| `/cancelar ID` | Eliminar una alerta |
| `/chart NAS100 1d` | Ver gráfico |
| `/grupo forex` | Ver grupo de activos |

---

## 🔔 Cómo Funcionan las Alertas

1. **Creas una alerta** con precio objetivo y dirección
2. **El monitor verifica** cada 30 segundos
3. **Cuando el precio llega** al objetivo, recibe notificación en Telegram
4. **La alerta se desactiva** automáticamente (a menos que active "repetir")

---

## 📊 Símbolos Disponibles

### Índices
- 🏛️ NAS100 (NASDAQ 100)
- 🏛️ US30 (Dow Jones)
- 🏛️ US500 (S&P 500)

### Crypto
- 🪙 BTC (Bitcoin)
- 🪙 ETHUSDT.P (Ethereum)
- 🪙 SOLUSDT.P (Solana)

### Forex
- 💱 EURUSD
- 💱 GBPUSD
- 💱 USDJPY
- 💱 USDCLP

### Macro
- 🥇 XAUUSD (Oro)
- 💵 DXY (Índice Dólar)
- 📉 VIX (Volatilidad)

---

## 🛠️ Archivos del Sistema

```
CODIGO PARA FOREX/
├── nas100-dashboard/
│   ├── server.js          ← Servidor principal
│   └── dashboard.html     ← Interfaz web
├── data/
│   ├── alerts.json        ← Alertas configuradas
│   └── telegram-config.json
├── telegram-bot.mjs       ← Bot de Telegram
├── alert-monitor.mjs      ← Monitoreo continuo
└── check-alerts.mjs       ← Verificación manual
```

---

## 🚀 Comandos Útiles

### Iniciar Sistema Completo
```powershell
# PowerShell
cd "C:\Users\joseh\OneDrive\Documentos\CODIGO PARA FOREX"
node alert-monitor.mjs
```

### Verificar Estado
```powershell
node test-full-system.mjs
```

### Enviar Prueba Manual
```powershell
node check-alerts.mjs
```

---

## 📝 Notas Importantes

1. **El monitor debe estar corriendo** para que las alertas funcionen
2. **Los precios se actualizan** cada 30 segundos
3. **Las alertas se guardan** en `data/alerts.json`
4. **Puedes crear alertas** desde Telegram o el Dashboard

---

## 🔧 Solución de Problemas

### Si no llegan las notificaciones:
1. Verificar que `alert-monitor.mjs` esté corriendo
2. Revisar token de Telegram en `data/telegram-config.json`
3. Ejecutar `node check-alerts.mjs` para prueba manual

### Si el dashboard no carga:
1. Verificar que el servidor esté en puerto 8780
2. Abrir http://127.0.0.1:8780/dashboard.html
3. Revisar consola del servidor para errores

---

**¡Sistema listo! Las alertas llegarán a tu Telegram automáticamente.** 🚀
