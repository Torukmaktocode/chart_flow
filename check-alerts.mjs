import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de Telegram
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) { console.error("❌ Define TELEGRAM_BOT_TOKEN en .env"); process.exit(1); }

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!CHAT_ID) { console.error("❌ Define TELEGRAM_CHAT_ID en .env"); process.exit(1); }
// Ruta al archivo de alertas del dashboard
const ALERTS_FILE = path.join(__dirname, 'nas100-dashboard', 'alerts.json');

// Función para enviar mensaje por Telegram
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
      console.log("✅ Mensaje enviado por Telegram");
      return true;
    } else {
      console.error("❌ Error de Telegram:", data.description);
      return false;
    }
  } catch (error) {
    console.error("❌ Error enviando mensaje:", error.message);
    return false;
  }
}

// Función para verificar alertas
function checkAlerts() {
  try {
    if (!fs.existsSync(ALERTS_FILE)) {
      console.log("No se encontró archivo de alertas");
      return;
    }
    
    const alertsData = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
    console.log(`📊 Alertas encontradas: ${alertsData.length}`);
    
    // Aquí iría la lógica para verificar los precios y activar alertas
    // Por ahora solo mostramos las alertas
    alertsData.forEach(alert => {
      console.log(`- ${alert.symbol} ${alert.operator} ${alert.value} (Activa: ${alert.active})`);
    });
    
  } catch (error) {
    console.error("Error leyendo alertas:", error.message);
  }
}

// Enviar mensaje de prueba
async function sendTestMessage() {
  const message = `🔔 *SISTEMA DE ALERTAS ACTIVO* ✅

El sistema de alertas está configurado y listo.

💰 *Symbol:* NAS100
🎯 *Precio Objetivo:* $21,500.00
📝 *Estado:* Monitoreando...

⏰ ${new Date().toLocaleString('es-CL')}

━━━━━━━━━━━━━━━━━━━━━
🤖 Trading Alert System`;

  await sendTelegramMessage(message);
}

// Ejecutar prueba
console.log("🔍 Verificando sistema de alertas...");
checkAlerts();
console.log("\n📱 Enviando mensaje de prueba...");
sendTestMessage();