import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) { console.error("❌ Define TELEGRAM_BOT_TOKEN en .env"); process.exit(1); }

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!CHAT_ID) { console.error("❌ Define TELEGRAM_CHAT_ID en .env"); process.exit(1); }
const PORT = 8888;

console.log('🚀 INICIANDO SERVIDOR DE PRUEBA CON BOT INTEGRADO');
console.log('='.repeat(50));

// Crear Express app
const app = express();
app.use(express.json());

// Crear bot con polling
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Estado del bot
let botStatus = {
  connected: false,
  username: null,
  messagesReceived: 0,
  messagesSent: 0,
  lastActivity: null
};

// Verificar conexión del bot
bot.getMe().then(info => {
  botStatus.connected = true;
  botStatus.username = info.username;
  console.log('✅ Bot conectado: @' + info.username);
}).catch(err => {
  console.error('❌ Error conectando bot:', err.message);
});

// Ruta de prueba - enviar mensaje
app.get('/send/:message', async (req, res) => {
  const message = req.params.message || 'Mensaje de prueba';
  
  try {
    await bot.sendMessage(CHAT_ID, message);
    botStatus.messagesSent++;
    botStatus.lastActivity = new Date().toISOString();
    res.json({ ok: true, message: 'Mensaje enviado', chatId: CHAT_ID });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Ruta para enviar alerta de prueba
app.get('/alert', async (req, res) => {
  const message = `🔔 *ALERTA DE PRUEBA* 🔔
━━━━━━━━━━━━━━━━━━━━━━

📈 NAS100 SUPERÓ $21,500

💰 Precio Actual: $21,525.50
🎯 Precio Objetivo: $21,500.00

⏰ ${new Date().toLocaleString('es-CL')}

━━━━━━━━━━━━━━━━━━━━━━
🤖 Trading Alert System`;

  try {
    await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
    botStatus.messagesSent++;
    botStatus.lastActivity = new Date().toISOString();
    res.json({ ok: true, message: 'Alerta enviada' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Ruta de estado
app.get('/status', (req, res) => {
  res.json({
    bot: botStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Escuchar comandos del bot
bot.onText(/\/start/, async (msg) => {
  botStatus.messagesReceived++;
  botStatus.lastActivity = new Date().toISOString();
  console.log(`📩 Comando /start de ${msg.from?.first_name}`);
  
  await bot.sendMessage(msg.chat.id, 
    `✅ *Bot Conectado*

Hola ${msg.from?.first_name}!

El bot está funcionando correctamente.

Comandos disponibles:
• /test - Prueba de conexión
• /status - Ver estado del bot
• /alert - Recibir alerta de prueba

⏰ ${new Date().toLocaleString('es-CL')}`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/test/, async (msg) => {
  botStatus.messagesReceived++;
  botStatus.lastActivity = new Date().toISOString();
  console.log(`📩 Comando /test de ${msg.from?.first_name}`);
  
  await bot.sendMessage(msg.chat.id, 
    `✅ *¡Prueba Exitosa!*

Bot funcionando correctamente.

📥 Mensajes recibidos: ${botStatus.messagesReceived}
📤 Mensajes enviados: ${botStatus.messagesSent}
⏰ ${new Date().toLocaleString('es-CL')}`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/status/, async (msg) => {
  botStatus.messagesReceived++;
  console.log(`📩 Comando /status de ${msg.from?.first_name}`);
  
  await bot.sendMessage(msg.chat.id, 
    `📊 *Estado del Bot*

🔌 Conectado: ${botStatus.connected ? '✅ Sí' : '❌ No'}
👤 Username: @${botStatus.username || 'N/A'}
📥 Mensajes recibidos: ${botStatus.messagesReceived}
📤 Mensajes enviados: ${botStatus.messagesSent}
⏰ Última actividad: ${botStatus.lastActivity || 'Ninguna'}`,
    { parse_mode: 'Markdown' }
  );
});

bot.on('message', (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    console.log(`📩 Mensaje de ${msg.from?.first_name}: "${msg.text}"`);
    botStatus.messagesReceived++;
    botStatus.lastActivity = new Date().toISOString();
  }
});

bot.on('polling_error', (err) => {
  console.error('⚠️ Error de polling:', err.message);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🌐 Servidor disponible en: http://127.0.0.1:${PORT}`);
  console.log(`\n📋 Comandos de prueba:`);
  console.log(`   GET http://127.0.0.1:${PORT}/send/Hola`);
  console.log(`   GET http://127.0.0.1:${PORT}/alert`);
  console.log(`   GET http://127.0.0.1:${PORT}/status`);
  console.log(`\n💬 Envía /test al bot para probar`);
  console.log('='.repeat(50));
});
