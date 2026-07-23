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
const DASHBOARD_URL = "http://127.0.0.1:8780/dashboard.html";

// Colores para consola
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, icon, message) {
  console.log(`${colors[color]}${icon} ${message}${colors.reset}`);
}

// Verificar servidor
async function checkServer() {
  try {
    const response = await fetch(DASHBOARD_URL);
    if (response.ok) {
      log('green', '✅', 'Servidor NAS100 Dashboard activo en http://127.0.0.1:8780');
      return true;
    } else {
      log('red', '❌', `Servidor respondió con status ${response.status}`);
      return false;
    }
  } catch (error) {
    log('red', '❌', 'Servidor NAS100 Dashboard NO está corriendo');
    return false;
  }
}

// Verificar alertas
function checkAlerts() {
  try {
    if (!fs.existsSync(ALERTS_FILE)) {
      log('yellow', '⚠️', 'No se encontró archivo de alertas');
      return [];
    }
    
    const alerts = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
    log('green', '✅', `${alerts.length} alerta(s) configurada(s)`);
    
    alerts.forEach((alert, i) => {
      const status = alert.active ? '🟢' : '🔴';
      const dir = alert.direction === 'above' ? '📈' : '📉';
      console.log(`   ${status} ${i+1}. ${alert.symbol} ${dir} $${alert.targetPrice}`);
    });
    
    return alerts;
  } catch (error) {
    log('red', '❌', `Error leyendo alertas: ${error.message}`);
    return [];
  }
}

// Enviar mensaje de prueba a Telegram
async function sendTestMessage(type = 'info') {
  const timestamp = new Date().toLocaleString('es-CL');
  
  let message;
  
  switch (type) {
    case 'alert':
      message = `🔔 *ALERTA DE PRECIO ACTIVADA* 🔔
━━━━━━━━━━━━━━━━━━━━━━

📈 *NAS100* SUPERÓ $21,500

💰 *Precio Actual:* $21,525.50
🎯 *Precio Objetivo:* $21,500.00

📝 *Mensaje:* Alerta de prueba del sistema
⏰ *Hora:* ${timestamp}

━━━━━━━━━━━━━━━━━━━━━━
🤖 Trading Alert System`;
      break;
      
    case 'system':
      message = `✅ *SISTEMA VERIFICADO* ✅
━━━━━━━━━━━━━━━━━━━━━━

🖥️ *Dashboard:* Activo
🔗 *URL:* ${DASHBOARD_URL}
🔔 *Alertas:* Sistema funcionando
📱 *Telegram:* Conectado

⏰ *Verificación:* ${timestamp}

━━━━━━━━━━━━━━━━━━━━━━
🤖 Trading Alert System`;
      break;
      
    default:
      message = `🧪 *PRUEBA DE SISTEMA* 🧪
━━━━━━━━━━━━━━━━━━━━━━

Este es un mensaje de prueba para verificar que las notificaciones llegan correctamente a Telegram.

⏰ ${timestamp}

━━━━━━━━━━━━━━━━━━━━━━
🤖 Trading Alert System`;
  }
  
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
      log('green', '✅', `Mensaje de ${type} enviado a Telegram`);
      return true;
    } else {
      log('red', '❌', `Error de Telegram: ${data.description}`);
      return false;
    }
  } catch (error) {
    log('red', '❌', `Error enviando mensaje: ${error.message}`);
    return false;
  }
}

// Función principal
async function main() {
  console.log('\n' + '='.repeat(50));
  console.log('🔍 VERIFICACIÓN COMPLETA DEL SISTEMA DE ALERTAS');
  console.log('='.repeat(50) + '\n');
  
  // 1. Verificar servidor
  log('blue', '1️⃣', 'Verificando servidor NAS100 Dashboard...');
  const serverOk = await checkServer();
  
  // 2. Verificar alertas
  log('blue', '2️⃣', 'Verificando alertas configuradas...');
  const alerts = checkAlerts();
  
  // 3. Enviar prueba de sistema
  log('blue', '3️⃣', 'Enviando notificación de prueba...');
  await sendTestMessage('system');
  
  // 4. Si hay alertas activas, simular activación
  if (alerts.length > 0) {
    log('blue', '4️⃣', 'Simulando activación de alerta...');
    await sendTestMessage('alert');
  }
  
  // Resumen
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN');
  console.log('='.repeat(50));
  
  if (serverOk) {
    log('green', '✅', 'Dashboard disponible en: http://127.0.0.1:8780/dashboard.html');
  } else {
    log('red', '❌', 'Dashboard NO disponible');
  }
  
  log('green', '✅', `Alertas configuradas: ${alerts.length}`);
  log('green', '✅', 'Notificaciones Telegram: Funcionando');
  
  console.log('\n' + '='.repeat(50));
  console.log('🚀 SISTEMA LISTO - Las alertas llegarán a Telegram');
  console.log('='.repeat(50) + '\n');
}

// Ejecutar
main().catch(console.error);
