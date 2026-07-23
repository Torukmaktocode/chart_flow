// Script de prueba para enviar un mensaje de alerta por Telegram
// Ejecutar con: node test-telegram-alert.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leer configuración de Telegram desde localStorage (simulado)
// En el navegador, esto viene del panel de configuración
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// Si no hay token en variables de entorno, intentar leer de un archivo de configuración
let config = { botToken: BOT_TOKEN, chatId: CHAT_ID };

try {
  const configPath = path.join(__dirname, 'data', 'telegram-config.json');
  if (fs.existsSync(configPath)) {
    const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.botToken = config.botToken || savedConfig.botToken;
    config.chatId = config.chatId || savedConfig.chatId;
  }
} catch (error) {
  console.log("No se encontró archivo de configuración");
}

// Función para enviar mensaje por Telegram
async function sendTelegramMessage(message) {
  if (!config.botToken || !config.chatId) {
    console.log("❌ Configuración de Telegram no encontrada");
    console.log("   Opción 1: Define TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID como variables de entorno");
    console.log("   Opción 2: Crea el archivo data/telegram-config.json con botToken y chatId");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log("✅ Mensaje enviado exitosamente por Telegram");
      return true;
    } else {
      console.log("❌ Error enviando mensaje:", data.description);
      return false;
    }
  } catch (error) {
    console.log("❌ Error de conexión:", error.message);
    return false;
  }
}

// Mensaje de prueba
const testMessage = `
🔔 *PRUEBA DE ALERTA* 🔔
━━━━━━━━━━━━━━━━━━━━━

✅ Sistema de alertas funcionando

💰 *Precio de prueba:* $21,500.00
🎯 *Precio objetivo:* $21,500.00

📝 *Mensaje:* Esta es una prueba del sistema de alertas
⏰ *Hora:* ${new Date().toLocaleString('es-CL')}

━━━━━━━━━━━━━━━━━━━━━
🤖 Trading Alert System - Prueba
`.trim();

console.log("📱 Enviando prueba de alerta por Telegram...");
console.log("");

sendTelegramMessage(testMessage)
  .then(success => {
    if (success) {
      console.log("");
      console.log("✅ La alerta fue enviada correctamente");
      console.log("   Revisa tu Telegram para ver el mensaje");
    } else {
      console.log("");
      console.log("⚠️  No se pudo enviar la alerta");
      console.log("   Asegúrate de tener configurado:");
      console.log("   - TELEGRAM_BOT_TOKEN");
      console.log("   - TELEGRAM_CHAT_ID");
    }
  });