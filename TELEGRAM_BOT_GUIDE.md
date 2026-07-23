# Guía del Bot de Telegram — Mercados

## Requisitos

1. Obtén un token de [@BotFather](https://t.me/BotFather) en Telegram
2. Define la variable de entorno `TELEGRAM_BOT_TOKEN`
3. (Opcional) Define `TELEGRAM_CHAT_ID` para recibir mensaje al iniciar

## Inicio

```bash
set TELEGRAM_BOT_TOKEN=tu_token_aqui
node telegram-bot.mjs
```

O desde package.json:

```bash
npm run bot
```

## Comandos

| Comando | Descripción |
|---------|-------------|
| `/start` | Mensaje de bienvenida |
| `/precios` | Precios de todos los símbolos agrupados |
| `/precio NAS100` | Precio detallado + gráfico diario |
| `/chart NAS100 1d` | Solo gráfico (timeframes: 1d, 4h, 1h, 15m, 5d, 1w) |
| `/grupo forex` | Símbolos de un grupo (indices, forex, crypto, macro) |
| `/help` | Lista de comandos |

## Símbolos disponibles

| Símbolo | Yahoo Finance | Grupo |
|---------|---------------|-------|
| NAS100 | ^NDX | 🏛️ Índices |
| US30 | ^DJI | 🏛️ Índices |
| US500 | ^GSPC | 🏛️ Índices |
| BTC | BTC-USD | 🪙 Crypto |
| ETHUSDT_P | ETH-USD | 🪙 Crypto |
| SOLUSDT_P | SOL-USD | 🪙 Crypto |
| EURUSD | EURUSD=X | 💱 Forex |
| GBPUSD | GBPUSD=X | 💱 Forex |
| USDJPY | USDJPY=X | 💱 Forex |
| USDCLP | USDCLP=X | 💱 Forex |
| XAUUSD | GC=F | 🥇 Macro |
| DXY | DX-Y.NYB | 💵 Macro |
| VIX | ^VIX | 📉 Macro |

## Diseño del mensaje

```
📊 PANEL DE MERCADOS
📅 28 jun 2026 — 14:30 UTC

🏛️ Índices
  ▫️ NAS100   →  29.514,25  🟢 +0,50%
  ▫️ US30     →  52.351,00  🟢 +0,27%
  ▫️ US500    →   7.439,25  🟢 +0,51%

💱 Forex
  ▫️ EURUSD   →     1,1392  🟢 +0,27%
  ▫️ DXY      →   101,32    🔴 -0,03%

...

━━━━━━━━━━━━━━━━━━━━━━
🤖 Bot de Mercados · /precios para actualizar
```

## Símbolo individual

```
🥇 XAUUSD — Macro
━━━━━━━━━━━━━━━━
Precio:  4.079,60
Cambio:  🟢 +0,90 (+0,02%)
Máx:     4.082,30
Mín:     4.075,10
Vol:     12.456
Fuente:  🟢 Mercado abierto
```
