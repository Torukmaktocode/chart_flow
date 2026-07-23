import TelegramBot from 'node-telegram-bot-api';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) { console.error("❌ Define TELEGRAM_BOT_TOKEN en .env"); process.exit(1); }

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!CHAT_ID) { console.error("❌ Define TELEGRAM_CHAT_ID en .env"); process.exit(1); }

console.log('🤖 INICIANDO BOT DE PRUEBA...');
console.log('='.repeat(50));
console.log(`Token: ${BOT_TOKEN.substring(0, 10)}...`);
console.log(`Chat ID: ${CHAT_ID}`);
console.log('='.repeat(50));

// Crear bot con polling
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Verificar conexión
bot.getMe().then(info => {
  console.log('✅ Bot conectado:');
  console.log(`   Username: @${info.username}`);
  console.log(`   Nombre: ${info.first_name}`);
  console.log(`   ID: ${info.id}`);
}).catch(err => {
  console.error('❌ Error conectando:', err.message);
  process.exit(1);
});

// Escuchar mensajes
console.log('\n👂 Escuchando mensajes...');
console.log('Envía /test al bot para probar\n');

bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from?.first_name || 'Usuario';
  
  console.log(`📩 Mensaje recibido de ${userName} (Chat: ${chatId})`);
  
  // Responder
  const response = `✅ *¡Bot funcionando!*

Hola ${userName}, este es un mensaje de prueba.

⏰ ${new Date().toLocaleString('es-CL')}

Si ves esto, ¡el bot está conectado y funcionando!`;

  try {
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    console.log('✅ Respuesta enviada');
  } catch (err) {
    console.error('❌ Error enviando respuesta:', err.message);
  }
});

// Escuchar todos los mensajes
bot.on('message', (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    console.log(`📩 Mensaje: "${msg.text}" de ${msg.from?.first_name}`);
  }
});

// Error handling
bot.on('polling_error', (err) => {
  console.error('⚠️ Error de polling:', err.message);
});

bot.on('error', (err) => {
  console.error('⚠️ Error general:', err.message);
});

console.log('✅ Bot iniciado y escuchando');
console.log('Presiona Ctrl+C para detener\n');
