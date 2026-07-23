import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) { console.error("❌ Define TELEGRAM_BOT_TOKEN en .env"); process.exit(1); }

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!CHAT_ID) { console.error("❌ Define TELEGRAM_CHAT_ID en .env"); process.exit(1); }
const ALERTS_FILE = path.join(__dirname, 'data', 'alerts.json');
const CHECK_INTERVAL = 30000; // 30 segundos

console.log('🔔 MONITOR DE ALERTAS - PRECIOS REALES');
console.log('='.repeat(50));

// ============================================
// 📊 SÍMBOLOS Y YAHOO FINANCE
// ============================================
const SYMBOLS_YAHOO = {
  'BTC': 'BTC-USD',
  'ETH': 'ETH-USD',
  'SOL': 'SOL-USD',
  'NAS100': '^NDX',
  'US30': '^DJI',
  'US500': '^GSPC',
  'XAUUSD': 'GC=F',
  'EURUSD': 'EURUSD=X',
  'DXY': 'DX-Y.NYB',
  'VIX': '^VIX',
};

// Cache de precios
const priceCache = new Map();
const CACHE_TTL = 30000;

// ============================================
// 📈 OBTENER PRECIO REAL
// ============================================
async function getRealPrice(symbol) {
  const now = Date.now();
  const cached = priceCache.get(symbol);
  if (cached && (now - cached.time) < CACHE_TTL) {
    return cached.price;
  }
  
  const yahooSymbol = SYMBOLS_YAHOO[symbol];
  if (!yahooSymbol) return null;
  
  try {
    // Usar el servidor NAS100 que ya tiene los precios
    const response = await fetch(`http://127.0.0.1:8780/api/chart?tf=1D&symbol=${symbol}&count=5`);
    const data = await response.json();
    
    if (data.candles && data.candles.length > 0) {
      const lastCandle = data.candles[data.candles.length - 1];
      const price = lastCandle.c;
      
      priceCache.set(symbol, { price, time: now });
      console.log(`📊 ${symbol}: $${price}`);
      
      return price;
    }
  } catch (error) {
    console.error(`Error obteniendo precio de ${symbol}:`, error.message);
  }
  
  return null;
}

// ============================================
// 📱 ENVIAR TELEGRAM
// ============================================
async function sendTelegramMessage(message) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
    
    const data = await response.json();
    if (data.ok) {
      console.log('✅ Notificación enviada a Telegram');
      return true;
    } else {
      console.error('❌ Error Telegram:', data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Error enviando:', error.message);
    return false;
  }
}

// ============================================
// 🔔 FORMATEAR MENSAJE DE ALERTA
// ============================================
function formatAlertMessage(alert, currentPrice) {
  const direction = alert.operator === 'cross_up' ? '📈 SUPERÓ' : '📉 BAJÓ DE';
  const emoji = alert.operator === 'cross_up' ? '🟢' : '🔴';
  const timestamp = new Date().toLocaleString('es-CL');
  
  return `🔔 *ALERTA DE PRECIO* 🔔
━━━━━━━━━━━━━━━━━━━━━━

${emoji} *${alert.symbol}* ${direction} *$${alert.value.toLocaleString('en-US')}*

💰 *Precio Actual:* $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
🎯 *Precio Objetivo:* $${alert.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

📝 *Mensaje:* ${alert.message || 'Alerta de precio'}
⏰ *Hora:* ${timestamp}

━━━━━━━━━━━━━━━━━━━━━━
🤖 Trading Alert System`;
}

// ============================================
// 🔍 CARGAR Y VERIFICAR ALERTAS
// ============================================
function loadAlerts() {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error cargando alertas:', error.message);
  }
  return [];
}

function saveAlerts(alerts) {
  try {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
    return true;
  } catch (error) {
    console.error('Error guardando alertas:', error.message);
    return false;
  }
}

// Convertir formato del dashboard al formato del monitor
function convertDashboardAlert(alert) {
  return {
    ...alert,
    targetPrice: alert.value,
    direction: alert.operator === 'cross_up' ? 'above' : 'below',
  };
}

async function checkAlerts() {
  const rawAlerts = loadAlerts();
  const alerts = rawAlerts.map(convertDashboardAlert);
  const activeAlerts = alerts.filter(a => a.active !== false);
  
  if (activeAlerts.length === 0) {
    return;
  }
  
  console.log(`\n🔍 Verificando ${activeAlerts.length} alerta(s) activa(s)...`);
  
  for (const alert of activeAlerts) {
    const currentPrice = await getRealPrice(alert.symbol);
    
    if (currentPrice === null) {
      console.log(`⚠️ No se pudo obtener precio para ${alert.symbol}`);
      continue;
    }
    
    const shouldTrigger = alert.direction === 'above' 
      ? currentPrice >= alert.targetPrice 
      : currentPrice <= alert.targetPrice;
    
    console.log(`   ${alert.symbol}: $${currentPrice} (Objetivo: ${alert.direction === 'above' ? '≥' : '≤'} $${alert.targetPrice})`);
    
    if (shouldTrigger) {
      console.log(`\n🔔 ¡ALERTA ACTIVADA! ${alert.symbol}`);
      
      // Enviar notificación
      const message = formatAlertMessage(alert, currentPrice);
      await sendTelegramMessage(message);
      
      // Marcar como activada
      const originalAlerts = loadAlerts();
      const index = originalAlerts.findIndex(a => a.id === alert.id);
      if (index !== -1) {
        originalAlerts[index].active = false;
        originalAlerts[index].triggeredAt = new Date().toISOString();
        saveAlerts(originalAlerts);
      }
    }
  }
}

// ============================================
// 🚀 INICIAR MONITOR
// ============================================
console.log(`⏰ Intervalo: ${CHECK_INTERVAL/1000} segundos`);
console.log('━'.repeat(50) + '\n');

// Verificar inmediatamente
checkAlerts();

// Programar verificaciones
setInterval(checkAlerts, CHECK_INTERVAL);

console.log('✅ Monitor iniciado...\n');
