import TelegramBot from 'node-telegram-bot-api';
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

console.log('🚀 BOT INTEGRADO CON GESTIÓN DE ALERTAS');
console.log('='.repeat(50));

// Cargar alertas
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

// Crear nueva alerta
function createAlert(symbol, targetPrice, direction = 'above', message = '') {
  const alerts = loadAlerts();
  
  const newAlert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    symbol: symbol.toUpperCase(),
    targetPrice: parseFloat(targetPrice),
    direction: direction.toLowerCase(),
    message: message || `Alerta creada desde Telegram - ${symbol} ${direction === 'above' ? 'supera' : 'baja de'} $${targetPrice}`,
    chatId: CHAT_ID,
    active: true,
    createdAt: new Date().toISOString(),
    triggeredAt: null,
    repeat: false
  };
  
  alerts.push(newAlert);
  saveAlerts(alerts);
  
  console.log(`✅ Alerta creada: ${newAlert.symbol} ${newAlert.direction === 'above' ? '📈' : '📉'} $${newAlert.targetPrice}`);
  
  return newAlert;
}

// Eliminar alerta
function deleteAlert(alertId) {
  const alerts = loadAlerts();
  const index = alerts.findIndex(a => a.id === alertId);
  
  if (index !== -1) {
    const deleted = alerts.splice(index, 1)[0];
    saveAlerts(alerts);
    console.log(`🗑️ Alerta eliminada: ${deleted.symbol}`);
    return deleted;
  }
  
  return null;
}

// Listar alertas activas
function getActiveAlerts() {
  return loadAlerts().filter(a => a.active);
}

// Crear bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Verificar conexión
bot.getMe().then(info => {
  console.log(`✅ Bot conectado: @${info.username}`);
  console.log(`📊 Chat ID configurado: ${CHAT_ID}`);
  console.log('\n💬 Comandos disponibles:');
  console.log('   /alerta SIMBOLO PRECIO [above|below]');
  console.log('   /alertas - Ver todas las alertas');
  console.log('   /cancelar ID - Eliminar alerta');
  console.log('   /test - Probar conexión');
  console.log('   /help - Ver ayuda');
  console.log('='.repeat(50) + '\n');
});

// Comando /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from?.first_name || 'Usuario';
  
  console.log(`📩 /start de ${userName}`);
  
  await bot.sendMessage(chatId,
    `🤖 *¡Hola ${userName}!*

Soy tu *Bot de Alertas de Trading* 📈

📝 *Cómo crear alertas:*
/alerta BTC 59800 above  → Alerta cuando BTC suba de $59,800
/alerta NAS100 21000 below → Alerta cuando NAS100 baje de $21,000

📋 *Otros comandos:*
• /alertas - Ver tus alertas activas
• /cancelar ID - Eliminar una alerta
• /test - Probar conexión
• /help - Ver ayuda completa

¡Empieza creando tu primera alerta! 🚀`,
    { parse_mode: 'Markdown' }
  );
});

// Comando /alerta - Crear nueva alerta
bot.onText(/\/alerta (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);
  
  console.log(`📩 /alerta ${match[1]}`);
  
  if (args.length < 2) {
    await bot.sendMessage(chatId,
      `❌ *Formato incorrecto*

📝 *Uso:*
/alerta SIMBOLO PRECIO [above|below]

📋 *Ejemplos:*
• /alerta BTC 59800 above
• /alerta NAS100 21000 below
• /alerta XAUUSD 3500

*above* = cuando suba de ese precio
*below* = cuando baje de ese precio`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const symbol = args[0].toUpperCase();
  const targetPrice = parseFloat(args[1]);
  const direction = args[2]?.toLowerCase() || 'above';
  
  // Validar precio
  if (isNaN(targetPrice) || targetPrice <= 0) {
    await bot.sendMessage(chatId,
      `❌ *Precio inválido*

El precio debe ser un número mayor a 0.
Ejemplo: /alerta BTC 59800 above`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Validar dirección
  if (!['above', 'below'].includes(direction)) {
    await bot.sendMessage(chatId,
      `❌ *Dirección inválida*

Usa: *above* (cuando suba) o *below* (cuando baje)
Ejemplo: /alerta BTC 59800 above`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Crear alerta
  const newAlert = createAlert(symbol, targetPrice, direction);
  
  // Confirmar al usuario
  const directionEmoji = direction === 'above' ? '📈' : '📉';
  const directionText = direction === 'above' ? 'supere' : 'baje de';
  
  await bot.sendMessage(chatId,
    `✅ *¡Alerta Creada!*

${directionEmoji} *${symbol}* ${directionText} *$${targetPrice.toLocaleString('en-US')}*

📋 *ID:* \`${newAlert.id}\`
⏰ *Creada:* ${new Date().toLocaleString('es-CL')}

Cuando el precio llegue a este nivel, recibirás una notificación.

Ver tus alertas: /alertas`,
    { parse_mode: 'Markdown' }
  );
});

// Comando /alertas - Ver todas las alertas
bot.onText(/\/alertas$/, async (msg) => {
  const chatId = msg.chat.id;
  
  console.log(`📩 /alertas`);
  
  const alerts = loadAlerts();
  const activeAlerts = alerts.filter(a => a.active);
  
  if (activeAlerts.length === 0) {
    await bot.sendMessage(chatId,
      `📋 *No tienes alertas activas*

Crea una con:
/alerta BTC 59800 above`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const lines = [`📋 *Tus Alertas Activas (${activeAlerts.length})*\n`];
  
  activeAlerts.forEach((alert, i) => {
    const direction = alert.direction === 'above' ? '📈' : '📉';
    const dirText = alert.direction === 'above' ? 'supere' : 'baje de';
    
    lines.push(`${i + 1}. *${alert.symbol}*`);
    lines.push(`   ${direction} ${dirText} $${alert.targetPrice.toLocaleString('en-US')}`);
    lines.push(`   ID: \`${alert.id}\``);
    lines.push('');
  });
  
  lines.push('━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('Usa /cancelar ID para eliminar');
  
  await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
});

// Comando /cancelar - Eliminar alerta
bot.onText(/\/cancelar (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const alertId = match[1].trim();
  
  console.log(`📩 /cancelar ${alertId}`);
  
  const deleted = deleteAlert(alertId);
  
  if (!deleted) {
    await bot.sendMessage(chatId,
      `❌ *Alerta no encontrada*

Usa /alertas para ver tus alertas.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  await bot.sendMessage(chatId,
    `✅ *Alerta Eliminada*

${deleted.symbol} $${deleted.targetPrice.toLocaleString('en-US')}`,
    { parse_mode: 'Markdown' }
  );
});

// Comando /test
bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from?.first_name || 'Usuario';
  
  console.log(`📩 /test de ${userName}`);
  
  await bot.sendMessage(chatId,
    `✅ *¡Bot Funcionando!*

Hola ${userName}, este es un mensaje de prueba.

⏰ ${new Date().toLocaleString('es-CL')}

El bot está conectado y listo para recibir alertas.`,
    { parse_mode: 'Markdown' }
  );
});

// Comando /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  console.log(`📩 /help`);
  
  await bot.sendMessage(chatId,
    `📖 *AYUDA COMPLETA*

🔔 *Crear Alertas:*
/alerta SIMBOLO PRECIO [above|below]

📋 *Ejemplos:*
• /alerta BTC 59800 above
• /alerta NAS100 21000 below
• /alerta XAUUSD 3500 above
• /alerta EURUSD 1.10 below

📋 *Ver Alertas:*
/alertas

🗑️ *Eliminar Alerta:*
/cancelar ID

🧪 *Probar Bot:*
/test

💡 *Notas:*
• *above* = alerta cuando el precio SUBA
• *below* = alerta cuando el precio BAJE
• El ID aparece al crear la alerta`,
    { parse_mode: 'Markdown' }
  );
});

// Manejar mensajes de texto (no comandos)
bot.on('message', async (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    const chatId = msg.chat.id;
    const userName = msg.from?.first_name || 'Usuario';
    const message = msg.text;
    
    console.log(`📩 Mensaje de ${userName}: "${message}"`);
    
    // Intentar parsear como alerta
    const alertMatch = message.match(/(?:crear|nueva|agregar)?\s*alerta?\s+(?:en|de|para)?\s*([A-Z]+)\s+(?:en|de|a)?\s*(\d+[\d,.]*)/i);
    
    if (alertMatch) {
      const symbol = alertMatch[1].toUpperCase();
      const price = parseFloat(alertMatch[2].replace(/,/g, ''));
      
      if (!isNaN(price) && price > 0) {
        const newAlert = createAlert(symbol, price, 'above');
        
        await bot.sendMessage(chatId,
          `✅ *¡Alerta Creada!*

📈 *${symbol}* supere *$${price.toLocaleString('en-US')}*

📋 *ID:* \`${newAlert.id}\`
⏰ *Creada:* ${new Date().toLocaleString('es-CL')}

Cuando el precio llegue a este nivel, recibirás una notificación.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }
    
    // Respuesta por defecto
    await bot.sendMessage(chatId,
      `🤔 No entendí tu mensaje.

Escribe /help para ver los comandos disponibles.

💡 Ejemplo: /alerta BTC 59800 above`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Error handling
bot.on('polling_error', (err) => {
  console.error('⚠️ Error de polling:', err.message);
});

bot.on('error', (err) => {
  console.error('⚠️ Error general:', err.message);
});

console.log('✅ Bot iniciado y escuchando mensajes...\n');
