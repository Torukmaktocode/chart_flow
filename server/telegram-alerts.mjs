import alertManager from './alert-manager.mjs';

// Configuración de Telegram (solo desde variables de entorno)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Enviar mensaje por Telegram
async function sendTelegramMessage(message, chatId = null) {
  if (!BOT_TOKEN) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN no configurado');
    return false;
  }
  
  const targetChatId = chatId || CHAT_ID;
  
  if (!targetChatId) {
    console.log('⚠️ TELEGRAM_CHAT_ID no configurado');
    return false;
  }
  
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Mensaje enviado por Telegram');
      return true;
    } else {
      console.error('❌ Error enviando mensaje:', data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Error en sendTelegramMessage:', error.message);
    return false;
  }
}

// Configurar listener de alertas para Telegram
function setupAlertNotifications() {
  alertManager.onAlert((alert, currentPrice, message) => {
    console.log(`📱 Enviando notificación por Telegram para ${alert.symbol}`);
    sendTelegramMessage(message, alert.chatId);
  });
  
  console.log('✅ Notificaciones de Telegram configuradas');
}

// Enviar mensaje de bienvenida
async function sendWelcomeMessage() {
  const message = `
🔔 *Sistema de Alertas Activado* 🔔
━━━━━━━━━━━━━━━━━━━━━

✅ Las notificaciones de precio están habilitadas

📋 *Comandos del Bot:*
• /alerta NAS100 21500 above - Alerta cuando suba
• /alerta BTC 100000 below - Alerta cuando baje
• /alertas - Ver todas las alertas
• /precio NAS100 - Ver precio actual
• /cancelar ID - Eliminar alerta

━━━━━━━━━━━━━━━━━━━━━
🤖 Trading Alert Bot
  `.trim();
  
  return sendTelegramMessage(message);
}

export {
  sendTelegramMessage,
  setupAlertNotifications,
  sendWelcomeMessage,
};