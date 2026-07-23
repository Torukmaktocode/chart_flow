import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) { console.error("❌ Define TELEGRAM_BOT_TOKEN en .env"); process.exit(1); }
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!CHAT_ID) { console.error("❌ Define TELEGRAM_CHAT_ID en .env"); process.exit(1); }
const ALERTS_FILE = path.join(__dirname, 'data', 'alerts.json');
const CHECK_INTERVAL = 30000; // 30 segundos

// Estado
let lastAlertsHash = '';
let monitoredSymbols = new Map();

// Precios de ejemplo (en producción se obtienen de la API)
const SAMPLE_PRICES = {
  NAS100: 21525.50,
  BTC: 108500.00,
  XAUUSD: 3285.75,
  EURUSD: 1.0842,
  US30: 42150.00,
};

// Enviar mensaje a Telegram
async function sendTelegramMessage(message) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
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
      console.log(`✅ Notificación enviada a Telegram`);
      return true;
    } else {
      console.error(`❌ Error de Telegram: ${data.description}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error enviando mensaje: ${error.message}`);
    return false;
  }
}

// Formatear mensaje de alerta
function formatAlertMessage(alert, currentPrice) {
  const direction = alert.direction === 'above' ? '📈 SUPERÓ' : '📉 BAJÓ DE';
  const emoji = alert.direction === 'above' ? '🟢' : '🔴';
  const timestamp = new Date().toLocaleString('es-CL');
  
  return `
🔔 *ALERTA DE PRECIO* 🔔
━━━━━━━━━━━━━━━━━━━━━━

${emoji} *${alert.symbol}* ${direction} *$${alert.targetPrice.toLocaleString('en-US')}*

💰 *Precio Actual:* $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
🎯 *Precio Objetivo:* $${alert.targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

📝 *Mensaje:* ${alert.message}
⏰ *Hora:* ${timestamp}

━━━━━━━━━━━━━━━━━━━━━━
🤖 Trading Alert System
  `.trim();
}

// Cargar alertas
function loadAlerts() {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      const data = fs.readFileSync(ALERTS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error cargando alertas:', error.message);
  }
  return [];
}

// Guardar alertas
function saveAlerts(alerts) {
  try {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
    return true;
  } catch (error) {
    console.error('Error guardando alertas:', error.message);
    return false;
  }
}

// Verificar si una alerta debe activarse
function shouldTrigger(alert, currentPrice) {
  if (!alert.active) return false;
  
  const { targetPrice, direction } = alert;
  
  if (direction === 'above') {
    return currentPrice >= targetPrice;
  } else {
    return currentPrice <= targetPrice;
  }
}

// Obtener precio actual (simulado - en producción usar API real)
function getCurrentPrice(symbol) {
  return SAMPLE_PRICES[symbol] || null;
}

// Verificar alertas
async function checkAlerts() {
  const alerts = loadAlerts();
  const activeAlerts = alerts.filter(a => a.active);
  
  if (activeAlerts.length === 0) {
    return;
  }
  
  console.log(`\n🔍 Verificando ${activeAlerts.length} alerta(s) activa(s)...`);
  
  for (const alert of activeAlerts) {
    const currentPrice = getCurrentPrice(alert.symbol);
    
    if (currentPrice === null) {
      console.log(`⚠️ No se pudo obtener precio para ${alert.symbol}`);
      continue;
    }
    
    console.log(`   ${alert.symbol}: $${currentPrice} (Objetivo: ${alert.direction === 'above' ? '≥' : '≤'} $${alert.targetPrice})`);
    
    if (shouldTrigger(alert, currentPrice)) {
      console.log(`\n🔔 ¡ALERTA ACTIVADA! ${alert.symbol} ${alert.direction === 'above' ? 'superó' : 'bajó de'} $${alert.targetPrice}`);
      
      // Enviar notificación
      const message = formatAlertMessage(alert, currentPrice);
      await sendTelegramMessage(message);
      
      // Marcar como activada
      alert.triggeredAt = new Date().toISOString();
      if (!alert.repeat) {
        alert.active = false;
      }
      
      // Guardar cambios
      saveAlerts(alerts);
    }
  }
}

// Crear alerta de prueba
function createTestAlert() {
  const alerts = loadAlerts();
  
  // Verificar si ya hay una alerta de prueba
  const existingTest = alerts.find(a => a.id === 'monitor-test');
  if (existingTest) {
    console.log('ℹ️ Ya existe una alerta de prueba');
    return;
  }
  
  // Crear alerta con precio cercano al actual para prueba rápida
  const testAlert = {
    id: 'monitor-test',
    symbol: 'NAS100',
    targetPrice: 21520.00, // Muy cerca del precio actual
    direction: 'above',
    message: 'Prueba del sistema de monitoreo continuo',
    chatId: CHAT_ID,
    active: true,
    createdAt: new Date().toISOString(),
    triggeredAt: null,
    repeat: false,
  };
  
  alerts.push(testAlert);
  saveAlerts(alerts);
  
  console.log('✅ Alerta de prueba creada:');
  console.log(`   ${testAlert.symbol} ${testAlert.direction === 'above' ? '📈' : '📉'} $${testAlert.targetPrice}`);
  console.log(`   Esta alerta se activará en el próximo ciclo de verificación`);
}

// Iniciar monitoreo
function startMonitoring() {
  console.log('\n' + '='.repeat(50));
  console.log('🔄 MONITOREO CONTINUO DE ALERTAS');
  console.log('='.repeat(50));
  console.log(`⏰ Intervalo: ${CHECK_INTERVAL/1000} segundos`);
  console.log(`🎯 Alertas activas: ${loadAlerts().filter(a => a.active).length}`);
  console.log('━'.repeat(50) + '\n');
  
  // Verificar inmediatamente
  checkAlerts();
  
  // Programar verificaciones periódicas
  setInterval(checkAlerts, CHECK_INTERVAL);
}

// Main
console.log('🚀 Iniciando sistema de monitoreo de alertas...\n');

// Crear alerta de prueba
createTestAlert();

// Iniciar monitoreo
startMonitoring();
